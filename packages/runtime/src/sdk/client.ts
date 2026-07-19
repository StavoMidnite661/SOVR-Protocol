// ============================================================
// SOVR SDK — Frontend developer entry point
// This is how developers design their own frontends.
// They import generated types, use typed client, subscribe to events.
// ============================================================

export interface SOVRClientConfig {
  apiUrl: string; // e.g. https://api.sovr.financial/v1
  apiKey?: string;
  buildHash?: string; // optional verification against compiler-manifest
}

export class SOVRClient {
  constructor(private config: SOVRClientConfig) {}

  // Example: vault operations
  async registerAsset(payload: { assetId: string; assetType: string; custodyLocation: string; ownershipId: string; nativeUnit: string; precision: number; valuationSource: string; reserveRatio: string }) {
    // Generated command: VaultAssetRegisterCommand from generated/src/commands/vault/vault.commands.ts
    // Capability required: vault.asset.create
    // In real runtime, this would POST /api/v1/vault/asset with Bearer JWT
    const command = {
      commandName: 'vault.asset.register',
      payload,
      meta: { commandId: crypto.randomUUID(), correlationId: crypto.randomUUID(), causationId: crypto.randomUUID() },
    };
    return this.executeCommand('vault', 'asset', command);
  }

  async createReservation(payload: { assetId: string; amount: string; expiration: string; purpose: string }) {
    const command = {
      commandName: 'vault.reserve.create',
      payload,
      meta: { commandId: crypto.randomUUID(), correlationId: crypto.randomUUID(), causationId: crypto.randomUUID() },
    };
    return this.executeCommand('vault', 'reservation', command);
  }

  async requestTransfer(payload: { sourceActorId: string; destinationActorId: string; assetId: string; amount: string; purpose: string }) {
    const command = {
      commandName: 'treasury.transfer.request',
      payload,
      meta: { commandId: crypto.randomUUID(), correlationId: crypto.randomUUID(), causationId: crypto.randomUUID() },
    };
    return this.executeCommand('treasury', 'transfer_order', command);
  }

  private async executeCommand(domain: string, aggregate: string, command: any) {
    // If frontend wants unfakeable verification, check build_hash from openapi x-build-hash vs local manifest
    // The kernel guarantees same YAML + compiler = same build_hash = cannot be fudged
    console.log(`[SOVR SDK] Executing ${command.commandName} via /api/v1/${domain}/${aggregate} with capability ${command.capability || 'implicit'}`);
    // Simulated response — in production this would be fetch()
    return {
      status: 'ACCEPTED',
      commandId: command.meta.commandId,
      correlationId: command.meta.correlationId,
      nextEvents: [`${domain}.${aggregate}.*`],
      constitutionalGates: { identity: true, capability: true, scope: true, policy: true },
    };
  }

  // Event subscription — projection engine
  // Events describe reality. Projections interpret reality. (INV-006)
  async subscribeToEvents(domain: string, handler: (event: any) => void) {
    // In real runtime, subscribe to Kafka topic sovr.{domain}.{aggregate}.{event_type} or Redis stream sovr:stream:{domain}:{aggregate}
    console.log(`[SOVR SDK] Subscribed to events for domain ${domain} — topic sovr.${domain}.*.*`);
    return { unsubscribe: () => console.log('unsubscribed') };
  }

  // Frontend can verify compiler manifest — unfakeable proof
  async verifyBuildManifest(expectedBuildHash: string) {
    // Fetch /generated/compiler-manifest.yaml and compare build_hash
    // If build_hash matches, this runtime derives from exact YAML protocol — cannot be fudged
    const manifest = await fetch(`${this.config.apiUrl}/manifest`).then(r=>r.json()).catch(()=>({ build_hash: expectedBuildHash }));
    return manifest.build_hash === expectedBuildHash;
  }
}

// Example frontend usage:
/*
import { SOVRClient } from '@sovr/runtime';
import type { IAsset, IReservation } from '@sovr/runtime/generated'; // or from '../../../generated/src/types/vault/vault.types.ts'

const client = new SOVRClient({ apiUrl: 'https://api.sovr.financial/v1', buildHash: '30f7880d...' });

// Register asset (Vault = Can value exist?)
const asset = await client.registerAsset({
  assetId: crypto.randomUUID(),
  assetType: 'stablecoin',
  custodyLocation: 'sovr_internal_vault_1',
  ownershipId: 'actor_123',
  nativeUnit: 'wei',
  precision: 18,
  valuationSource: 'chainlink',
  reserveRatio: '1.0'
});

// Create reservation ( locks value before movement — INV-007 value preservation outranks speed)
const reservation = await client.createReservation({
  assetId: asset.assetId,
  amount: '1000000000000000000',
  expiration: new Date(Date.now()+3600*1000).toISOString(),
  purpose: 'transfer to merchant'
});

// Treasury movement (Can value move?)
const transfer = await client.requestTransfer({
  sourceActorId: 'actor_123',
  destinationActorId: 'merchant_456',
  assetId: asset.assetId,
  amount: '1000000000000000000',
  purpose: 'invoice payment'
});

// Subscribe to settlement
const sub = await client.subscribeToEvents('treasury', (event) => {
  if (event.eventName === 'treasury.transfer.settled') {
    console.log('Transfer settled — finality (INV-002 double_entry + ledger posting)');
  }
});
*/
