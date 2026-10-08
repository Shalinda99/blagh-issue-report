# Blagh UI BFF

NestJS Backend-for-Frontend between the embedded `blagh.js` widget and the FastAPI backend.
Handles report submission, user report lookup, and consent management on behalf of the widget.

## Architecture

```
blagh.js widget  (any host app)
       │
       ▼  (CORS-unrestricted by default — widget is embeddable anywhere)
blagh-ui-bff    (port 4001)   ←── this service
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
# Edit .env — set BACKEND_URL

# 3. Start in development mode (watch)
npm run start:dev
```

Server starts on **http://localhost:4001**

## Environment Variables

Copy `.env.example` to `.env`:

```dotenv
# Port this BFF listens on
PORT=4001

# FastAPI backend URL (internal — never exposed to the browser)
BACKEND_URL=http://localhost:8002

# CORS origin for the widget. '*' allows embedding on any site.
# Restrict to known host app domains in production, e.g. https://yourapp.com
CORS_ORIGIN=*
```

## Environment Differences

| Setting | Development | Production |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8002` | Deployed FastAPI URL |
| `CORS_ORIGIN` | `*` | Specific host app domain(s), e.g. `https://yourapp.com` |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/reports` | Submit an issue report from the widget |
| `GET` | `/api/reports` | Get a user's previously submitted reports |
| `GET` | `/api/consents` | Check if a user has acknowledged the privacy notice |
| `POST` | `/api/consents` | Record a user's consent |

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
# 40 tests · 100% line coverage
```
