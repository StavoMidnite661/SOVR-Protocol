#!/usr/bin/env node
// ============================================================
// SOVR Protocol — Vercel static demo build
// File: scripts/build-vercel-site.mjs
// ============================================================
// Assembles `dist/` — the directory Vercel serves (see vercel.json).
//
// This build is intentionally dependency-free: it runs with nothing but
// Node's standard library, so Vercel does not need to install the
// workspace (and therefore never has to build the native tigerbeetle-node
// addon just to publish a demo console).
//
// What ships:
//   /            sovr-board.html  — THE BOARD (constitutional control console)
//   /health      static provenance manifest derived from the real compiler
//                output (build_hash, ir_hash, registry counts) so the console
//                can display genuine, unfaked build identity
//   /openapi.json the compiler-generated OpenAPI 3.1 surface (read-only)
//   /assets/*    console artwork
//   404.html     explains that the kernel API is not attached in static mode
//
// Nothing here mutates protocol sources: it is a read-only projection of
// artifacts the compiler already produced, plus one HTML file.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

// Source art is JPEG data that was checked in with a .png extension, so it is
// published with the extension that matches its actual bytes.
const ART_SOURCE = path.join(ROOT, 'sovr_space_planet.png');
const ART_TARGET = path.join('assets', 'sovr-planet.jpg');

const REGISTRIES = [
  ['commands', 'commands.registry.json'],
  ['events', 'events.registry.json'],
  ['machines', 'machines.registry.json'],
  ['capabilities', 'capabilities.registry.json'],
  ['contracts', 'contracts.registry.json'],
  ['constitution', 'constitution.registry.json'],
  ['envelopes', 'envelopes.registry.json'],
  ['execution_plans', 'execution-plans.registry.json'],
  ['economic', 'economic.registry.json'],
];

const log = (icon, message) => console.log(`${icon} ${message}`);

function fail(message) {
  console.error(`\n✖ Vercel static build failed: ${message}\n`);
  process.exit(1);
}

function readJson(file, label) {
  try {
    if (!fs.existsSync(file)) return null;
    // compiler-manifest.yaml is JSON-inside-a-.yaml-file; tolerate a leading
    // front-matter block just like packages/runtime/src/server/config.ts does.
    const raw = fs.readFileSync(file, 'utf8');
    try {
      return JSON.parse(raw);
    } catch {
      return JSON.parse(raw.replace(/^---[\s\S]*?\n/, ''));
    }
  } catch (err) {
    log('⚠️ ', `${label} present but unreadable (${err.message}) — continuing without it`);
    return null;
  }
}

