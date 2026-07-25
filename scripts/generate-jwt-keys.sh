#!/usr/bin/env bash
# scripts/generate-jwt-keys.sh
# Generate a production RS256 JWT key pair for SOVR Financial OS.
# Outputs the PEM-encoded private and public keys.
# Never commit these values to version control.

set -euo pipefail

echo "Generating SOVR Protocol RS256 JWT key pair..."
echo ""

openssl genrsa -out /tmp/sovr_jwt_private.pem 4096 2>/dev/null
openssl rsa -in /tmp/sovr_jwt_private.pem -pubout -out /tmp/sovr_jwt_public.pem 2>/dev/null

PRIVATE_KEY=$(cat /tmp/sovr_jwt_private.pem)
PUBLIC_KEY=$(cat /tmp/sovr_jwt_public.pem)

rm -f /tmp/sovr_jwt_private.pem /tmp/sovr_jwt_public.pem

echo "Add these to your environment or secrets manager:"
echo ""
echo "JWT_PRIVATE_KEY=\"${PRIVATE_KEY}\""
echo ""
echo "JWT_PUBLIC_KEY=\"${PUBLIC_KEY}\""
echo ""
echo "WARNING: Store these securely."
echo "Never commit to git."
echo "Rotate regularly."
