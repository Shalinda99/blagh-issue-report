# Mock IFS assyst Server

A locally-runnable mock of the **IFS assyst REST API** (`assystREST/v2`), built to let the Similarity Check Index POC retrieve and inspect previously-reported incidents without needing access to a live assyst environment.

The API contract is derived from the official IFS assyst REST API documentation and is documented in [`docs/ASSYST_API_CONTRACT.md`](docs/ASSYST_API_CONTRACT.md).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser  →  React UI (port 5173 / 3000)                │
│                    ↓ axios                              │
│  FastAPI Backend (port 8081)                            │
│    /assystREST/v2/events   ← verified API path          │
│    /mock/admin/*           ← mock-only admin endpoints  │
│    /health                 ← health check               │
│                    ↓ motor (async)                      │
│  MongoDB 7 (port 27017)                                 │
└─────────────────────────────────────────────────────────┘
```

| Service | Technology | Port |
|---|---|---|
| Backend | FastAPI + Uvicorn | `8081` |
| Frontend | React + Vite (dev) / nginx (prod) | `5173` / `3000` |
| Database | MongoDB 7 | `27017` |

---

## Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Docker | 24+ | `docker --version` |
| Docker Compose | v2 (plugin) | `docker compose version` |
| Python | 3.11+ | `python --version` (local dev only) |
| Node.js | 20+ | `node --version` (local dev only) |
| npm | 10+ | `npm --version` (local dev only) |

---

## Quick Start — Docker Compose (Recommended)

```bash
# 1. Clone / navigate to the project
cd similarity_index/mocked_assyst

# 2. Copy environment file
cp .env.example .env

# 3. Start all services (backend + frontend + MongoDB)
docker compose up --build

# 4. Open the UI
#    http://localhost:3000

# 5. Call the API directly
curl -u mock_user:change_me http://localhost:8081/assystREST/v2/events
```

Services start in dependency order: MongoDB → Backend (waits for Mongo health) → Frontend.
The backend auto-seeds **100 realistic incidents** on first startup.

---

## Local Development (No Docker)

Run each service independently for faster iteration.

### 1 — MongoDB

```bash
# Option A — Docker (MongoDB only)
docker compose up mongodb -d

# Option B — local MongoDB
mongod --dbpath /tmp/mock-assyst-db
```

### 2 — Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp ../.env.example .env
# Edit .env: set MONGODB_URI=mongodb://localhost:27017

# Start the API server
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

Backend available at: `http://localhost:8081`
Interactive API docs: `http://localhost:8081/docs`

### 3 — Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server (proxies /assystREST to backend automatically)
npm run dev
```

Frontend available at: `http://localhost:5173`

> The Vite dev server is pre-configured to proxy `/assystREST`, `/health`, and `/mock` to `http://localhost:8081` — no CORS issues in dev mode.

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` | `8081` | Backend listen port |
| `MONGODB_URI` | `mongodb://mongodb:27017` | MongoDB connection string |
| `MONGODB_DATABASE` | `mock_assyst` | Database name |
| `MOCK_AUTH_ENABLED` | `true` | Require Basic Auth on all requests |
| `MOCK_AUTH_USERNAME` | `mock_user` | Basic Auth username |
| `MOCK_AUTH_PASSWORD` | `change_me` | Basic Auth password |
| `MOCK_AUTH_BYPASS` | `false` | Set `true` to skip auth entirely |
| `SEED_DATA_ENABLED` | `true` | Auto-seed on startup |
| `SEED_DATA_COUNT` | `100` | Number of incidents to seed |
| `FAULT_INJECTION_ENABLED` | `false` | Randomly inject errors/delays |
| `FAULT_INJECTION_ERROR_RATE` | `0.0` | Fraction of requests to fail (0.0–1.0) |
| `FAULT_INJECTION_DELAY_MS` | `0` | Extra latency per request (ms) |
| `PAGINATION_DEFAULT_SIZE` | `25` | Default `numberOfRows` |
| `PAGINATION_MAX_SIZE` | `100` | Max `numberOfRows` allowed |
| `CORS_ORIGINS` | `[...]` | Allowed CORS origins (JSON array) |

---

## Project Structure

```
mocked_assyst/
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── main.py            # Application factory, startup
│   │   ├── api/               # Route handlers
│   │   ├── contracts/         # Pydantic models (assystREST schema)
│   │   ├── core/              # Settings, auth, middleware
│   │   ├── database/          # MongoDB connection, repositories
│   │   ├── mock/              # Seed data generator (Faker)
│   │   └── services/          # Business logic
│   ├── tests/                 # pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                  # React + TypeScript UI
│   ├── src/
│   │   ├── api/               # Axios client + endpoint wrappers
│   │   ├── components/        # Reusable UI + layout components
│   │   ├── hooks/             # TanStack Query data hooks
│   │   ├── pages/             # Dashboard, Incidents, Lab, Explorer…
│   │   ├── types/             # TypeScript interfaces (assyst schema)
│   │   └── lib/               # Utility functions
│   ├── package.json
│   └── Dockerfile
│
├── docs/
│   ├── ASSYST_API_CONTRACT.md # API contract research & verification
│   └── TESTING_GUIDE.md       # How to test this mock server
│
├── docker-compose.yml
├── .env.example
└── README.md                  # ← you are here
```

---

## Useful Commands

```bash
# View live backend logs
docker compose logs -f backend

# Reseed the database (via Admin UI or curl)
curl -u mock_user:change_me -X POST \
  "http://localhost:8081/mock/admin/seed?count=200"

# Reset the database (drop + reseed)
curl -u mock_user:change_me -X POST \
  "http://localhost:8081/mock/admin/reset?count=100"

# Check health
curl http://localhost:8081/health

# Stop all services
docker compose down

# Stop and wipe MongoDB volume
docker compose down -v
```

---

## UI Pages

| Page | URL | Description |
|---|---|---|
| Dashboard | `/` | Charts, status summary, recent incidents |
| Incidents | `/incidents` | Filterable, paginated incident table |
| Incident Detail | `/incidents/:id` | Full detail, status update, raw JSON |
| New Incident | `/incidents/new` | Create via POST /events form |
| Similarity Lab | `/similarity` | Client-side Jaccard test against live data |
| API Explorer | `/api-explorer` | Interactive HTTP client for the mock API |
| Settings | `/settings` | Seed/reset DB, change credentials |
| Reference Data | `/users`, `/teams`, `/categories`, `/services` | Reference tables |

---

## Testing

See [`docs/TESTING_GUIDE.md`](docs/TESTING_GUIDE.md) for a complete guide covering:
- Running the automated backend test suite
- Testing all API endpoints with `curl`
- Using the browser-based API Explorer
- Validating the similarity cluster seed data
- Fault injection testing

---

## Relationship to Similarity Check Index POC

This mock server is a **test dependency** of the Similarity Check Index POC. The POC queries:

```
GET /assystREST/v2/events?eventStatus=OPEN&fields=affectedUser,assignedGroup,service,category
```

to retrieve open incidents, then runs its own similarity algorithm. This mock lets the POC run end-to-end locally without a real assyst licence.

Set `SIMILARITY_INDEX_URL` in `.env` to the POC's address so the backend can expose the integration health endpoint.
