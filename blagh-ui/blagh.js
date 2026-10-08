/**
 * Blagh Widget
 * Inject into any web app via a single <script> tag.
 * No build step required on the host application.
 *
 * Usage:
 *   <script
 *     src="/blagh.js"
 *     data-project-id="YOUR_APP_ID"
 *     data-api-url="https://api.your-domain.com"
 *     data-theme="#4F46E5"
 *     data-label="Report Issue"
 *     defer>
 *   </script>
 *
 *   // Optional: set config before widget loads
 *   window.__BLAGH_CONFIG = {
 *     user: { id: 'U001', name: 'John Doe', email: 'john@company.com', role: 'Manager' },
 *     enableMediaRecording: true,  // default: false — show voice recording, screen recording, upload video buttons
 *   };
 */

(function (window, document) {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────────────

  function getConfig() {
    var script = document.querySelector('script[data-project-id]');
    var attr = {
      projectId : (script && script.getAttribute('data-project-id'))  || 'demo',
      apiUrl    : (script && script.getAttribute('data-api-url'))     || '',
      position  : (script && script.getAttribute('data-position'))    || 'bottom-right',
      theme     : (script && script.getAttribute('data-theme'))       || '#4F46E5',
      label     : (script && script.getAttribute('data-label'))       || 'Report Issue',
    };
    var win = window.__BLAGH_CONFIG || {};
    return {
      projectId              : win.projectId              || attr.projectId,
      apiUrl                 : win.apiUrl                 || attr.apiUrl,
      position               : win.position               || attr.position,
      theme                  : win.theme                  || attr.theme,
      label                  : win.label                  || attr.label,
      maxConsoleEntries      : win.maxConsoleEntries      || 50,
      captureConsoleErrors   : win.captureConsoleErrors   !== false,
      captureConsoleWarnings : win.captureConsoleWarnings !== false,
      captureFailedAPIs      : win.captureFailedAPIs      !== false,
      enableMediaRecording   : (typeof __ENABLE_MEDIA_RECORDING__ !== 'undefined' ? __ENABLE_MEDIA_RECORDING__ : false) || win.enableMediaRecording === true,
      user                   : win.user                   || null,
    };
  }

  // ─── Runtime State ────────────────────────────────────────────────────────

  var state = {
    consoleErrors    : [],
    consoleWarnings  : [],
    failedAPICalls   : [],
    isOpen           : false,
    isMinimized      : false,
    isConsentOpen    : false,
    config           : null,
    screenshots      : [],    // array of base64 data URL strings
    voiceRecordings  : [],    // array of base64 audio data URL strings
    videoRecordings  : [],    // array of base64 video data URL strings
  };

  // ─── Recording transient state (not part of report payload) ──────────────
  var _voiceRec = { recorder: null, chunks: [], timer: null, elapsed: 0, stream: null };
  var _videoRec = { recorder: null, chunks: [], timer: null, elapsed: 0, stream: null };

  // ─── Console Monitor ──────────────────────────────────────────────────────

  function initConsoleMonitor(config) {
    var max = config.maxConsoleEntries;

    if (config.captureConsoleErrors) {
      var origError = console.error.bind(console);
      console.error = function () {
        pushEntry(state.consoleErrors, 'error', argsToString(arguments), max);
        origError.apply(console, arguments);
      };

      var origOnError = window.onerror;
      window.onerror = function (msg, src, line) {
        pushEntry(state.consoleErrors, 'error', String(msg), max, String(src || ''), line);
        if (origOnError) return origOnError.apply(this, arguments);
      };

      window.addEventListener('unhandledrejection', function (ev) {
        var msg = (ev.reason && ev.reason.message) ? ev.reason.message : String(ev.reason);
        pushEntry(state.consoleErrors, 'error', 'Unhandled Promise Rejection: ' + msg, max);
      });
    }

    if (config.captureConsoleWarnings) {
      var origWarn = console.warn.bind(console);
      console.warn = function () {
        pushEntry(state.consoleWarnings, 'warn', argsToString(arguments), max);
        origWarn.apply(console, arguments);
      };
    }
  }

  function argsToString(args) {
    return Array.prototype.slice.call(args).map(function (a) {
      if (a && typeof a === 'object') {
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }
      return String(a);
    }).join(' ');
  }

  function pushEntry(arr, level, message, max, source, line) {
    var pageUrl = window.location.href;
    // Dedup: skip if identical message already captured from this page
    for (var i = arr.length - 1; i >= Math.max(0, arr.length - 5); i--) {
      if (arr[i].message === message && arr[i].page_url === pageUrl) return;
    }
    if (arr.length >= max) arr.shift();
    arr.push({
      level       : level,
      message     : message,
      source      : source || '',
      line_number : line   || null,
      timestamp   : new Date().toISOString(),
      page_url    : pageUrl,
    });
  }

  var DEDUP_WINDOW_MS = 10000; // 10 seconds — same URL+method+status allowed again after this

  // Strip query string so URLs that differ only by cache-busting params (e.g. ?t=…) are treated as the same endpoint
  function normalizeUrl(url) {
    try {
      var u = new URL(url, window.location.href);
      return u.origin + u.pathname;
    } catch (e) {
      var qi = url.indexOf('?');
      return qi !== -1 ? url.slice(0, qi) : url;
    }
  }

  function isApiDuplicate(url, method, statusCode, pageUrl) {
    var now     = Date.now();
    var normUrl = normalizeUrl(url);
    var calls   = state.failedAPICalls;
    for (var i = calls.length - 1; i >= 0; i--) {
      var e = calls[i];
      if (normalizeUrl(e.url) === normUrl && e.method === method &&
          e.status_code === statusCode && e.page_url === pageUrl) {
        // Only treat as duplicate if captured within the dedup window
        return (now - new Date(e.timestamp).getTime()) < DEDUP_WINDOW_MS;
      }
    }
    return false;
  }

  // ─── Network Monitor ─────────────────────────────────────────────────────

  function initNetworkMonitor(config) {
    if (!config.captureFailedAPIs) return;

    // Patch fetch
    if (typeof window.fetch === 'function') {
      var origFetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url    = (typeof input === 'string') ? input : (input && input.url) ? input.url : String(input);
        var method = (init && init.method) ? init.method.toUpperCase() : 'GET';
        var start  = Date.now();

        var pageAtRequest = window.location.href;
        return origFetch(input, init).then(function (resp) {
          if (!resp.ok && !isApiDuplicate(url, method, resp.status, pageAtRequest)) {
            state.failedAPICalls.push({
              url         : url,
              method      : method,
              status_code : resp.status,
              status_text : resp.statusText,
              duration_ms : Date.now() - start,
              timestamp   : new Date().toISOString(),
              page_url    : pageAtRequest,
            });
          }
          return resp;
        }).catch(function (err) {
          if (!isApiDuplicate(url, method, 0, pageAtRequest)) {
            state.failedAPICalls.push({
              url         : url,
              method      : method,
              status_code : 0,
              status_text : 'Network Error: ' + (err.message || String(err)),
              duration_ms : Date.now() - start,
              timestamp   : new Date().toISOString(),
              page_url    : pageAtRequest,
            });
          }
          throw err;
        });
      };
    }

    // Patch XHR
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._csi_method   = method;
      this._csi_url      = url;
      this._csi_start    = Date.now();
      this._csi_page_url = window.location.href;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var self = this;
      self.addEventListener('load', function () {
        var u = self._csi_url || '', m = (self._csi_method || 'GET').toUpperCase(), pg = self._csi_page_url || '';
        if (self.status >= 400 && !isApiDuplicate(u, m, self.status, pg)) {
          state.failedAPICalls.push({
            url         : u,
            method      : m,
            status_code : self.status,
            status_text : self.statusText,
            duration_ms : Date.now() - (self._csi_start || Date.now()),
            timestamp   : new Date().toISOString(),
            page_url    : pg,
          });
        }
      });
      self.addEventListener('error', function () {
        var u = self._csi_url || '', m = (self._csi_method || 'GET').toUpperCase(), pg = self._csi_page_url || '';
        if (!isApiDuplicate(u, m, 0, pg)) {
          state.failedAPICalls.push({
            url         : u,
            method      : m,
            status_code : 0,
            status_text : 'Network Error',
            duration_ms : Date.now() - (self._csi_start || Date.now()),
            timestamp   : new Date().toISOString(),
            page_url    : pg,
          });
        }
      });
      return origSend.apply(this, arguments);
    };
  }

  // ─── Auto-Capture Helpers ────────────────────────────────────────────────

  function captureWho(config) {
    var liveUser = window.__BLAGH_CONFIG && window.__BLAGH_CONFIG.user;
    var u = liveUser || config.user || {};
    return {
      user_id    : u.id    || '',
      user_name  : u.name  || '',
      user_email : u.email || '',
      user_role  : u.role  || '',
      user_agent : navigator.userAgent,
    };
  }

  function captureWhere() {
    var ua = navigator.userAgent;
    var browser = 'Unknown', os = 'Unknown';

    if      (/Edg\//.test(ua))                        browser = 'Edge '    + (ua.match(/Edg\/([\d.]+)/)     || ['','?'])[1];
    else if (/Chrome\//.test(ua))                     browser = 'Chrome '  + (ua.match(/Chrome\/([\d.]+)/)  || ['','?'])[1];
    else if (/Firefox\//.test(ua))                    browser = 'Firefox ' + (ua.match(/Firefox\/([\d.]+)/) || ['','?'])[1];
    else if (/Safari\//.test(ua))                     browser = 'Safari';

    if      (/Windows/.test(ua))                      os = 'Windows';
    else if (/Android/.test(ua))                      os = 'Android';
    else if (/iPhone|iPad/.test(ua))                  os = 'iOS';
    else if (/Mac/.test(ua))                          os = 'macOS';
    else if (/Linux/.test(ua))                        os = 'Linux';

    var mobile = /Mobi|Android/i.test(ua);
    var tablet = /Tablet|iPad/i.test(ua);

    return {
      url               : window.location.href,
      page_title        : document.title,
      referrer          : document.referrer || '',
      browser           : browser,
      os                : os,
      device            : tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
      viewport          : window.innerWidth + 'x' + window.innerHeight,
      screen_resolution : screen.width + 'x' + screen.height,
    };
  }

  function captureWhen() {
    var now = new Date();
    return {
      utc_timestamp   : now.toISOString(),
      local_timestamp : now.toLocaleString(),
      timezone        : Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  // ─── Styles (Shadow DOM scoped) ───────────────────────────────────────────

  function getStyles(theme) {
    var t = theme;
    return [
      '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',

      /* FAB */
      '#csi-fab {',
      '  position: fixed; bottom: 24px; right: 24px;',
      '  display: flex; align-items: center; gap: 8px;',
      '  padding: 12px 20px;',
      '  background: ' + t + '; color: #fff;',
      '  border: none; border-radius: 50px; cursor: grab; user-select: none;',
      '  font-size: 14px; font-weight: 600; letter-spacing: 0.01em;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  box-shadow: 0 4px 20px rgba(0,0,0,0.25);',
      '  pointer-events: auto;',
      '  transition: transform 0.2s ease, box-shadow 0.2s ease;',
      '}',
      '#csi-fab:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.3); }',
      '#csi-fab:active { transform: translateY(0); }',
      '#csi-fab.minimized { background:#374151; }',
      '#csi-fab.minimized:hover { background:#1f2937; transform:translateY(-2px); }',
      '#csi-fab.dragging { cursor: grabbing !important; transform: none !important; box-shadow: 0 8px 32px rgba(0,0,0,0.35) !important; }',

      /* Overlay */
      '#csi-overlay {',
      '  display: none; position: absolute; inset: 0;',
      '  background: rgba(0,0,0,0.5);',
      '  pointer-events: auto;',
      '  align-items: center; justify-content: center;',
      '  padding: 16px;',
      '  backdrop-filter: blur(3px);',
      '}',
      '#csi-overlay.open { display: flex; }',

      /* Modal */
      '#csi-modal {',
      '  background: #fff; border-radius: 16px;',
      '  width: 100%; max-width: 520px; max-height: 90vh;',
      '  overflow-y: auto; overflow-x: hidden;',
      '  box-shadow: 0 24px 64px rgba(0,0,0,0.22);',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  animation: csi-in 0.22s ease;',
      '}',
      '@keyframes csi-in { from { opacity:0; transform: translateY(14px) scale(0.97); } to { opacity:1; transform:none; } }',

      /* Header */
      '#csi-header {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 18px 22px; border-bottom: 1px solid #f0f0f0;',
      '  position: sticky; top: 0; background: #fff; z-index: 2;',
      '  border-radius: 16px 16px 0 0;',
      '}',
      '.csi-title { display:flex; align-items:center; gap:10px; font-size:16px; font-weight:700; color:#111; }',
      '.csi-icon-box {',
      '  width:30px; height:30px; background:' + t + '18;',
      '  border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0;',
      '}',
      '#csi-close, #csi-minimize {',
      '  width:30px; height:30px; border:none; background:#f5f5f5;',
      '  border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;',
      '  font-size:15px; color:#666; transition:background 0.15s, color 0.15s; line-height:1;',
      '}',
      '#csi-close:hover, #csi-minimize:hover { background:#e5e5e5; color:#111; }',
      '#csi-hdr-actions { display:flex; align-items:center; gap:6px; }',
      /* Body */
      '#csi-body { padding: 22px; display:flex; flex-direction:column; gap:16px; }',

      /* Fields */
      '.csi-field { display:flex; flex-direction:column; gap:5px; }',
      '.csi-label { font-size:12.5px; font-weight:600; color:#374151; }',
      '.csi-req { color:#ef4444; margin-left:2px; }',
      '.csi-input, .csi-textarea, .csi-select {',
      '  width:100%; padding:9px 13px;',
      '  border:1.5px solid #e5e7eb; border-radius:8px;',
      '  font-size:13.5px; color:#111; background:#fff;',
      '  font-family:inherit; outline:none; appearance:none; -webkit-appearance:none;',
      '  transition:border-color 0.15s, box-shadow 0.15s;',
      '}',
      '.csi-input::placeholder, .csi-textarea::placeholder { color:#9ca3af; }',
      '.csi-input:focus, .csi-textarea:focus, .csi-select:focus {',
      '  border-color:' + t + '; box-shadow:0 0 0 3px ' + t + '22;',
      '}',
      '.csi-input.err, .csi-textarea.err, .csi-select.err { border-color:#ef4444; }',
      '.csi-textarea { resize:vertical; min-height:96px; line-height:1.5; }',
      '.csi-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }',

      /* Select wrapper */
      '.csi-sel-wrap { position:relative; }',
      '.csi-sel-wrap::after {',
      '  content:""; position:absolute; right:11px; top:50%;',
      '  transform:translateY(-50%) rotate(45deg);',
      '  width:6px; height:6px;',
      '  border-right:2px solid #6b7280; border-bottom:2px solid #6b7280;',
      '  pointer-events:none; margin-top:-3px;',
      '}',
      '.csi-select { padding-right:30px; cursor:pointer; }',

      /* Error text */
      '.csi-err { font-size:11.5px; color:#ef4444; margin-top:1px; min-height:16px; }',

      /* Tech details */
      '.csi-tech {',
      '  border:1.5px solid #e5e7eb; border-radius:10px; overflow:hidden;',
      '}',
      '.csi-tech-hdr {',
      '  display:flex; align-items:center; justify-content:space-between;',
      '  padding:10px 14px; background:#f9fafb; cursor:pointer;',
      '  font-size:12.5px; font-weight:600; color:#374151;',
      '  user-select:none; transition:background 0.15s;',
      '}',
      '.csi-tech-hdr:hover { background:#f3f4f6; }',
      '.csi-chev { font-size:10px; color:#9ca3af; transition:transform 0.2s; }',
      '.csi-tech-hdr.open .csi-chev { transform:rotate(180deg); }',
      '.csi-tech-refresh {',
      '  background:none; border:1px solid #e5e7eb; cursor:pointer; color:#6b7280;',
      '  font-size:12px; padding:2px 6px; border-radius:5px; line-height:1.4;',
      '  transition:color 0.3s, background 0.3s, border-color 0.3s;',
      '  display:flex; align-items:center; gap:3px;',
      '}',
      '.csi-tech-refresh:hover:not(:disabled) { color:#374151; background:#f3f4f6; border-color:#d1d5db; }',
      '.csi-tech-refresh:disabled { opacity:0.6; cursor:not-allowed; }',
      '.csi-tech-refresh .csi-refresh-icon { display:inline-block; }',
      '.csi-tech-refresh.spinning .csi-refresh-icon { animation:csi-rotate 0.8s linear infinite; }',
      '.csi-tech-refresh.refreshed { color:#16a34a; background:#f0fdf4; border-color:#bbf7d0; }',
      '.csi-tech-body { display:none; padding:14px; background:#fff; }',
      '.csi-tech-body.open { display:block; }',

      /* Tech rows */
      '.csi-trow { display:flex; align-items:flex-start; gap:8px; font-size:12.5px; margin-bottom:8px; }',
      '.csi-trow:last-child { margin-bottom:0; }',
      '.csi-tico { font-size:13px; flex-shrink:0; margin-top:1px; }',
      '.csi-tkey { color:#6b7280; font-weight:500; width:86px; flex-shrink:0; }',
      '.csi-tval { color:#111; word-break:break-all; line-height:1.4; }',

      /* Badges */
      '.csi-badge {',
      '  display:inline-flex; align-items:center; gap:3px;',
      '  padding:2px 7px; border-radius:20px;',
      '  font-size:11px; font-weight:600;',
      '}',
      '.csi-badge.err { background:#fef2f2; color:#dc2626; }',
      '.csi-badge.wrn { background:#fffbeb; color:#d97706; }',
      '.csi-badge.api { background:#fef2f2; color:#dc2626; }',
      '.csi-badge.ok  { background:#f0fdf4; color:#16a34a; }',

      /* Diag list */
      '.csi-diag { margin-top:10px; padding-top:10px; border-top:1px solid #f0f0f0; }',
      '.csi-diag-ttl { font-size:11px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; margin-bottom:5px; }',
      '.csi-diag-item {',
      '  font-size:11.5px; color:#374151; background:#f9fafb;',
      '  border-radius:5px; padding:5px 9px;',
      '  font-family:ui-monospace, "Courier New", monospace;',
      '  word-break:break-all; margin-bottom:3px; line-height:1.4;',
      '}',
      '.csi-diag-page {',
      '  font-size:10.5px; color:#6b7280; font-weight:600;',
      '  padding:4px 0 3px 0; margin-top:6px; margin-bottom:3px;',
      '  border-bottom:1px dashed #e5e7eb; word-break:break-all;',
      '}',

      /* API call card */
      '.csi-api-item {',
      '  border:1px solid #fee2e2; border-radius:7px;',
      '  padding:7px 10px; margin-bottom:5px; background:#fff;',
      '}',
      '.csi-api-top { display:flex; align-items:center; gap:5px; flex-wrap:wrap; }',
      '.csi-api-url {',
      '  font-size:11.5px; font-family:ui-monospace,"Courier New",monospace;',
      '  color:#374151; word-break:break-all; margin-top:3px;',
      '}',
      '.csi-api-sub { font-size:10.5px; color:#9ca3af; margin-top:2px; }',
      '.csi-diag-count {',
      '  font-size:10px; font-weight:700; color:#6b7280;',
      '  background:#f3f4f6; border-radius:20px; padding:1px 6px; margin-left:auto;',
      '}',

      /* Method badges */
      '.meth-get   { background:#eff6ff; color:#1d4ed8; }',
      '.meth-post  { background:#f0fdf4; color:#15803d; }',
      '.meth-put   { background:#fefce8; color:#a16207; }',
      '.meth-del   { background:#fef2f2; color:#dc2626; }',
      '.meth-patch { background:#faf5ff; color:#7c3aed; }',
      '.meth-xhr   { background:#f0f9ff; color:#0369a1; }',

      /* Status badges */
      '.stat-err { background:#f5f5f4; color:#78716c; }',
      '.stat-4xx { background:#fef2f2; color:#dc2626; }',
      '.stat-5xx { background:#fff7ed; color:#ea580c; }',
      '.stat-3xx { background:#f0f9ff; color:#0369a1; }',

      /* Tab navigation */
      '#csi-tabs {',
      '  display:flex; border-bottom:1.5px solid #f0f0f0; background:#fff;',
      '  position:sticky; top:57px; z-index:1;',
      '}',
      '.csi-tab {',
      '  flex:1; padding:11px 0; background:none; border:none; cursor:pointer;',
      '  font-size:13px; font-weight:600; color:#6b7280; font-family:inherit;',
      '  border-bottom:2.5px solid transparent; margin-bottom:-1.5px;',
      '  transition:color 0.15s, border-color 0.15s;',
      '}',
      '.csi-tab.active { color:' + t + '; border-bottom-color:' + t + '; }',
      '.csi-tab:hover:not(.active) { color:#374151; background:#fafafa; }',

      /* My Reports panel */
      '#csi-my-reports-wrap { display:none; padding:18px 22px 22px; min-height:220px; }',
      '.csi-mr-hdr-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }',
      '.csi-mr-section-hdr {',
      '  font-size:11px; font-weight:700; color:#9ca3af; text-transform:uppercase;',
      '  letter-spacing:.06em; margin-bottom:0;',
      '}',
      '.csi-mr-refresh {',
      '  display:inline-flex; align-items:center; gap:5px;',
      '  padding:3px 10px; border-radius:6px; border:1.5px solid #e5e7eb;',
      '  background:#fff; color:#6b7280; font-size:11.5px; font-weight:600;',
      '  cursor:pointer; font-family:inherit; transition:all 0.15s;',
      '}',
      '.csi-mr-refresh:hover { border-color:#d1d5db; background:#f9fafb; color:#374151; }',
      '.csi-mr-refresh:disabled { opacity:.5; cursor:not-allowed; }',
      '.csi-mr-refresh-icon { font-size:13px; display:inline-block; transition:transform 0.4s; }',
      '.csi-mr-refresh.spinning .csi-mr-refresh-icon { animation:csi-rotate 0.7s linear infinite; }',
      '.csi-mr-card {',
      '  background:#f9fafb; border:1.5px solid #e5e7eb; border-radius:10px;',
      '  padding:12px 14px; margin-bottom:10px; transition:border-color 0.15s;',
      '}',
      '.csi-mr-card:last-child { margin-bottom:0; }',
      '.csi-mr-card:hover { border-color:#d1d5db; }',
      '.csi-mr-row1 { display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; }',
      '.csi-mr-ref { font-size:11px; font-weight:700; color:#9ca3af; font-family:ui-monospace,"Courier New",monospace; }',
      '.csi-mr-badges { display:flex; gap:5px; flex-wrap:wrap; }',
      '.csi-mr-badge { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:20px; }',
      '.mr-open     { background:#eff6ff; color:#3b82f6; }',
      '.mr-inprog   { background:#fff7ed; color:#f97316; }',
      '.mr-resolved { background:#f0fdf4; color:#16a34a; }',
      '.mr-closed   { background:#f3f4f6; color:#6b7280; }',
      '.mr-critical { background:#fef2f2; color:#dc2626; }',
      '.mr-high     { background:#fff7ed; color:#ea580c; }',
      '.mr-medium   { background:#fffbeb; color:#d97706; }',
      '.mr-low      { background:#f0fdf4; color:#16a34a; }',
      '.csi-mr-title { font-size:13.5px; font-weight:600; color:#111; margin-bottom:4px; line-height:1.35; }',
      '.csi-mr-meta { font-size:11px; color:#9ca3af; }',
      '.csi-mr-page { color:#6b7280; }',
      '.csi-mr-state {',
      '  text-align:center; padding:36px 20px; font-size:13px; color:#9ca3af;',
      '}',
      '.csi-mr-state.err { color:#dc2626; }',
      '.csi-mr-spin {',
      '  display:inline-block; width:18px; height:18px;',
      '  border:2.5px solid #e5e7eb; border-top-color:' + t + ';',
      '  border-radius:50%; animation:csi-rotate 0.7s linear infinite;',
      '  vertical-align:middle; margin-right:8px;',
      '}',

      /* Footer */
      '#csi-footer {',
      '  display:flex; justify-content:flex-end; align-items:center; gap:10px;',
      '  padding:14px 22px; border-top:1px solid #f0f0f0;',
      '  background:#fafafa; border-radius:0 0 16px 16px;',
      '  position:sticky; bottom:0;',
      '}',

      /* Buttons */
      '.csi-btn {',
      '  padding:9px 18px; border-radius:8px;',
      '  font-size:13.5px; font-weight:600; cursor:pointer; border:none;',
      '  font-family:inherit; transition:all 0.15s;',
      '}',
      '.csi-btn-cancel { background:#f3f4f6; color:#374151; }',
      '.csi-btn-cancel:hover { background:#e5e7eb; }',
      '.csi-btn-submit {',
      '  background:' + t + '; color:#fff;',
      '  min-width:120px; display:flex; align-items:center; justify-content:center; gap:6px;',
      '}',
      '.csi-btn-submit:hover:not(:disabled) { filter:brightness(1.1); }',
      '.csi-btn-submit:disabled { opacity:0.6; cursor:not-allowed; }',
      '.csi-sub-err { font-size:12px; color:#dc2626; margin-right:auto; }',

      /* Submit success toast */
      '#csi-toast {',
      '  display:none; align-items:flex-start; gap:10px;',
      '  background:#f0fdf4; border:1.5px solid #bbf7d0; border-radius:10px;',
      '  padding:12px 14px; margin:0 22px 4px; font-size:13px;',
      '}',
      '#csi-toast.show { display:flex; }',
      '.csi-toast-icon { color:#16a34a; font-size:17px; flex-shrink:0; line-height:1.2; }',
      '.csi-toast-body { flex:1; }',
      '.csi-toast-ttl { font-weight:700; color:#15803d; margin-bottom:2px; }',
      '.csi-toast-ref { font-size:11.5px; color:#166534; font-family:ui-monospace,"Courier New",monospace; }',
      '.csi-toast-close {',
      '  background:none; border:none; cursor:pointer; color:#6b7280;',
      '  font-size:16px; padding:0 2px; line-height:1; flex-shrink:0;',
      '}',
      '.csi-toast-close:hover { color:#111; }',

      /* Success panel */
      '#csi-success {',
      '  display:none; flex-direction:column; align-items:center;',
      '  justify-content:center; padding:48px 24px; text-align:center; gap:14px;',
      '}',
      '#csi-success.show { display:flex; }',
      '.csi-ok-icon {',
      '  width:60px; height:60px; background:#f0fdf4; border-radius:50%;',
      '  display:flex; align-items:center; justify-content:center;',
      '}',
      '.csi-ok-ttl { font-size:17px; font-weight:700; color:#111; }',
      '.csi-ref { font-family:ui-monospace, monospace; font-size:14px; color:' + t + '; font-weight:700; background:' + t + '12; padding:4px 12px; border-radius:6px; }',
      '.csi-ok-sub { font-size:13px; color:#6b7280; }',

      /* Spinner */
      '.csi-spin {',
      '  width:15px; height:15px; border:2px solid rgba(255,255,255,.35);',
      '  border-top-color:#fff; border-radius:50%;',
      '  animation:csi-spin 0.65s linear infinite;',
      '}',
      '@keyframes csi-spin { to { transform:rotate(360deg); } }',

      /* Screenshot section */
      '.csi-ss-actions { display:flex; gap:8px; flex-wrap:wrap; }',
      '.csi-ss-btn {',
      '  display:inline-flex; align-items:center; gap:5px;',
      '  padding:7px 13px; border-radius:8px;',
      '  border:1.5px dashed #d1d5db; background:#f9fafb;',
      '  font-size:12.5px; font-weight:500; color:#6b7280;',
      '  cursor:pointer; font-family:inherit; transition:all 0.15s;',
      '}',
      '.csi-ss-btn:hover { border-color:' + t + '; color:' + t + '; background:' + t + '0d; }',
      '.csi-ss-list { display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }',
      '.csi-ss-item { position:relative; flex-shrink:0; }',
      '.csi-ss-thumb {',
      '  display:block; width:80px; height:54px; object-fit:cover;',
      '  border-radius:6px; border:1.5px solid #e5e7eb; cursor:zoom-in;',
      '}',
      '.csi-ss-item-remove {',
      '  position:absolute; top:-6px; right:-6px;',
      '  width:18px; height:18px; border-radius:50%;',
      '  background:#ef4444; color:#fff; border:none;',
      '  font-size:12px; line-height:1; cursor:pointer;',
      '  display:flex; align-items:center; justify-content:center;',
      '  padding:0; font-family:inherit;',
      '}',
      '.csi-ss-item-remove:hover { background:#dc2626; }',
      '.csi-ss-hint { font-size:11.5px; color:#9ca3af; margin-top:6px; }',

      /* Recording button active state */
      '.csi-ss-btn.csi-rec-active {',
      '  border-color:#ef4444; color:#ef4444; background:#fef2f2;',
      '  animation:csi-rec-pulse 1.2s ease-in-out infinite;',
      '}',
      '@keyframes csi-rec-pulse { 0%,100%{opacity:1} 50%{opacity:0.65} }',

      /* Recording previews */
      '.csi-rec-list { display:flex; flex-direction:column; gap:10px; margin-top:8px; }',
      '.csi-rec-item {',
      '  position:relative; background:#f9fafb;',
      '  border:1.5px solid #e5e7eb; border-radius:8px; padding:8px 36px 8px 10px;',
      '}',
      '.csi-rec-lbl { font-size:11px; font-weight:600; color:#6b7280; margin-bottom:5px; }',
      '.csi-rec-audio { width:100%; height:36px; display:block; }',
      '.csi-rec-video { width:100%; max-height:160px; border-radius:4px; background:#000; display:block; }',
      '.csi-rec-item .csi-ss-item-remove { position:absolute; top:-6px; right:-6px; }',

      /* Scrollbar */
      '#csi-modal::-webkit-scrollbar { width:5px; }',
      '#csi-modal::-webkit-scrollbar-track { background:transparent; }',
      '#csi-modal::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:3px; }',

      /* ── Consent overlay ─────────────────────────────────────────────── */
      '#csi-consent-overlay {',
      '  display:none; position:absolute; inset:0;',
      '  background:rgba(0,0,0,0.55);',
      '  pointer-events:auto;',
      '  align-items:center; justify-content:center;',
      '  padding:16px;',
      '  backdrop-filter:blur(3px);',
      '}',
      '#csi-consent-overlay.open { display:flex; }',

      '#csi-consent-modal {',
      '  background:#fff; border-radius:16px;',
      '  width:100%; max-width:480px; max-height:90vh;',
      '  overflow-y:auto;',
      '  box-shadow:0 24px 64px rgba(0,0,0,0.22);',
      '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      '  animation:csi-in 0.22s ease;',
      '}',

      '#csi-consent-header {',
      '  display:flex; align-items:center; gap:12px;',
      '  padding:20px 22px 16px;',
      '  border-bottom:1px solid #f0f0f0;',
      '}',
      '.csi-consent-shield {',
      '  width:40px; height:40px; flex-shrink:0;',
      '  background:' + t + '15;',
      '  border-radius:10px; display:flex; align-items:center; justify-content:center;',
      '  font-size:20px;',
      '}',
      '.csi-consent-title { font-size:16px; font-weight:700; color:#111; margin-bottom:2px; }',
      '.csi-consent-subtitle { font-size:12px; color:#6b7280; }',

      '#csi-consent-body { padding:20px 22px; display:flex; flex-direction:column; gap:14px; }',

      '.csi-consent-notice {',
      '  background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:10px;',
      '  padding:14px 16px; font-size:13px; color:#374151; line-height:1.6;',
      '}',
      '.csi-consent-notice p { margin:0 0 8px; }',
      '.csi-consent-notice p:last-child { margin:0; }',
      '.csi-consent-notice strong { color:#111; }',

      '.csi-consent-points {',
      '  display:flex; flex-direction:column; gap:7px;',
      '  font-size:12.5px; color:#374151;',
      '}',
      '.csi-consent-point {',
      '  display:flex; align-items:flex-start; gap:8px;',
      '}',
      '.csi-consent-point-icon { font-size:13px; flex-shrink:0; margin-top:1px; }',

      '.csi-consent-options { display:flex; flex-direction:column; gap:9px; }',
      '.csi-consent-option {',
      '  display:flex; align-items:flex-start; gap:11px;',
      '  padding:12px 14px; border-radius:9px; cursor:pointer; user-select:none;',
      '  border:1.5px solid #e5e7eb; background:#f9fafb; transition:border-color 0.15s, background 0.15s;',
      '}',
      '.csi-consent-option:hover { border-color:#d1d5db; background:#f3f4f6; }',
      '.csi-consent-option.selected-agree  { background:#f0fdf4; border-color:#86efac; }',
      '.csi-consent-option.selected-disagree { background:#fef2f2; border-color:#fca5a5; }',
      '.csi-consent-option input[type=radio] {',
      '  width:16px; height:16px; flex-shrink:0; margin-top:3px; cursor:pointer;',
      '  accent-color:' + t + ';',
      '}',
      '.csi-consent-opt-icon { font-size:16px; flex-shrink:0; }',
      '.csi-consent-opt-text { display:flex; flex-direction:column; gap:2px; font-size:12.5px; color:#374151; line-height:1.5; }',
      '.csi-consent-opt-text strong { font-size:13px; color:#111; }',

      '#csi-consent-footer {',
      '  display:flex; justify-content:flex-end; align-items:center; gap:10px;',
      '  padding:14px 22px; border-top:1px solid #f0f0f0;',
      '  background:#fafafa; border-radius:0 0 16px 16px;',
      '}',

      '.csi-consent-btn-cancel { background:#f3f4f6; color:#374151; }',
      '.csi-consent-btn-cancel:hover { background:#e5e7eb; }',
      '.csi-consent-btn-submit {',
      '  background:' + t + '; color:#fff;',
      '  min-width:110px; display:flex; align-items:center; justify-content:center; gap:6px;',
      '}',
      '.csi-consent-btn-submit:hover:not(:disabled) { filter:brightness(1.1); }',
      '.csi-consent-btn-submit:disabled { opacity:0.45; cursor:not-allowed; }',
    ].join('\n');
  }

  // ─── DOM Builders ─────────────────────────────────────────────────────────

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'className') node.className = attrs[k];
      else if (k === 'innerHTML') node.innerHTML = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    if (children) children.forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function txt(str) { return document.createTextNode(str); }

  function bugIcon(color) {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }

  function checkIcon() {
    return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  }

  function buildShadow(config) {
    var host = document.createElement('div');
    host.id  = 'csi-widget-host';
    host.setAttribute('style',
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:2147483645;overflow:visible;'
    );
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = getStyles(config.theme);
    shadow.appendChild(style);

    return shadow;
  }

  function buildFAB(shadow, config) {
    var fab = document.createElement('button');
    fab.id  = 'csi-fab';
    fab.setAttribute('aria-label', config.label);
    fab.innerHTML     = bugIcon('#fff') + config.label;
    fab._csiOrigHTML  = fab.innerHTML;   // saved for restore after minimize
    shadow.appendChild(fab);
    return fab;
  }

  function buildModal(shadow, config) {
    var overlay = document.createElement('div');
    overlay.id  = 'csi-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Report an Issue');

    var modal = document.createElement('div');
    modal.id  = 'csi-modal';

    /* ── Header ── */
    var header = document.createElement('div');
    header.id  = 'csi-header';

    var titleBox = document.createElement('div');
    titleBox.className = 'csi-title';
    titleBox.innerHTML = '<div class="csi-icon-box">' + bugIcon(config.theme) + '</div>';
    titleBox.appendChild(txt('Report an Issue'));

    var hdrActions = document.createElement('div');
    hdrActions.id = 'csi-hdr-actions';

    var minBtn = document.createElement('button');
    minBtn.id        = 'csi-minimize';
    minBtn.innerHTML = '&#8722;';
    minBtn.setAttribute('aria-label', 'Minimize');
    minBtn.setAttribute('title', 'Minimize — navigate pages and come back');

    var closeBtn = document.createElement('button');
    closeBtn.id        = 'csi-close';
    closeBtn.innerHTML = '&#215;';
    closeBtn.setAttribute('aria-label', 'Close');

    hdrActions.appendChild(minBtn);
    hdrActions.appendChild(closeBtn);
    header.appendChild(titleBox);
    header.appendChild(hdrActions);

    /* ── Tab Navigation ── */
    var tabNav = document.createElement('div');
    tabNav.id = 'csi-tabs';

    var tabNew = document.createElement('button');
    tabNew.id        = 'csi-tab-new';
    tabNew.type      = 'button';
    tabNew.className = 'csi-tab active';
    tabNew.innerHTML = '&#9998; New Report';

    var tabMy = document.createElement('button');
    tabMy.id        = 'csi-tab-my';
    tabMy.type      = 'button';
    tabMy.className = 'csi-tab';
    tabMy.innerHTML = '&#128203; My Reports';

    tabNav.appendChild(tabNew);
    tabNav.appendChild(tabMy);

    /* ── My Reports Panel ── */
    var myWrap = document.createElement('div');
    myWrap.id = 'csi-my-reports-wrap';

    var mrHdrRow = document.createElement('div');
    mrHdrRow.className = 'csi-mr-hdr-row';

    var mrHdr = document.createElement('div');
    mrHdr.className = 'csi-mr-section-hdr';
    mrHdr.appendChild(txt('Your Submitted Reports'));

    var mrRefreshBtn = document.createElement('button');
    mrRefreshBtn.id        = 'csi-mr-refresh';
    mrRefreshBtn.type      = 'button';
    mrRefreshBtn.className = 'csi-mr-refresh';
    mrRefreshBtn.innerHTML = '<span class="csi-mr-refresh-icon">&#8635;</span> Refresh';

    mrHdrRow.appendChild(mrHdr);
    mrHdrRow.appendChild(mrRefreshBtn);

    var myPanel = document.createElement('div');
    myPanel.id = 'csi-my-reports';

    myWrap.appendChild(mrHdrRow);
    myWrap.appendChild(myPanel);

    /* ── Form Content ── */
    var formWrap = document.createElement('div');
    formWrap.id = 'csi-form-wrap';

    var body = document.createElement('div');
    body.id  = 'csi-body';

    // Summary field
    body.appendChild(buildField('csi-summary', 'text', 'Issue Title', true, 'text', 'One-line title of the issue'));
    // Description field
    body.appendChild(buildField('csi-desc', 'textarea', 'Description', true, 'textarea', 'Describe what happened, what you expected, and steps to reproduce…'));

    // Priority field (standalone — category removed, will be set by AI pipeline)
    body.appendChild(buildSelect('csi-priority', 'Priority', false, [
      { v: '', l: 'Select priority (optional)' },
      { v: 'Low', l: 'Low' },
      { v: 'Medium', l: 'Medium' },
      { v: 'High', l: 'High' },
      { v: 'Critical', l: 'Critical' },
    ]));

    // Media attachments section
    body.appendChild(buildMediaSection(config));

    // Technical Details collapsible
    body.appendChild(buildTechSection());

    /* ── Footer ── */
    var footer = document.createElement('div');
    footer.id  = 'csi-footer';

    var cancelBtn = document.createElement('button');
    cancelBtn.id        = 'csi-cancel';
    cancelBtn.className = 'csi-btn csi-btn-cancel';
    cancelBtn.appendChild(txt('Cancel'));

    var submitBtn = document.createElement('button');
    submitBtn.id        = 'csi-submit';
    submitBtn.className = 'csi-btn csi-btn-submit';
    submitBtn.innerHTML = 'Submit Issue';

    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);

    formWrap.appendChild(body);
    formWrap.appendChild(footer);

    /* ── Success Panel (centered, shown after submit) ── */
    var success = document.createElement('div');
    success.id  = 'csi-success';
    success.innerHTML = [
      '<div class="csi-ok-icon">' + checkIcon() + '</div>',
      '<div class="csi-ok-ttl">Issue Reported Successfully!</div>',
      '<div class="csi-ref" id="csi-refid"></div>',
      '<div class="csi-ok-sub">Our team has been notified and will investigate shortly.</div>',
    ].join('');

    var doneBtn = document.createElement('button');
    doneBtn.id        = 'csi-done';
    doneBtn.className = 'csi-btn csi-btn-submit';
    doneBtn.style.marginTop = '8px';
    doneBtn.appendChild(txt('Done'));
    success.appendChild(doneBtn);

    modal.appendChild(header);
    modal.appendChild(tabNav);
    modal.appendChild(formWrap);
    modal.appendChild(myWrap);
    modal.appendChild(success);
    overlay.appendChild(modal);
    shadow.appendChild(overlay);

    return { overlay: overlay, closeBtn: closeBtn, cancelBtn: cancelBtn, submitBtn: submitBtn, doneBtn: doneBtn, minBtn: minBtn };
  }

  function buildField(id, type, label, required, inputType, placeholder) {
    var field = document.createElement('div');
    field.className = 'csi-field';

    var lbl = document.createElement('label');
    lbl.className = 'csi-label';
    lbl.setAttribute('for', id);
    lbl.appendChild(txt(label));
    if (required) {
      var req = document.createElement('span');
      req.className = 'csi-req';
      req.appendChild(txt(' *'));
      lbl.appendChild(req);
    }

    var input;
    if (inputType === 'textarea') {
      input = document.createElement('textarea');
      input.className   = 'csi-textarea';
      input.placeholder = placeholder;
      input.id          = id;
    } else {
      input = document.createElement('input');
      input.type        = type;
      input.className   = 'csi-input';
      input.placeholder = placeholder;
      input.id          = id;
    }

    var errSpan = document.createElement('span');
    errSpan.className = 'csi-err';
    errSpan.id        = id + '-err';

    field.appendChild(lbl);
    field.appendChild(input);
    field.appendChild(errSpan);
    return field;
  }

  function buildSelect(id, label, required, options) {
    var field = document.createElement('div');
    field.className = 'csi-field';

    var lbl = document.createElement('label');
    lbl.className = 'csi-label';
    lbl.setAttribute('for', id);
    lbl.appendChild(txt(label));
    if (required) {
      var req = document.createElement('span');
      req.className = 'csi-req';
      req.appendChild(txt(' *'));
      lbl.appendChild(req);
    }

    var wrap = document.createElement('div');
    wrap.className = 'csi-sel-wrap';

    var sel = document.createElement('select');
    sel.id        = id;
    sel.className = 'csi-select';
    options.forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o.v;
      opt.appendChild(txt(o.l));
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);

    var errSpan = document.createElement('span');
    errSpan.className = 'csi-err';
    errSpan.id        = id + '-err';

    field.appendChild(lbl);
    field.appendChild(wrap);
    field.appendChild(errSpan);
    return field;
  }

  function buildTechSection() {
    var section = document.createElement('div');
    section.className = 'csi-tech';

    var hdr = document.createElement('div');
    hdr.className = 'csi-tech-hdr';
    hdr.id        = 'csi-tech-hdr';

    var titleSpan = document.createElement('span');
    titleSpan.innerHTML = '&#9881; Technical Details <span style="font-weight:400;color:#9ca3af">(auto-captured)</span>';

    var rightSide = document.createElement('span');
    rightSide.style.cssText = 'display:flex;align-items:center;gap:8px;';

    var refreshBtn = document.createElement('button');
    refreshBtn.id        = 'csi-tech-refresh';
    refreshBtn.type      = 'button';
    refreshBtn.className = 'csi-tech-refresh';
    refreshBtn.title     = 'Refresh captured data';
    refreshBtn.innerHTML = '<span class="csi-refresh-icon">&#8635;</span> Refresh';

    var chev = document.createElement('span');
    chev.className = 'csi-chev';
    chev.innerHTML = '&#9660;';

    rightSide.appendChild(refreshBtn);
    rightSide.appendChild(chev);
    hdr.appendChild(titleSpan);
    hdr.appendChild(rightSide);

    var body = document.createElement('div');
    body.className = 'csi-tech-body';
    body.id        = 'csi-tech-body';

    section.appendChild(hdr);
    section.appendChild(body);
    return section;
  }

  function buildMediaSection(config) {
    var field = document.createElement('div');
    field.className = 'csi-field';

    var lbl = document.createElement('label');
    lbl.className = 'csi-label';
    lbl.appendChild(txt('Media Attachments '));
    var opt = document.createElement('span');
    opt.style.cssText = 'font-weight:400; color:#9ca3af;';
    opt.appendChild(txt('(optional)'));
    lbl.appendChild(opt);

    var actions = document.createElement('div');
    actions.className = 'csi-ss-actions';

    var captureBtn = document.createElement('button');
    captureBtn.type = 'button';
    captureBtn.id = 'csi-screenshot-btn';
    captureBtn.className = 'csi-ss-btn';
    captureBtn.innerHTML = '&#128247; Capture Screen';

    var uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.id = 'csi-upload-btn';
    uploadBtn.className = 'csi-ss-btn';
    uploadBtn.innerHTML = '&#128247; Upload Image';

    actions.appendChild(captureBtn);
    actions.appendChild(uploadBtn);

    if (config.enableMediaRecording) {
      var voiceBtn = document.createElement('button');
      voiceBtn.type = 'button';
      voiceBtn.id = 'csi-voice-btn';
      voiceBtn.className = 'csi-ss-btn';
      voiceBtn.innerHTML = '&#127908; Record Voice';

      var videoBtn = document.createElement('button');
      videoBtn.type = 'button';
      videoBtn.id = 'csi-video-btn';
      videoBtn.className = 'csi-ss-btn';
      videoBtn.innerHTML = '&#127916; Record Screen';

      var uploadVideoBtn = document.createElement('button');
      uploadVideoBtn.type = 'button';
      uploadVideoBtn.id = 'csi-upload-video-btn';
      uploadVideoBtn.className = 'csi-ss-btn';
      uploadVideoBtn.innerHTML = '&#128190; Upload Video';

      actions.appendChild(voiceBtn);
      actions.appendChild(videoBtn);
      actions.appendChild(uploadVideoBtn);
    }

    var ssList = document.createElement('div');
    ssList.className = 'csi-ss-list';
    ssList.id = 'csi-ss-list';

    var recList = document.createElement('div');
    recList.className = 'csi-rec-list';
    recList.id = 'csi-rec-list';

    var hint = document.createElement('div');
    hint.className = 'csi-ss-hint';
    hint.id = 'csi-ss-hint';
    hint.appendChild(txt('No media attached'));

    field.appendChild(lbl);
    field.appendChild(actions);
    field.appendChild(ssList);
    field.appendChild(recList);
    field.appendChild(hint);
    return field;
  }

  // ─── My Reports helpers ──────────────────────────────────────────────────

  function switchTab(shadow, tab, config) {
    var formWrap = shadow.getElementById('csi-form-wrap');
    var myWrap   = shadow.getElementById('csi-my-reports-wrap');
    var tabNew   = shadow.getElementById('csi-tab-new');
    var tabMy    = shadow.getElementById('csi-tab-my');
    if (!formWrap || !myWrap) return;

    if (tab === 'my') {
      tabMy.classList.add('active');
      tabNew.classList.remove('active');
      formWrap.style.display = 'none';
      myWrap.style.display   = 'block';
      loadMyReports(shadow, config);
    } else {
      tabNew.classList.add('active');
      tabMy.classList.remove('active');
      formWrap.style.display = 'block';
      myWrap.style.display   = 'none';
    }
  }

  function loadMyReports(shadow, config) {
    var panel = shadow.getElementById('csi-my-reports');
    if (!panel) return;

    var who = captureWho(config);
    if (!who.user_email) {
      panel.innerHTML = '<div class="csi-mr-state">No user email configured.<br>Set <code>user.email</code> in the widget config to view your reports.</div>';
      return;
    }
    if (!config.apiUrl) {
      panel.innerHTML = '<div class="csi-mr-state">API not configured — reports unavailable in demo mode.</div>';
      return;
    }

    panel.innerHTML = '<div class="csi-mr-state"><span class="csi-mr-spin"></span>Loading your reports…</div>';

    var endpoint = config.apiUrl.replace(/\/$/, '') + '/api/reports';
    var params   = new URLSearchParams({ user_email: who.user_email, limit: '10' });
    if (config.projectId) params.set('project_id', config.projectId);

    fetch(endpoint + '?' + params.toString(), {
      headers: { 'X-Project-ID': config.projectId || '' },
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (data) {
      renderMyReports(panel, data);
    }).catch(function (err) {
      panel.innerHTML = '<div class="csi-mr-state err">&#9888; Could not load reports.<br>' + escHtml(err.message || 'Network error') + '</div>';
    });
  }

  function formatStatus(s) {
    var map = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };
    return map[s] || s;
  }

  function renderMyReports(panel, reports) {
    if (!reports || !reports.length) {
      panel.innerHTML = '<div class="csi-mr-state">No reports submitted yet.</div>';
      return;
    }

    var statusCls = { open: 'mr-open', in_progress: 'mr-inprog', resolved: 'mr-resolved', closed: 'mr-closed' };
    var prCls     = { Critical: 'mr-critical', High: 'mr-high', Medium: 'mr-medium', Low: 'mr-low' };

    var html = '';
    reports.forEach(function (r) {
      var dateStr = '';
      try {
        var d = new Date(r.reported_at_utc || r.created_at);
        dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) { dateStr = r.created_at || ''; }

      var sCls = statusCls[r.status] || 'mr-open';
      var pCls = r.priority ? (prCls[r.priority] || '') : '';

      html += '<div class="csi-mr-card">';
      html += '<div class="csi-mr-row1">';
      html += '<span class="csi-mr-ref">' + escHtml(r.ref_id) + '</span>';
      html += '<div class="csi-mr-badges">';
      if (r.priority) html += '<span class="csi-mr-badge ' + pCls + '">' + escHtml(r.priority) + '</span>';
      html += '<span class="csi-mr-badge ' + sCls + '">' + escHtml(formatStatus(r.status)) + '</span>';
      html += '</div></div>';
      html += '<div class="csi-mr-title">' + escHtml(r.summary) + '</div>';
      html += '<div class="csi-mr-meta">' + escHtml(dateStr);
      if (r.page_url) html += ' &middot; <span class="csi-mr-page">' + escHtml(urlPath(r.page_url)) + '</span>';
      html += '</div>';
      html += '</div>';
    });

    panel.innerHTML = html;
  }

  function scanMissedEntries(config) {
    if (!window.performance || typeof window.performance.getEntriesByType !== 'function') return;

    var pageUrl = window.location.href;
    var entries = window.performance.getEntriesByType('resource');
    var apiUrl  = (config.apiUrl || '').replace(/\/$/, '');

    // Build a set of normalised URLs already captured in state for quick lookup
    var captured = {};
    state.failedAPICalls.forEach(function (f) { captured[normalizeUrl(f.url)] = true; });

    entries.forEach(function (entry) {
      if (entry.initiatorType !== 'fetch' && entry.initiatorType !== 'xmlhttprequest') return;
      var url = entry.name;

      // Skip the widget's own backend calls
      if (apiUrl && url.indexOf(apiUrl) !== -1) return;

      // Network-level failure signature: no data transferred and no cached body
      // This catches CORS failures, DNS errors, connection refused, etc.
      // (HTTP 4xx/5xx still transfer a body so they won't match this)
      if (entry.transferSize === 0 && entry.encodedBodySize === 0 &&
          entry.decodedBodySize === 0 && entry.responseEnd > 0) {

        if (!captured[normalizeUrl(url)] && !isApiDuplicate(url, 'GET', 0, pageUrl)) {
          state.failedAPICalls.push({
            url         : url,
            method      : 'GET',
            status_code : 0,
            status_text : 'Network Error (detected via Performance API)',
            duration_ms : Math.round(entry.duration),
            timestamp   : new Date().toISOString(),
            page_url    : pageUrl,
          });
          captured[normalizeUrl(url)] = true;
        }
      }
    });
  }

  function resetToNewReport(shadow, config) {
    _resetFormState(shadow, config);
  }

  // ─── Helpers for page-grouped diagnostics ────────────────────────────────

  function urlPath(fullUrl) {
    try { return new URL(fullUrl).pathname || fullUrl; } catch (e) { return fullUrl; }
  }

  function groupByPage(items) {
    var groups = {}, order = [];
    items.forEach(function (item) {
      var key = item.page_url || window.location.href;
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(item);
    });
    return { groups: groups, order: order };
  }

  // ─── Populate Tech Details ─────────────────────────────────────────────

  function populateTech(shadow, config) {
    var body = shadow.getElementById('csi-tech-body');
    if (!body) return;

    var who   = captureWho(config);
    var where = captureWhere();
    var when  = captureWhen();

    var errCount      = state.consoleErrors.length;
    var wrnCount      = state.consoleWarnings.length;
    var dedupedApis   = deduplicateApiCalls(state.failedAPICalls);
    var apiCount      = dedupedApis.length;

    var rows = [
      { icon: '👤', key: 'Reporter',    val: (who.user_name || 'Anonymous') + (who.user_email ? ' · ' + who.user_email : '') + (who.user_role ? ' · ' + who.user_role : '') },
      { icon: '🌐', key: 'Page',        val: (where.page_title || '-') + ' <span style="color:#9ca3af;font-size:11.5px">' + truncate(where.url, 60) + '</span>' },
      { icon: '💻', key: 'Environment', val: where.browser + ' · ' + where.os + ' · ' + where.device + ' · ' + where.viewport },
      { icon: '🕐', key: 'Timestamp',   val: when.local_timestamp + ' <span style="color:#9ca3af">(' + when.timezone + ')</span>' },
      {
        icon: '⚠',
        key: 'Diagnostics',
        val: badge(errCount, 'err', 'error') + '&nbsp;' +
            badge(wrnCount, 'wrn', 'warning') + '&nbsp;' +
            badge(apiCount, 'api', 'failed API'),
      },
    ];

    var html = rows.map(function (r) {
      return '<div class="csi-trow"><span class="csi-tico">' + r.icon + '</span><span class="csi-tkey">' + r.key + '</span><span class="csi-tval">' + r.val + '</span></div>';
    }).join('');

    // Console errors — grouped by page
    if (errCount > 0) {
      html += '<div class="csi-diag"><div class="csi-diag-ttl">Console Errors (' + errCount + ')</div>';
      var errGroups = groupByPage(state.consoleErrors.slice(-15));
      errGroups.order.forEach(function (pageUrl) {
        if (errGroups.order.length > 1) {
          html += '<div class="csi-diag-page">&#128279; ' + escHtml(urlPath(pageUrl)) + '</div>';
        }
        errGroups.groups[pageUrl].slice(-5).forEach(function (e) {
          html += '<div class="csi-diag-item">[' + e.level.toUpperCase() + '] ' + escHtml(truncate(e.message, 120)) + '</div>';
        });
      });
      html += '</div>';
    }

    // Failed API calls — grouped by page, deduplicated
    if (apiCount > 0) {
      html += '<div class="csi-diag"><div class="csi-diag-ttl">Failed API Calls (' + apiCount + ')</div>';
      var apiGroups = groupByPage(state.failedAPICalls);
      apiGroups.order.forEach(function (pageUrl) {
        if (apiGroups.order.length > 1) {
          html += '<div class="csi-diag-page">&#128279; ' + escHtml(urlPath(pageUrl)) + '</div>';
        }
        deduplicateApiCalls(apiGroups.groups[pageUrl]).forEach(function (item) {
          var a = item.entry;
          html += '<div class="csi-api-item">';
          html += '<div class="csi-api-top">' + methodBadge(a.method) + ' ' + statusBadge(a.status_code);
          if (item.count > 1) html += '<span class="csi-diag-count">&#215;' + item.count + '</span>';
          html += '</div>';
          html += '<div class="csi-api-url">' + escHtml(truncate(a.url, 80)) + '</div>';
          if (a.status_text) {
            html += '<div class="csi-api-sub">' + escHtml(truncate(a.status_text, 80)) + ' &middot; ' + a.duration_ms + 'ms</div>';
          }
          html += '</div>';
        });
      });
      html += '</div>';
    }

    body.innerHTML = html;
  }

  function deduplicateApiCalls(calls) {
    var seen = {}, result = [];
    calls.forEach(function (c) {
      var key = normalizeUrl(c.url) + '||' + c.method + '||' + c.status_code;
      if (!seen[key]) { seen[key] = { entry: c, count: 1 }; result.push(seen[key]); }
      else            { seen[key].count++; }
    });
    return result;
  }

  function statusBadge(code) {
    if (code === 0)  return '<span class="csi-badge stat-err">Err</span>';
    if (code >= 500) return '<span class="csi-badge stat-5xx">' + code + '</span>';
    if (code >= 400) return '<span class="csi-badge stat-4xx">' + code + '</span>';
    if (code >= 300) return '<span class="csi-badge stat-3xx">' + code + '</span>';
    return '<span class="csi-badge ok">' + code + '</span>';
  }

  function methodBadge(method) {
    var m   = (method || 'GET').toUpperCase();
    var cls = { GET:'meth-get', POST:'meth-post', PUT:'meth-put', DELETE:'meth-del', PATCH:'meth-patch', XHR:'meth-xhr' }[m] || 'meth-get';
    return '<span class="csi-badge ' + cls + '">' + m + '</span>';
  }

  function badge(count, cls, label) {
    return '<span class="csi-badge ' + (count > 0 ? cls : 'ok') + '">' + count + ' ' + label + (count !== 1 ? 's' : '') + '</span>';
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ─── Consent Helpers ──────────────────────────────────────────────────────

  function getConsentKey(config) {
    var who = captureWho(config);
    var userKey = who.user_email || who.user_id || 'anon';
    return 'csi-consent-v1-' + (config.projectId || 'default') + '-' + userKey;
  }

  function isConsentGiven(config) {
    try {
      var stored = localStorage.getItem(getConsentKey(config));
      if (!stored) return false;
      var parsed = JSON.parse(stored);
      return parsed && parsed.consented === true;
    } catch (e) { return false; }
  }

  function saveConsentLocal(config) {
    try {
      localStorage.setItem(getConsentKey(config), JSON.stringify({
        consented  : true,
        savedAt    : new Date().toISOString(),
        projectId  : config.projectId,
      }));
    } catch (e) {}
  }

  function clearConsentLocal(config) {
    try {
      localStorage.removeItem(getConsentKey(config));
    } catch (e) {}
  }

  function postConsentToServer(config, consented) {
    if (!config.apiUrl) return;
    var who = captureWho(config);
    if (!who.user_email && !who.user_id) return;   // only persist identified users

    var endpoint = config.apiUrl.replace(/\/$/, '') + '/api/consents';
    fetch(endpoint, {
      method  : 'POST',
      headers : {
        'Content-Type' : 'application/json',
        'X-Project-ID' : config.projectId || '',
      },
      body : JSON.stringify({
        user_email : who.user_email || null,
        user_id    : who.user_id   || null,
        user_name  : who.user_name || null,
        user_role  : who.user_role || null,
        project_id : config.projectId,
        consented  : consented === true,
        user_agent : navigator.userAgent,
      }),
    }).catch(function () {
      // Fire-and-forget — localStorage is the source of truth for the session
    });
  }

  function checkServerConsent(config, callback) {
    if (!config.apiUrl) { callback(false); return; }
    var who = captureWho(config);
    if (!who.user_email) { callback(false); return; }

    var endpoint = config.apiUrl.replace(/\/$/, '') + '/api/consents';
    var params   = new URLSearchParams({
      user_email : who.user_email,
      project_id : config.projectId || '',
    });
    fetch(endpoint + '?' + params.toString())
      .then(function (r) { return r.ok ? r.json() : { consented: false }; })
      .then(function (data) {
        if (data && data.consented === true) {
          saveConsentLocal(config);    // warm the local cache
          callback(true);
        } else {
          callback(false);
        }
      })
      .catch(function () { callback(false); });
  }

  // ─── Modal Open / Close ───────────────────────────────────────────────────

  function _resetFormState(shadow, config) {
    // Reset all form fields and validation state
    ['csi-summary', 'csi-desc', 'csi-priority'].forEach(function (id) {
      var el = shadow.getElementById(id);
      if (el) { el.value = ''; el.classList.remove('err'); }
    });
    ['csi-summary-err', 'csi-desc-err'].forEach(function (id) {
      var el = shadow.getElementById(id);
      if (el) el.textContent = '';
    });

    // Remove stale submit error if any
    var oldErr = shadow.getElementById('csi-sub-err');
    if (oldErr) oldErr.remove();

    // Reset submit button
    var submitBtn = shadow.getElementById('csi-submit');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = 'Submit Issue'; }

    // Collapse + refresh tech panel
    var techHdr  = shadow.getElementById('csi-tech-hdr');
    var techBody = shadow.getElementById('csi-tech-body');
    if (techHdr)  techHdr.classList.remove('open');
    if (techBody) techBody.classList.remove('open');
    populateTech(shadow, config);
    clearScreenshots(shadow);
    clearRecordings(shadow);

    // Hide success panel and restore tab nav
    var success = shadow.getElementById('csi-success');
    var tabNav  = shadow.getElementById('csi-tabs');
    if (success) success.classList.remove('show');
    if (tabNav)  tabNav.style.display = '';

    // Switch back to New Report tab
    switchTab(shadow, 'new', config);

    setTimeout(function () {
      var s = shadow.getElementById('csi-summary');
      if (s) s.focus();
    }, 80);
  }

  function openModal(shadow, config) {
    state.isOpen = true;
    _resetFormState(shadow, config);
    shadow.getElementById('csi-overlay').classList.add('open');
  }

  function minimizeModal(shadow, fab) {
    state.isMinimized = true;
    var overlay = shadow.getElementById('csi-overlay');
    if (overlay) overlay.classList.remove('open');
    if (fab) {
      fab.innerHTML = '&#9998;&nbsp;Resume Report&nbsp;&#8599;';
      fab.classList.add('minimized');
      fab.setAttribute('title', 'Click to resume your report');
    }
  }

  function restoreModal(shadow, fab, config) {
    state.isMinimized = false;
    var overlay = shadow.getElementById('csi-overlay');
    populateTech(shadow, config);   // refresh with any new errors captured while minimized
    if (overlay) overlay.classList.add('open');
    if (fab) {
      fab.innerHTML = fab._csiOrigHTML;
      fab.classList.remove('minimized');
      fab.removeAttribute('title');
    }
    setTimeout(function () {
      var s = shadow.getElementById('csi-summary');
      if (s) s.focus();
    }, 80);
  }

  function closeModal(shadow, fab) {
    state.isOpen = false;
    state.isMinimized = false;
    var overlay = shadow.getElementById('csi-overlay');
    if (overlay) overlay.classList.remove('open');
    if (fab) {
      fab.innerHTML = fab._csiOrigHTML;
      fab.classList.remove('minimized');
      fab.removeAttribute('title');
    }
  }

  // ─── Consent Dialog ───────────────────────────────────────────────────────

  function buildConsentModal(shadow) {
    var overlay = document.createElement('div');
    overlay.id  = 'csi-consent-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Privacy Acknowledgment');

    var modal = document.createElement('div');
    modal.id  = 'csi-consent-modal';

    /* Header */
    var header = document.createElement('div');
    header.id  = 'csi-consent-header';
    header.innerHTML = [
      '<div class="csi-consent-shield">&#128737;</div>',
      '<div>',
      '  <div class="csi-consent-title">Data Privacy Notice</div>',
      '  <div class="csi-consent-subtitle">Please review before submitting a report</div>',
      '</div>',
    ].join('');

    /* Body */
    var body = document.createElement('div');
    body.id  = 'csi-consent-body';

    var notice = document.createElement('div');
    notice.className = 'csi-consent-notice';
    notice.innerHTML = [
      '<p>When you submit an issue report, the following <strong>technical information</strong>',
      ' is automatically captured to help our team investigate the problem:</p>',
    ].join('');

    var points = document.createElement('div');
    points.className = 'csi-consent-points';
    points.innerHTML = [
      '<div class="csi-consent-point"><span class="csi-consent-point-icon">&#128279;</span><span>Current page URL, page title, and browser referrer</span></div>',
      '<div class="csi-consent-point"><span class="csi-consent-point-icon">&#128187;</span><span>Browser type, operating system, device type, and viewport dimensions</span></div>',
      '<div class="csi-consent-point"><span class="csi-consent-point-icon">&#128100;</span><span>Your name, email, and role (if you are logged in)</span></div>',
      '<div class="csi-consent-point"><span class="csi-consent-point-icon">&#9888;</span><span>Console errors and failed network requests recorded in this session</span></div>',
      '<div class="csi-consent-point"><span class="csi-consent-point-icon">&#128247;</span><span>Screenshots, voice recordings, and screen recordings you optionally attach to the report</span></div>',
      '<div class="csi-consent-point" style="color:#dc2626;font-weight:600;"><span class="csi-consent-point-icon">&#128683;</span><span><strong>Do not include patient health information (PHI) or any sensitive personal data</strong> in the issue title, description, or screenshots.</span></div>',
    ].join('');

    body.appendChild(notice);
    body.appendChild(points);

    /* Footer */
    var footer = document.createElement('div');
    footer.id  = 'csi-consent-footer';

    var cancelBtn = document.createElement('button');
    cancelBtn.id        = 'csi-consent-cancel';
    cancelBtn.className = 'csi-btn csi-consent-btn-cancel';
    cancelBtn.appendChild(document.createTextNode('Cancel'));

    var submitBtn = document.createElement('button');
    submitBtn.id        = 'csi-consent-submit';
    submitBtn.className = 'csi-btn csi-consent-btn-submit';
    submitBtn.innerHTML = 'I Agree &amp; Continue';

    footer.appendChild(cancelBtn);
    footer.appendChild(submitBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    shadow.appendChild(overlay);
  }

  function openConsentModal(shadow) {
    state.isConsentOpen = true;
    var overlay = shadow.getElementById('csi-consent-overlay');
    if (overlay) overlay.classList.add('open');
  }

  function closeConsentModal(shadow) {
    state.isConsentOpen = false;
    var overlay = shadow.getElementById('csi-consent-overlay');
    if (overlay) overlay.classList.remove('open');
  }

  function wireConsentEvents(shadow, fab, config) {
    var submitBtn = shadow.getElementById('csi-consent-submit');
    var cancelBtn = shadow.getElementById('csi-consent-cancel');

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        saveConsentLocal(config);
        postConsentToServer(config, true);
        closeConsentModal(shadow);
        openModal(shadow, config);
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        closeConsentModal(shadow);
      });
    }
  }

  function tryOpenModal(shadow, fab, config) {
    var who = captureWho(config);
    if (who.user_email || who.user_id) {
      // Identified user — MongoDB is the source of truth.
      // Always verify with server so a deleted DB record forces re-consent.
      checkServerConsent(config, function (serverConsented) {
        if (serverConsented) {
          saveConsentLocal(config);   // keep local cache in sync
          openModal(shadow, config);
        } else {
          clearConsentLocal(config);  // invalidate any stale local cache
          openConsentModal(shadow);
        }
      });
      return;
    }
    // Anonymous user — no server record possible, fall back to localStorage only
    if (isConsentGiven(config)) {
      openModal(shadow, config);
    } else {
      openConsentModal(shadow);
    }
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  function validate(shadow) {
    var valid = true;

    function check(id, errId, msg) {
      var f = shadow.getElementById(id);
      var e = shadow.getElementById(errId);
      if (!f || !f.value.trim()) {
        if (e) e.textContent = msg;
        if (f) f.classList.add('err');
        valid = false;
      } else {
        if (e) e.textContent = '';
        if (f) f.classList.remove('err');
      }
    }

    check('csi-summary', 'csi-summary-err', 'Issue title is required.');
    check('csi-desc',    'csi-desc-err',     'Description is required.');
    return valid;
  }

  // ─── Build Payload ────────────────────────────────────────────────────────

  function buildPayload(shadow, config) {
    var sumEl  = shadow.getElementById('csi-summary');
    var descEl = shadow.getElementById('csi-desc');
    var priEl  = shadow.getElementById('csi-priority');
    return {
      project_id  : config.projectId,
      summary     : sumEl  ? sumEl.value.trim()  : '',
      description : descEl ? descEl.value.trim() : '',
      priority    : priEl  ? (priEl.value || null) : null,
      who         : captureWho(config),
      where       : captureWhere(),
      when        : captureWhen(),
      diagnostics : {
        console_errors   : state.consoleErrors.slice(),
        console_warnings : state.consoleWarnings.slice(),
        failed_api_calls : state.failedAPICalls.slice(),
        screenshots      : state.screenshots.slice(),
        voice_recordings : state.voiceRecordings.slice(),
        video_recordings : state.videoRecordings.slice(),
      },
    };
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  function submitReport(shadow, config) {
    if (!validate(shadow)) return;

    var submitBtn = shadow.getElementById('csi-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="csi-spin"></span>';

    var payload = buildPayload(shadow, config);

    var doSuccess = function (refId) {
      // Clear captured diagnostics (monitoring continues)
      state.consoleErrors   = [];
      state.consoleWarnings = [];
      state.failedAPICalls  = [];
      state.screenshots     = [];
      state.voiceRecordings = [];
      state.videoRecordings = [];

      // Hide form + tabs, show centered success panel
      var formWrap = shadow.getElementById('csi-form-wrap');
      var myWrap   = shadow.getElementById('csi-my-reports-wrap');
      var tabNav   = shadow.getElementById('csi-tabs');
      var success  = shadow.getElementById('csi-success');
      var refEl    = shadow.getElementById('csi-refid');
      if (formWrap) formWrap.style.display = 'none';
      if (myWrap)   myWrap.style.display   = 'none';
      if (tabNav)   tabNav.style.display   = 'none';
      if (refEl)    refEl.textContent = refId;
      if (success)  success.classList.add('show');
    };

    var doError = function (msg) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit Issue';
      var footer = shadow.getElementById('csi-footer');
      var errEl  = shadow.getElementById('csi-sub-err');
      if (!errEl && footer) {
        errEl = document.createElement('span');
        errEl.id        = 'csi-sub-err';
        errEl.className = 'csi-sub-err';
        footer.insertBefore(errEl, footer.firstChild);
      }
      if (errEl) errEl.textContent = msg || 'Submission failed. Please try again.';
    };

    if (config.apiUrl) {
      var endpoint = config.apiUrl.replace(/\/$/, '') + '/api/reports';
      fetch(endpoint, {
        method  : 'POST',
        headers : { 'Content-Type': 'application/json', 'X-Project-ID': config.projectId },
        body    : JSON.stringify(payload),
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().catch(function () { return {}; });
      }).then(function (data) {
        doSuccess(data.ref_id || data.id || genRef());
      }).catch(function () {
        doError('Submission failed. Please check your connection.');
      });
    } else {
      // Mock / demo mode — log payload and simulate success
      console.log('[Blagh] Mock submission payload:', JSON.stringify(payload, null, 2));
      setTimeout(function () { doSuccess(genRef()); }, 900);
    }
  }

  function genRef() {
    return 'REF-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  // ─── Screenshot Capture ────────────────────────────────────────────────────

  function startScreenshotCapture(shadow) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      triggerFileUpload(shadow);
      return;
    }
    var host = document.getElementById('csi-widget-host');
    if (host) host.style.display = 'none';
    // Failsafe: always restore host visibility after 30 s in case the flow is interrupted
    var restoreTimer = setTimeout(function () { if (host) host.style.display = ''; }, 30000);
    showCaptureBanner(shadow, host, restoreTimer);
  }

  function showCaptureBanner(shadow, host, restoreTimer) {
    var banner = document.createElement('div');
    banner.id = 'csi-capture-banner';
    banner.style.cssText = [
      'position:fixed;top:20px;left:50%;transform:translateX(-50%);',
      'z-index:2147483647;background:rgba(17,24,39,0.92);color:#fff;',
      'border-radius:12px;padding:14px 20px;',
      'display:flex;align-items:center;gap:12px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
      'font-size:13px;box-shadow:0 8px 32px rgba(0,0,0,0.35);',
      'white-space:nowrap;',
    ].join('');

    var text = document.createElement('span');
    text.textContent = '\uD83D\uDCCC Scroll to the area you want to capture, then click';

    var captureBtn = document.createElement('button');
    captureBtn.textContent = '\uD83D\uDCF8 Capture Now';
    captureBtn.style.cssText = [
      'padding:7px 16px;border-radius:8px;border:none;',
      'background:#3b82f6;color:#fff;font-size:13px;',
      'font-weight:600;cursor:pointer;font-family:inherit;',
    ].join('');

    var spaceHint = document.createElement('span');
    spaceHint.textContent = 'or press Space';
    spaceHint.style.cssText = 'color:rgba(255,255,255,0.45);font-size:12px;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = '\u2715';
    cancelBtn.setAttribute('aria-label', 'Cancel capture');
    cancelBtn.style.cssText = [
      'padding:5px 9px;border-radius:6px;border:none;',
      'background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);',
      'font-size:14px;cursor:pointer;font-family:inherit;',
    ].join('');

    banner.appendChild(text);
    banner.appendChild(captureBtn);
    banner.appendChild(spaceHint);
    banner.appendChild(cancelBtn);
    document.body.appendChild(banner);

    function doCapture() {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
      document.removeEventListener('keydown', keyHandler);
      performCapture(shadow, host, restoreTimer);
    }

    function doCancel() {
      clearTimeout(restoreTimer);
      if (banner.parentNode) banner.parentNode.removeChild(banner);
      document.removeEventListener('keydown', keyHandler);
      if (host) host.style.display = '';
    }

    var keyHandler = function (e) {
      if (e.key === ' ') { e.preventDefault(); doCapture(); }
      else if (e.key === 'Escape') { doCancel(); }
    };

    captureBtn.addEventListener('click', doCapture);
    cancelBtn.addEventListener('click', doCancel);
    document.addEventListener('keydown', keyHandler);
  }

  function performCapture(shadow, host, restoreTimer) {
    setTimeout(function () {
      navigator.mediaDevices.getDisplayMedia({ video: true, audio: false, preferCurrentTab: true })
          .then(function (stream) {
            var video = document.createElement('video');
            video.muted = true;
            video.srcObject = stream;
            video.onloadedmetadata = function () {
              video.play().then(function () {
                setTimeout(function () {
                  var canvas = document.createElement('canvas');
                  canvas.width  = video.videoWidth  || window.screen.width;
                  canvas.height = video.videoHeight || window.screen.height;
                  canvas.getContext('2d').drawImage(video, 0, 0);
                  stream.getTracks().forEach(function (t) { t.stop(); });
                  video.srcObject = null;
                  clearTimeout(restoreTimer);
                  if (host) host.style.display = '';
                  showCropOverlay(canvas, shadow);
                }, 120);
              });
            };
          })
          .catch(function (err) {
            clearTimeout(restoreTimer);
            if (host) host.style.display = '';
            if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
              var hint = shadow.getElementById('csi-ss-hint');
              if (hint) hint.textContent = 'Screen capture failed \u2014 try "Upload Image" instead.';
            }
          });
    }, 180);
  }

  function showCropOverlay(sourceCanvas, shadow) {
    var W = window.innerWidth;
    var H = window.innerHeight;

    var overlay = document.createElement('div');
    overlay.id = 'csi-crop-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;user-select:none;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    var canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    canvas.style.cssText = 'position:absolute;inset:0;display:block;cursor:crosshair;';

    var ctx = canvas.getContext('2d');
    var srcW  = sourceCanvas.width;
    var srcH  = sourceCanvas.height;
    var scale = Math.min(W / srcW, H / srcH);
    var imgW  = srcW * scale;
    var imgH  = srcH * scale;
    var imgX  = (W - imgW) / 2;
    var imgY  = (H - imgH) / 2;

    function drawState(sel) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(sourceCanvas, imgX, imgY, imgW, imgH);
      ctx.globalAlpha = 1;
      if (!sel || Math.abs(sel.w) < 4 || Math.abs(sel.h) < 4) return;

      var x = sel.w > 0 ? sel.x : sel.x + sel.w;
      var y = sel.h > 0 ? sel.y : sel.y + sel.h;
      var w = Math.abs(sel.w);
      var h = Math.abs(sel.h);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,     0,     W, y);
      ctx.fillRect(0,     y + h, W, H - y - h);
      ctx.fillRect(0,     y,     x, h);
      ctx.fillRect(x + w, y,     W - x - w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.globalAlpha = 1;
      ctx.drawImage(sourceCanvas, imgX, imgY, imgW, imgH);
      ctx.restore();

      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      ctx.fillStyle = '#fff';
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(function (p) {
        ctx.fillRect(p[0] - 4, p[1] - 4, 8, 8);
      });
    }
    drawState(null);

    var sel = { active: false, x: 0, y: 0, w: 0, h: 0, done: false };

    canvas.addEventListener('mousedown', function (e) {
      var r = canvas.getBoundingClientRect();
      sel.active = true; sel.done = false;
      sel.x = e.clientX - r.left; sel.y = e.clientY - r.top;
      sel.w = 0; sel.h = 0;
      confirmBtn.style.display = 'none';
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!sel.active) return;
      var r = canvas.getBoundingClientRect();
      sel.w = (e.clientX - r.left) - sel.x;
      sel.h = (e.clientY - r.top)  - sel.y;
      drawState(sel);
    });
    canvas.addEventListener('mouseup', function () {
      if (!sel.active) return;
      sel.active = false;
      if (Math.abs(sel.w) > 10 && Math.abs(sel.h) > 10) {
        sel.done = true;
        confirmBtn.style.display = 'inline-flex';
      }
    });

    var hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;pointer-events:none;white-space:nowrap;';
    hint.textContent = 'Drag to select a region — or use a button below';

    var bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;';

    var confirmBtn = document.createElement('button');
    confirmBtn.textContent = '\u2713 Crop & Attach';
    confirmBtn.style.cssText = 'display:none;align-items:center;padding:10px 22px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;';

    var fullBtn = document.createElement('button');
    fullBtn.textContent = '\uD83D\uDCC4 Full Screenshot';
    fullBtn.style.cssText = 'padding:10px 22px;border-radius:8px;border:2px solid rgba(255,255,255,0.5);background:rgba(255,255,255,0.12);color:#fff;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = '\u2715 Cancel';
    cancelBtn.style.cssText = 'padding:10px 22px;border-radius:8px;border:2px solid rgba(255,255,255,0.25);background:transparent;color:rgba(255,255,255,0.65);font-size:14px;cursor:pointer;font-family:inherit;';

    bar.appendChild(confirmBtn);
    bar.appendChild(fullBtn);
    bar.appendChild(cancelBtn);
    overlay.appendChild(canvas);
    overlay.appendChild(hint);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);

    function finalize(dataUrl) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      attachScreenshot(dataUrl, shadow);
    }
    function dismiss() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    confirmBtn.addEventListener('click', function () {
      var x = sel.w > 0 ? sel.x : sel.x + sel.w;
      var y = sel.h > 0 ? sel.y : sel.y + sel.h;
      var w = Math.abs(sel.w);
      var h = Math.abs(sel.h);
      var srcX = Math.max(0, Math.round((x - imgX) / scale));
      var srcY = Math.max(0, Math.round((y - imgY) / scale));
      var srcW = Math.min(Math.round(w / scale), sourceCanvas.width  - srcX);
      var srcH = Math.min(Math.round(h / scale), sourceCanvas.height - srcY);
      var crop = document.createElement('canvas');
      crop.width  = srcW;
      crop.height = srcH;
      crop.getContext('2d').drawImage(sourceCanvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      finalize(crop.toDataURL('image/jpeg', 0.85));
    });
    fullBtn.addEventListener('click', function () {
      finalize(sourceCanvas.toDataURL('image/jpeg', 0.85));
    });
    cancelBtn.addEventListener('click', dismiss);

    var escHandler = function (e) {
      if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
  }

  function renderScreenshotPreviews(shadow) {
    var list = shadow.getElementById('csi-ss-list');
    if (!list) return;
    list.innerHTML = '';
    state.screenshots.forEach(function (dataUrl, idx) {
      var item = document.createElement('div');
      item.className = 'csi-ss-item';
      var img = document.createElement('img');
      img.className = 'csi-ss-thumb';
      img.src = dataUrl;
      img.alt = 'Screenshot ' + (idx + 1);
      var rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'csi-ss-item-remove';
      rmBtn.innerHTML = '&times;';
      rmBtn.setAttribute('aria-label', 'Remove screenshot ' + (idx + 1));
      (function (i) {
        rmBtn.addEventListener('click', function () { removeScreenshot(i, shadow); });
      }(idx));
      item.appendChild(img);
      item.appendChild(rmBtn);
      list.appendChild(item);
    });
    updateMediaHint(shadow);
  }

  function attachScreenshot(dataUrl, shadow) {
    state.screenshots.push(dataUrl);
    renderScreenshotPreviews(shadow);
  }

  function removeScreenshot(idx, shadow) {
    state.screenshots.splice(idx, 1);
    renderScreenshotPreviews(shadow);
  }

  function clearScreenshots(shadow) {
    state.screenshots = [];
    renderScreenshotPreviews(shadow);
  }

  function triggerFileUpload(shadow) {
    var input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function (e) { attachScreenshot(e.target.result, shadow); };
        reader.readAsDataURL(file);
      }
      if (input.parentNode) input.parentNode.removeChild(input);
    });
    input.click();
  }

  function triggerVideoUpload(shadow) {
    var MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    var input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'video/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (file) {
        if (file.size > MAX_BYTES) {
          var hint = shadow.getElementById('csi-ss-hint');
          if (hint) { hint.style.color = '#ef4444'; hint.textContent = 'Video exceeds the 10 MB limit — please choose a shorter clip.'; }
        } else {
          var reader = new FileReader();
          reader.onload = function (e) {
            state.videoRecordings.push(e.target.result);
            renderRecordingPreviews(shadow);
          };
          reader.readAsDataURL(file);
        }
      }
      if (input.parentNode) input.parentNode.removeChild(input);
    });
    input.click();
  }

  // ─── Media Hint ───────────────────────────────────────────────────────────

  function updateMediaHint(shadow) {
    var hint = shadow.getElementById('csi-ss-hint');
    if (!hint) return;
    hint.style.color = '';  // reset any error colour
    var sc  = state.screenshots.length;
    var vc  = state.voiceRecordings.length;
    var vid = state.videoRecordings.length;
    var total = sc + vc + vid;
    if (total === 0) { hint.textContent = 'No media attached'; return; }
    var parts = [];
    if (sc)  parts.push(sc  + ' screenshot'       + (sc  > 1 ? 's' : ''));
    if (vc)  parts.push(vc  + ' voice recording'  + (vc  > 1 ? 's' : ''));
    if (vid) parts.push(vid + ' screen recording' + (vid > 1 ? 's' : ''));
    hint.textContent = parts.join(', ') + ' attached';
  }

  // ─── Recording previews ───────────────────────────────────────────────────

  function renderRecordingPreviews(shadow) {
    var list = shadow.getElementById('csi-rec-list');
    if (!list) return;
    list.innerHTML = '';

    state.voiceRecordings.forEach(function (dataUrl, idx) {
      var item = document.createElement('div');
      item.className = 'csi-rec-item';
      var lbl = document.createElement('div');
      lbl.className = 'csi-rec-lbl';
      lbl.textContent = '\uD83C\uDF99\uFE0F Voice Recording ' + (idx + 1);
      var audio = document.createElement('audio');
      audio.controls = true;
      audio.src = dataUrl;
      audio.className = 'csi-rec-audio';
      var rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'csi-ss-item-remove';
      rmBtn.innerHTML = '&times;';
      rmBtn.setAttribute('aria-label', 'Remove voice recording ' + (idx + 1));
      (function (i) {
        rmBtn.addEventListener('click', function () { removeVoiceRecording(i, shadow); });
      }(idx));
      item.appendChild(lbl);
      item.appendChild(audio);
      item.appendChild(rmBtn);
      list.appendChild(item);
    });

    state.videoRecordings.forEach(function (dataUrl, idx) {
      var item = document.createElement('div');
      item.className = 'csi-rec-item';
      var lbl = document.createElement('div');
      lbl.className = 'csi-rec-lbl';
      lbl.textContent = '\uD83C\uDFA5 Screen Recording ' + (idx + 1);
      var video = document.createElement('video');
      video.controls = true;
      video.src = dataUrl;
      video.className = 'csi-rec-video';
      var rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'csi-ss-item-remove';
      rmBtn.innerHTML = '&times;';
      rmBtn.setAttribute('aria-label', 'Remove screen recording ' + (idx + 1));
      (function (i) {
        rmBtn.addEventListener('click', function () { removeVideoRecording(i, shadow); });
      }(idx));
      item.appendChild(lbl);
      item.appendChild(video);
      item.appendChild(rmBtn);
      list.appendChild(item);
    });

    updateMediaHint(shadow);
  }

  function removeVoiceRecording(idx, shadow) {
    state.voiceRecordings.splice(idx, 1);
    renderRecordingPreviews(shadow);
  }

  function removeVideoRecording(idx, shadow) {
    state.videoRecordings.splice(idx, 1);
    renderRecordingPreviews(shadow);
  }

  function clearRecordings(shadow) {
    state.voiceRecordings = [];
    state.videoRecordings = [];
    renderRecordingPreviews(shadow);
  }

  // ─── Recording helpers ────────────────────────────────────────────────────

  function blobToDataUrl(blob, callback) {
    var reader = new FileReader();
    reader.onload = function (e) { callback(e.target.result); };
    reader.readAsDataURL(blob);
  }

  function formatDuration(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  // ─── Voice Recording ──────────────────────────────────────────────────────

  function startVoiceRecording(shadow) {
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      var hint = shadow.getElementById('csi-ss-hint');
      if (hint) hint.textContent = 'Voice recording is not supported in this browser.';
      return;
    }
    var btn = shadow.getElementById('csi-voice-btn');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        _voiceRec.stream  = stream;
        _voiceRec.chunks  = [];
        _voiceRec.elapsed = 0;
        var mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
        _voiceRec.recorder = new MediaRecorder(stream, { mimeType: mimeType });
        _voiceRec.recorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) _voiceRec.chunks.push(e.data);
        };
        _voiceRec.recorder.onstop = function () {
          clearInterval(_voiceRec.timer);
          _voiceRec.timer = null;
          stream.getTracks().forEach(function (t) { t.stop(); });
          _voiceRec.stream = null;
          var blob = new Blob(_voiceRec.chunks, { type: mimeType });
          blobToDataUrl(blob, function (dataUrl) {
            state.voiceRecordings.push(dataUrl);
            renderRecordingPreviews(shadow);
          });
          if (btn) { btn.innerHTML = '&#127908; Record Voice'; btn.classList.remove('csi-rec-active'); }
        };
        _voiceRec.recorder.start(500);
        if (btn) { btn.classList.add('csi-rec-active'); btn.innerHTML = '&#9209; Stop (' + formatDuration(0) + ')'; }
        _voiceRec.timer = setInterval(function () {
          _voiceRec.elapsed++;
          if (btn) btn.innerHTML = '&#9209; Stop (' + formatDuration(_voiceRec.elapsed) + ')';
        }, 1000);
      })
      .catch(function (err) {
        if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
          var hint = shadow.getElementById('csi-ss-hint');
          if (hint) hint.textContent = 'Microphone access denied \u2014 check browser permissions.';
        }
      });
  }

  function stopVoiceRecording() {
    if (_voiceRec.recorder && _voiceRec.recorder.state !== 'inactive') {
      _voiceRec.recorder.stop();
    }
  }

  // ─── Screen / Video Recording ─────────────────────────────────────────────

  function startVideoRecording(shadow) {
    if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      var hint = shadow.getElementById('csi-ss-hint');
      if (hint) hint.textContent = 'Screen recording is not supported in this browser.';
      return;
    }
    var btn = shadow.getElementById('csi-video-btn');
    navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      .then(function (stream) {
        _videoRec.stream  = stream;
        _videoRec.chunks  = [];
        _videoRec.elapsed = 0;
        var mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
        var recOpts = mimeType ? { mimeType: mimeType } : {};
        _videoRec.recorder = new MediaRecorder(stream, recOpts);
        _videoRec.recorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) _videoRec.chunks.push(e.data);
        };
        _videoRec.recorder.onstop = function () {
          clearInterval(_videoRec.timer);
          _videoRec.timer = null;
          stream.getTracks().forEach(function (t) { t.stop(); });
          _videoRec.stream = null;
          var blob = new Blob(_videoRec.chunks, { type: 'video/webm' });
          blobToDataUrl(blob, function (dataUrl) {
            state.videoRecordings.push(dataUrl);
            renderRecordingPreviews(shadow);
          });
          if (btn) { btn.innerHTML = '&#127916; Record Screen'; btn.classList.remove('csi-rec-active'); }
        };
        // Handle user stopping screen share via browser's own stop button
        stream.getVideoTracks()[0].addEventListener('ended', function () {
          if (_videoRec.recorder && _videoRec.recorder.state !== 'inactive') {
            _videoRec.recorder.stop();
          }
        });
        _videoRec.recorder.start(500);
        if (btn) { btn.classList.add('csi-rec-active'); btn.innerHTML = '&#9209; Stop (' + formatDuration(0) + ')'; }
        _videoRec.timer = setInterval(function () {
          _videoRec.elapsed++;
          if (btn) btn.innerHTML = '&#9209; Stop (' + formatDuration(_videoRec.elapsed) + ')';
        }, 1000);
      })
      .catch(function () {
        // User cancelled the screen share picker — no error shown
      });
  }

  function stopVideoRecording() {
    if (_videoRec.recorder && _videoRec.recorder.state !== 'inactive') {
      _videoRec.recorder.stop();
    }
  }

  // ─── Draggable FAB ────────────────────────────────────────────────────────
  //
  // Position is stored as right/bottom offsets (distance from viewport edges).
  // The shadow host is position:fixed covering the full viewport; the FAB is
  // position:absolute inside it. right/bottom offsets are therefore viewport-
  // relative and stay anchored correctly on any resize — DevTools open/close,
  // dock side/bottom, screen rotation — with zero extra recalculation.

  function saveFabPos(right, bottom) {
    try { localStorage.setItem('csi-fab-pos', JSON.stringify({ right: right, bottom: bottom })); } catch (e) {}
  }

  function loadFabPos() {
    try {
      var s = localStorage.getItem('csi-fab-pos');
      if (!s) return null;
      var p = JSON.parse(s);
      // Accept only new right/bottom format; discard old left/top format
      return (typeof p.right === 'number' && typeof p.bottom === 'number') ? p : null;
    } catch (e) { return null; }
  }

  function makeDraggable(fab, shadow, config) {
    var THRESHOLD = 5;
    var drag = { active: false, moved: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };

    var saved = loadFabPos();
    if (saved) {
      // Restore as right/bottom — inherently viewport-relative, safe on any resize
      fab.style.left   = 'auto';
      fab.style.top    = 'auto';
      fab.style.right  = Math.max(0, saved.right)  + 'px';
      fab.style.bottom = Math.max(0, saved.bottom) + 'px';
    }

    // Clamp the FAB so it stays fully within the visible viewport.
    // Called on every resize (including DevTools open/close, screen rotation,
    // responsive emulation) to force a repaint and prevent the FAB from
    // disappearing when the viewport changes without prior user interaction.
    function clampFab() {
      if (drag.active) return; // never interrupt an in-progress drag

      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var fw = fab.offsetWidth  || 140;
      var fh = fab.offsetHeight || 48;

      // Recover a stuck drag (mousedown fired but mouseup was lost to DevTools)
      if (fab.style.left && fab.style.left !== 'auto') {
        var left   = Math.max(0, Math.min(parseFloat(fab.style.left) || 0, vw - fw));
        var top    = Math.max(0, Math.min(parseFloat(fab.style.top)  || 0, vh - fh));
        fab.style.left   = 'auto';
        fab.style.top    = 'auto';
        fab.style.right  = Math.max(0, vw - fw - left) + 'px';
        fab.style.bottom = Math.max(0, vh - fh - top)  + 'px';
        return;
      }

      // right/bottom mode: fall back to CSS defaults (24 px) if no inline value set
      var right  = fab.style.right  ? parseFloat(fab.style.right)  : 24;
      var bottom = fab.style.bottom ? parseFloat(fab.style.bottom) : 24;

      // Clamp so a large saved offset never pushes the FAB off-screen
      var newRight  = Math.max(0, Math.min(right,  vw - fw));
      var newBottom = Math.max(0, Math.min(bottom, vh - fh));

      // Always write the inline style explicitly — this forces a shadow-DOM
      // repaint in Chrome, fixing the stale-paint bug when DevTools opens.
      fab.style.right  = newRight  + 'px';
      fab.style.bottom = newBottom + 'px';
    }

    window.addEventListener('resize', clampFab);

    function onStart(clientX, clientY) {
      var rect      = fab.getBoundingClientRect();
      drag.active   = true;
      drag.moved    = false;
      drag.startX   = clientX;
      drag.startY   = clientY;
      drag.origLeft = rect.left;
      drag.origTop  = rect.top;
      // Switch to left/top during drag for direct pixel manipulation
      fab.style.right      = 'auto';
      fab.style.bottom     = 'auto';
      fab.style.left       = rect.left + 'px';
      fab.style.top        = rect.top  + 'px';
      fab.style.transition = 'none';
      fab.classList.add('dragging');
    }

    function onMove(clientX, clientY) {
      if (!drag.active) return;
      var dx = clientX - drag.startX;
      var dy = clientY - drag.startY;
      if (!drag.moved && (Math.abs(dx) > THRESHOLD || Math.abs(dy) > THRESHOLD)) {
        drag.moved = true;
      }
      if (drag.moved) {
        var newLeft = Math.max(0, Math.min(drag.origLeft + dx, window.innerWidth  - fab.offsetWidth));
        var newTop  = Math.max(0, Math.min(drag.origTop  + dy, window.innerHeight - fab.offsetHeight));
        fab.style.left = newLeft + 'px';
        fab.style.top  = newTop  + 'px';
      }
    }

    function onEnd() {
      if (!drag.active) return;
      drag.active = false;
      fab.style.transition = '';
      fab.classList.remove('dragging');
      if (drag.moved) {
        // Convert left/top → right/bottom so saved position is viewport-relative
        var left   = parseFloat(fab.style.left) || 0;
        var top    = parseFloat(fab.style.top)  || 0;
        var right  = Math.max(0, window.innerWidth  - fab.offsetWidth  - left);
        var bottom = Math.max(0, window.innerHeight - fab.offsetHeight - top);
        fab.style.left   = 'auto';
        fab.style.top    = 'auto';
        fab.style.right  = right  + 'px';
        fab.style.bottom = bottom + 'px';
        saveFabPos(right, bottom);
      } else {
        if (state.isMinimized) {
          restoreModal(shadow, fab, config);
        } else {
          tryOpenModal(shadow, fab, config);
        }
      }
    }

    fab.addEventListener('mousedown', function (e) { e.preventDefault(); onStart(e.clientX, e.clientY); });
    document.addEventListener('mousemove', function (e) { onMove(e.clientX, e.clientY); });
    document.addEventListener('mouseup',   function ()  { onEnd(); });

    fab.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; e.preventDefault(); onStart(t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener('touchmove', function (e) {
      if (!drag.active) return; var t = e.touches[0]; onMove(t.clientX, t.clientY);
    });
    document.addEventListener('touchend', function () { onEnd(); });
  }

  // ─── Wire Events ─────────────────────────────────────────────────────────

  function wireEvents(shadow, fab, els, config) {
    els.overlay.addEventListener('click', function (e) {
      if (e.target === els.overlay) minimizeModal(shadow, fab);
    });

    els.minBtn.addEventListener('click', function () { minimizeModal(shadow, fab); });

    var tabNewBtn = shadow.getElementById('csi-tab-new');
    var tabMyBtn  = shadow.getElementById('csi-tab-my');
    if (tabNewBtn) tabNewBtn.addEventListener('click', function () { switchTab(shadow, 'new', config); });
    if (tabMyBtn)  tabMyBtn.addEventListener('click',  function () { switchTab(shadow, 'my',  config); });

    var mrRefreshBtn = shadow.getElementById('csi-mr-refresh');
    if (mrRefreshBtn) {
      mrRefreshBtn.addEventListener('click', function () {
        mrRefreshBtn.disabled = true;
        mrRefreshBtn.classList.add('spinning');
        loadMyReports(shadow, config);
        // Re-enable after a short delay to cover the async fetch
        setTimeout(function () {
          mrRefreshBtn.disabled = false;
          mrRefreshBtn.classList.remove('spinning');
        }, 1200);
      });
    }

    els.closeBtn.addEventListener('click',  function () { closeModal(shadow, fab); });
    els.cancelBtn.addEventListener('click', function () { closeModal(shadow, fab); });
    els.doneBtn.addEventListener('click',   function () { resetToNewReport(shadow, config); });

    els.submitBtn.addEventListener('click', function () { submitReport(shadow, config); });

    var ssCapBtn      = shadow.getElementById('csi-screenshot-btn');
    var ssUpBtn       = shadow.getElementById('csi-upload-btn');
    var voiceBtn      = shadow.getElementById('csi-voice-btn');
    var videoBtn      = shadow.getElementById('csi-video-btn');
    var upVideoBtn    = shadow.getElementById('csi-upload-video-btn');
    if (ssCapBtn)   ssCapBtn.addEventListener('click', function () { startScreenshotCapture(shadow); });
    if (ssUpBtn)    ssUpBtn.addEventListener('click',  function () { triggerFileUpload(shadow); });
    if (upVideoBtn) upVideoBtn.addEventListener('click', function () { triggerVideoUpload(shadow); });
    if (voiceBtn) voiceBtn.addEventListener('click', function () {
      if (_voiceRec.recorder && _voiceRec.recorder.state === 'recording') {
        stopVoiceRecording();
      } else {
        startVoiceRecording(shadow);
      }
    });
    if (videoBtn) videoBtn.addEventListener('click', function () {
      if (_videoRec.recorder && _videoRec.recorder.state === 'recording') {
        stopVideoRecording();
      } else {
        startVideoRecording(shadow);
      }
    });

    var techHdr     = shadow.getElementById('csi-tech-hdr');
    var techBody    = shadow.getElementById('csi-tech-body');
    var techRefresh = shadow.getElementById('csi-tech-refresh');

    techHdr.addEventListener('click', function () {
      techHdr.classList.toggle('open');
      techBody.classList.toggle('open');
    });

    if (techRefresh) {
      techRefresh.addEventListener('click', function (e) {
        e.stopPropagation();   // prevent header toggle

        if (techRefresh.disabled) return;
        techRefresh.disabled = true;
        techRefresh.classList.remove('refreshed');
        techRefresh.classList.add('spinning');

        // Wait 1 s so any in-flight requests have time to complete and land in state
        setTimeout(function () {
          techRefresh.classList.remove('spinning');
          techRefresh.disabled = false;

          // Supplement state with any network-level failures missed by the fetch patch
          scanMissedEntries(config);

          // Re-populate with latest captured data
          populateTech(shadow, config);

          // Auto-expand the panel
          techHdr.classList.add('open');
          techBody.classList.add('open');

          // Green success flash for 1.8 s
          techRefresh.classList.add('refreshed');
          setTimeout(function () { techRefresh.classList.remove('refreshed'); }, 1800);
        }, 1000);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.isOpen) minimizeModal(shadow, fab);
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    if (window.__BLAGH_LOADED) return;
    window.__BLAGH_LOADED = true;

    var config = getConfig();
    state.config = config;

    initConsoleMonitor(config);
    initNetworkMonitor(config);

    var shadow = buildShadow(config);
    var fab    = buildFAB(shadow, config);
    var els    = buildModal(shadow, config);
    buildConsentModal(shadow);

    wireEvents(shadow, fab, els, config);
    wireConsentEvents(shadow, fab, config);
    makeDraggable(fab, shadow, config);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window, document));
