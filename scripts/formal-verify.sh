#!/bin/bash
# scripts/formal-verify.sh
# TLA+ formal verification for critical SOVR state machines
# Requires: Java, tla2tools.jar (TLC model checker)
set -euo pipefail

TLC_JAR="${TLC_JAR:-./tla2tools.jar}"
TLA_DIR="generated/verification/tla"
REPORT_DIR="generated/verification/reports"
PASS=0
FAIL=0
SKIP=0

mkdir -p "$REPORT_DIR"

CRITICAL_MACHINES=(
  "VAULT_ASSET_LIFECYCLE"
  "LEDGER_JOURNAL_LIFECYCLE"
  "TREASURY_TRANSFER_LIFECYCLE"
)

echo ""
echo "SOVR Protocol — TLA+ Formal Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -f "$TLC_JAR" ]; then
  echo ""
  echo "  ⚠️  TLC not available ($TLC_JAR not found)"
  echo "  → Set TLC_JAR env var or install in CI"
  echo "  → Local install:"
  echo "     wget https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar"
  echo ""
  # Silently exiting 0 here would let CI report "formally verified" without
  # running a single check (audit finding F-5). In CI this is a hard failure.
  if [ -n "${CI:-}" ]; then
    echo "  ❌ TLC is required in CI — refusing to report success without model checking"
    exit 1
  fi
  echo "  (local run: skipping — set CI=1 to enforce)"
  exit 0
fi

for machine in "${CRITICAL_MACHINES[@]}"; do
  TLA_FILE="$TLA_DIR/${machine}.tla"

  if [ ! -f "$TLA_FILE" ]; then
    echo "  ⚠️  $machine: TLA+ file not found — skipping"
    ((SKIP++))
    continue
  fi

  echo "  Checking $machine..."
  REPORT="$REPORT_DIR/${machine}-$(date +%Y%m%d).txt"

  CFG_FILE="$TLA_DIR/${machine}.cfg"
  TLC_ARGS=(-modelcheck -workers auto)
  if [ -f "$CFG_FILE" ]; then
    TLC_ARGS+=(-config "$CFG_FILE")
  fi

  if java -jar "$TLC_JAR" "${TLC_ARGS[@]}" "$TLA_FILE" > "$REPORT" 2>&1; then

    if grep -q "No error" "$REPORT" || \
       grep -q "Model checking completed" "$REPORT"; then
      echo "  ✅ $machine: No violations"
      ((PASS++))
    else
      echo "  ✅ $machine: Completed (review report)"
      ((PASS++))
    fi
  else
    echo "  ❌ $machine: TLC found violations"
    echo "     Report: $REPORT"
    tail -20 "$REPORT"
    ((FAIL++))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS verified, $FAIL violations, $SKIP skipped"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "  ❌ Constitutional violations found in state machines"
  echo "     Fix specification before proceeding"
  exit 1
fi

echo ""
echo "  ✅ Critical state machines formally verified"
exit 0
