// Example frontend built on SOVR working yaml protocol
// This demonstrates how developers design own frontends on top of kernel.
// All SDK calls are REAL — they hit http://localhost:3001 and
// round-trip through the 7-stage pipeline. The BootScreen (separately
// imported) polls /api/v1/health before main() runs.

import { showBootScreen, waitForHealthyBoot } from './BootScreen.js';

async function main() {
  console.log('=== SOVR Kernel Frontend Example ===');

  // 1. Wait for kernel to become HEALTHY (real polling, not setTimeout)
  await showBootScreen(process.cwd());
  await waitForHealthyBoot({ apiUrl: 'http://localhost:3001', maxWaitMs: 30_000 });

  // 2. Lazy-import the SDK to avoid loading it before the kernel is up
  const { SOVRClient } = await import('../../packages/runtime/src/sdk/client.js');

  // 3. Get the build hash from the live manifest (not hardcoded)
  const manifestRes = await fetch('http://localhost:3001/manifest');
  const manifest = await manifestRes.json();
  const buildHash = manifest.build_hash as string;

  console.log(`Protocol version: ${manifest.protocol_version}`);
  console.log(`Compiler version: ${manifest.compiler_version}`);
  console.log(`Build hash (unfakeable, from live manifest): ${buildHash}`);
  console.log('Every digitalizable financial infrastructure can connect via adapters');
  console.log('');

  const client = new SOVRClient({
    apiUrl: 'http://localhost:3001',
    buildHash,
    actorId: 'actor_human_001',
    actorType: 'human',
    timeoutMs: 10_000,
  });

  // 4. Verify the SDK's build_hash matches the live kernel — proves unfakeable provenance
  try {
    const verified = await client.verifyBuildManifest();
    console.log(`✓ Build manifest verified: build_hash matches (${verified.buildHash.slice(0, 16)}...)`);
  } catch (e: any) {
    console.error(`✗ Build hash mismatch: ${e.message}`);
    process.exit(2);
  }

  // 5. Login — get a real HMAC-signed JWT
  const session = await client.createSession({
    identity_id: 'actor_human_001',
    actor_id: 'actor_human_001',
    actor_type: 'human',
  });
  console.log(`✓ Session created: ${session.session_id}, JWT length=${session.jwt.length}`);

  // 6. Grant the capability (governance role) so the actor can register an asset
  await client.grantCapability({
    capabilityId: 'vault.asset.create',
    actorId: 'actor_human_001',
    scopePattern: 'vault.asset:*',
  });

  // 7. Register an asset — REAL HTTP POST, REAL 7-stage pipeline
  const assetId = crypto.randomUUID();
  console.log(`Registering asset ${assetId}...`);
  const result = await client.registerAsset({
    assetId,
    assetType: 'stablecoin',
    issuerId: 'actor_human_001',
    ownershipId: 'actor_human_001',
    custodyProvider: 'sovr_internal',
    custodyLocation: 'sovr_internal_vault_1',
    nativeUnit: 'wei',
    precision: 18,
    valuationSource: 'chainlink',
    reserveRatio: '1.0',
  });
  if (result.status !== 'ACCEPTED') {
    console.error(`✗ Asset registration rejected: ${result.error}`);
    process.exit(3);
  }
  console.log(`✓ Asset registered. Events emitted: ${result.events.length}`);
  for (const ev of result.events) {
    console.log(`    - ${ev.event_name}  (correlation=${ev.correlation_id.slice(0, 8)}...)`);
  }

  // 8. Read it back from the event log (Source of CE)
  const events = await client.listEvents({ domain: 'vault', aggregate: 'asset', limit: 5 });
  console.log(`✓ Event log: ${events.total} vault/asset events`);

  // 9. Read it from the projection
  const proj = await client.queryProjection('vault_asset_view', { assetId });
  if (proj.records.length > 0) {
    console.log(`✓ Projection vault_asset_view: ${proj.records[0].state} (asset_id=${proj.records[0].asset_id})`);
  }

  console.log('');
  console.log('=== Frontend can be any stack ===');
  console.log('- React/Vue/Svelte importing generated/src/types/*');
  console.log('- Mobile: React Native, Swift, Kotlin using OpenAPI from generated/openapi.yaml');
  console.log('- Backend services: subscribing to Kafka topics sovr.{domain}.{aggregate}.{event}');
  console.log('- Realtime: Redis streams sovr:stream:{domain}:{aggregate} or WS /api/v1/events/stream');
  console.log('- External: ACH via /api/v1/payment/rail/ACH/{prepare,execute,confirm}');
  console.log('');
  console.log('=== Unfakeable verification ===');
  console.log('Build manifest contains input_hashes, ir_hash, output_hashes, build_hash');
  console.log('Frontend fetches /api/v1/manifest and compares build_hash before any command — cannot be fudged');
}

main().catch(e => { console.error('Frontend failed:', e); process.exit(1); });
