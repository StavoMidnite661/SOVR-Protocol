import { EventEnvelope, EventStore } from '../server/eventStore.js';

type PgPool = any;
type PgClient = { query: (sql: string, params?: any[]) => Promise<any>; release?: () => void };

export interface StateTransition {
  aggregate: string;
  aggregateId: string;
  domain?: string;
  fromState: string;
  toState: string;
  trigger: string;
  machineId?: string;
  machineName?: string;
  transitionName?: string;
  commandId?: string;
  correlationId?: string;
  eventName?: string;
}

interface StateRecord {
  domain?: string;
  aggregate: string;
  aggregateId: string;
  state: string;
}

export interface RebuildResult {
  rebuilt: boolean;
  aggregatesRestored: number;
  eventsProcessed: number;
  transitionsApplied: number;
  timestamp: string;
}

export type InitialStateResolver = (domain: string | undefined, aggregate: string) => string | undefined;

export interface StateRegistryOptions {
  usePostgres?: boolean;
  databaseUrl?: string;
}

export class StateRegistry {
  private states = new Map<string, StateRecord>();
  private history = new Map<string, StateTransition[]>();
  private rebuilt = false;
  private rebuildTimestamp: string | null = null;
  private lastRebuildResult: RebuildResult | null = null;

  private usePostgres = false;
  private poolPromise?: Promise<PgPool>;
  private cache = new Map<string, string>();

  constructor(
    private readonly initialStateResolver?: InitialStateResolver,
    options?: StateRegistryOptions,
  ) {
    if (options?.usePostgres && options.databaseUrl) {
      this.usePostgres = true;
      this.poolPromise = this.createPool(options.databaseUrl);
    }
  }

  async hasState(aggregate: string, id: string, domain?: string): Promise<boolean> {
    if (this.usePostgres) {
      const cached = this.cache.get(this.key(aggregate, id, domain));
      if (cached) return true;
      const pool = await this.poolPromise!;
      const res = await pool.query(
        'SELECT 1 FROM sovr_aggregate_states WHERE aggregate=$1 AND aggregate_id=$2 LIMIT 1',
        [aggregate, id],
      );
      return res.rows.length > 0;
    }
    return this.states.has(this.key(aggregate, id, domain));
  }

  async getState(aggregate: string, id: string, domain?: string): Promise<string> {
    const key = this.key(aggregate, id, domain);
    if (this.usePostgres) {
      const cached = this.cache.get(key);
      if (cached) return cached;
      const pool = await this.poolPromise!;
      const res = await pool.query(
        'SELECT current_state FROM sovr_aggregate_states WHERE aggregate=$1 AND aggregate_id=$2',
        [aggregate, id],
      );
      const state = res.rows[0]?.current_state;
      if (state) {
        this.cache.set(key, state);
        return state;
      }
      const initial = this.initialStateResolver?.(domain, aggregate);
      if (!initial) return 'INIT';
      return initial;
    }
    const existing = this.states.get(key)?.state;
    if (existing) return existing;
    const initial = this.initialStateResolver?.(domain, aggregate);
    if (!initial) return 'INIT';
    return initial;
  }

  async setState(aggregate: string, id: string, state: string, domain?: string, transition?: StateTransition): Promise<void> {
    const key = this.key(aggregate, id, domain);
    if (this.usePostgres) {
      const pool = await this.poolPromise!;
      await pool.query(
        'INSERT INTO sovr_aggregate_states (aggregate, aggregate_id, current_state, updated_at) ' +
        'VALUES ($1, $2, $3, NOW()) ' +
        'ON CONFLICT (aggregate, aggregate_id) DO UPDATE SET current_state=$3, updated_at=NOW()',
        [aggregate, id, state],
      );
      this.cache.set(key, state);
    } else {
      this.states.set(key, { domain, aggregate, aggregateId: id, state });
    }
    if (transition) {
      if (!this.history.has(key)) this.history.set(key, []);
      this.history.get(key)!.push({ ...transition, domain, aggregate, aggregateId: id, toState: state });
    }
  }

  async recordTransition(transition: StateTransition): Promise<void> {
    await this.setState(
      transition.aggregate,
      transition.aggregateId,
      transition.toState,
      transition.domain,
      transition,
    );
  }

  async rollback(aggregate: string, id: string, previousState: string | undefined, domain?: string): Promise<void> {
    await this.rollbackState(aggregate, id, previousState, domain);
  }

  async rollbackState(aggregate: string, id: string, previousState: string | undefined, domain?: string): Promise<void> {
    const key = this.key(aggregate, id, domain);
    if (previousState === undefined) {
      if (this.usePostgres) {
        const pool = await this.poolPromise!;
        await pool.query('DELETE FROM sovr_aggregate_states WHERE aggregate=$1 AND aggregate_id=$2', [aggregate, id]);
        this.cache.delete(key);
      } else {
        this.states.delete(key);
      }
      const h = this.history.get(key) ?? [];
      h.pop();
      if (h.length === 0) this.history.delete(key);
      else this.history.set(key, h);
      return;
    }
    if (this.usePostgres) {
      const pool = await this.poolPromise!;
      await pool.query(
        'UPDATE sovr_aggregate_states SET current_state=$1, updated_at=NOW() WHERE aggregate=$2 AND aggregate_id=$3',
        [previousState, aggregate, id],
      );
      this.cache.set(key, previousState);
    } else {
      this.states.set(key, { domain, aggregate, aggregateId: id, state: previousState });
    }
    const h = this.history.get(key) ?? [];
    h.pop();
    if (h.length === 0) this.history.delete(key);
    else this.history.set(key, h);
  }

