# Testing Guide — Mock IFS assyst Server

This guide covers every testing surface of the mock server: automated tests, manual `curl` testing, the browser-based API Explorer, the Similarity Lab UI, and fault injection.

---

## Table of Contents

1. [Pre-flight Checklist](#1-pre-flight-checklist)
2. [Running the Automated Backend Tests](#2-running-the-automated-backend-tests)
3. [Health & Auth Verification](#3-health--auth-verification)
4. [Testing the Events API (curl)](#4-testing-the-events-api-curl)
5. [Testing Pagination](#5-testing-pagination)
6. [Testing Filters](#6-testing-filters)
7. [Testing Field Expansion](#7-testing-field-expansion)
8. [Testing Write Operations (POST / DELETE)](#8-testing-write-operations-post--delete)
9. [Testing Reference Data Endpoints](#9-testing-reference-data-endpoints)
10. [Testing Admin Endpoints](#10-testing-admin-endpoints)
11. [Browser-Based API Explorer](#11-browser-based-api-explorer)
12. [Similarity Lab](#12-similarity-lab)
13. [Fault Injection Testing](#13-fault-injection-testing)
14. [Contract Compliance Notes](#14-contract-compliance-notes)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Pre-flight Checklist

Before testing, confirm all services are up:

```bash
# All containers should show "Up" or "healthy"
docker compose ps

# Backend health endpoint — should return {"status": "ok"}
curl http://localhost:8081/health

# Backend API docs (Swagger UI)
open http://localhost:8081/docs
```

Set a shell alias for convenience throughout this guide:

```bash
export AUTH="-u mock_user:change_me"
export BASE="http://localhost:8081/assystREST/v2"
```

---

## 2. Running the Automated Backend Tests

The test suite lives in `backend/tests/` and uses **pytest + pytest-asyncio**.

### With Docker (no local Python needed)

```bash
# Run tests inside the running container
docker compose exec backend pytest tests/ -v

# With coverage
docker compose exec backend pytest tests/ -v --tb=short
```

### With local Python (faster iteration)

```bash
cd backend
source .venv/bin/activate

# Run all tests
pytest tests/ -v

# Run only contract compliance tests
pytest tests/test_contract.py -v

# Run only integration tests
pytest tests/test_integration.py -v

# Run a single test by name
pytest tests/test_contract.py::test_list_events_bare_array -v

# Stop on first failure
pytest tests/ -x -v
```

### What the tests cover

| File | Coverage |
|---|---|
| `test_contract.py` | Verifies the response shape matches the official assystREST contract (bare JSON array, field names, date format, pagination parameters) |
| `test_integration.py` | End-to-end flows: create → read → update → delete, filter combinations, auth rejection |

---

## 3. Health & Auth Verification

### Health check (no auth required)

```bash
curl -s http://localhost:8081/health | python -m json.tool
```

Expected:
```json
{"status": "ok", "database": "connected", "version": "v2"}
```

### Auth required on API routes

```bash
# Should return 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/assystREST/v2/events
# → 401

# Should return 200
curl -s -o /dev/null -w "%{http_code}" $AUTH $BASE/events
# → 200
```

### Wrong credentials

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -u wrong_user:wrong_pass http://localhost:8081/assystREST/v2/events
# → 401
```

### Bypass auth (dev only)

Set `MOCK_AUTH_BYPASS=true` in `.env` and restart:
```bash
curl -s http://localhost:8081/assystREST/v2/events | python -m json.tool
# → 200, no credentials needed
```

---

## 4. Testing the Events API (curl)

### List all events (verified contract path)

```bash
curl -s $AUTH "$BASE/events" | python -m json.tool
```

**Key contract facts verified:**
- Response is a **bare JSON array** `[{...}, {...}]` — not wrapped in `{items: [...]}`.
- Each event has `id`, `eventRef`, `shortDescription`, `eventStatus`, `priorityCode`, `creationDate`.

```bash
# Count returned events
curl -s $AUTH "$BASE/events" | python -m json.tool | grep '"id"' | wc -l
```

### Get a single event by ID

```bash
# Get the first event's ID
ID=$(curl -s $AUTH "$BASE/events?numberOfRows=1" | python -m json.tool | grep '"id"' | head -1 | grep -oP '\d+')

curl -s $AUTH "$BASE/events/$ID" | python -m json.tool
```

### Verify date format

Dates must be ISO-8601 with milliseconds: `2026-01-15T09:23:11.000Z`

```bash
curl -s $AUTH "$BASE/events?numberOfRows=1" | python -m json.tool | grep "Date"
```

---

## 5. Testing Pagination

The verified parameters are `startRow` (0-based offset) and `numberOfRows` (page size).

```bash
# Page 1 — rows 0–9
curl -s $AUTH "$BASE/events?startRow=0&numberOfRows=10" | python -m json.tool | grep '"eventRef"'

# Page 2 — rows 10–19
curl -s $AUTH "$BASE/events?startRow=10&numberOfRows=10" | python -m json.tool | grep '"eventRef"'

# Page 3 — rows 20–29
curl -s $AUTH "$BASE/events?startRow=20&numberOfRows=10" | python -m json.tool | grep '"eventRef"'
```

Verify the refs do **not overlap** between pages.

### Maximum page size

```bash
# numberOfRows capped at PAGINATION_MAX_SIZE (default 100)
curl -s $AUTH "$BASE/events?numberOfRows=9999" | python -m json.tool | python -c "import sys,json; d=json.load(sys.stdin); print(len(d))"
# → 100
```

---

## 6. Testing Filters

### Filter by event status

```bash
# Open incidents
curl -s $AUTH "$BASE/events?eventStatus=OPEN" | python -m json.tool | grep '"eventStatus"'

# Resolved only
curl -s $AUTH "$BASE/events?eventStatus=RESOLVED" | python -m json.tool | grep '"eventStatus"'

# All status values: OPEN | IN_PROGRESS | PENDING | RESOLVED | CLOSED
```

### Filter by priority

```bash
curl -s $AUTH "$BASE/events?priorityCode=P1" | python -m json.tool | grep '"priorityCode"'
# All should show "priorityCode": "P1"
```

### Filter by event type

```bash
curl -s $AUTH "$BASE/events?eventType=INCIDENT" | python -m json.tool | grep '"eventType"'
curl -s $AUTH "$BASE/events?eventType=CHANGE" | python -m json.tool | grep '"eventType"'
# Types: INCIDENT | PROBLEM | CHANGE | SERVICE_REQUEST
```

### Date range filter (verified contract format)

The `creationDate` filter uses a **comma-separated `from,to` range**:

```bash
# From a specific date onwards (open-ended)
curl -s $AUTH "$BASE/events?creationDate=2026-01-01T00:00:00Z," | python -m json.tool | grep '"creationDate"'

# Specific date range
curl -s $AUTH "$BASE/events?creationDate=2026-01-01T00:00:00Z,2026-06-30T23:59:59Z" \
  | python -m json.tool | grep '"creationDate"'
```

### Combined filters

```bash
curl -s $AUTH "$BASE/events?eventStatus=OPEN&priorityCode=P1&numberOfRows=5" | python -m json.tool
```

### Sorting

```bash
# Sort by creation date ascending
curl -s $AUTH "$BASE/events?sortField=creationDate&sortOrder=asc&numberOfRows=5" \
  | python -m json.tool | grep '"creationDate"'

# Sort by priority descending
curl -s $AUTH "$BASE/events?sortField=priorityCode&sortOrder=desc&numberOfRows=5" \
  | python -m json.tool | grep '"priorityCode"'
```

---

## 7. Testing Field Expansion

The `fields` query parameter triggers nested object expansion (verified contract behaviour).

```bash
# Without expansion — IDs only
curl -s $AUTH "$BASE/events/$(curl -s $AUTH "$BASE/events?numberOfRows=1" | python -m json.tool | grep '"id"' | grep -oP '\d+' | head -1)" \
  | python -m json.tool | grep -E '"affectedUser|assignedGroup|service|category'

# With full expansion
ID=$(curl -s $AUTH "$BASE/events?numberOfRows=1" | python -m json.tool | grep '"id"' | grep -oP '\d+' | head -1)
curl -s $AUTH "$BASE/events/$ID?fields=affectedUser,assignedGroup,service,category" \
  | python -m json.tool
```

Expected difference:
- **Without** `fields`: `"affectedUserId": 1001`, `"assignedGroupId": 2001`
- **With** `fields=affectedUser,assignedGroup`: nested objects `"affectedUser": {"id": 1001, "name": "..."}`

---

## 8. Testing Write Operations (POST / DELETE)

### Create an incident (POST)

```bash
curl -s $AUTH -X POST "$BASE/events" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "INCIDENT",
    "shortDescription": "Test incident created via curl",
    "remarks": "This is a test for the mock server write path.",
    "priorityCode": "P2"
  }' | python -m json.tool
```

Expected: `201 Created` with the full event object including generated `id` and `eventRef`.

### Update an incident (PUT)

```bash
# Capture the ID of the created event
NEW_ID=$(curl -s $AUTH -X POST "$BASE/events" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"INCIDENT","shortDescription":"Update test","priorityCode":"P3"}' \
  | python -m json.tool | grep '"id"' | grep -oP '\d+')

# Update its status
curl -s $AUTH -X PUT "$BASE/events/$NEW_ID" \
  -H "Content-Type: application/json" \
  -d '{"eventStatus": "RESOLVED", "resolutionRemarks": "Resolved via API test"}' \
  | python -m json.tool

# Verify
curl -s $AUTH "$BASE/events/$NEW_ID" | python -m json.tool | grep '"eventStatus"'
# → "eventStatus": "RESOLVED"
```

### Delete an incident (DELETE)

```bash
curl -s -o /dev/null -w "%{http_code}" $AUTH -X DELETE "$BASE/events/$NEW_ID"
# → 204

# Verify it's gone — should return 404
curl -s -o /dev/null -w "%{http_code}" $AUTH "$BASE/events/$NEW_ID"
# → 404
```

---

## 9. Testing Reference Data Endpoints

> **Note:** These endpoint paths are **provisional** (⚠️ not yet verified against the official contract). They are mock-only implementations.

```bash
# Users
curl -s $AUTH "http://localhost:8081/assystREST/v2/assystUsers" | python -m json.tool

# Support Groups
curl -s $AUTH "http://localhost:8081/assystREST/v2/supportGroups" | python -m json.tool

# Categories (with sub-categories)
curl -s $AUTH "http://localhost:8081/assystREST/v2/categories" | python -m json.tool

# Services
curl -s $AUTH "http://localhost:8081/assystREST/v2/services" | python -m json.tool
```

---

## 10. Testing Admin Endpoints

These are **mock-only** endpoints (not part of the assystREST contract) for controlling the mock environment.

```bash
# View statistics
curl -s $AUTH http://localhost:8081/mock/admin/stats | python -m json.tool

# View server configuration
curl -s $AUTH http://localhost:8081/mock/admin/config | python -m json.tool

# Seed additional events (inserts, does not drop existing)
curl -s $AUTH -X POST "http://localhost:8081/mock/admin/seed?count=50" | python -m json.tool

# Reset — drop all data and fully reseed
curl -s $AUTH -X POST "http://localhost:8081/mock/admin/reset?count=200" | python -m json.tool
```

---

## 11. Browser-Based API Explorer

The frontend ships an interactive API client at **`http://localhost:5173/api-explorer`** (dev) or **`http://localhost:3000/api-explorer`** (Docker).

### How to use it

1. Open the API Explorer page.
2. Select a pre-built endpoint from the left sidebar (or type a custom path).
3. Change the HTTP method (GET / POST / DELETE) if needed.
4. For POST, edit the request body JSON in the textarea.
5. Click **Send** — the response appears in the terminal panel with HTTP status and elapsed time.
6. Click **Copy** to copy the raw JSON response.

### Recommended test sequence in the Explorer

| Step | Endpoint | What to verify |
|---|---|---|
| 1 | `GET /assystREST/v2/events?startRow=0&numberOfRows=10` | Bare array response |
| 2 | `GET /assystREST/v2/events/10000001` | Single event object |
| 3 | `GET /assystREST/v2/events/10000001?fields=affectedUser,assignedGroup,service,category` | Nested expansion |
| 4 | `GET /assystREST/v2/events?eventStatus=OPEN&numberOfRows=5` | Status filter |
| 5 | `POST /assystREST/v2/events` | Create with default body |
| 6 | `GET /mock/admin/stats` | Database counts |

---

## 12. Similarity Lab

The Similarity Lab is a **mock-only browser tool** at `/similarity` that validates the seeded similarity clusters.

### How to use it

1. Open `http://localhost:5173/similarity`.
2. Click one of the pre-loaded cluster queries, e.g. *"Unable to log into the employee portal"*.
3. Adjust the **similarity threshold** slider (default 0.20). Lower = more results.
4. Click **Search** — the tool fetches all incidents from the API and computes Jaccard token overlap on the client.
5. Results are scored and ranked. Incidents from the same seeded cluster should score significantly higher than unrelated ones.

### What to expect

The seed data includes **4 similarity clusters** (incidents that share description vocabulary):

| Cluster seed phrase | Expected high-scoring cluster size |
|---|---|
| "Unable to log into the employee portal" | ~5–10 incidents |
| "Production database connection refused" | ~5–10 incidents |
| "API gateway returning 504 timeout errors" | ~5–10 incidents |
| "Production deployment failed — service unavailable" | ~5–10 incidents |

If no cluster matches appear at threshold 0.20, try lowering to 0.10 or reseed with more data via Settings.

---

## 13. Fault Injection Testing

The mock server supports controlled fault injection to test client resilience.

### Enable via environment

Edit `.env`:

```bash
FAULT_INJECTION_ENABLED=true
FAULT_INJECTION_ERROR_RATE=0.3      # 30% of requests return 500
FAULT_INJECTION_DELAY_MS=500        # Add 500ms latency to every request
```

Then restart the backend:

```bash
docker compose restart backend
# or locally: restart uvicorn
```

### Test that your client handles errors gracefully

```bash
# Run 10 requests — expect ~3 failures
for i in $(seq 1 10); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $AUTH "$BASE/events?numberOfRows=1")
  echo "Request $i: $STATUS"
done
```

### Test timeout handling

Set `FAULT_INJECTION_DELAY_MS=10000` (10 seconds) and confirm your HTTP client's timeout fires before the response arrives.

---

## 14. Contract Compliance Notes

The following table summarises which assystREST behaviours are **verified** from the official docs vs. **provisional** (inferred from common REST patterns):

| Behaviour | Status | Notes |
|---|---|---|
| `GET /assystREST/v2/events` returns bare JSON array | ✅ Verified | Not `{"items": [...]}` wrapper |
| Pagination via `startRow` + `numberOfRows` | ⚠️ Provisional | Official doc parameter names uncertain |
| `fields` query param triggers nested expansion | ✅ Verified | `affectedUser`, `assignedGroup`, `service`, `category` confirmed |
| Date format: `YYYY-MM-DDTHH:MM:SS.sssZ` | ✅ Verified | ISO-8601 with milliseconds |
| `creationDate` range as `from,to` comma string | ✅ Verified | Open-ended with trailing comma |
| POST `201 Created` for new events | ✅ Verified | Standard REST |
| Basic Auth via `Authorization: Basic <b64>` | ✅ Verified | Standard HTTP Basic |
| `/assystREST/v2/assystUsers` user endpoint | ⚠️ Provisional | Path unverified |
| `/assystREST/v2/supportGroups` team endpoint | ⚠️ Provisional | Path unverified |
| `eventRef` format `INC-XXXXXXXX` | ⚠️ Provisional | Format assumed |

See [`ASSYST_API_CONTRACT.md`](ASSYST_API_CONTRACT.md) for the full research notes.

---

## 15. Troubleshooting

### Backend not starting

```bash
docker compose logs backend
```

Common causes:
- MongoDB not yet healthy — wait 15–20s and retry.
- Port `8081` already in use: `lsof -i :8081`

### MongoDB connection error

```bash
# Check MongoDB is healthy
docker compose ps mongodb

# Test connection directly
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### 401 on all requests

- Confirm `MOCK_AUTH_USERNAME` / `MOCK_AUTH_PASSWORD` match your credentials.
- Check `MOCK_AUTH_ENABLED=true` in your `.env`.
- Or set `MOCK_AUTH_BYPASS=true` for unauthenticated local testing.

### Frontend shows "API Offline"

The frontend health indicator calls `GET /health`. If it shows red:
1. Confirm the backend is running: `curl http://localhost:8081/health`
2. Check CORS — in Docker, the frontend container calls the backend by service name. In dev mode, the Vite proxy handles this automatically.

### Empty results / no incidents

The backend seeds on startup only if the collection is empty. If you wiped and restarted:
```bash
curl -s $AUTH -X POST "http://localhost:8081/mock/admin/seed?count=100"
```

### Port conflicts (all services)

| Service | Port | Fix |
|---|---|---|
| Backend | `8081` | Change `APP_PORT` in `.env` and update `docker-compose.yml` |
| Frontend | `3000` | Update port mapping in `docker-compose.yml` |
| MongoDB | `27017` | Update `MONGODB_URI` and port mapping |
