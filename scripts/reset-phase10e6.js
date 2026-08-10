#!/usr/bin/env node

/**
 * SOVR Phase RESET — Controlled Development Substrate Reset Script
 *
 * This script prepares for and verifies a controlled TigerBeetle cluster reset.
 * It does NOT perform the actual reset - that requires human operator action.
 *
 * Usage:
 *   node scripts/reset-phase10e6.js prepare
 *   node scripts/reset-phase10e6.js verify
 *
 * Modes:
 *   prepare  - Archive evidence, verify prerequisites, generate reset instructions
 *   verify   - Verify post-reset empty ledger state
 *
 * IMPORTANT: This script performs READ-ONLY operations. No ledger mutations.
 * The actual cluster reset MUST be performed by the human operator.
 */

import { createClient } from 'tigerbeetle-node';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AUDIT_DIR = join(ROOT, 'generated/audit');
const GOVERNANCE_DIR = join(ROOT, 'governance/tigerbeetle');
const SCRIPTS_DIR = join(ROOT, 'scripts');

const CLUSTER_ID = 0n;
const REPLICA_ADDRESSES = ['127.0.0.1:8080'];
const EXPECTED_ACCOUNT_IDS = [404771, 327102, 689728, 346086, 536681, 441831, 657844, 941698];
const DATA_DIRECTORY = 'D:/sovr-financial-os-protocol-v1.0.0/Tigerbeetle/data';

function log(msg) {
  console.log(`[RESET] ${msg}`);
}

function error(msg) {
  console.error(`[RESET] ERROR: ${msg}`);
}

function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
}

