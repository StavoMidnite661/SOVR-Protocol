# SOVR Protocol — Auditor Engagement Checklist
**Version:** v1.0.0-rc
**Date:** 2026-07-25
**Build hash:** `d27fdbe60290ba976f684bb7d0096b911195776d975bb1da8bdd6c56d835e512`
**Classification:** Auditor Confidential

---

## Day One Package

| Item | Location | Status |
|---|---|---|
| Audit brief | `docs/audit/AUDIT-BRIEF.md` | ✅ |
| Self-test report | `docs/audit/SELF-TEST-REPORT.md` | ✅ 14/14 clean |
| Findings register | `docs/audit/FINDINGS-REGISTER.md` | ✅ 0 open |
| Threat model | `docs/security/threat-model.md` | ✅ 5 categories, 16 threats |
| SOC2 control mapping | `docs/compliance/SOC2-CONTROL-MAPPING.md` | ✅ 6 controls |
| GDPR evidence | `docs/compliance/evidence/GDPR/` | ✅ 3 documents |
| Pentest surface map | `docs/security/PENTEST-SURFACE-MAP.md` | ✅ |
| Hardening checklist | `docs/security/hardening-checklist.md` | ✅ |
| Operational runbook | `docs/operations/RUNBOOK.md` | ✅ |
| Institution deployment package | `docs/deployment/` (5 docs) | ✅ |
| Architecture summary | `docs/deployment/ARCHITECTURE-SUMMARY.md` | ✅ |
| npm audit report | 0 HIGH/0 CRITICAL (production) | ✅ |

---

## Environment Access

**Repository:** https://github.com/StavoMidnite661/SOVR-Protocol  
**Branch:** v0.9.0  
**Runtime:** Node.js v20 LTS  
**Database:** PostgreSQL 16+  
**Demo script:** `bash scripts/demo.sh` (13/13 deterministic)

### Spin Up Instructions

```bash
# 1. Clone release tag
git clone https://github.com/StavoMidnite661/SOVR-Protocol
cd SOVR-Protocol
git checkout v0.9.0

# 2. Install dependencies
npm install --workspaces

# 3. Build
npm run build --workspace=packages/compiler
npm run build --workspace=packages/runtime

# 4. Start PostgreSQL (Docker or native)
docker compose -f deployment/docker-compose.production.yml up -d postgres

# 5. Start runtime
export JWT_PRIVATE_KEY="$(cat private.pem)"
export JWT_PUBLIC_KEY="$(cat public.pem)"
export DATABASE_URL="postgresql://sovr:password@localhost:5432/sovr_protocol?sslmode=require"
export NODE_ENV=production
node packages/runtime/dist/server/index.js

# 6. Verify health
curl http://localhost:3001/health
# Expected: {"final_health":"HEALTHY",...}

# 7. Run smoke test
bash scripts/demo.sh
# Expected: 13/13 passed
```

---

## Known Pre-Disclosed Findings

| Finding | Severity | Status | Notes |
|---|---|---|---|
| SOVR-SEC-001: Rate limit keyed on spoofable header | MEDIUM | ✅ REMEDIATED | Fixed: keys on JWT-verified actor_id |
| esbuild moderate | MODERATE | OPEN | Dev-only, not in production bundle |
| brace-expansion high | HIGH | OPEN | Dev-only, transitive via vitest |

**Open findings: 0 in production bundle.**  
**All dev-only findings are in test tooling, not in runtime.**

---

## Pre-Audit Verification Checklist

### Authentication

- [ ] Q1: Expired JWT rejected (401/403)
- [ ] Q2: Tampered signature rejected (401/403)
- [ ] Q3: Missing Authorization header rejected (401/403)
- [ ] Q4: HS256 algorithm confusion blocked (RS256 only)

### Authorization

- [ ] Q5: Command without capability rejected (403)
- [ ] Q6: Grant capability → execute succeeds (200)

### Event Store Integrity

- [ ] Q7: UPDATE on sovr_events blocked by trigger
- [ ] Q8: DELETE on sovr_events blocked by trigger

### Rate Limiting

- [ ] Q9: 429 returned on burst
- [ ] Q10: Spoofed x-actor-id hits same bucket (identity-sovereign)

### Secrets & Configuration

- [ ] Q11: JWT_PRIVATE_KEY not in logs
- [ ] Q12: DATABASE_URL not in logs
- [ ] Q13: NODE_ENV=production fails closed

### Compiler Integrity

- [ ] Q14: Compiler produces deterministic output

---

## Acceptance Criteria

| Criterion | Requirement | Status |
|---|---|---|
| CRITICAL findings | All remediated or formally accepted | ✅ 0 open |
| HIGH findings | All remediated or formally accepted with timeline | ✅ 0 open |
| Pentest report | Delivered | ⏳ Pending auditor |
| Audit attestation letter | Delivered | ⏳ Pending auditor |
| SOC2 readiness assessment | Delivered | ⏳ Pending auditor |

---

## Auditor Notes

- Rate limiting is identity-sovereign (per JWT-verified actor_id)
- Per-actor bucket isolation verified (Q10b)
- Immutable triggers verified on live PostgreSQL 18
- Compiler determinism verified (byte-identical across runs)
- Production environment fails-closed on missing secrets
- All 16 integration tests pass
- Demo 13/13 passes
- Pre-audit self-test: 14/14 PASS
- Open findings: 0

---

## Document Control

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.0.0-rc | 2026-07-25 | SOVR Protocol Engineering | Initial release for audit engagement |
