#!/usr/bin/env node

/**
 * SOVR Phase 10E.8 — Genesis Substrate Lock & Attestation Script
 *
 * This script captures the complete genesis state, computes a canonical root hash,
 * and produces attestation artifacts. It performs READ-ONLY operations.
 *
 * Usage:
 *   node scripts/attest-phase10e8.js
 *
 * Output:
 *   generated/audit/phase10e8-genesis-snapshot.json
 *   generated/audit/phase10e8-genesis-root-hash.json
 *   governance/tigerbeetle/PHASE10E.8_LOCK_CERTIFICATE.yaml
 */

import { createClient } from 'tigerbeetle-node';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AUDIT_DIR = join(ROOT, 'generated/audit');
const GOVERNANCE_DIR = join(ROOT, 'governance/tigerbeetle');

const CLUSTER_ID = 0n;
const REPLICA_ADDRESSES = ['127.0.0.1:8080'];
const EXPECTED_ACCOUNT_IDS = [404771, 327102, 689728, 346086, 536681, 441831, 657844, 941698];
const EXPECTED_TRANSFER_ID = 190481;

function log(msg) {
  console.log(`[10E.8] ${msg}`);
}

function error(msg) {
  console.error(`[10E.8] ERROR: ${msg}`);
}

function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
}

function canonicalJson(obj) {
  return JSON.stringify(obj, (_k, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Map) return Object.fromEntries(v);
    return v;
  }, 2);
}

