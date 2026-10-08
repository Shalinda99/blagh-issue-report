# Similarity Index — End‑to‑End Flow (Plain English)

This document explains how the **Similarity Check Index** project works, from the
moment incidents are created in IFS assyst to the moment a user sees
duplicate / similar incidents in the web UI. It is written to be easy to follow,
even if you have never seen the code.

---

## 1. What this project is trying to do

IT incidents all live in one place:

- **IFS assyst** — the IT service desk system where incidents (tickets) live.
  (In this repo it is faked by the `mocked_assyst` service.)

> **Important:** end users can report issues through the **blagh** widget, but
> every blagh report is **automatically mirrored into assyst**. So assyst is the
> **single source of truth** — the similarity service only needs to read assyst.

The same real‑world problem often gets logged **more than once** in assyst by
different people (or via blagh + directly). That creates duplicate tickets and
wasted effort.

The **Similarity Check Index** is a small, independent microservice that:

1. Pulls recent incidents from assyst.
2. Converts each incident into a mathematical "fingerprint" (an embedding).
3. Stores those fingerprints in a vector database.
4. Compares incidents against each other to find **duplicates / near‑duplicates**.
5. Exposes everything through an API and a React dashboard.

A key design point: this service is **isolated**. It never touches assyst's
database directly — it only talks to it over the public assystREST HTTP API.

---

## 2. The main building blocks

```
similarity_index/
├── similarity-service/   ← the Python backend (FastAPI) — the brain
├── similarity-ui/        ← the React dashboard (what the user sees)
└── mocked_assyst/        ← a fake IFS assyst system used as a data source
```

### Backend internals (`similarity-service/app/`)

| Piece | File | Job in simple terms |
|-------|------|---------------------|
| **Entry point** | `main.py` | Starts the FastAPI web server, enables CORS, exposes `/health`. |
| **Settings** | `config.py` | All knobs: URLs, thresholds, which embedder to use, etc. |
| **Canonical model** | `models.py` | A single standard shape (`CanonicalIssue`) that every assyst incident is converted into. |
| **Connector** | `connectors/assyst_connector.py` | Fetches incidents from assyst and translates them into the canonical shape. |
| **Embedder** | `embeddings/embedder.py` | Turns text into a numeric vector (fingerprint). |
| **Vector store** | `store/vector_store.py` | ChromaDB — stores vectors and finds nearest neighbours. |
| **Metadata store** | `store/metadata_store.py` | SQLite — stores the actual issue rows, detected pairs, and sync history. |
| **Rules** | `similarity/rules.py` | A simple, explainable word‑overlap score. |
| **LLM judge** | `similarity/llm_judge.py` | Optional AI "final say" on whether a pair is a duplicate. |
| **Engine** | `similarity/engine.py` | Orchestrates everything — the actual brain. |
| **API routes** | `api/routes.py` | The HTTP endpoints the UI calls. |

---

## 3. The canonical issue — one shape to rule them all

assyst incidents come back as assystREST JSON. To keep the rest of the code
simple, every incident is converted into a single standard object called
`CanonicalIssue` (`models.py`), with fields like `source` (always `"assyst"`),
`source_id`, `title`, `body`, `priority`, `category`, `status`, `created_at`.

> This canonical layer means that if another source is ever added later, only a
> new connector is needed — the rest of the pipeline stays unchanged.

Each issue also gets a globally unique id:

```
uid = "<source>:<source_id>"   e.g. "assyst:1234"
```

This `uid` is the key used everywhere (vector DB and SQLite).

There is also a helper `embedding_text()` that stitches together the title, body
and category into one block of text — this is the text that gets turned into a
vector.

---

## 4. How the data flows in — the `sync` process

This is the heart of the system. It is triggered by `POST /api/sync` (the
"Sync" button in the dashboard). Here is what happens step by step inside
`SimilarityEngine.sync()` (`similarity/engine.py`):

