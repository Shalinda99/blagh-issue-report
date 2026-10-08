# Similarity Check Index — Service

An **isolated** microservice that detects duplicate / similar incidents in **IFS
assyst** (here, the local `mocked_assyst` server). Issues reported by end users
through the blagh widget are mirrored into assyst, so assyst is treated as the
single source of truth.

It pulls the **latest N days** (default 7) of incidents over the public
assystREST API, stores them in a **vector DB (ChromaDB)** and a **relational DB
(SQLite)**, then flags likely duplicates using **three combined mechanisms**:

1. **Vector DB comparison** — cosine similarity over text embeddings.
2. **Rule-based scoring** — token Jaccard overlap + priority/category bonuses.
3. **LLM comparison (optional)** — a Groq (OpenAI-compatible) agent reasons over
   title + description + priority + category and returns a similarity score,
   verdict, and the matching / differing factors. Used on demand in the Compare
   Lab and to confirm strong candidates during `sync`.

```
mock assyst ──▶ Similarity Index ──┬── ChromaDB (assyst_issues)
                  (this service)   └── SQLite  (issues, pairs, sync runs)
                        │
                        ▼
                 similarity-ui (React)
```

The service never touches the other systems' databases — it is a pure API client.

---

## Quick start (local)

```bash
cd similarity_index/similarity-service

python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # adjust URLs/credentials if needed

uvicorn app.main:app --reload --port 8090
```

- API docs: http://localhost:8090/docs
- Health:   http://localhost:8090/health

> **Prerequisites for a full sync:** the `mocked_assyst` backend running on
> `:8081` with data in the last 7 days (the assyst mock auto-seeds).

---

## Configuration

All config is via environment variables (see `.env.example`). Highlights:

| Variable | Default | Purpose |
|---|---|---|
| `ASSYST_BASE_URL` | `http://localhost:8081` | mock assyst base URL |
| `ASSYST_USERNAME` / `ASSYST_PASSWORD` | `mock_user` / `change_me` | Basic Auth |
| `SYNC_WINDOW_DAYS` | `7` | how far back to fetch |
| `EMBEDDER` | `hashing` | `hashing` (offline) or `sentence` (semantic) |
| `VECTOR_WEIGHT` / `RULE_WEIGHT` | `0.7` / `0.3` | blend of the two scores |
| `DUPLICATE_THRESHOLD` | `0.72` | combined score to flag a duplicate |
| `LLM_PROVIDER` | `groq` | `groq` or `openai` (both OpenAI-compatible) |
| `GROQ_API_KEY` | – | Groq key; enables LLM comparison in the Compare Lab |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq chat model used by the agent |
| `LLM_ENABLED` | `true` | also run the LLM judge during `sync` |

### Embedding modes

- **`hashing`** (default): deterministic word + char n-gram feature hashing.
  Zero downloads, fully offline, great for a POC demo.
- **`sentence`**: true semantic embeddings via `sentence-transformers`. Uncomment
  the dependency in `requirements.txt`, `pip install` it, set `EMBEDDER=sentence`.
  Downloads the model once on first run.

---

## API

| Method | Path | Description |
|---|---|---|
| POST | `/api/sync` | Fetch assyst incidents, embed, store, detect duplicates. Body: `{ "days": 7, "run_llm": false }` |
| GET | `/api/issues?q=<text>` | List stored incidents (optional title/body search) |
| GET | `/api/issues/{uid}` | Issue detail + nearest matches |
| GET | `/api/duplicates` | Detected duplicate pairs |
| POST | `/api/compare` | Ad-hoc compare two free-text issues |
| GET | `/api/stats` | Counts, last run, config |
| POST | `/api/reset` | Wipe all stored data |

### Example

```bash
# Run a sync over the last 7 days
curl -X POST http://localhost:8090/api/sync -H 'Content-Type: application/json' -d '{"days":7}'

# See detected duplicates
curl 'http://localhost:8090/api/duplicates'

# Ad-hoc compare
curl -X POST http://localhost:8090/api/compare -H 'Content-Type: application/json' \
  -d '{"text_a":"login button not working on checkout","text_b":"cannot click the login button at payment"}'
```

---

## How duplicate detection works

1. Each incident is normalized to a `CanonicalIssue` (`title + body + category`).
2. Text is embedded and upserted into the assyst Chroma collection.
3. For every incident we query the collection for the top-K nearest neighbours.
4. Each candidate pair gets `combined = VECTOR_WEIGHT·cosine + RULE_WEIGHT·rule`.
5. Pairs above `CANDIDATE_THRESHOLD` are stored; those above `DUPLICATE_THRESHOLD`
   are treated as duplicates. If the LLM judge is enabled, the strongest pairs get
   a final `duplicate` / `not_duplicate` verdict with a reason.