function readFile(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function runCommand(command) {
  try {
    return execSync(command, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

// ============================================================================
// GATE_R001: Evidence artifacts exist and are readable
// ============================================================================

function gateR001_evidenceArtifactsExist() {
  log('GATE_R001: Evidence artifacts exist and are readable');

  const requiredArtifacts = [
    'phase10e6-existing-ledger-snapshot.json',
    'phase10e6-transfer-provenance.json',
    'phase10e6-manifest-comparison.json',
    'phase10e6-event-classification.json',
    'phase10e6-recovery-recommendation.json',
    'phase10e6-investigation-summary.json',
  ];

  const results = [];
  for (const artifact of requiredArtifacts) {
    const path = join(AUDIT_DIR, artifact);
    const exists = existsSync(path);
    const content = exists ? readFile(path) : null;
    results.push({
      artifact,
      exists,
      readable: content !== null && content.length > 0,
    });
  }

  const allExist = results.every(r => r.exists && r.readable);

  const result = {
    gate: 'GATE_R001',
    name: 'Evidence artifacts exist and are readable',
    timestamp: new Date().toISOString(),
    artifacts: results,
    status: allExist ? 'PASS' : 'FAIL',
  };

  writeJson(join(AUDIT_DIR, 'phase10e6-reset-gate-r001.json'), result);
  log(`  Status: ${result.status}`);
  log(`  Artifacts: ${results.filter(r => r.exists).length}/${results.length}`);

  return allExist;
}

// ============================================================================
// GATE_R002: Reset authorization exists and is valid
// ============================================================================

function gateR002_resetAuthorizationExists() {
  log('GATE_R002: Reset authorization exists and is valid');

  const authPath = join(GOVERNANCE_DIR, 'RESET_AUTHORIZATION.yaml');
  const exists = existsSync(authPath);
  const content = exists ? readFile(authPath) : null;

  let approved = false;
  let authorizedBy = null;
  let timestamp = null;

  if (content) {
    const approvedMatch = content.match(/approved:\s*(true|false)/);
    const authorizedByMatch = content.match(/authorized_by:\s*(.+)/);
    const timestampMatch = content.match(/authorization_timestamp:\s*"?([^"\n]+)"?/);

    approved = approvedMatch ? approvedMatch[1] === 'true' : false;
    authorizedBy = authorizedByMatch ? authorizedByMatch[1].trim() : null;
    timestamp = timestampMatch ? timestampMatch[1].trim() : null;
  }

  const result = {
    gate: 'GATE_R002',
    name: 'Reset authorization exists and is valid',
    timestamp: new Date().toISOString(),
    authorization: {
      artifact: 'governance/tigerbeetle/RESET_AUTHORIZATION.yaml',
      exists,
      approved,
      authorized_by: authorizedBy,
      authorization_timestamp: timestamp,
    },
    status: approved && authorizedBy ? 'PASS' : 'FAIL',
  };

  writeJson(join(AUDIT_DIR, 'phase10e6-reset-gate-r002.json'), result);
  log(`  Status: ${result.status}`);
  log(`  Approved: ${approved}`);
  log(`  Authorized by: ${authorizedBy}`);

  return result.status === 'PASS';
}

// ============================================================================
// GATE_R003: TigerBeetle process is running
// ============================================================================

function gateR003_tigerbeetleRunning() {
  log('GATE_R003: TigerBeetle process is running');

  // Check if port 8080 is listening
  let processRunning = false;
  let pid = null;

  try {
    // Use netstat or similar to check if port is listening
    const netstatOutput = runCommand('netstat -ano | findstr :8080');
    if (netstatOutput) {
      processRunning = true;
      const lines = netstatOutput.split('\n');
      for (const line of lines) {
        if (line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          pid = parts[parts.length - 1];
          break;
        }
      }
    }
  } catch (e) {
    // Ignore errors
  }

  const result = {
    gate: 'GATE_R003',
    name: 'TigerBeetle process is running',
    timestamp: new Date().toISOString(),
    tigerbeetle: {
      process_running: processRunning,
      pid,
      endpoint: REPLICA_ADDRESSES[0],
    },
    status: processRunning ? 'PASS' : 'FAIL',
  };

  writeJson(join(AUDIT_DIR, 'phase10e6-reset-gate-r003.json'), result);
  log(`  Status: ${result.status}`);
  log(`  Process running: ${processRunning}`);
  log(`  PID: ${pid}`);

  return processRunning;
}

// ============================================================================
// GATE_R004: Cluster state matches pre-reset snapshot
// ============================================================================

async function gateR004_clusterStateMatches() {
  log('GATE_R004: Cluster state matches pre-reset snapshot');

  try {
    const client = createClient({
      cluster_id: CLUSTER_ID,
      replica_addresses: REPLICA_ADDRESSES,
    });

    const accounts = await client.lookupAccounts(EXPECTED_ACCOUNT_IDS.map(id => BigInt(id)));
    const transfers = await client.queryTransfers({
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      code: 0,
      ledger: 0,
      timestamp_min: 0n,
      timestamp_max: 0n,
      limit: 1000,
      flags: 0,
    });

    client.destroy();

    const accountsFound = accounts.length;
    const transfersFound = transfers.length;
    const transferIds = transfers.map(t => Number(t.id));

    // Load pre-reset snapshot
    const snapshotPath = join(AUDIT_DIR, 'phase10e6-existing-ledger-snapshot.json');
    const snapshotContent = readFile(snapshotPath);
    const snapshot = snapshotContent ? JSON.parse(snapshotContent) : null;

    const snapshotAccounts = snapshot?.accounts_found || 0;
    const snapshotTransfers = snapshot?.transfers_found || 0;
    const snapshotTransferIds = snapshot?.transfer_ids || [];

    const accountsMatch = accountsFound === snapshotAccounts;
    const transfersMatch = transfersFound === snapshotTransfers;
    const transferIdsMatch = JSON.stringify(transferIds.sort()) === JSON.stringify(snapshotTransferIds.sort());

    const result = {
      gate: 'GATE_R004',
      name: 'Cluster state matches pre-reset snapshot',
      timestamp: new Date().toISOString(),
      current_state: {
        accounts_found: accountsFound,
        transfers_found: transfersFound,
        transfer_ids: transferIds,
      },
      snapshot_state: {
        accounts_found: snapshotAccounts,
        transfers_found: snapshotTransfers,
        transfer_ids: snapshotTransferIds,
      },
      accounts_match: accountsMatch,
      transfers_match: transfersMatch,
      transfer_ids_match: transferIdsMatch,
      status: accountsMatch && transfersMatch && transferIdsMatch ? 'PASS' : 'FAIL',
    };

    writeJson(join(AUDIT_DIR, 'phase10e6-reset-gate-r004.json'), result);
    log(`  Status: ${result.status}`);
    log(`  Accounts match: ${accountsMatch}`);
    log(`  Transfers match: ${transfersMatch}`);
    log(`  Transfer IDs match: ${transferIdsMatch}`);

    return result.status === 'PASS';
  } catch (err) {
    error(err.message);
    const result = {
      gate: 'GATE_R004',
      name: 'Cluster state matches pre-reset snapshot',
      timestamp: new Date().toISOString(),
      error: err.message,
      status: 'FAIL',
    };
    writeJson(join(AUDIT_DIR, 'phase10e6-reset-gate-r004.json'), result);
    return false;
  }
}

// ============================================================================
// Prepare Mode: Archive evidence and generate reset instructions
// ============================================================================

function prepare() {
  log('=== Phase RESET Preparation ===');
  log('');

  // Run all gates
  const gateR001 = gateR001_evidenceArtifactsExist();
  log('');

  const gateR002 = gateR002_resetAuthorizationExists();
  log('');

  const gateR003 = gateR003_tigerbeetleRunning();
  log('');

  gateR004_clusterStateMatches().then(gateR004 => {
    log('');

    // Generate archive
    const snapshotPath = join(AUDIT_DIR, 'phase10e6-existing-ledger-snapshot.json');
    const snapshotContent = readFile(snapshotPath);
    const snapshot = snapshotContent ? JSON.parse(snapshotContent) : null;

    const archive = {
      archive_id: 'GENESIS_ATTEMPT_001',
      archive_timestamp: new Date().toISOString(),
      pre_reset_snapshot_hash: snapshot?.snapshot_hash || null,
      evidence_artifacts: [
        'phase10e6-existing-ledger-snapshot.json',
        'phase10e6-transfer-provenance.json',
        'phase10e6-manifest-comparison.json',
        'phase10e6-event-classification.json',
        'phase10e6-recovery-recommendation.json',
        'phase10e6-investigation-summary.json',
      ],
      classification: 'CLASS_A',
      disposition: 'ARCHIVED',
      reset_directive: 'SOVR-GENESIS-000002-RESET-000001',
    };

    writeJson(join(AUDIT_DIR, 'phase10e6-genesis-attempt-001-archive.json'), archive);
    log('Evidence archived as GENESIS_ATTEMPT_001');
    log('');

    // Generate reset instructions
    const instructions = {
      directive: 'SOVR-GENESIS-000002-RESET-000001',
      timestamp: new Date().toISOString(),
      status: 'READY_FOR_HUMAN_OPERATOR',
      prerequisites: {
        gateR001: gateR001 ? 'PASS' : 'FAIL',
        gateR002: gateR002 ? 'PASS' : 'FAIL',
        gateR003: gateR003 ? 'PASS' : 'FAIL',
        gateR004: gateR004 ? 'PASS' : 'FAIL',
      },
      human_operator_actions: [
        '1. Stop TigerBeetle process (PID: check phase10e6-reset-gate-r003.json)',
        '2. Format cluster data: tigerbeetle format --cluster=0 --replica=0 --replica-count=1 ' + DATA_DIRECTORY + '/0/cluster.tigerbeetle',
        '3. Restart TigerBeetle: tigerbeetle start --addresses=127.0.0.1:8080 ' + DATA_DIRECTORY + '/0/cluster.tigerbeetle',
        '4. Verify empty ledger: node scripts/reset-phase10e6.js verify',
        '5. Authorize Phase 10E.7: Update governance/tigerbeetle/HUMAN_AUTHORIZATION.yaml',
      ],
      warnings: [
        'This action is IRREVERSIBLE',
        'Existing ledger data will be permanently lost',
        'Evidence has been archived as GENESIS_ATTEMPT_001',
        'Only proceed if reset authorization is valid',
      ],
    };

    writeJson(join(AUDIT_DIR, 'phase10e6-reset-instructions.json'), instructions);
    log('Reset instructions generated');
    log('');

    // Summary
    const allPass = gateR001 && gateR002 && gateR003 && gateR004;
    const summary = {
      phase: 'RESET',
      mode: 'PREPARE',
      timestamp: new Date().toISOString(),
      directive: 'SOVR-GENESIS-000002-RESET-000001',
      gates: {
        GATE_R001: gateR001 ? 'PASS' : 'FAIL',
        GATE_R002: gateR002 ? 'PASS' : 'FAIL',
        GATE_R003: gateR003 ? 'PASS' : 'FAIL',
        GATE_R004: gateR004 ? 'PASS' : 'FAIL',
      },
      overall: allPass ? 'READY_FOR_RESET' : 'PREREQUISITES_NOT_MET',
    };

    writeJson(join(AUDIT_DIR, 'phase10e6-reset-summary.json'), summary);
    log('=== Reset Preparation Complete ===');
    log(`  Overall: ${summary.overall}`);

    if (allPass) {
      log('');
      log('=== HUMAN OPERATOR ACTIONS REQUIRED ===');
      for (const action of instructions.human_operator_actions) {
        log(`  ${action}`);
      }
      log('');
      log('After reset, run: node scripts/reset-phase10e6.js verify');
    }

    process.exit(allPass ? 0 : 1);
  });
}

// ============================================================================
// Verify Mode: Verify post-reset empty ledger state
// ============================================================================

async function verify() {
  log('=== Phase RESET Verification ===');
  log('');

  log('Connecting to TigerBeetle cluster...');
  const client = createClient({
    cluster_id: CLUSTER_ID,
    replica_addresses: REPLICA_ADDRESSES,
  });

  try {
    log('STEP 1: Verify empty ledger');

    const accounts = await client.lookupAccounts(EXPECTED_ACCOUNT_IDS.map(id => BigInt(id)));
    const transfers = await client.queryTransfers({
      user_data_128: 0n,
      user_data_64: 0n,
      user_data_32: 0,
      code: 0,
      ledger: 0,
      timestamp_min: 0n,
      timestamp_max: 0n,
      limit: 1000,
      flags: 0,
    });

    const accountsFound = accounts.length;
    const transfersFound = transfers.length;

    log(`  Accounts found: ${accountsFound}`);
    log(`  Transfers found: ${transfersFound}`);

    const emptyLedger = accountsFound === 0 && transfersFound === 0;

    if (!emptyLedger) {
      error('Ledger is not empty. Reset may not have completed successfully.');
      process.exit(1);
    }

    log('  Ledger is EMPTY ✓');
    log('');

    // Generate certification
    const certification = {
      reset_verified: true,
      verified_at: new Date().toISOString(),
      cluster: {
        cluster_id: Number(CLUSTER_ID),
        endpoint: REPLICA_ADDRESSES[0],
      },
      ledger_state: {
        accounts: accountsFound,
        transfers: transfersFound,
        status: 'EMPTY',
      },
      ready_for_phase10e7: true,
    };

    writeJson(join(AUDIT_DIR, 'phase10e6-reset-certification.json'), certification);
    log('Reset certification generated');
    log('');

    log('=== Reset Verification Complete ===');
    log('  Status: READY FOR PHASE 10E.7');
    log('');
    log('Next steps:');
    log('  1. Update governance/tigerbeetle/HUMAN_AUTHORIZATION.yaml for Phase 10E.7');
    log('  2. Run Phase 10E.7 genesis ceremony');

    process.exit(0);
  } catch (err) {
    error(err.message);
    process.exit(1);
  } finally {
    client.destroy();
  }
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const mode = process.argv[2];
  if (mode === 'verify') {
    verify();
  } else if (mode === 'prepare') {
    prepare();
  } else {
    console.error('Usage: node scripts/reset-phase10e6.js [prepare|verify]');
    process.exit(1);
  }
}

main();