  async getHistory(aggregate: string, id: string, domain?: string): Promise<StateTransition[]> {
    return [...(this.history.get(this.key(aggregate, id, domain)) ?? [])];
  }

  snapshot(): Array<StateRecord & { history: StateTransition[] }> {
    return [...this.states.values()]
      .sort((a, b) => this.key(a.aggregate, a.aggregateId, a.domain).localeCompare(this.key(b.aggregate, b.aggregateId, b.domain)))
      .map(record => ({
        ...record,
        history: [...(this.history.get(this.key(record.aggregate, record.aggregateId, record.domain)) ?? [])],
      }));
  }

  isReady(): boolean {
    return this.rebuilt;
  }

  getRebuildStatus(): RebuildResult & { ready: boolean } {
    return this.lastRebuildResult
      ? { ...this.lastRebuildResult, ready: this.rebuilt }
      : { rebuilt: false, ready: false, aggregatesRestored: 0, eventsProcessed: 0, transitionsApplied: 0, timestamp: this.rebuildTimestamp ?? '' };
  }

  clear(): void {
    this.states.clear();
    this.history.clear();
    this.cache.clear();
  }

  async rebuildFromEventLog(eventStore: EventStore | { getAll: () => EventEnvelope[] | Promise<EventEnvelope[]> }): Promise<RebuildResult> {
    const events = await Promise.resolve(eventStore.getAll());
    return this.rebuildFromEvents(events);
  }

  rebuildFromEvents(events: EventEnvelope[]): RebuildResult {
    this.clear();
    const sorted = [...events].sort((a, b) => {
      const byTimestamp = String(a.timestamp ?? '').localeCompare(String(b.timestamp ?? ''));
      if (byTimestamp !== 0) return byTimestamp;
      return String(a.event_id ?? '').localeCompare(String(b.event_id ?? ''));
    });

    let transitionsApplied = 0;
    for (const event of sorted) {
      for (const transition of this.resolveTransitionsFromEvent(event)) {
        const key = this.key(transition.aggregate, transition.aggregateId, transition.domain);
        if (!this.usePostgres) {
          this.states.set(key, {
            domain: transition.domain,
            aggregate: transition.aggregate,
            aggregateId: transition.aggregateId,
            state: transition.toState,
          });
        } else {
          this.cache.set(key, transition.toState);
        }
        if (!this.history.has(key)) this.history.set(key, []);
        this.history.get(key)!.push(transition);
        transitionsApplied++;
      }
    }

    this.rebuilt = true;
    this.rebuildTimestamp = new Date().toISOString();
    this.lastRebuildResult = {
      rebuilt: true,
      aggregatesRestored: this.states.size + this.cache.size,
      eventsProcessed: sorted.length,
      transitionsApplied,
      timestamp: this.rebuildTimestamp,
    };
    return this.lastRebuildResult;
  }

  private resolveTransitionsFromEvent(event: EventEnvelope): StateTransition[] {
    const rawTransitions = event.payload?._state_transitions
      ?? event.payload?.state_transitions
      ?? event.payload?._state_transition
      ?? event.payload?.state_transition;
    const transitionList = Array.isArray(rawTransitions) ? rawTransitions : rawTransitions ? [rawTransitions] : [];
    const result: StateTransition[] = [];

    for (const transition of transitionList as any[]) {
      if (!transition?.to_state && !transition?.toState) continue;
      const aggregate = String(transition.aggregate ?? event.aggregate);
      const aggregateId = String(transition.aggregate_id ?? transition.aggregateId ?? event.aggregate_id);
      const domain = String(transition.domain ?? event.source_domain);
      result.push({
        domain,
        aggregate,
        aggregateId,
        fromState: String(transition.from_state ?? transition.fromState ?? 'UNKNOWN'),
        toState: String(transition.to_state ?? transition.toState),
        trigger: String(transition.trigger ?? event.event_name),
        machineId: transition.machine_id ?? transition.machineId,
        machineName: transition.machine_name ?? transition.machineName,
        transitionName: transition.transition_name ?? transition.transitionName,
        commandId: event.command_id,
        correlationId: event.correlation_id,
        eventName: event.event_name,
      });
    }

    return result;
  }

  private key(aggregate: string, id: string, domain?: string): string {
    return `${domain ?? '*'}:${aggregate}:${id}`;
  }

  private async createPool(databaseUrl: string): Promise<PgPool> {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    let pg: any;
    try {
      pg = await dynamicImport('pg');
    } catch (error) {
      throw new Error('StateRegistry PostgreSQL backing requires optional dependency "pg". Install it before enabling usePostgres.');
    }
    return new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false,
    });
  }
}
