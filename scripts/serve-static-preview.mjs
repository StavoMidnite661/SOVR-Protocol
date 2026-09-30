#!/usr/bin/env node
// ============================================================
// SOVR Protocol — local preview of the Vercel static build
// File: scripts/serve-static-preview.mjs
// ============================================================
// Serves `dist/` (the output of scripts/build-vercel-site.mjs) with the same
// behaviour Vercel applies in production, so what you see locally is what the
// demo deployment serves:
//   * /            -> index.html
//   * /health      -> application/json, no-store
//   * /assets/*    -> immutable long-lived cache
//   * /board, /sovr-board.html, /api/health, /api/v1/openapi.json -> 307 to their canonical route
//   * anything else -> 404.html with status 404
//
// Zero dependencies. Binds 0.0.0.0 so it can be reached from outside the
// sandbox/container (the live preview pane, a phone on the LAN, a tunnel).
//
//   npm run preview:vercel            # build + serve on :4173
//   PORT=8080 npm run serve:vercel    # serve an existing dist/ on :8080
// ============================================================

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number(process.env.PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(DIST)) {
  console.error('✖ dist/ not found — run `npm run build:vercel` first (or `npm run preview:vercel`).');
  process.exit(1);
}

const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Mirrors the `redirects` block in vercel.json so the local preview matches production.
const REDIRECTS = new Map([
  ['/board', '/'],
  ['/sovr-board.html', '/'],
  ['/api/health', '/health'],
  ['/api/v1/openapi.json', '/openapi.json'],
]);

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(DIST, relative);
  if (!candidate.startsWith(DIST)) return null; // path traversal attempt
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const withHtml = `${candidate}.html`;
  if (fs.existsSync(withHtml) && fs.statSync(withHtml).isFile()) return withHtml;
  const asIndex = path.join(candidate, 'index.html');
  if (fs.existsSync(asIndex) && fs.statSync(asIndex).isFile()) return asIndex;
  return null;
}

function respond(res, status, body, headers = {}) {
  res.writeHead(status, { ...BASE_HEADERS, ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const pathname = (req.url ?? '/').split('?')[0];
  const started = Date.now();

  const redirectTo = REDIRECTS.get(pathname);
  if (redirectTo) {
    respond(res, 307, undefined, { Location: redirectTo });
    console.log(`  307 ${req.method} ${req.url} -> ${redirectTo}`);
    return;
  }

  const file = resolveFile(req.url ?? '/');

  if (!file) {
    const notFound = path.join(DIST, '404.html');
    const body = fs.existsSync(notFound) ? fs.readFileSync(notFound) : Buffer.from('404 — not found');
    respond(res, 404, body, { 'Content-Type': 'text/html; charset=utf-8' });
    console.log(`  404 ${req.method} ${req.url}  (${Date.now() - started}ms)`);
    return;
  }

  const ext = path.extname(file);
  const isHealth = path.basename(file) === 'health';
  const contentType = isHealth ? 'application/json; charset=utf-8' : MIME[ext] ?? 'application/octet-stream';
  const cacheControl = file.includes(`${path.sep}assets${path.sep}`)
    ? 'public, max-age=31536000, immutable'
    : isHealth
      ? 'no-store'
      : 'public, max-age=0, must-revalidate';

  if (req.method === 'HEAD') {
    respond(res, 200, undefined, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
    return;
  }

  respond(res, 200, fs.readFileSync(file), { 'Content-Type': contentType, 'Cache-Control': cacheControl });
  console.log(`  200 ${req.method} ${req.url}  (${Date.now() - started}ms)`);
});

server.listen(PORT, HOST, () => {
  console.log(`\n▲ SOVR static demo preview — ${DIST}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${HOST}:${PORT}`);
  console.log('  Routes:  /  ·  /health  ·  /openapi.json\n');
});
