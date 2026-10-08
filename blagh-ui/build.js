/**
 * Build script for blagh-ui.
 * Reads .env and injects feature flags into the bundle via esbuild --define.
 *
 * Usage:
 *   node build.js           → production build (minified)
 *   node build.js --watch   → watch mode (minified, rebuilds on change)
 *   node build.js --dev     → development build (not minified, not watched)
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Load .env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(function (line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    var idx = line.indexOf('=');
    if (idx === -1) return;
    var k = line.slice(0, idx).trim();
    var v = line.slice(idx + 1).trim();
    env[k] = v;
  });
}

// ── Resolve flags ─────────────────────────────────────────────────────────────
var enableMedia = (env.ENABLE_MEDIA_RECORDING === 'true') ? 'true' : 'false';

// ── Build options ─────────────────────────────────────────────────────────────
var args     = process.argv.slice(2);
var isWatch  = args.includes('--watch');
var isDev    = args.includes('--dev');
var isServe  = args.includes('--serve');

console.log('[blagh-ui-build] ENABLE_MEDIA_RECORDING =', enableMedia);

var cmd;

if (isServe) {
  // Dev server: esbuild compiles with env flags and serves dist/ on port 3000.
  // blagh-mock-ui loads http://localhost:3000/blagh.js from dist/.
  cmd = [
    'npx esbuild blagh.js',
    '--target=es5',
    '--outfile=dist/blagh.js',
    '--define:__ENABLE_MEDIA_RECORDING__=' + enableMedia,
    '--serve=3000',
    '--servedir=dist',
  ].join(' ');
} else {
  // Production / watch build → dist/blagh.min.js
  cmd = [
    'npx esbuild blagh.js',
    '--target=es5',
    '--outfile=dist/blagh.min.js',
    '--define:__ENABLE_MEDIA_RECORDING__=' + enableMedia,
    isDev   ? '' : '--minify',
    isWatch ? '--watch' : '',
  ].filter(Boolean).join(' ');
}

console.log('[blagh-ui-build]', cmd);
execSync(cmd, { stdio: 'inherit', cwd: __dirname });
