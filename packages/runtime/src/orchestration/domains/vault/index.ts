export interface VaultState {
  vault_id: string;
  state: 'INIT' | 'ACTIVE' | 'LOCKED' | 'RELEASED' | 'CLOSED';
  asset_type: string;
  balance: string;
  locked_at?: string;
  released_at?: string;
  created_at: string;
  updated_at: string;
}

export interface VaultCommandPayload {
  vault_id?: string;
  asset_type?: string;
  amount?: string;
  reason?: string;
  actor?: string;
}

export const VAULT_COMMANDS = {
  CREATE_VAULT_INTENT: 'CREATE_VAULT_INTENT',
  OPEN_VAULT: 'OPEN_VAULT',
  LOCK_VAULT: 'LOCK_VAULT',
  RELEASE_VAULT: 'RELEASE_VAULT',
  VERIFY_VAULT_STATE: 'VERIFY_VAULT_STATE',
} as const;

export const VAULT_EVENTS = {
  VAULT_INTENT_CREATED: 'VaultIntentCreated',
  VAULT_CREATED: 'VaultCreated',
  VAULT_ACTIVATED: 'VaultActivated',
  VAULT_LOCKED: 'VaultLocked',
  VAULT_RELEASED: 'VaultReleased',
  VAULT_STATE_VERIFIED: 'VaultStateVerified',
} as const;

export class VaultDomain {
  private readonly vaults: Map<string, VaultState> = new Map();
  private readonly eventLog: Array<{ event: string; vault_id: string; timestamp: string }> = [];

  createIntent(payload: VaultCommandPayload): { intent_id: string; event: string } {
    const intentId = `vault_intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.eventLog.push({ event: VAULT_EVENTS.VAULT_INTENT_CREATED, vault_id: intentId, timestamp: new Date().toISOString() });
    return { intent_id: intentId, event: VAULT_EVENTS.VAULT_INTENT_CREATED };
  }

  openVault(vaultId: string, assetType: string, actor: string): VaultState {
    const state: VaultState = {
      vault_id: vaultId,
      state: 'ACTIVE',
      asset_type: assetType,
      balance: '0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.vaults.set(vaultId, state);
    this.eventLog.push({ event: VAULT_EVENTS.VAULT_CREATED, vault_id: vaultId, timestamp: new Date().toISOString() });
    this.eventLog.push({ event: VAULT_EVENTS.VAULT_ACTIVATED, vault_id: vaultId, timestamp: new Date().toISOString() });
    return state;
  }

  lockVault(vaultId: string, reason: string, actor: string): VaultState | null {
    const vault = this.vaults.get(vaultId);
    if (!vault || vault.state !== 'ACTIVE') return null;

    vault.state = 'LOCKED';
    vault.locked_at = new Date().toISOString();
    vault.updated_at = new Date().toISOString();
    this.vaults.set(vaultId, vault);
    this.eventLog.push({ event: VAULT_EVENTS.VAULT_LOCKED, vault_id: vaultId, timestamp: new Date().toISOString() });
    return vault;
  }

  releaseVault(vaultId: string, actor: string): VaultState | null {
    const vault = this.vaults.get(vaultId);
    if (!vault || vault.state !== 'LOCKED') return null;

    vault.state = 'RELEASED';
    vault.released_at = new Date().toISOString();
    vault.updated_at = new Date().toISOString();
    this.vaults.set(vaultId, vault);
    this.eventLog.push({ event: VAULT_EVENTS.VAULT_RELEASED, vault_id: vaultId, timestamp: new Date().toISOString() });
    return vault;
  }

  verifyState(vaultId: string): { valid: boolean; state: VaultState | null } {
    const vault = this.vaults.get(vaultId);
    this.eventLog.push({ event: VAULT_EVENTS.VAULT_STATE_VERIFIED, vault_id: vaultId, timestamp: new Date().toISOString() });
    return { valid: vault !== undefined && vault.state !== 'CLOSED', state: vault || null };
  }

  getVault(vaultId: string): VaultState | undefined {
    return this.vaults.get(vaultId);
  }

  getAllVaults(): VaultState[] {
    return Array.from(this.vaults.values());
  }

  getEventLog() {
    return [...this.eventLog];
  }
}
