#!/usr/bin/env bash
set -euo pipefail

RUNTIME_URL="${SOVR_URL:-http://localhost:3001}"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL + 1)); }
info() { echo "     → $1"; }

section() {
  echo ""
  echo "── $1"
}

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  SOVR Protocol — Constitutional Kernel   ║"
echo "║  The Linux of Finance                    ║"
echo "╚══════════════════════════════════════════╝"

# Start runtime
section "Starting runtime..."
SOVR_DEV_AUTO_GRANT=true node packages/runtime/dist/server/index.js &
SERVER_PID=$!
info "PID: $SERVER_PID"

# Wait for health
for i in $(seq 1 60); do
  if curl -sf "$RUNTIME_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

HEALTH=$(curl -sf "$RUNTIME_URL/health" || echo '{"final_health":"UNREACHABLE"}')
FINAL=$(echo "$HEALTH" | grep -o '"final_health":"[^"]*"' | cut -d'"' -f4 || echo "UNREACHABLE")

if [ "$FINAL" != "HEALTHY" ]; then
  echo ""
  echo "❌ Runtime failed to become healthy: $FINAL"
  echo "   Check output above for errors."
  exit 1
fi

# 1. Build integrity
section "1. Build Integrity"
VERIFY=$(node packages/compiler/dist/cli.js verify 2>&1 || true)
if echo "$VERIFY" | grep -q "Reproducible build verified"; then
  HASH=$(echo "$VERIFY" | grep -o '[a-f0-9]\{64\}' | head -1)
  pass "Build hash: ${HASH:0:16}..."
else
  fail "Build verification failed"
  echo "     $VERIFY"
fi

# 2. Health gate
section "2. Health Gate"
if [ "$FINAL" = "HEALTHY" ]; then
  pass "System HEALTHY"
  ADAPTER=$(echo "$HEALTH" | grep -o '"adapter":"[^"]*"' | cut -d'"' -f4 | head -1 || true)
  JWT_MODE=$(echo "$HEALTH" | grep -o '"mode":"[^"]*"' | cut -d'"' -f4 | head -1 || true)
  info "Event store: ${ADAPTER:-unknown}"
  info "JWT: ${JWT_MODE:-unknown}"
else
  fail "System not HEALTHY: $FINAL"
  echo "Cannot continue."
  exit 1
fi

# 3. Attestation chain
section "3. Cryptographic Attestation Chain"
MANIFEST=$(curl -sf "$RUNTIME_URL/api/v1/manifest" || echo '{}')
ATTESTATION=$(curl -sf "$RUNTIME_URL/api/v1/boot-attestation" || echo '{}')
M_HASH=$(echo "$MANIFEST" | grep -o '"build_hash":"[^"]*"' | cut -d'"' -f4 || true)
A_HASH=$(echo "$ATTESTATION" | grep -o '"build_hash":"[^"]*"' | cut -d'"' -f4 || true)
if [ -n "$M_HASH" ]; then
  pass "Manifest hash: ${M_HASH:0:16}..."
else
  fail "Manifest hash missing"
fi
if [ "$M_HASH" = "$A_HASH" ] && [ -n "$M_HASH" ]; then
  pass "Attestation chain intact"
else
  fail "Attestation chain broken"
fi

# 4. Identity session
section "4. Identity Session (RS256 JWT)"
SESSION=$(curl -sf -X POST "$RUNTIME_URL/api/v1/identity/session" \
  -H "Content-Type: application/json" \
  -d '{"actor_id":"demo_alice","actor_type":"human"}' || echo '{}')
JWT=$(echo "$SESSION" | grep -o '"jwt":"[^"]*"' | cut -d'"' -f4 || true)
if [ -n "$JWT" ]; then
  pass "Session created with RS256 JWT"
else
  fail "Session creation failed"
  echo "   Response: $SESSION"
  exit 1
fi

# 5. Constitutional enforcement INV-002
section "5. Constitutional Enforcement (INV-002)"
VIOLATION=$(curl -s -X POST "$RUNTIME_URL/api/v1/ledger/entry" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "commandName": "ledger.entry.post",
    "aggregateId": "demo-inv002",
    "capability_id": "ledger.entry.post",
    "scope": "ledger.entry:*",
    "payload": {
      "postings": [{"type":"debit","amount":"100"}]
    }
  }' 2>&1 || true)
if echo "$VIOLATION" | grep -qiE "INV_002|BALANCED|rejected|error|422|400"; then
  pass "INV-002: Unbalanced posting rejected"
else
  fail "INV-002: Should have been rejected"
  echo "   Response: $VIOLATION"
fi

