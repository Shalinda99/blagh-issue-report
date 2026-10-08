# Blagh Admin BFF

NestJS Backend-for-Frontend that sits between the React admin dashboard and the FastAPI backend.
Handles session cookies, Keycloak SSO validation, and proxies all admin API calls.

## Architecture

```
blagh-admin-ui  (port 5175)
       │
       ▼
blagh-admin-bff (port 4000)   ←── this service
       │
       ▼
blagh-service   (port 8002)
```

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| blagh-service | Running on port 8002 |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set BACKEND_URL, KEYCLOAK_USERINFO_URL, and service account credentials

# 3. Start in development mode (watch)
npm run start:dev
```

Server starts on **http://localhost:4000**

## Environment Variables

Copy `.env.example` to `.env`:

```dotenv
# Port this BFF listens on
PORT=4000

# FastAPI backend URL (internal — never exposed to the browser)
BACKEND_URL=http://localhost:8002

# Origin of the Admin React app (for CORS)
ADMIN_FRONTEND_URL=http://localhost:5175

# Keycloak userinfo endpoint — used to validate incoming SSO tokens
KEYCLOAK_USERINFO_URL=https://<keycloak-host>/auth/realms/<realm>/protocol/openid-connect/userinfo

# Service account credentials — MUST match INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD
# set in blagh-service/.env. Used to exchange a Keycloak token for a FastAPI JWT.
ADMIN_SERVICE_EMAIL=admin@blagh.internal
ADMIN_SERVICE_PASSWORD=ChangeThisPassword!

# Comma-separated Keycloak preferred_username values allowed admin panel access.
# Leave empty to allow ALL authenticated Keycloak users (not recommended for production).
ALLOWED_SSO_USERNAMES=
```

## Environment Differences

| Setting | Development | Production |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8002` | Deployed FastAPI URL |
| `ADMIN_FRONTEND_URL` | `http://localhost:5175` | Production admin UI URL |
| `KEYCLOAK_USERINFO_URL` | Keycloak dev realm | Keycloak prod realm |
| `ALLOWED_SSO_USERNAMES` | optional | Set explicitly for access control |

## Auth Flow

1. **Direct login** — user submits email + password → BFF calls FastAPI `/api/v1/admin/login` → stores JWT in an `httpOnly` session cookie.
2. **SSO login** — user authenticates via Keycloak → BFF validates the Keycloak token against the `userinfo` endpoint → exchanges it for a FastAPI JWT → stores in `httpOnly` cookie.

## Scripts

```bash
npm run start:dev       # Development with watch mode
npm run build           # Compile TypeScript → dist/
npm run start           # Production (requires build first)
npm test                # Run unit tests
npm test -- --coverage  # Run tests with coverage report
```

## Running Tests

```bash
npm test -- --coverage
# 67 tests · 100% line coverage
```
