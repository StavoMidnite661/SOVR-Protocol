# Deploying SOVR Protocol to Vercel

This repository ships with a **static demo deployment** of THE BOARD — the
constitutional control console — plus the compiler-generated protocol artifacts.
No database, broker, Docker image or environment variable is required.

| Route | Source | What it is |
| --- | --- | --- |
| `/` | `sovr-board.html` | THE BOARD — constitutional control console (interactive) |
| `/health` | generated from `generated/compiler-manifest.yaml` | real build identity: `build_hash`, `ir_hash`, registry counts |
| `/openapi.json` | `generated/openapi.json` | compiler-generated OpenAPI 3.1 command surface (read-only) |
| `/assets/sovr-planet.jpg` | `sovr_space_planet.png` | console backdrop |
| `/404.html` | generated | explains that the kernel API is not attached |

Everything is produced by [`scripts/build-vercel-site.mjs`](../scripts/build-vercel-site.mjs)
into `dist/`, which is what Vercel publishes. The build uses **only the Node
standard library**, so `npm install` is skipped — the native `tigerbeetle-node`
addon never has to compile just to publish the console.

---

## 1. Deploy

### Option A — Vercel dashboard (recommended, gives you Git-based previews)

1. Go to **vercel.com → Add New → Project** and import this GitHub repository.
2. Vercel reads [`vercel.json`](../vercel.json) automatically:
   - Framework preset: **Other**
   - Install command: skipped (overridden)
   - Build command: `node scripts/build-vercel-site.mjs`
   - Output directory: `dist`
3. **Deploy.** No environment variables are needed for the demo.
4. Every push to `main` becomes a production deployment; every other branch
   gets its own preview URL.

### Option B — Vercel CLI

```bash
npm i -g vercel        # once
vercel                 # preview deployment
vercel --prod          # production deployment
```

`npm run deploy:vercel` is a shortcut for `vercel --prod`.

### Option C — GitHub Action

