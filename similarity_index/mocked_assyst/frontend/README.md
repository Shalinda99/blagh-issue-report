# Frontend — Mock IFS assyst UI

React + TypeScript single-page application for browsing and testing the mock assyst server.

---

## Stack

| Library | Version | Role |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool + dev server |
| TailwindCSS | 3 | Utility-first styling |
| TanStack Query | 5 | Server state management |
| React Router | 6 | Client-side routing |
| Axios | 1 | HTTP client with Basic Auth |
| Recharts | 2 | Dashboard charts |
| react-hook-form + zod | latest | Form validation |
| react-hot-toast | latest | Toast notifications |
| lucide-react | latest | Icons |

---

## Local Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Backend running at `http://localhost:8081`

### Install and start

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open: **`http://localhost:5173`**

The Vite dev server automatically proxies `/assystREST`, `/health`, and `/mock` to `http://localhost:8081`, so there are no CORS issues during development.

---

## Environment Variables

Create a `.env` file (or use the existing one):

```bash
cp .env.example .env   # or copy from parent directory
```

| Variable | Default | Description |
|---|---|---|
| `VITE_ASSYST_API_BASE_URL` | `http://localhost:8081` | Backend base URL |
| `VITE_APP_ENV` | `development` | Environment label shown in sidebar |
| `VITE_MOCK_USERNAME` | `mock_user` | Default Basic Auth username |
| `VITE_MOCK_PASSWORD` | `change_me` | Default Basic Auth password |

> Credentials in `.env` are used as **defaults** only. They can be overridden at runtime via the **Settings → Session Credentials** panel without restarting.

---

## Build for Production

```bash
npm run build
```

Output is placed in `dist/`. The build is a standard SPA — serve with any static host or the included nginx config.

```bash
# Preview the production build locally
npm run preview
```

---

## Project Structure

```
src/
├── api/
│   ├── client.ts           # Axios instance, Basic Auth headers
│   ├── events.ts           # CRUD wrappers for /assystREST/v2/events
│   ├── reference-data.ts   # Users, teams, categories, services
│   ├── health.ts           # Health check
│   └── admin.ts            # Mock admin endpoints
│
├── hooks/
│   ├── useEvents.ts         # TanStack Query hooks for events
│   ├── useReferenceData.ts  # Hooks for reference data
│   └── useHealth.ts         # Hooks for health + admin stats
│
├── components/
│   ├── layout/
│   │   ├── Layout.tsx       # Main shell (sidebar + outlet)
│   │   ├── Sidebar.tsx      # Navigation links
│   │   └── Header.tsx       # Page header + health indicator
│   └── ui/
│       ├── Badge.tsx        # Status/priority colour badges
│       ├── Button.tsx       # Button variants (primary, danger, ghost…)
│       └── Spinner.tsx      # Loading spinner + full-page loader
│
├── pages/
│   ├── Dashboard.tsx        # Overview with charts + recent incidents
│   ├── Incidents.tsx        # Paginated, filterable incident table
│   ├── IncidentDetail.tsx   # Detail view + inline status update
│   ├── NewIncident.tsx      # Create incident form
│   ├── ReferencePages.tsx   # Users, Teams, Categories, Services
│   ├── SimilarityLab.tsx    # Client-side Jaccard similarity search
│   ├── ApiExplorer.tsx      # Interactive HTTP client
│   └── Settings.tsx         # Admin: seed/reset, credentials
│
├── types/
│   └── index.ts             # TypeScript interfaces matching assystREST schema
│
├── lib/
│   └── utils.ts             # Date formatting, status colours, error extraction
│
├── App.tsx                  # Router + QueryClient provider
├── main.tsx                 # React DOM entry point
├── index.css                # Tailwind CSS base
└── vite-env.d.ts            # Vite import.meta.env type declarations
```

---

## UI Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Incident count cards, priority/status charts, recent list |
| Incidents | `/incidents` | Sortable table, filters (type/status/priority/category/service), pagination |
| Incident Detail | `/incidents/:id` | All fields, status update buttons, raw JSON toggle |
| New Incident | `/incidents/new` | Validated create form with dropdown reference data |
| Users | `/users` | List of mock assyst users |
| Teams | `/teams` | List of mock support groups |
| Categories | `/categories` | Categories with expandable sub-categories |
| Services | `/services` | Service catalogue table |
| Similarity Lab | `/similarity` | Fetch all incidents → Jaccard search → ranked results |
| API Explorer | `/api-explorer` | Select endpoint → edit path/method/body → see live response |
| Settings | `/settings` | Seed/reset database, change session credentials, view config |

---

## Authentication

Credentials are sent as an `Authorization: Basic <base64>` header on every Axios request. They are stored in `sessionStorage` only and are never persisted to disk.

To change credentials at runtime:
1. Open **Settings** (`/settings`).
2. Update Username and Password.
3. Click **Save Credentials** — all subsequent API requests use the new values immediately.

---

## Docker

The production Docker image uses a **multi-stage build** (Node → nginx):

```bash
# Build image
docker build -t mock-assyst-ui .

# The nginx config reverse-proxies /assystREST and /mock to the backend
# so the frontend container needs to run on the same Docker network as the backend

# Use Docker Compose (recommended)
docker compose up frontend -d
```

The nginx configuration (`nginx.conf`) handles:
- SPA routing (`try_files` → `index.html`)
- Reverse proxy for `/assystREST/`, `/health`, and `/mock/` → `http://backend:8081`
- gzip compression

---

## Common npm Scripts

```bash
npm run dev        # Start Vite dev server (hot reload)
npm run build      # TypeScript check + production build
npm run preview    # Preview production build at localhost:3000
npm run lint       # ESLint
```
