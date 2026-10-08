# Blagh — Widget

A single JavaScript file (`blagh.js`) that injects a floating "Report Issue" button into any web application with a single `<script>` tag. No build step required on the host app.

> **`data-api-url` must point to `blagh-ui-bff` (port 4001), never directly to the FastAPI backend.**

## Architecture

```
Host web app  ──► (loads blagh.js) ──► Widget UI (Shadow DOM)
                                              │  (XHR/fetch)
                                              ▼
                                       blagh-ui-bff (port 4001)
                                              │
                                              ▼
                                       blagh-service (port 8002)
```

## Prerequisites

| Requirement | Version / Note |
|---|---|
| Node.js | 18+ (for the dev server) |
| blagh-ui-bff | Running on port 4001 |
| blagh-service | Running on port 8002 |

## Dev Server

Serves `blagh.js` at `http://localhost:3000/blagh.js` — no `npm install` needed.

```bash
npm start
```

## Production Build

Minifies and bundles `blagh.js` into `dist/blagh.min.js`:

```bash
npm run build
# → dist/blagh.min.js
```

Deploy `dist/blagh.min.js` to a CDN or static file server.

## Embedding the Widget

**Development:**
```html
<script
  src="http://localhost:3000/blagh.js"
  data-project-id="your-app-id"
  data-api-url="http://localhost:4001"
  data-theme="#4F46E5"
  data-label="Report Issue"
  defer>
</script>
```

**Production:**
```html
<script
  src="https://your-cdn.com/blagh.min.js"
  data-project-id="your-app-id"
  data-api-url="https://widget-bff.yourcompany.com"
  defer>
</script>
```

## Script Attributes

| Attribute | Required | Default | Description |
|---|---|---|---|
| `data-project-id` | **Yes** | — | App ID registered in the admin panel |
| `data-api-url` | **Yes** | — | Widget BFF base URL |
| `data-theme` | No | `#4F46E5` | FAB and accent colour (any CSS colour) |
| `data-label` | No | `File a Blagh` | Text shown on the floating button |
| `data-position` | No | `bottom-right` | `bottom-right` or `bottom-left` |

## Push User Context

Call this after your app's login to pre-fill the reporter fields automatically:

```js
window.__BLAGH_CONFIG = {
  user: {
    id:    'U001',
    name:  'Jane Doe',
    email: 'jane@yourcompany.com',
    role:  'Manager',
  },
  enableMediaRecording: true,  // show voice/screen recording buttons (default: false)
};
```

## What the Widget Captures

On every report submission the widget automatically attaches:

- **Who** — user identity (from `__BLAGH_CONFIG.user`)
- **Where** — page URL, page title, referrer, browser, OS, device, viewport
- **When** — UTC timestamp, local timestamp, timezone
- **Console errors & warnings** — last 50 entries
- **Failed API calls** — URL, method, status code, duration
- **Screenshots** — manual capture or drag-and-drop upload
- **Voice / screen recordings** — optional, enabled via `enableMediaRecording`
