# Issue Report

A platform for reporting, managing, and de-duplicating issues. End users submit
reports via an embeddable widget; admins triage them in a dashboard; a separate
service flags likely duplicate incidents.

## Directory Overview

### Core (Blagh)

- **`blagh-service/`** — Core backend API. Python · FastAPI · MongoDB · MinIO. Exposes the REST endpoints consumed by both BFFs and the widget (port 8002).
- **`blagh-ui/`** — Embeddable widget. A single `blagh.js` file that injects a floating "Report Issue" button into any host web app via one `<script>` tag (served on port 3000).
- **`blagh-ui-bff/`** — NestJS Backend-for-Frontend between the `blagh.js` widget and `blagh-service`. Handles report submission, lookup, and consent (port 4001).
- **`blagh-admin-ui/`** — React + Vite admin dashboard for viewing and managing submitted reports (port 5175).
- **`blagh-admin-bff/`** — NestJS Backend-for-Frontend between the admin UI and `blagh-service`. Handles session cookies and Keycloak SSO (port 4000).
- **`blagh-mock-ui/`** — Sample HR portal used to test the widget end-to-end (simulates a real host app with the embedded button).

### Similarity Index

- **`similarity_index/`** — Independent subsystem for detecting duplicate / similar incidents. See `PROJECT_FLOW.md` for the end-to-end flow.
  - **`similarity-service/`** — Microservice that pulls recent incidents, stores them in a vector DB (ChromaDB) and SQLite, and flags likely duplicates.
  - **`similarity-ui/`** — React + Vite + Tailwind frontend for viewing similarity results.
  - **`mocked_assyst/`** — Local stand-in for the IFS assyst service desk (the source of truth for incidents), with its own backend and frontend.

## Running Locally

**Prerequisites:** Node.js 18+, Python 3.11+, MongoDB, MinIO (for `blagh-service`),
and Docker (for `mocked_assyst`). Each directory has its own `README.md` with full
details. Start services in dependency order (one terminal each).

### Core (Blagh) widget stack

```bash
# 1. Backend API — blagh-service (port 8002)
cd blagh-service
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                               # set MONGODB_URL, SECRET_KEY, INITIAL_ADMIN_PASSWORD
uvicorn app.main:app --port 8002 --reload

# 2. Widget BFF — blagh-ui-bff (port 4001)
cd blagh-ui-bff
npm install
cp .env.example .env                               # set BACKEND_URL
npm run start:dev

# 3. Widget dev server — blagh-ui (serves blagh.js on port 3000)
cd blagh-ui
npm start

# 4. Mock host app — blagh-mock-ui (port 5173)
cd blagh-mock-ui
npm install
npm run dev
```

Open http://localhost:5173, log in, and click **"Report Issue"**.

### Admin dashboard

```bash
# 5. Admin BFF — blagh-admin-bff (port 4000)
cd blagh-admin-bff
npm install
cp .env.example .env                               # set BACKEND_URL, KEYCLOAK_USERINFO_URL, service account creds
npm run start:dev

# 6. Admin UI — blagh-admin-ui (port 5175)
cd blagh-admin-ui
npm install
cp .env.example .env                               # set VITE_API_URL and Keycloak config
npm run dev
```

Open http://localhost:5175.

### Similarity Index

```bash
# 7. Mock IFS assyst — mocked_assyst (backend :8081, UI :3000, MongoDB :27017)
cd similarity_index/mocked_assyst
cp .env.example .env
docker compose up --build

# 8. Similarity service — similarity-service (port 8090)
cd similarity_index/similarity-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8090

# 9. Similarity UI — similarity-ui (port 3100)
cd similarity_index/similarity-ui
npm install
npm run dev
```

Open http://localhost:3100 (service API docs at http://localhost:8090/docs).
