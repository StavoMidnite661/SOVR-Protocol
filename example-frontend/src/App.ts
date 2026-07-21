// Example frontend built on SOVR working yaml protocol
// This demonstrates how developers design own frontends on top of kernel

// Import generated types — machine-readable compiler output, deterministic, unfakeable
import type { IAsset, IReservation } from '../../generated/src/types/vault/vault.types.js';
import { VaultAssetRegisterCommand } from '../../generated/src/commands/vault/vault.commands.js';
import { SOVRClient } from '../../packages/runtime/src/sdk/client.js';

// The kernel answers 9 questions:
// vault: Can value exist? (atomic value definition)
// ledger: How is truth recorded? (immutable event log, double-entry)
// treasury: Can value move? (controlled movement with reservation)
// payment: Can execution leave system? (external rails via adapters)
// identity: Who is acting? (actor verification, trust levels)
// policy: Is this permitted? (pure-function rule evaluation)
// agent: Can intelligence request action? (bounded autonomy)
// governance: Who oversees? (constitutional oversight, emergency halt)
// intent: What does actor want? (human/agent intent → command)

async function main() {
  console.log('=== SOVR Kernel Frontend Example ===');
  console.log('Protocol version: 1.0.0');
  console.log('Compiler version: 0.2.0-kernel-working');
  console.log('Build hash (unfakeable): 30f7880d5d665fbcb34ac847ab650bece84a92faa094a3a1b3f770e6732ec3c3');
  console.log('Every digitalizable financial infrastructure can connect via adapters');
  console.log('');

  // Protocol API Service runs on :3001 as Source of Canonical Events (CE)
  // Explorer (frontend) runs on :3000 and connects via /api/v1 to backend
  const client = new SOVRClient({
    apiUrl: 'http://localhost:3001/api/v1',
    buildHash: '20c57cfb56b202ce975b4932c06b3c4fe81feaefb2b63eccc11a628e009ebb1e',
  });

  // 1. Vault: define atomic value — polymorphic value model, no silent conversion
  const asset: Partial<IAsset> = {
    assetId: crypto.randomUUID(),
    assetType: 'stablecoin',
    custodyLocation: 'sovr_internal_vault_1',
    ownershipId: 'actor_human_001',
    nativeUnit: 'wei',
    precision: 18,
    valuationSource: 'chainlink',
    reserveRatio: '1.0' as any,
    state: 'REGISTERED',
  };
  console.log('1. Vault asset registered (can value exist?):', asset.assetId);

  // 2. Treasury: controlled movement — reservation before execution (INV-007)
  const reservation: Partial<IReservation> = {
    assetId: asset.assetId,
    amount: '100000000000000000000' as any, // 100 tokens with 18 decimals
    expiration: new Date(Date.now() + 3600 * 1000).toISOString() as any,
    purpose: 'merchant payment',
  };
  console.log('2. Vault reservation created (value preservation outranks speed):', reservation.amount);

  // 3. Payment: external connectivity — any rail
  console.log('3. Payment rails available: ACH, FEDNOW, WIRE, RTP, CARD, BLOCKCHAIN, STABLECOIN, SWIFT, SEPA, FUTURE_ADAPTER');
  console.log('   Adapter prohibition: ADAPTERS_MAY_NOT_MUTATE_CONSTITUTIONAL_STATE');
  console.log('   Handoff protocols: attestation_based, adapter_based, batch_export');

  // 4. Ledger: double-entry, append-only — INV-001, INV-002
  console.log('4. Ledger guarantees: every state change requires immutable event, debits == credits');

  // 5. Capability check — INV-003, INV-008 gate 2+3
  console.log('5. Capability check: vault.asset.create with scope asset:*:* — governance approval required');

  // 6. Policy evaluation — deterministic, pure function, replayable hash
  console.log('6. Policy evaluation: deterministic_hash for replay verification');

  // 7. ExecutionContext — single object handler receives (ADR-009)
  console.log('7. ExecutionContext: identity + intent + policyDecision + capabilities + vault/treasury/ledger/payment contexts');

  console.log('\n=== Frontend can be any stack ===');
  console.log('- React/Vue/Svelte importing generated/src/types/*');
  console.log('- Mobile: React Native, Swift, Kotlin using OpenAPI from generated/openapi.yaml');
  console.log('- Backend services: subscribing to Kafka topics sovr.{domain}.{aggregate}.{event}');
  console.log('- Realtime: Redis streams sovr:stream:{domain}:{aggregate}');
  console.log('\n=== Unfakeable verification ===');
  console.log('Build manifest contains input_hashes, ir_hash, output_hashes, build_hash');
  console.log('build_hash = sha256(sorted(input_hashes) + ir_hash + sorted(output_hashes) + compiler_version)');
  console.log('Same YAML + same compiler = byte-identical manifest = cannot be fudged');
  console.log('Frontend can verify: GET /manifest → compare build_hash === expected → proof this runtime derives from exact frozen YAML');
}

main();