If you would rather not connect the Vercel Git integration, deploy from CI with
the community action and three repository secrets (`VERCEL_TOKEN`,
`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). Keep the same commands as Option B; the
CLI honours `vercel.json`, so no extra configuration is required.

---

## 2. Verify a deployment

```bash
curl -s https://<your-deployment>/health | head -20
```

You should see the hash the compiler produced locally:

```json
{
  "status": "ok",
  "mode": "static-demo",
  "build_hash": "d1829636f3c630b476766ef2cd80f426857cc1044476fe1192aff54de724812a",
  "ir_hash": "16c3f8b8a6352d35acc5f449b1a00251763341a6ec1ea12e680ded6a23381d6e",
  "protocol_version": "1.0.0",
  "compiler_version": "0.6.0",
  "determinism_verification": "VERIFIED: two independent isolated compilations byte-identical"
}
```

Because the values are read from the compiler manifest — not hardcoded — the
deployed demo carries the same unfakeable build identity as the source tree.
If `generated/compiler-manifest.yaml` changes, `/health` changes with it.

---

## 3. Local preview (no Vercel account needed)

```bash
npm run preview:vercel      # builds dist/ and serves it on 0.0.0.0:4173
npm run build:vercel        # build only
npm run serve:vercel        # serve an existing dist/ (PORT=8080 to change)
```

`scripts/serve-static-preview.mjs` mirrors Vercel's behaviour (MIME types,
cache headers, the redirects from `vercel.json`, themed 404) so what you see
locally is what the deployment serves.

---

## 4. What the demo does and does not do

**Works** — the whole console is real HTML/CSS/JS: panel navigation, YAML/TS tab
switching, terminal commands (`help`, `status`, `audit_verify`, `spec_compile`,
`clear`), autonomy switching, the WebGL backdrop, and the **Ping** button, which
calls the same-origin `/health` and displays the genuine build hash and registry
counts.

**Not attached** — anything that needs the kernel process:

| Capability | Why | Where it lives |
| --- | --- | --- |
| `POST /api/v1/{domain}/{aggregate}` command execution | needs the Fastify runtime, capability engine and event store | `packages/runtime/src/server/index.ts` |
| Durable events | needs PostgreSQL or the JSON store on a writable volume; Vercel's filesystem is read-only except `/tmp` and is per-invocation | `packages/runtime/src/adapters/postgres-event-store.ts` |
| Kafka publication / Redis streams | needs brokers | `packages/runtime/src/server/kafkaPublisher.ts`, `redisStreamPublisher.ts` |
| WebSocket event stream (`/api/v1/events/stream`) | Vercel functions do not hold long-lived sockets | `packages/runtime/src/server/index.ts` |
| TigerBeetle ledger, ACH rails, DID/VC secrets | need a reachable cluster / secret manager / rail sandbox | `packages/runtime/src/ledger/`, `packages/runtime/src/adapters/`, `packages/runtime/src/secrets/` |

On an HTTPS deployment the console detects static mode, points its kernel field
at its own origin, and says so plainly in the terminal instead of failing
silently. Locally (`npm run dev` in `packages/runtime`) it still targets
`http://localhost:3429` unchanged.

To run the kernel for real, use the container path:
`deployment/docker-compose.dev.yml` (see the main [README](../README.md#deployment)),
or Kubernetes/Helm manifests under `deploy/`.

---

## 5. Optional: making the demo show live data

The structure is in place for a hybrid deployment later — the console already
talks to a configurable kernel URL and `/health` already returns the right shape:

1. Add an `api/` directory with a Vercel Function that imports `buildServer()`
   from `packages/runtime/src/server/index.ts` behind a serverless adapter
   (`buildServer` returns the Fastify instance without calling `listen()`; only
   the CLI entry point listens).
2. Point the console's kernel field at that origin (or keep same-origin and let
   the function serve `/health`, `/api/v1/*`).
3. Supply `DATABASE_URL` (Neon / Supabase / Vercel Postgres) — the runtime
   already switches to `PostgreSQLEventStore` when it is set — plus
   `SOVR_JWT_SECRET` (`loadRuntimeConfig` refuses to boot production without it).
4. Drop `packages/` from [`.vercelignore`](../.vercelignore) so the workspace is
   uploaded, and restore an install step (remove `installCommand`).

That work is deliberately out of scope for the demo deployment: the runtime's
constitutional guarantees (INV-005/007 enforcement wrappers, durability,
ordering) assume a stateful process, and should not be weakened to fit a static
host.

---

## 6. Configuration reference

### `vercel.json`

| Key | Value | Why |
| --- | --- | --- |
| `framework` | `null` | this is not a framework app; prevents auto-detection from picking a build preset |
| `installCommand` | echo | the build needs zero dependencies |
| `buildCommand` | `node scripts/build-vercel-site.mjs` | assembles `dist/` from repo artifacts |
| `outputDirectory` | `dist` | published directory |
| `headers` | baseline hardening + cache policy | `nosniff`, referrer policy, permissions policy, JSON content type for `/health`, immutable caching for `/assets/*` |
| `redirects` | `/board`, `/sovr-board.html` → `/`; `/api/health` → `/health`; `/api/v1/openapi.json` → `/openapi.json` | keeps old links and API-style paths working |

No `Content-Security-Policy` is set on purpose: the console loads the Tailwind
Play CDN, Google Fonts and its own inline scripts, which would require a
permissive policy of little security value on a static demo. If you harden the
page (self-hosted CSS, no CDN), add a strict CSP in the `headers` block.

### Environment variables

None are required. Nothing in the static path reads the environment — that is
part of the point: the demo cannot be misconfigured.

### Build artefacts

`dist/` is generated and git-ignored. `npm run build:vercel` is idempotent: it
clears `dist/` first and rebuilds from source, so a stale deployment can never
survive past a rebuild.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Vercel runs `npm install` for minutes | `installCommand` was removed from `vercel.json`; restore the echo override — the static build needs no packages |
| Page loads but fonts/icons are missing | the console uses Google Fonts and the Tailwind CDN; check the network tab / ad-blockers |
| Console shows `Hash: fa948641...` instead of `d1829636...` | that is the placeholder in the HTML; it is replaced on load from `/health`. A failed ping means `/health` is not being served |
| `/health` returns HTML or 404 | the output directory is wrong, or `generated/compiler-manifest.yaml` was excluded from the upload (see `.vercelignore`) |
| Background image missing | `/assets/sovr-planet.jpg` was not emitted — check that `sovr_space_planet.png` is still in the repository root |
| Deploy succeeds but the API returns 404 | expected: this deployment is static-only. See §4 |

---

## 8. Related documentation

- [`README.md`](../README.md) — protocol overview and the full deployment matrix (Docker, Compose, Helm, Kubernetes, Terraform)
- [`deployment/Dockerfile`](../deployment/Dockerfile) — runtime image (kernel included)
- [`docs/generated/BUILD_IDENTITY.md`](generated/BUILD_IDENTITY.md) — what `build_hash` / `ir_hash` are derived from
- [`CHANGELOG.md`](../CHANGELOG.md) — version history for the compiler and runtime
