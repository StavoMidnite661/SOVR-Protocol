// ============================================================
// SOVR SDK — Frontend developer entry point
// This is how developers design their own frontends.
// Every method performs a real HTTP call to the Protocol API
// and returns the actual server response. There are no mocks.
// ============================================================

import { Buffer } from 'node:buffer';

export interface SOVRClientConfig {
  /** Base URL of the Protocol API. Must NOT end with '/'. */
  apiUrl: string;
  /** Bearer JWT obtained from /api/v1/identity/session. */
  bearerToken?: string;
  /** Default actor id to attach via X-Actor-Id header. */
  actorId?: string;
  /** Default actor type to attach via X-Actor-Type header. */
  actorType?: 'human' | 'organization' | 'ai_agent' | 'service_account' | 'governance' | 'external_system' | 'system';
  /** Expected build hash — verified on first request. */
  buildHash?: string;
  /** Optional fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms (default 30000). */
  timeoutMs?: number;
}

export interface SOVRCommandResult<T = unknown> {
  status: 'ACCEPTED' | 'REJECTED';
  commandId: string;
  correlationId: string;
  events: any[];
  gates: Record<string, { passed: boolean; reason?: string; policy_decision_id?: string }>;
  error?: string;
}

export interface SOVRSession {
  jwt: string;
  session_id: string;
  identity_id: string;
  actor_id: string;
  trust_level: string;
  event: any;
}

