#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "SOVR Protocol — Setup"
echo "━━━━━━━━━━━━━━━━━━━"

echo "Building @sovr/shared..."
cd packages/shared
npm install --silent
cd ../..

echo "Building @sovr/compiler..."
cd packages/compiler
npm install --silent
npm run build --silent
cd ../..

echo "Building @sovr/runtime..."
cd packages/runtime
npm install --silent
npm run build --silent
cd ../..

echo "Compiling YAML protocol..."
node packages/compiler/dist/cli.js compile
node packages/compiler/dist/cli.js verify

echo ""
echo "━━━━━━━━━━━━━━━━━━━"
echo "Setup complete."
echo ""
echo "Run the runtime:"
echo "  PORT=3001 node packages/runtime/dist/server/index.js"
echo ""
echo "Run the demo:"
echo "  bash scripts/demo.sh"
echo ""
