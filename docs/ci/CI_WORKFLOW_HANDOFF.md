# CI Workflow Handoff — blocked change, ready to apply

**Status:** blocked on a permission, not on engineering.
**Scope:** exactly **4 lines** across 2 files.
**Branch:** `arena/019fa11e-sovr-protocol` (PR #14)

---

## TL;DR for the next agent

Nothing was removed or deleted. **No workflow file on this branch was modified at all** — `git diff origin/main...HEAD -- .github/` is empty.

I *attempted* a 4-line fix to two workflow files. GitHub rejected the push:

```
! [remote rejected] arena/019fa11e-sovr-protocol -> arena/019fa11e-sovr-protocol
  (refusing to allow a GitHub App to create or update workflow
   `.github/workflows/ci-production.yml` without `workflows` permission)
```

Because a rejected push blocks the **entire** commit — including the 120+ unrelated files — I reverted the two workflow files back to their committed state (`git checkout HEAD~1 -- .github/workflows/`) so the rest could land. The intended content was preserved verbatim in `docs/ci/*.proposed`.

**Your job:** apply the 4 lines below with a token that has the `workflows` scope.

---

## The exact change

### 1. `.github/workflows/ci.yml`

```diff
@@ line 87 @@  (job: docker → "Build API image")
-          file: deployment/api/Dockerfile
+          file: deployment/Dockerfile

@@ line 95 @@  (job: docker → "Build Worker image")
-          file: deployment/worker/Dockerfile
+          file: deployment/Dockerfile
```

### 2. `.github/workflows/ci-production.yml`

```diff
@@ line 104 @@  (job: docker → api image push)
-          file: deployment/api/Dockerfile
+          file: deployment/Dockerfile

@@ line 110 @@  (job: docker → worker image push)
-          file: deployment/worker/Dockerfile
+          file: deployment/Dockerfile
```

That is the complete diff. Verify it yourself:

```bash
diff .github/workflows/ci.yml            docs/ci/ci.yml.proposed
diff .github/workflows/ci-production.yml docs/ci/ci-production.yml.proposed
```

### Apply

```bash
cp docs/ci/ci.yml.proposed            .github/workflows/ci.yml
cp docs/ci/ci-production.yml.proposed .github/workflows/ci-production.yml
git add .github/workflows/
git commit -m "ci: point docker builds at the Dockerfile that exists"
git push
```

`.github/workflows/formal-verify.yml` is **untouched** — do not modify it.

---

## Why this is needed

Both workflows referenced Dockerfiles that do not exist:

| Referenced by CI | Exists? |
|---|---|
| `deployment/api/Dockerfile` | ❌ no such path |
| `deployment/worker/Dockerfile` | ❌ no such path |
| `deployment/Dockerfile` | ✅ the only Dockerfile in the repo |

Confirmed:

```bash
$ find . -iname 'Dockerfile*' -not -path '*/node_modules/*' -not -path './_archive/*'
./deployment/Dockerfile
```

This is half of audit finding **F-6**, which explains why all 66 recorded CI runs failed. See `DUE_DILIGENCE/INDEPENDENT_AUDIT_2026-07-27.md`.

---

## ⚠️ One judgement call to review

`deployment/Dockerfile` self-describes as the **API** image and ends with:

```dockerfile
EXPOSE 3001
CMD ["node", "packages/runtime/dist/server/index.js"]
```

My change points **both** the API and Worker builds at it. That produces two identically-built images under different tags.

I chose this because it matches what the repo already does elsewhere — `deployment/docker-compose.production.yml` builds its `worker` service from the same `Dockerfile` and differentiates purely by environment:

```yaml
worker:
  build:
    context: ..
    dockerfile: Dockerfile      # same image as api
  environment:
    SERVICE_ROLE: event-processor
    WORKER_CONCURRENCY: ${WORKER_CONCURRENCY:-4}
```

So a single image with a role switch is the existing convention, and pointing CI at it is consistent rather than novel.

**But there is no worker entrypoint in the codebase.** `packages/runtime/package.json` has no worker script, and nothing reads `SERVICE_ROLE`. The image will boot the HTTP server regardless of the tag.

**Two options — a domain owner should pick:**

1. **Accept as-is.** CI stops failing; the worker tag is a placeholder until a real worker exists. This is what the `.proposed` files do.
2. **Drop the worker build step entirely** from both workflows until there is a worker to build. Arguably more honest, and in keeping with the audit's principle of not shipping artifacts that imply capability the code lacks.

I deliberately did not guess further. Fabricating a worker entrypoint to satisfy a build step is the same class of error the audit was written to catch.

---

## What *is* already applied

The other half of F-6 shipped normally, since `package.json` is not a protected path. Root `package.json` went from **1 script to 12** — every script the workflows invoke now resolves:

| CI invokes | Before | Now |
|---|---|---|
| `npm run lint` | ❌ missing | ✅ |
| `npm run typecheck` | ❌ missing | ✅ |
| `npm run build` | ❌ missing | ✅ |
| `npm run test:genesis` | ❌ missing | ✅ |
| `npm run test:fault` | ❌ missing | ✅ |
| `npm run test:stress` | ❌ missing | ✅ |
| `npm run test:integration` | ❌ missing | ✅ |
| `npm run certify:production` | ❌ missing | ✅ (script newly written) |

Verified locally on this branch:

```
npm run typecheck              → 0 errors
npm run build                  → exit 0
npm run test:genesis           → ALL CHECKS PASSED (17/17)
npm run test:fault             → ALL CHECKS PASSED
npm run test:stress            → ALL CHECKS PASSED
npm run protocol:runtime-audit → PASS — 0 violations
npm run certify:production     → PASSED — 0 blocking issues
```

---

## Expected result after applying

Every job in both workflows should pass — the first green CI run in this repository's history.

Two caveats to expect:

- **`test:integration` will fail 4 of 59 tests.** Pre-existing, not a regression: the tests expect `EXECUTION_GATE_FAILED`, but `execution_gates` appears **0 times** in `03_command-catalog.yaml`, so no gate ever fires. Tracked as TD-002; needs YAML authoring, not a code fix. If you want CI green immediately, either mark those 4 as `it.skip` with a TD-002 reference or let the job fail visibly — do **not** weaken the assertions.
- **`formal-verify.yml` now fails hard when TLC is missing.** Intentional (finding F-5): it previously `exit 0`'d silently, letting CI imply "formally verified" without checking anything. The workflow downloads `tla2tools.jar` before invoking it, so it should be fine in CI. Under `CI=1` without the jar, it exits 1 by design.