function resetDirectory(dir) {
  const resolved = path.resolve(dir);
  if (path.basename(resolved) !== 'dist' || !resolved.startsWith(ROOT)) {
    fail(`refusing to clear unexpected output directory ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

function write(relativePath, contents) {
  const target = path.join(OUT, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
  return target;
}

function copy(source, relativeTarget) {
  const target = path.join(OUT, relativeTarget);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return target;
}

function sizeOf(file) {
  const bytes = fs.statSync(file).size;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// ------------------------------------------------------------
// 1. Console page
// ------------------------------------------------------------
function buildConsole() {
  const source = path.join(ROOT, 'sovr-board.html');
  if (!fs.existsSync(source)) fail('sovr-board.html is missing from the repository root');
  const target = copy(source, 'index.html');
  log('🖥️ ', `console        /              ${sizeOf(target)}`);
}

// ------------------------------------------------------------
// 2. Static provenance manifest served at /health
// ------------------------------------------------------------
function buildHealth() {
  const manifest = readJson(path.join(ROOT, 'generated', 'compiler-manifest.yaml'), 'compiler manifest') ?? {};
  const openapi = readJson(path.join(ROOT, 'generated', 'openapi.json'), 'openapi.json');

  const registryCounts = {};
  for (const [label, file] of REGISTRIES) {
    const registry = readJson(path.join(ROOT, 'generated', 'registries', file), file);
    const count = registry?.entry_count ?? (registry?.entries ? Object.keys(registry.entries).length : undefined);
    if (typeof count === 'number') registryCounts[label] = count;
  }

  const health = {
    status: 'ok',
    mode: 'static-demo',
    service: 'sovr-financial-os',
    surface: 'constitutional-console',
    kernel_api: {
      attached: false,
      reason:
        'This is the static demo deployment of THE BOARD. Command execution, event store, Kafka/Redis streams and WebSocket delivery require the container runtime (see deployment/ and deploy/).',
    },
    build_hash: manifest.build_hash ?? 'unavailable',
    ir_hash: manifest.ir_hash ?? 'unavailable',
    protocol_version: manifest.protocol_version ?? manifest.protocol_target_version ?? 'unknown',
    compiler_version: manifest.compiler_version ?? 'unknown',
    determinism_verification: manifest.determinism_verification ?? 'unavailable',
    registry_counts: registryCounts,
    openapi: openapi
      ? { url: '/openapi.json', path_count: Object.keys(openapi.paths ?? {}).length, ir_hash: openapi['x-ir-hash'] ?? null }
      : { url: null, path_count: 0 },
    event_store: {
      backend: 'none',
      totalEvents: 0,
      note: 'Static demo — no live event store is attached to this deployment.',
    },
    surfaces: {
      console: '/',
      health: '/health',
      openapi: openapi ? '/openapi.json' : null,
    },
    generated_from: 'generated/compiler-manifest.yaml',
  };

  const target = write('health', `${JSON.stringify(health, null, 2)}\n`);
  log('🔐', `provenance     /health        ${sizeOf(target)}  build_hash ${String(health.build_hash).slice(0, 16)}...`);

  if (openapi) {
    const openapiTarget = copy(path.join(ROOT, 'generated', 'openapi.json'), 'openapi.json');
    log('📜', `openapi        /openapi.json  ${sizeOf(openapiTarget)}`);
  } else {
    log('⚠️ ', 'generated/openapi.json not found — skipping API surface (run `npm run build:protocol` to produce it)');
  }
}

// ------------------------------------------------------------
// 3. Artwork
// ------------------------------------------------------------
function buildArt() {
  if (!fs.existsSync(ART_SOURCE)) {
    log('⚠️ ', 'sovr_space_planet.png not found — console background will fall back to its CSS default');
    return;
  }
  const target = copy(ART_SOURCE, ART_TARGET);
  log('🪐', `artwork        /${ART_TARGET.split(path.sep).join('/')}  ${sizeOf(target)}`);
}

// ------------------------------------------------------------
// 4. 404 — explains the static boundary instead of a bare error
// ------------------------------------------------------------
function buildNotFound() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>SOVR Financial OS — not found</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0b0d12; color:#e2e2ea; font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif; }
  main { max-width:640px; padding:32px; }
  h1 { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:28px; letter-spacing:-0.02em; color:#4cd7f6; margin:0 0 4px; }
  p { line-height:1.6; color:#c8ccd6; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; background:#171a22; border:1px solid #2a2f3a; border-radius:4px; padding:1px 5px; color:#4edea3; }
  .tag { display:inline-block; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:11px; letter-spacing:0.14em;
         text-transform:uppercase; color:#ffb95f; border:1px solid rgba(255,185,95,0.4); border-radius:999px; padding:4px 10px; margin-bottom:20px; }
  a { color:#4cd7f6; }
  ul { line-height:1.8; color:#c8ccd6; }
</style>
</head>
<body>
<main>
  <div class="tag">Static demo deployment</div>
  <h1>404 — route not attached</h1>
  <p>
    This deployment publishes the SOVR constitutional console and the compiled protocol artifacts.
    The live kernel API (<code>/api/v1/…</code>, WebSocket event streams) is <strong>not</strong> attached here:
    it requires the container runtime with its event store, ledger and message brokers.
  </p>
  <ul>
    <li><a href="/">THE BOARD</a> — constitutional control console</li>
    <li><a href="/health">/health</a> — real build manifest (build hash, IR hash, registry counts)</li>
    <li><a href="/openapi.json">/openapi.json</a> — compiler-generated command surface</li>
  </ul>
  <p>To run the kernel itself, see <code>deployment/docker-compose.dev.yml</code> and <code>docs/VERCEL_DEPLOYMENT.md</code>.</p>
</main>
</body>
</html>
`;
  const target = write('404.html', html);
  log('🧭', `not found      /404.html      ${sizeOf(target)}`);
}

// ------------------------------------------------------------
// Run
// ------------------------------------------------------------
console.log('\n▲ SOVR Protocol — assembling Vercel static demo\n');
resetDirectory(OUT);

buildConsole();
buildHealth();
buildArt();
buildNotFound();

const files = fs
  .readdirSync(OUT, { recursive: true, withFileTypes: false })
  .filter((entry) => fs.statSync(path.join(OUT, String(entry))).isFile())
  .map(String)
  .sort();

const totalBytes = files.reduce((sum, file) => sum + fs.statSync(path.join(OUT, file)).size, 0);
console.log(`\n✔ dist/ ready — ${files.length} files, ${(totalBytes / 1024).toFixed(1)} KB`);
console.log('  deploy with: vercel --prod   |   preview locally with: npm run preview:vercel\n');
