# Blagh — Admin Dashboard

React + Vite admin panel for viewing and managing issue reports submitted via the Blagh widget.

## Architecture

```
blagh-admin-ui  (port 5175)   ←── this app
       │
       ▼  (all API calls, never direct to backend)
blagh-admin-bff (port 4000)
       │
       ▼
blagh-service   (port 8002)
```

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| blagh-admin-bff | Running on port 4000 |
| blagh-service | Running on port 8002 |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set VITE_API_URL and Keycloak config

# 3. Start the dev server
npm run dev
```

App starts on **http://localhost:5175**

## Environment Variables

Copy `.env.example` to `.env`:

```dotenv
# Admin BFF URL — the React app talks ONLY to this, not the FastAPI backend directly
VITE_API_URL=http://localhost:4000

# Keycloak realm base URL — required for SSO login
VITE_KEYCLOAK_BASE=https://<keycloak-host>/auth/realms/<realm>
VITE_KEYCLOAK_CLIENT_ID=app
```

## Environment Differences

| Setting | Development | Production |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | `https://admin-bff.yourcompany.com` |
| `VITE_KEYCLOAK_BASE` | Dev Keycloak realm URL | Prod Keycloak realm URL |

After changing `.env` for production, rebuild:
```bash
npm run build   # outputs to dist/
```

## Login

**Direct login** (email + password):
> Credentials are set in `blagh-service/.env` via `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`.

Default (development only — change before going to production):
```
Email:    admin@blagh.internal
Password: ChangeThisPassword!
```

**Keycloak SSO login** is also available on the `/login` page.
> Requires `ALLOWED_SSO_USERNAMES` to be configured in `blagh-admin-bff/.env`.

## Scripts

```bash
npm run dev     # Start development server (hot reload)
npm run build   # Production build → dist/
npm run preview # Preview the production build locally
```
