#!/bin/bash
# scripts/release-v1.0.0.sh
# HELD — Execute ONLY after:
#   1. Audit clean letter received
#   2. Provisional patent filing confirmed
#   3. All tests passing on clean build

set -euo pipefail

echo "=== SOVR Protocol v1.0.0 Release ==="
echo "Pre-flight checks..."

# Verify clean build
pnpm tsc --noEmit
echo "✅ TypeScript clean"

# Verify all tests pass
pnpm test
echo "✅ All tests passing"

# Verify npm audit
pnpm audit --prod
echo "✅ npm audit clean (prod)"

# Verify constitutional build hash
pnpm compile
echo "✅ Constitution compiled"

# Bump versions
node scripts/bump-version.js 1.0.0
echo "✅ Version bumped to 1.0.0"

# Commit
git add -A
git commit -m "chore: release v1.0.0 — The Linux of Finance

Constitutional compilation complete.
All 10 invariants enforced.
60/60 acceptance tests passing.
External audit: clean letter received.
Provisional patent filed.

No handwritten financial logic.
Constitution compiles. Kernel executes."

# Tag (signed)
git tag -s v1.0.0 -m "SOVR Protocol v1.0.0 — The Linux of Finance"
echo "✅ Signed tag created"

# Push
git push origin main --tags
echo "✅ Pushed to origin"

echo ""
echo "=== Release complete ==="
echo "Create GitHub Release from tag v1.0.0"
echo "Use docs/release/GITHUB-RELEASE-DRAFT.md as body"
echo "Attach: docs/audit/AUDIT-BRIEF.md (public)"
echo "Attach: docs/deployment/ package (institution)"
