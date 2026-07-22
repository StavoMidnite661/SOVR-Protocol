# Multi-Language SDK Roadmap

## Current (2026-07-22)
- TypeScript/JavaScript: Full featured (real HTTP)

## Planned

| Language | Priority | Target | Status |
|----------|----------|--------|--------|
| Python   | High     | 2026-Q3 | Not started |
| Go       | High     | 2026-Q3 | Not started |
| Java     | Medium   | 2026-Q4 | Not started |
| Rust     | Low      | 2027   | Not started |

## SDK Feature Requirements

Every SDK must support:
- `waitForHealthy()`
- `verifyBuildManifest()`
- Real JWT handling
- All 101 commands via universal route
- Event polling + WebSocket (where possible)

## Contribution Path

See `docs/guides/openapi-client-generation.md` for auto-generation guidance.