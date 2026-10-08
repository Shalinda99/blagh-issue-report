# Blagh — Mock Web App

A sample HR portal used to test the Blagh widget end-to-end.
Simulates a real host application with login, dashboards, and the embedded "Report Issue" button.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| blagh-service | Running on port 8002 (for report persistence) |
| blagh-ui-bff | Running on port 4001 (widget API gateway) |
| blagh-ui | Running on port 3000 (serves `blagh.js`) |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev
```

App starts on **http://localhost:5173**

> The mock app runs standalone — you can browse all pages without the widget stack running.
> The "Report Issue" button requires the full widget stack (see below).

## Full Widget Stack (End-to-End Testing)

Start all services in separate terminals (order matters):

```bash
# Terminal 1 — FastAPI backend
cd ../blagh-service
source venv/bin/activate    # Windows: venv\Scripts\activate
uvicorn app.main:app --port 8002 --reload

# Terminal 2 — Widget BFF
cd ../blagh-ui-bff
npm install && npm run start:dev

# Terminal 3 — Widget dev server (serves blagh.js)
cd ../blagh-ui
npm start

# Terminal 4 — Mock Web App
cd ../blagh-mock-ui
npm run dev
```

Then open **http://localhost:5173**, log in, and click **"Report Issue"**.

## Environment Variables

Optional — create `.env` to override Keycloak config:

```dotenv
VITE_KEYCLOAK_BASE=https://<keycloak-host>/auth/realms/<realm>
VITE_KEYCLOAK_CLIENT_ID=app
```

## Mock Login Credentials

**Local mock auth (no Keycloak required):**
```
admin@csiconnect.com      /  admin123
john.doe@csiconnect.com   /  password123
```

**Keycloak SSO:**
> Configure `VITE_KEYCLOAK_BASE` in `.env` and use your Keycloak credentials.

## Scripts

```bash
npm run dev     # Start development server (hot reload)
npm run build   # Production build → dist/
npm run preview # Preview the production build locally
```
