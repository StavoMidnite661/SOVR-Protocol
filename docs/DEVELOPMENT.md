# Operating and extending SOVR

Minimum guide to compile, run, and change the current system.

## Prerequisites

Node.js ≥ 20, npm ≥ 10.

## Build and compile

```bash
npm install
npm run build                 # compiler + runtime TypeScript
npm run compile               # YAML → IR + registries + artifacts
node packages/compiler/dist/cli.js verify
```

The compiler is the only materialization path. After any YAML change, recompile.
Never edit `generated/registries/` or other compiler outputs by hand.

## Run the runtime

```bash
PORT=3001 node packages/runtime/dist/server/index.js
```

The process loads `generated/registries` via the authority-loader. It does not
read the YAML corpus at execution time.

Health: `GET /health`  
Commands: `POST /api/v1/:domain/:aggregate`  
Events: `GET /api/v1/events`  
Projections: `GET /api/v1/projections/:name`

## Tests

```bash
npm test                      # genesis + runtime integration
npm run verify:simulation     # compile + simulation + integrity suites
npm run protocol:runtime-audit
```

Simulation scenarios: `governance/simulation/scenarios/`.

Do not treat TigerBeetle tests as required for protocol certification in this
baseline. They need a configured ledger host.

## How to change protocol behavior

1. Edit YAML (catalog, machines, events, capabilities, projections).
2. Compile. Fix fail-closed diagnostics (REF-006 / REF-008 / silent-drop).
3. Run simulation / integration against the new registries.
4. Update `docs/ARCHITECTURE.md` counts **from the new registries**, not from memory.

Do not add runtime YAML parsers. Do not add command handlers that bypass the
authoritative command map. Do not invent machine triggers that are not catalog
events.

## Where things live

| Concern | Location |
| --- | --- |
| Protocol | root `*.yaml`, `domains/`, `compiler/` |
| Compiler | `packages/compiler/src` |
| Runtime kernel | `packages/runtime/src` |
| Authority load | `packages/runtime/src/authority/` |
| Event store / command bus | `packages/runtime/src/server/` |
| Projections | `packages/runtime/src/projection*` |
| Compiled authority | `generated/registries/` |
| Historical docs | `docs/history/` |