1. **Decide the time window.** Default is the last **7 days** (`SYNC_WINDOW_DAYS`).
2. **Record a sync run** in SQLite (so history/status can be shown).
3. **Fetch from assyst.** `AssystConnector.fetch(days)` calls
   `GET /assystREST/v2/events` with Basic Auth, pages through results, and maps
   each incident into a `CanonicalIssue`. This is the **only** data source —
   blagh is not fetched because its reports already live inside assyst.
4. **Clear stale data.** Old assyst records are wiped from both the vector store
   and SQLite, so the result always reflects exactly the requested window.
5. **Embed.** The text of every issue is turned into a vector by the embedder.
6. **Store.** Vectors go into ChromaDB (`vectors.upsert`); the full rows go into
   SQLite (`meta.upsert_issues`).
7. **Detect duplicates.** `detect_duplicates()` runs (see §6) and the resulting
   pairs are saved into SQLite.
8. **Finish the run** and return a summary: how many issues, how many pairs found.

In short: **fetch → normalize → embed → store → compare → save pairs.**

---

## 5. How text becomes a vector (the embedder)

`embeddings/embedder.py` offers two ways to turn text into a vector:

- **HashingEmbedder (default).** Fully offline. It splits text into words, word
  pairs, and character triplets, then "hashes" them into a fixed‑size vector
  (768 numbers). No internet, no model download, deterministic. Surprisingly
  good at catching reworded/near‑duplicate text.
- **SentenceTransformerEmbedder (optional).** Uses a real AI model
  (`all-MiniLM-L6-v2`) for true semantic understanding. Requires a one‑time
  download. Enabled by setting `EMBEDDER=sentence`.

Every vector is **normalized**, which means similarity can be measured with a
simple **cosine** score (closer to 1.0 = more similar).

---

## 6. How duplicates are detected (the scoring)

For each stored issue, `detect_duplicates()` asks the vector store: *"who are
your nearest neighbours?"* (top 5 by default). For every candidate neighbour it
computes a **combined score** out of up to three signals:

1. **Vector score** — cosine similarity of the two fingerprints (semantic match).
2. **Rule score** (`similarity/rules.py`) — a transparent, explainable signal:
   - word overlap (Jaccard) between the two texts, plus
   - a bonus if **priority** matches, plus
   - a bonus if **category** matches.
3. **Title bonus** — if both issues have the exact same title, add +0.20 (a
   strong duplicate signal).

The scores are blended using weights from `config.py`:

```
combined = 0.7 * vector_score + 0.3 * rule_score   (+0.20 if titles match)
```

Then thresholds decide what counts:

- `CANDIDATE_THRESHOLD` (0.35) — minimum to even be recorded as a candidate pair.
- `DUPLICATE_THRESHOLD` (0.62) — score at which something is flagged a duplicate.

### Optional LLM judge

If `LLM_ENABLED` is on and a pair scores above `LLM_JUDGE_THRESHOLD`, the pair is
sent to an OpenAI‑compatible model (`similarity/llm_judge.py`). The model returns
strict JSON: `duplicate` / `not_duplicate`, a confidence, and a short reason.
This is the "final human‑like opinion". If disabled or it fails, the system
simply falls back to the vector + rule scores — nothing breaks.

The final list of pairs is sorted by score (highest first) and saved to SQLite.

---

## 7. The two stores — and why there are two

The project deliberately uses **two databases**:

- **ChromaDB (vector store)** — holds the embeddings and does fast
  nearest‑neighbour search. Incidents live in a single `assyst_issues`
  collection.
- **SQLite (metadata store)** — holds the "ground truth": the full incident
  rows, the detected duplicate pairs, and the history of sync runs.

Think of it as: **Chroma knows which issues are similar; SQLite knows what the
issues actually are.**

---

## 8. The real‑time single‑issue check (`/api/check`)

Besides the batch `sync`, there is a lighter endpoint for checking **one** issue
on the spot — meant to be called the moment a new incident is created, to warn
"this might be a duplicate of INC000123".

`SimilarityEngine.check()` does:

1. Build a canonical issue from the incoming title/body/priority/category.
2. Embed it.
3. Query the assyst collection for nearest neighbours.
4. Score each neighbour exactly like §6 (vector + rules + title bonus).
5. Return the matches, flag whether any crossed the duplicate threshold, and
   list the matching refs/ids.
