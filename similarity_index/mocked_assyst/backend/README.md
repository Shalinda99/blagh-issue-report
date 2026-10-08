# Backend — Mock IFS assyst REST API

FastAPI application that reproduces the `assystREST/v2` API contract backed by MongoDB.

---

## Stack

| Component | Library | Version |
|---|---|---|
| Web framework | FastAPI | 0.111.1 |
| ASGI server | Uvicorn | 0.30.1 |
| Data validation | Pydantic v2 | 2.7.4 |
| Async MongoDB driver | Motor | 3.4.0 |
| Seed data generation | Faker | 25.9.2 |
| Testing | pytest + pytest-asyncio | 8.2.2 |

---

## Local Setup

### 1. Create virtual environment

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp ../.env.example .env
```

For local dev (MongoDB on localhost, not Docker):

```bash
# Edit .env — change this line:
MONGODB_URI=mongodb://localhost:27017
```

### 4. Start MongoDB

```bash
# Quickest: spin up only MongoDB via Docker Compose
docker compose -f ../docker-compose.yml up mongodb -d
```

### 5. Run the server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload
```

- **API base:** `http://localhost:8081/assystREST/v2`
- **Swagger UI:** `http://localhost:8081/docs`
- **ReDoc:** `http://localhost:8081/redoc`
- **Health:** `http://localhost:8081/health`

---

## Application Structure

```
app/
├── main.py              # App factory, lifespan (startup seed, shutdown)
├── api/
│   ├── events.py        # GET/POST/PUT/DELETE /assystREST/v2/events
│   ├── reference.py     # Users, groups, categories, services
│   └── admin.py         # Mock-only: /mock/admin/stats|config|seed|reset
├── contracts/
│   ├── event.py         # AssystEvent Pydantic model (assystREST schema)
│   ├── reference.py     # AssystUser, SupportGroup, Category, Service
│   └── responses.py     # Health, admin stats response models
├── core/
│   ├── config.py        # Settings (pydantic-settings from env)
│   ├── auth.py          # HTTP Basic Auth dependency
│   └── middleware.py    # Fault injection middleware
├── database/
│   ├── connection.py    # Motor client, database/collection accessors
│   └── repositories/   # EventRepository, ReferenceRepository (CRUD)
├── mock/
│   └── seeder.py        # Faker-based seed data generator
└── services/
    └── event_service.py # Filter building, field expansion logic
```

---

## Key API Endpoints

### Verified assystREST contract paths

| Method | Path | Description |
|---|---|---|
| `GET` | `/assystREST/v2/events` | List events (paginated, filterable) |
| `GET` | `/assystREST/v2/events/{id}` | Get single event |
| `POST` | `/assystREST/v2/events` | Create event → `201 Created` |
| `PUT` | `/assystREST/v2/events/{id}` | Update event |
| `DELETE` | `/assystREST/v2/events/{id}` | Delete event → `204 No Content` |

### Query parameters for GET /events

| Parameter | Type | Description |
|---|---|---|
| `startRow` | int | 0-based row offset (pagination) |
| `numberOfRows` | int | Page size (max: `PAGINATION_MAX_SIZE`) |
| `eventType` | string | `INCIDENT \| PROBLEM \| CHANGE \| SERVICE_REQUEST` |
| `eventStatus` | string | `OPEN \| IN_PROGRESS \| PENDING \| RESOLVED \| CLOSED` |
| `priorityCode` | string | `P1 \| P2 \| P3 \| P4` |
| `creationDate` | string | `from,to` ISO-8601 range (comma-separated) |
| `fields` | string | Comma-separated relation expansion |
| `sortField` | string | Field name to sort by |
| `sortOrder` | string | `asc \| desc` |

### Mock-only admin paths

| Method | Path | Description |
|---|---|---|
| `GET` | `/mock/admin/stats` | Event/user/group counts |
| `GET` | `/mock/admin/config` | Current server configuration |
| `POST` | `/mock/admin/seed?count=N` | Insert N seeded events |
| `POST` | `/mock/admin/reset?count=N` | Drop all + reseed |
| `GET` | `/health` | Health check (no auth required) |

---

## Running Tests

```bash
# All tests, verbose
pytest tests/ -v

# Contract tests only
pytest tests/test_contract.py -v

# Integration tests only
pytest tests/test_integration.py -v

# Stop on first failure, show locals
pytest tests/ -x -l

# With coverage (install pytest-cov first)
pip install pytest-cov
pytest tests/ --cov=app --cov-report=term-missing
```

### Test configuration

Tests use `pytest-asyncio` and `httpx` for async ASGI testing — no running server needed.
The test `conftest.py` creates an in-memory test client and seeds a small dataset before each test module.

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `Mock IFS assyst REST API` | Name shown in docs |
| `APP_HOST` | `0.0.0.0` | Bind address |
| `APP_PORT` | `8081` | Listen port |
| `APP_ENV` | `development` | Environment tag |
| `MONGODB_URI` | `mongodb://mongodb:27017` | Connection string |
| `MONGODB_DATABASE` | `mock_assyst` | Database name |
| `ASSYST_API_VERSION` | `v2` | API version prefix |
| `ASSYST_BASE_PATH` | `/assystREST/v2` | Route prefix |
| `MOCK_AUTH_ENABLED` | `true` | Require Basic Auth |
| `MOCK_AUTH_USERNAME` | `mock_user` | Username |
| `MOCK_AUTH_PASSWORD` | `change_me` | Password |
| `MOCK_AUTH_BYPASS` | `false` | Skip auth entirely |
| `SEED_DATA_ENABLED` | `true` | Seed on startup |
| `SEED_DATA_COUNT` | `100` | Incidents to seed |
| `FAULT_INJECTION_ENABLED` | `false` | Enable random errors/delays |
| `FAULT_INJECTION_ERROR_RATE` | `0.0` | Error fraction 0.0–1.0 |
| `FAULT_INJECTION_DELAY_MS` | `0` | Extra latency (ms) |
| `PAGINATION_DEFAULT_SIZE` | `25` | Default page size |
| `PAGINATION_MAX_SIZE` | `100` | Maximum page size |
| `CORS_ORIGINS` | `[...]` | JSON array of allowed origins |

---

## Docker

```bash
# Build image only
docker build -t mock-assyst-backend .

# Run with Docker Compose (recommended)
docker compose up backend -d

# View logs
docker compose logs -f backend

# Shell into container
docker compose exec backend bash
```
