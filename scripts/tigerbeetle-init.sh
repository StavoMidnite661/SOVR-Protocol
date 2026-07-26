#!/usr/bin/env bash
# scripts/tigerbeetle-init.sh
#
# Initialize TigerBeetle data file for development.
# Run ONCE before first docker compose up.
#
# Usage:
#   chmod +x scripts/tigerbeetle-init.sh
#   ./scripts/tigerbeetle-init.sh
#
# Production: run with TB_REPLICA_COUNT=3 for 3-node cluster.

set -euo pipefail

CLUSTER_ID="${TIGERBEETLE_CLUSTER_ID:-0}"
DATA_DIR="${TIGERBEETLE_DATA_DIR:-./data/tigerbeetle}"
REPLICA_COUNT="${TB_REPLICA_COUNT:-1}"
IMAGE="ghcr.io/tigerbeetle/tigerbeetle:latest"

echo "═══════════════════════════════════════════"
echo " TigerBeetle Init"
echo " Cluster ID:    ${CLUSTER_ID}"
echo " Data dir:      ${DATA_DIR}"
echo " Replica count: ${REPLICA_COUNT}"
echo "═══════════════════════════════════════════"

mkdir -p "${DATA_DIR}"

# Format data file for replica 0
docker run --rm \
  -v "${DATA_DIR}:/data" \
  "${IMAGE}" \
  format \
  --cluster-id="${CLUSTER_ID}" \
  --replica-count="${REPLICA_COUNT}" \
  --replica=0 \
  /data/0_0.tigerbeetle

echo ""
echo "✅ TigerBeetle initialized: ${DATA_DIR}/0_0.tigerbeetle"
echo ""
echo "Start with:"
echo "  docker compose up tigerbeetle"
echo ""
echo "Verify:"
echo "  docker compose exec tigerbeetle nc -z localhost 3000 && echo OK"
