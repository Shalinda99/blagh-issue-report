# Blagh — Backend API

Python · FastAPI · MongoDB · MinIO

The core backend service that powers the Blagh issue-reporting platform.
Exposes REST endpoints consumed by the Admin BFF, the Widget BFF, and the embedded widget.

## Architecture

```
blagh-admin-bff  ──►  /api/v1/admin/*   (JWT-protected admin routes)
blagh-ui-bff     ──►  /api/v1/reports   (public widget report submission)
blagh-ui-bff     ──►  /api/v1/consents  (public widget consent management)
```

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11+ |
| MongoDB | 6+ (local) or MongoDB Atlas |
| MinIO | Latest (for media storage — screenshots, recordings) |

## Quick Start

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set: MONGODB_URL, SECRET_KEY, INITIAL_ADMIN_PASSWORD

# 4. Start the server
uvicorn app.main:app --port 8002 --reload
```

- **API base:** `http://localhost:8002`
- **Swagger UI:** `http://localhost:8002/api/docs`
- **ReDoc:** `http://localhost:8002/api/redoc`

> MongoDB indexes and the MinIO bucket are created automatically on startup — no manual migration needed.

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```dotenv
# ── Application ──────────────────────────────────────────────────────────────
APP_ENV=development          # Set to 'production' to enable strict CORS + secret validation
APP_NAME="Blagh API"
APP_VERSION=1.0.0
SECRET_KEY=<run: openssl rand -hex 32>   # REQUIRED in production

# ── MongoDB ───────────────────────────────────────────────────────────────────
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=blagh
# MongoDB Atlas:
# MONGODB_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority

# ── MinIO (Object Storage) ────────────────────────────────────────────────────
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin      # Change in production
MINIO_SECURE=false               # Set to true when MinIO is behind HTTPS
MINIO_BUCKET=blagh-reports
MINIO_PRESIGN_EXPIRES_HOURS=24

# ── CORS ──────────────────────────────────────────────────────────────────────
# Comma-separated origins allowed for the widget and admin UI
ALLOWED_ORIGINS_STR=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176

# ── JWT ───────────────────────────────────────────────────────────────────────
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# ── Bootstrap Admin Credentials ───────────────────────────────────────────────
INITIAL_ADMIN_EMAIL=admin@blagh.internal
INITIAL_ADMIN_PASSWORD=ChangeThisPassword!   # REQUIRED to change in production
```

## Environment Differences

| Setting | Development | Production |
|---|---|---|
| `APP_ENV` | `development` | `production` |
| `MONGODB_URL` | `mongodb://localhost:27017` | MongoDB Atlas URI |
| `SECRET_KEY` | any value | Strong random 64-char hex |
| `INITIAL_ADMIN_PASSWORD` | default OK | **Must** be changed |
| `MINIO_SECURE` | `false` | `true` (TLS) |
| `ALLOWED_ORIGINS_STR` | localhost origins | Production domain(s) |

> In `production` mode the service will **refuse to start** if `SECRET_KEY` or `INITIAL_ADMIN_PASSWORD` are left at their default values.

## MinIO Setup (Local)

```bash
# Run MinIO via Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  quay.io/minio/minio server /data --console-address ":9001"
```

MinIO console: `http://localhost:9001` (user: `minioadmin` / `minioadmin`)

## Running Tests

```bash
source venv/bin/activate

# Run all tests (no real MongoDB needed — uses mongomock)
pytest --tb=short -q

# With coverage report
pytest --cov=app --cov-report=term-missing
```

> ~109 tests · ~95% coverage

## API Overview

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/admin/login` | — | Admin login, returns JWT |
| `GET` | `/api/v1/admin/reports` | JWT | List reports (paginated) |
| `GET` | `/api/v1/admin/reports/{ref_id}` | JWT | Get report detail |
| `PATCH` | `/api/v1/admin/reports/{ref_id}/status` | JWT | Update report status |
| `GET` | `/api/v1/projects` | JWT | List projects |
| `POST` | `/api/v1/projects` | JWT | Create project |
| `PATCH` | `/api/v1/projects/{app_id}` | JWT | Update project |
| `POST` | `/api/v1/reports` | — | Submit report (widget) |
| `GET` | `/api/v1/reports` | — | Get user's reports (widget) |
| `GET` | `/api/v1/consents` | — | Check consent status |
| `POST` | `/api/v1/consents` | — | Record consent |