6. Optionally **index** the new issue (if it has a `source_id`) so future checks
   can match against it.

> In this repo the `mocked_assyst` service does **not** automatically call this
> endpoint when creating an event — `check` is available for integration but is
> currently driven manually / via the API, not wired into assyst's create flow.
> Because blagh reports are mirrored into assyst, any new incident is picked up
> by the next `sync` regardless.

---

## 9. The HTTP API (what the UI can call)

Defined in `api/routes.py`, all under the `/api` prefix:

| Method & path | What it does |
|---------------|--------------|
| `POST /api/sync` | Fetch, embed, store, and detect duplicates (the big one). |
| `GET /api/issues` | List stored incidents. Supports an optional `?q=<text>` search over title/body. |
| `GET /api/issues/{uid}` | One issue's details plus its nearest matches. |
| `POST /api/detect` | Re‑run duplicate detection on already‑stored issues (no re‑fetch). |
| `GET /api/duplicates` | List detected duplicate pairs. |
| `POST /api/check` | Real‑time duplicate check for a single issue (§8). |
| `POST /api/compare` | Ad‑hoc: paste two free texts and see how similar they are. |
| `GET /api/stats` | Counts, last run info, and current config. |
| `POST /api/reset` | Wipe everything (handy for demos). |
| `GET /health` | Simple health check. |

---

## 10. The frontend (what the user sees)

The React app in `similarity-ui/` (`App.jsx`) is a dashboard with four pages:

- **Dashboard** — overview stats, the **Sync** button, last run status.
- **Issues** — the list of indexed issues; click one to see its nearest matches.
- **Duplicates** — the detected duplicate pairs with their scores.
- **Compare Lab** — paste any two texts and instantly see vector/rule/combined
  scores (great for experimenting).

All pages talk to the backend through one thin client in
`src/api/client.js` (using axios). In development, Vite proxies `/api` and
`/health` to the backend running on port **8090**; in production the base URL
comes from `VITE_API_BASE_URL`.

---

## 11. The whole journey in one picture

```
   (blagh reports are mirrored into assyst upstream)
                      │
                      ▼
              ┌──────────────┐
              │ mocked assyst │   ← single source of truth
              └──────┬───────┘
                     │  (assystREST HTTP API only)
                     ▼
            ┌───────────────────┐
            │ Assyst Connector  │  normalize → CanonicalIssue
            └─────────┬─────────┘
                      ▼
                 ┌─────────┐
                 │ Embedder │  text → vector fingerprint
                 └────┬─────┘
          ┌───────────┴───────────┐
          ▼                       ▼
   ┌─────────────┐        ┌───────────────┐
   │  ChromaDB    │        │    SQLite      │
   │ (assyst_     │        │ (incident rows,│
   │  issues)     │        │  pairs, runs)  │
   └──────┬───────┘        └──────┬────────┘
          └───────────┬───────────┘
                      ▼
            ┌───────────────────┐
            │ Similarity Engine  │  vector + rules (+ optional LLM)
            │  → duplicate pairs │
            └─────────┬─────────┘
                      ▼
               ┌────────────┐
               │  FastAPI    │  /api/sync, /api/duplicates, ...
               └─────┬──────┘
                      ▼
               ┌────────────┐
               │ React UI    │  Dashboard · Issues · Duplicates · Compare
               └────────────┘
```

---

## 12. Quick recap in one paragraph

A user clicks **Sync** in the dashboard. The backend pulls recent assyst
incidents over HTTP (assyst is the single source of truth — blagh reports are
already mirrored into it), converts them into a standard shape, turns each one's
text into a numeric fingerprint, and stores those fingerprints in ChromaDB and
the full records in SQLite. It then compares every incident against its nearest
neighbours using a blend of **vector similarity**, **simple word/priority/category
rules**, and (optionally) an **LLM judge**, producing a ranked list of likely
duplicate pairs. The React dashboard reads this through the API so the user can
browse incidents (with optional text search), inspect matches, review
duplicates, and experiment in the Compare Lab. A separate `/api/check` endpoint
allows checking a single new incident for duplicates in real time.