# 6. Vault domain
section "6. Vault Domain — Asset Registration"
ASSET_ID="demo-asset-$(date +%s)"
ASSET=$(curl -s -X POST "$RUNTIME_URL/api/v1/vault/asset" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"commandName\": \"vault.asset.register\",
    \"aggregateId\": \"$ASSET_ID\",
    \"capability_id\": \"vault.asset.create\",
    \"scope\": \"vault.asset:*\",
    \"payload\": {
      \"asset_id\": \"$ASSET_ID\",
      \"asset_type\": \"fiat\",
      \"face_value\": 10000,
      \"quantity\": 1,
      \"issuer_id\": \"demo_alice\",
      \"ownership_id\": \"demo_alice\",
      \"custody_location\": \"primary_vault\",
      \"native_unit\": \"USD\",
      \"precision\": 2,
      \"valuation_source\": \"internal\"
    }
  }" 2>&1 || echo '{"status":"FAILED"}')
if echo "$ASSET" | grep -q "ACCEPTED"; then
  pass "Asset registered: INIT → REGISTERED"
else
  fail "Asset registration failed"
  echo "   Response: $ASSET"
fi

# 7. State machine enforcement
section "7. State Machine Enforcement"
INVALID=$(curl -s -X POST "$RUNTIME_URL/api/v1/vault/asset" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"commandName\": \"vault.reserve.create\",
    \"aggregateId\": \"$ASSET_ID\",
    \"capability_id\": \"vault.reserve.create\",
    \"scope\": \"vault.asset:*\",
    \"payload\": {
      \"asset_id\": \"$ASSET_ID\",
      \"amount\": 1000
    }
  }" 2>&1 || true)
if echo "$INVALID" | grep -qiE "InvalidStateTransition|REGISTERED|rejected|error|409|422|400"; then
  pass "Invalid transition rejected by state machine"
else
  fail "Invalid transition should have been rejected"
  echo "   Response: $INVALID"
fi

# 8. Multi-domain saga
section "8. Multi-Domain Saga (Vault → Ledger)"
SAGA=$(curl -sf -X POST "$RUNTIME_URL/api/v1/treasury/saga" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"sagaName\": \"internal_transfer_saga\",
    \"correlationId\": \"demo-saga-$(date +%s)\",
    \"payload\": {
      \"asset_id\": \"$ASSET_ID\",
      \"amount\": \"500.00\",
      \"source_account\": \"acc_001\",
      \"destination_account\": \"acc_002\"
    }
  }" 2>&1 || echo '{"state":"FAILED"}')
if echo "$SAGA" | grep -q "COMPLETED"; then
  pass "Multi-domain saga COMPLETED"
else
  info "Saga: $SAGA"
  fail "Saga did not complete"
fi

# 9. Event log
section "9. Immutable Event Log"
EVENTS=$(curl -sf "$RUNTIME_URL/api/v1/events?domain=vault&limit=5" 2>&1 || echo '{}')
if echo "$EVENTS" | grep -qiE "vault|asset|event"; then
  pass "Event log verified"
else
  fail "Event log query failed"
  echo "   Response: $EVENTS"
fi

# 10. Constitutional proof — escrow
section "10. Constitutional Proof — Escrow Domain"
info "YAML-only domain. Zero runtime changes."
ESCROW_ID="demo-escrow-$(date +%s)"
ESCROW=$(curl -sf -X POST "$RUNTIME_URL/api/v1/escrow/escrow_account" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{
    \"commandName\": \"escrow.account.create\",
    \"aggregateId\": \"$ESCROW_ID\",
    \"capability_id\": \"escrow.account.create\",
    \"scope\": \"escrow.account:*\",
    \"payload\": {
      \"escrow_id\": \"$ESCROW_ID\",
      \"parties\": [\"alice\", \"bob\"],
      \"amount\": 10000,
      \"asset_type\": \"fiat\",
      \"release_conditions\": \"delivery_confirmed\",
      \"initiator_id\": \"demo_alice\"
    }
  }" 2>&1 || echo '{"status":"FAILED"}')
if echo "$ESCROW" | grep -q "ACCEPTED"; then
  pass "Escrow domain executed (zero runtime changes)"
  pass "Constitutional Proof XV3 verified"
else
  fail "Escrow execution failed"
  echo "   Response: $ESCROW"
fi

# 11. Purity audit
section "11. Runtime Purity Audit"
PURITY=$(node scripts/runtime-audit.mjs 2>&1 || true)
if echo "$PURITY" | grep -q "PASS"; then
  pass "Runtime purity: 0 violations"
else
  fail "Purity audit failed"
  echo "   $PURITY"
fi

# Results
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "  SOVR Protocol v0.7.0"
  echo "  Spec-driven. Constitutional. Auditable."
  echo "  The Linux of Finance."
  echo ""
  exit 0
else
  echo "  $FAIL check(s) failed. Review output above."
  echo ""
  exit 1
fi
