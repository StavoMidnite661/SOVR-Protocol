# Runtime HTTP server

Fastify surface for the SOVR kernel. The server does **not** parse YAML.
It boots compiled registries through `../authority/authority-loader.ts`.

```bash
npm run build --prefix packages/runtime
PORT=3001 node packages/runtime/dist/server/index.js
```

- Health: `GET /health`
- Command: `POST /api/v1/:domain/:aggregate`
- Events: `GET /api/v1/events`
- Projections: `GET /api/v1/projections/:name` (registry-driven; not authoritative)

Architecture: `docs/ARCHITECTURE.md`.