async function main() {
  log('=== Phase 10E.8 Genesis Substrate Lock & Attestation ===');
  log('');

  // STEP 1 — Connect to TigerBeetle
  log('STEP 1: Connect to TigerBeetle');
  const client = createClient({
    cluster_id: CLUSTER_ID,
    replica_addresses: REPLICA_ADDRESSES,
  });

  // STEP 2 — Read all accounts
  log('STEP 2: Read all accounts');
  const accounts = await client.lookupAccounts(EXPECTED_ACCOUNT_IDS.map(id => BigInt(id)));
  log(`  Found: ${accounts.length} accounts`);

  if (accounts.length !== 8) {
    error(`Expected 8 accounts, found ${accounts.length}`);
    process.exit(1);
  }

  // STEP 3 — Read all transfers
  log('STEP 3: Read all transfers');
  const transfers = await client.queryTransfers({
    user_data_128: 0n,
    user_data_64: 0n,
    user_data_32: 0,
    code: 0,
    ledger: 0,
    timestamp_min: 0n,
    timestamp_max: 0n,
    limit: 100,
    flags: 0,
  });
  log(`  Found: ${transfers.length} transfers`);

  if (transfers.length !== 1) {
    error(`Expected 1 transfer, found ${transfers.length}`);
    process.exit(1);
  }

  // STEP 4 — Load genesis manifest
  log('STEP 4: Load genesis manifest');
  const manifestPath = join(GOVERNANCE_DIR, 'GENESIS_TRANSACTION_SET.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifestHash = createHash('sha256').update(canonicalJson(manifest)).digest('hex');
  log(`  Manifest hash: ${manifestHash}`);

  // STEP 5 — Compute genesis root hash
  log('STEP 5: Compute genesis root hash');

  // Sort accounts by ID for canonical ordering
  const sortedAccounts = accounts
    .map(a => ({
      id: Number(a.id),
      ledger: a.ledger,
      code: a.code,
      debits_posted: Number(a.debits_posted),
      credits_posted: Number(a.credits_posted),
      timestamp: a.timestamp.toString(),
    }))
    .sort((a, b) => a.id - b.id);

  // Sort transfers by ID for canonical ordering
  const sortedTransfers = transfers
    .map(t => ({
      id: Number(t.id),
      debit_account_id: Number(t.debit_account_id),
      credit_account_id: Number(t.credit_account_id),
      amount: t.amount.toString(),
      code: t.code,
      ledger: t.ledger,
      timestamp: t.timestamp.toString(),
    }))
    .sort((a, b) => a.id - b.id);

  const rootHashInput = canonicalJson({
    accounts: sortedAccounts,
    transfers: sortedTransfers,
    manifest_hash: manifestHash,
  });

  const rootHash = createHash('sha256').update(rootHashInput).digest('hex');
  log(`  Root hash: ${rootHash}`);

  // STEP 6 — Generate attestation artifacts
  log('STEP 6: Generate attestation artifacts');

  const timestamp = new Date().toISOString();

  // ARTIFACT 1: Genesis Snapshot
  const snapshot = {
    snapshot_id: 'SOVR-GENESIS-000002-SNAPSHOT-001',
    timestamp,
    cluster: {
      cluster_id: Number(CLUSTER_ID),
      endpoint: REPLICA_ADDRESSES[0],
      data_directory: 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data',
    },
    accounts: sortedAccounts,
    transfers: sortedTransfers,
    manifest_hash: manifestHash,
    snapshot_hash: createHash('sha256').update(canonicalJson({ accounts: sortedAccounts, transfers: sortedTransfers })).digest('hex'),
  };

  writeJson(join(AUDIT_DIR, 'phase10e8-genesis-snapshot.json'), snapshot);
  log(`  Snapshot written: phase10e8-genesis-snapshot.json`);

  // ARTIFACT 2: Genesis Root Hash
  const rootHashArtifact = {
    root_hash: rootHash,
    hash_algorithm: 'SHA256',
    inputs: [
      { type: 'accounts', count: sortedAccounts.length, hash: createHash('sha256').update(canonicalJson(sortedAccounts)).digest('hex') },
      { type: 'transfers', count: sortedTransfers.length, hash: createHash('sha256').update(canonicalJson(sortedTransfers)).digest('hex') },
      { type: 'manifest', hash: manifestHash },
    ],
    computed_at: timestamp,
  };

  writeJson(join(AUDIT_DIR, 'phase10e8-genesis-root-hash.json'), rootHashArtifact);
  log(`  Root hash written: phase10e8-genesis-root-hash.json`);

  // ARTIFACT 3: Lock Certificate
  const lockCertificate = {
    lock_id: 'SOVR-GENESIS-000002-LOCK-001',
    locked: true,
    locked_at: timestamp,
    genesis_root_hash: rootHash,
    account_count: sortedAccounts.length,
    transfer_count: sortedTransfers.length,
    immutable: true,
    snapshot_hash: snapshot.snapshot_hash,
    manifest_hash: manifestHash,
    cluster: {
      cluster_id: Number(CLUSTER_ID),
      endpoint: REPLICA_ADDRESSES[0],
    },
  };

  writeJson(join(GOVERNANCE_DIR, 'PHASE10E.8_LOCK_CERTIFICATE.json'), lockCertificate);
  log(`  Lock certificate written: PHASE10E.8_LOCK_CERTIFICATE.json`);

  // STEP 7 — Verification
  log('STEP 7: Verification');

  // Verify all expected accounts present
  const actualAccountIds = new Set(sortedAccounts.map(a => a.id));
  const expectedAccountIds = new Set(EXPECTED_ACCOUNT_IDS);
  const accountCountMatch = actualAccountIds.size === expectedAccountIds.size &&
    [...expectedAccountIds].every(id => actualAccountIds.has(id));

  // Verify expected transfer present
  const actualTransferIds = new Set(sortedTransfers.map(t => t.id));
  const transferCountMatch = actualTransferIds.has(EXPECTED_TRANSFER_ID);

  log(`  Account count match: ${accountCountMatch ? 'PASS' : 'FAIL'} (${actualAccountIds.size}/${expectedAccountIds.size})`);
  log(`  Transfer count match: ${transferCountMatch ? 'PASS' : 'FAIL'} (${actualTransferIds.size}/1)`);

  if (!accountCountMatch || !transferCountMatch) {
    error('Verification failed');
    process.exit(1);
  }

  // STEP 8 — Summary
  log('');
  log('=== Genesis Lock & Attestation Complete ===');
  log(`  Snapshot ID: ${snapshot.snapshot_id}`);
  log(`  Root Hash: ${rootHash}`);
  log(`  Lock ID: ${lockCertificate.lock_id}`);
  log(`  Accounts: ${sortedAccounts.length}`);
  log(`  Transfers: ${sortedTransfers.length}`);
  log(`  Status: LOCKED`);
  log('');
  log('Genesis substrate is now attested and locked.');
  log('This root hash serves as the permanent anchor for future ledger validation.');

  client.destroy();
  process.exit(0);
}

main().catch(err => {
  error(err.message);
  process.exit(1);
});