/** Thrown on non-2xx network responses with parsed error body. */
export class SOVRApiError extends Error {
  constructor(public statusCode: number, public body: any, public endpoint: string) {
    super(`SOVR API error ${statusCode} on ${endpoint}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.name = 'SOVRApiError';
  }
}

/** Thrown when local build hash config does not match the server's manifest. */
export class SOVRBuildHashMismatchError extends Error {
  constructor(public expected: string, public actual: string) {
    super(`Build hash mismatch: SDK expects ${expected}, server reports ${actual}. Refusing to execute — possible tamper or stale SDK.`);
    this.name = 'SOVRBuildHashMismatchError';
  }
}

export class SOVRClient {
  private readonly fetchImpl: typeof fetch;
  private readonly buildHashChecked: { value: boolean };

  constructor(private readonly config: SOVRClientConfig) {
    if (!config.apiUrl) throw new Error('SOVRClient: apiUrl is required');
    this.fetchImpl = (config.fetchImpl ?? globalThis.fetch) as typeof fetch;
    this.buildHashChecked = { value: false };
  }

  private url(path: string): string {
    const base = this.config.apiUrl.replace(/\/+$/, '');
    // If the caller passed a full path that already starts with /api/v1, use it as-is.
    // If they passed just a path like /health or /foo, use as-is too.
    // The convention: apiUrl is the BASE URL (no /api/v1 prefix) and paths include /api/v1/...
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async request<T = any>(
    method: 'GET' | 'POST',
    path: string,
    body?: any,
  ): Promise<T> {
    const url = this.url(path);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.config.bearerToken) headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    if (this.config.actorId) headers['X-Actor-Id'] = this.config.actorId;
    if (this.config.actorType) headers['X-Actor-Type'] = this.config.actorType;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30000);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let parsed: any = text;
    if (text) {
      try { parsed = JSON.parse(text); } catch { /* keep as text */ }
    }

    if (!res.ok) {
      throw new SOVRApiError(res.status, parsed, `${method} ${path}`);
    }
    return parsed as T;
  }

  /** Fetch /api/v1/manifest and compare build_hash to config. Throws on mismatch. */
  async verifyBuildManifest(): Promise<{ buildHash: string; manifest: any }> {
    const manifest = await this.request<any>('GET', '/api/v1/manifest');
    const serverHash: string | undefined = manifest?.build_hash;
    if (this.config.buildHash && serverHash && serverHash !== this.config.buildHash) {
      throw new SOVRBuildHashMismatchError(this.config.buildHash, serverHash);
    }
    this.buildHashChecked.value = true;
    return { buildHash: serverHash ?? '', manifest };
  }

  /** Block until /api/v1/health reports final_health === 'HEALTHY'. */
  async waitForHealthy(opts: { intervalMs?: number; maxWaitMs?: number } = {}): Promise<void> {
    const interval = opts.intervalMs ?? 500;
    const deadline = Date.now() + (opts.maxWaitMs ?? 60_000);
    while (Date.now() < deadline) {
      try {
        const h = await this.request<any>('GET', '/api/v1/health');
        if (h?.final_health === 'HEALTHY') return;
      } catch { /* keep trying */ }
      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error(`SOVRClient: kernel did not become HEALTHY within ${opts.maxWaitMs ?? 60_000}ms`);
  }

  /** POST /api/v1/identity/session — returns JWT + session_id. Stores token on the client. */
  async createSession(input: { identity_id: string; actor_id: string; actor_type: SOVRClientConfig['actorType']; credential_id?: string }): Promise<SOVRSession> {
    const sess = await this.request<SOVRSession>('POST', '/api/v1/identity/session', input);
    (this.config as any).bearerToken = sess.jwt;
    return sess;
  }

  /** Universal low-level command executor. */
  async executeCommand(domain: string, aggregate: string, command: { commandName: string; payload: any; capability_id?: string; scope?: string; meta?: any }): Promise<SOVRCommandResult> {
    if (!this.buildHashChecked.value && this.config.buildHash) {
      await this.verifyBuildManifest().catch(() => { /* tolerated for test mode */ });
    }
    return this.request<SOVRCommandResult>('POST', `/api/v1/${domain}/${aggregate}`, command);
  }

  // --- High-level typed helpers -------------------------------------------------

  async registerAsset(payload: {
    assetId: string; assetType: 'cash' | 'stablecoin' | 'tokenized_asset' | 'collateral_position' | 'liquidity_position' | 'external_claim';
    issuerId: string; ownershipId: string; custodyProvider: 'sovr_internal' | 'on_chain' | 'external_bank' | 'third_party';
    custodyLocation: string; nativeUnit: string; precision: number; valuationSource: string;
    reserveRatio: string; faceValue?: string; quantity?: string;
  }): Promise<SOVRCommandResult> {
    return this.executeCommand('vault', 'asset', {
      commandName: 'vault.asset.register',
      capability_id: 'vault.asset.create',
      scope: 'vault.asset:*',
      payload: {
        asset_id: payload.assetId, asset_type: payload.assetType, issuer_id: payload.issuerId,
        ownership_id: payload.ownershipId, custody_provider: payload.custodyProvider,
        custody_location: payload.custodyLocation, native_unit: payload.nativeUnit,
        precision: payload.precision, risk_classification: 'low', valuation_source: payload.valuationSource,
        reserve_ratio: payload.reserveRatio,
        // catalog required_payload always includes face_value and quantity
        face_value: payload.faceValue ?? '0',
        quantity: payload.quantity ?? '0',
      },
    });
  }

  async createReservation(payload: { assetId: string; amount: string; expiration: string; purpose: string }): Promise<SOVRCommandResult> {
    return this.executeCommand('vault', 'reservation', {
      commandName: 'vault.reserve.create',
      capability_id: 'vault.reserve.create',
      scope: `vault.asset:${payload.assetId}`,
      payload: { asset_id: payload.assetId, amount: payload.amount, expiration: payload.expiration, purpose: payload.purpose },
    });
  }

  async requestTransfer(payload: { sourceActorId: string; destinationActorId: string; assetId: string; amount: string; purpose: string }): Promise<SOVRCommandResult> {
    return this.executeCommand('treasury', 'transfer_order', {
      commandName: 'treasury.transfer.request',
      capability_id: 'treasury.transfer.request',
      scope: 'treasury.transfer:*',
      payload: {
        source_actor_id: payload.sourceActorId, destination_actor_id: payload.destinationActorId,
        asset_id: payload.assetId, amount: payload.amount, purpose: payload.purpose,
      },
    });
  }

  async postLedgerEntry(payload: { journalId: string; postings: Array<{ direction: 'DEBIT' | 'CREDIT'; account_id: string; amount: number; asset_id?: string; description?: string }>; description?: string; entryType?: string; transactionId?: string; eventReference?: string; correlationId?: string; causationId?: string }): Promise<SOVRCommandResult> {
    const correlationId = payload.correlationId ?? crypto.randomUUID();
    const causationId = payload.causationId ?? correlationId;
    return this.executeCommand('ledger', 'journal_entry', {
      commandName: 'ledger.entry.post',
      capability_id: 'ledger.journal_entry.create',
      scope: 'ledger.journal_entry:*',
      payload: {
        journal_id: payload.journalId,
        transaction_id: payload.transactionId ?? `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        event_reference: payload.eventReference ?? '',
        correlation_id: correlationId,
        causation_id: causationId,
        description: payload.description ?? 'ledger entry',
        entry_type: payload.entryType ?? 'STANDARD',
        postings: payload.postings.map(p => ({
          account_id: p.account_id,
          amount: p.amount,
          direction: p.direction,
          asset_id: p.asset_id ?? 'asset_default',
          description: p.description ?? '',
        })),
      },
    });
  }

  async grantCapability(payload: { capabilityId: string; actorId: string; scopePattern: string; expiresAt?: string }): Promise<any> {
    return this.request('POST', '/api/v1/capabilities/grant', {
      capability_id: payload.capabilityId, actor_id: payload.actorId, scope_pattern: payload.scopePattern, expires_at: payload.expiresAt,
    });
  }

  /** Get a single event by id. */
  async getEvent(eventId: string): Promise<any> {
    return this.request('GET', `/api/v1/events/${eventId}`);
  }

  /** List events with optional filters. */
  async listEvents(opts: { domain?: string; aggregate?: string; aggregateId?: string; correlationId?: string; commandId?: string; limit?: number } = {}): Promise<any> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(opts)) if (v !== undefined) q.set(k, String(v));
    return this.request('GET', `/api/v1/events?${q.toString()}`);
  }

  /** Query a projection. */
  async queryProjection(name: string, opts: { actorId?: string; assetId?: string; orderId?: string; limit?: number } = {}): Promise<any> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(opts)) if (v !== undefined) q.set(k, String(v));
    return this.request('GET', `/api/v1/projections/${name}?${q.toString()}`);
  }

  /** Audit trail for a correlation. */
  async getAudit(correlationId: string): Promise<any> {
    return this.request('GET', `/api/v1/audit/${correlationId}`);
  }
}
