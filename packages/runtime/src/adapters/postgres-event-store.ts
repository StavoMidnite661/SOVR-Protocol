import { randomUUID } from 'node:crypto';
import { AppendInput, EventEnvelope, IEventStore } from '../execution/event-store.js';

type PgPool = any;

type PgClient = { query: (sql: string, params?: any[]) => Promise<any>; release?: () => void };

export class PostgreSQLEventStore implements IEventStore {
  readonly adapter = 'postgres';
  private poolPromise: Promise<PgPool>;
  private publisher?: (envelope: EventEnvelope) => Promise<void>;
  private cachedCount = 0;

  constructor(readonly databaseUrl: string) {
    this.poolPromise = this.createPool(databaseUrl);
  }

  setPublisher(publisher: (envelope: EventEnvelope) => Promise<void>): void {
    this.publisher = publisher;
  }

  async migrate(): Promise<void> {
    const pool = await this.poolPromise;
    await pool.query(MIGRATION_SQL);
    this.cachedCount = await this.count();
  }

  async append(input: AppendInput): Promise<EventEnvelope> {
    const [event] = await this.appendManyAtomic([input]);
    return event;
  }

  async appendManyAtomic(inputs: AppendInput[]): Promise<EventEnvelope[]> {
    if (inputs.length === 0) return [];
    const events = inputs.map(buildEnvelope);
    const pool = await this.poolPromise;
    const client: PgClient = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const event of events) {
        await client.query(INSERT_SQL, eventToParams(event));
      }
      await client.query('COMMIT');
      this.cachedCount += events.length;
      for (const event of events) {
        if (this.publisher) Promise.resolve(this.publisher(event)).catch((e) => console.warn(`Event publisher failed for ${event.event_name}:`, (e as Error).message));
      }
      return events;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
      throw error;
    } finally {
      client.release?.();
    }
  }

  async getAll(): Promise<EventEnvelope[]> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events ORDER BY timestamp ASC, event_id ASC');
    return res.rows.map(rowToEvent);
  }

  async getByAggregate(aggregate: string, id: string): Promise<EventEnvelope[]> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events WHERE aggregate=$1 AND aggregate_id=$2 ORDER BY timestamp ASC, event_id ASC', [aggregate, id]);
    return res.rows.map(rowToEvent);
  }

  async getByDomain(domain: string, limit = 100): Promise<EventEnvelope[]> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events WHERE source_domain=$1 ORDER BY timestamp DESC, event_id DESC LIMIT $2', [domain, limit]);
    return res.rows.map(rowToEvent);
  }

  async getAfter(timestamp: string): Promise<EventEnvelope[]> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events WHERE timestamp > $1 ORDER BY timestamp ASC, event_id ASC', [timestamp]);
    return res.rows.map(rowToEvent);
  }

  async getById(event_id: string): Promise<EventEnvelope | undefined> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events WHERE event_id=$1 LIMIT 1', [event_id]);
    return res.rows[0] ? rowToEvent(res.rows[0]) : undefined;
  }

  async getByCorrelation(correlation_id: string): Promise<EventEnvelope[]> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events WHERE correlation_id=$1 ORDER BY timestamp ASC, event_id ASC', [correlation_id]);
    return res.rows.map(rowToEvent);
  }

  async getByCommand(command_id: string): Promise<EventEnvelope[]> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events WHERE command_id=$1 ORDER BY timestamp ASC, event_id ASC', [command_id]);
    return res.rows.map(rowToEvent);
  }

  async getByActor(actor_id: string): Promise<EventEnvelope[]> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT * FROM sovr_events WHERE actor_id=$1 ORDER BY timestamp ASC, event_id ASC', [actor_id]);
    return res.rows.map(rowToEvent);
  }

  async replay(_fromSequence?: number, filter?: (e: EventEnvelope) => boolean): Promise<EventEnvelope[]> {
    const events = await this.getAll();
    return filter ? events.filter(filter) : events;
  }

  async auditTrailForCommand(command_id: string): Promise<{ events: EventEnvelope[]; isComplete: boolean }> {
    const events = await this.getByCommand(command_id);
    return { events, isComplete: events.length > 0 && events.every(e => e.audit && e.identity_context && e.policy_decision_id) };
  }

  stats() {
    return {
      adapter: 'PostgreSQL',
      totalEvents: this.cachedCount,
      sequences: this.cachedCount,
      aggregates: 0,
      correlations: 0,
      latestTimestamp: undefined,
    };
  }

  async count(): Promise<number> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT COUNT(*)::int AS count FROM sovr_events');
    this.cachedCount = Number(res.rows[0]?.count ?? 0);
    return this.cachedCount;
  }

  private async createPool(databaseUrl: string): Promise<PgPool> {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    let pg: any;
    try {
      pg = await dynamicImport('pg');
    } catch (error) {
      throw new Error('PostgreSQLEventStore requires optional dependency "pg". Install it in production runtime before setting DATABASE_URL.');
    }
    return new pg.Pool({ connectionString: databaseUrl });
  }
}

const INSERT_SQL = `
INSERT INTO sovr_events (
  event_id, event_name, event_version, schema_version, aggregate, aggregate_id,
  source_domain, command_id, triggering_command, causation_id, correlation_id,
  actor_id, identity_context, policy_decision_id, capability_id, timestamp,
  payload, projection_effect, audit
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb)
ON CONFLICT (event_id) DO NOTHING
`;

export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS sovr_events (
  event_id UUID PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  event_version VARCHAR(50) NOT NULL,
  schema_version VARCHAR(50) NOT NULL,
  aggregate VARCHAR(255) NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  source_domain VARCHAR(100) NOT NULL,
  command_id UUID NOT NULL,
  triggering_command VARCHAR(255) NOT NULL,
  causation_id UUID,
  correlation_id UUID,
  actor_id VARCHAR(255) NOT NULL,
  identity_context JSONB NOT NULL,
  policy_decision_id UUID,
  capability_id VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  projection_effect JSONB NOT NULL,
  audit JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sovr_events_aggregate ON sovr_events(aggregate, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_sovr_events_domain ON sovr_events(source_domain);
CREATE INDEX IF NOT EXISTS idx_sovr_events_timestamp ON sovr_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_sovr_events_correlation ON sovr_events(correlation_id);
CREATE OR REPLACE RULE no_update_sovr_events AS ON UPDATE TO sovr_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_sovr_events AS ON DELETE TO sovr_events DO INSTEAD NOTHING;
`;

function buildEnvelope(input: AppendInput): EventEnvelope {
  return {
    event_id: randomUUID(),
    event_name: input.event_name,
    event_version: input.event_version ?? '1.0.0',
    schema_version: '1.0.0',
    aggregate: input.aggregate,
    aggregate_id: input.aggregate_id,
    source_domain: input.source_domain,
    command_id: input.command_id,
    triggering_command: input.triggering_command,
    causation_id: input.causation_id,
    correlation_id: input.correlation_id,
    actor_id: input.actor_id,
    identity_context: input.identity_context,
    policy_decision_id: input.policy_decision_id,
    capability_id: input.capability_id,
    timestamp: new Date().toISOString(),
    payload: input.payload,
    projection_effect: input.projection_effect ?? { target: 'none', operation: 'no_op' },
    audit: input.audit ?? { constitutional_rules_referenced: ['INV-001', 'INV-005'], retention_class: 'permanent' },
    actor_chain: input.identity_context?.delegation_chain ?? [],
    retention_metadata: { legal_hold: input.audit?.retention_class === 'permanent' || false },
  };
}

function eventToParams(event: EventEnvelope): any[] {
  return [
    event.event_id,
    event.event_name,
    event.event_version,
    event.schema_version,
    event.aggregate,
    event.aggregate_id,
    event.source_domain,
    event.command_id,
    event.triggering_command,
    event.causation_id,
    event.correlation_id,
    event.actor_id,
    JSON.stringify(event.identity_context),
    event.policy_decision_id,
    event.capability_id,
    event.timestamp,
    JSON.stringify(event.payload),
    JSON.stringify(event.projection_effect),
    JSON.stringify(event.audit),
  ];
}

function rowToEvent(row: any): EventEnvelope {
  return {
    event_id: row.event_id,
    event_name: row.event_name,
    event_version: row.event_version,
    schema_version: row.schema_version,
    aggregate: row.aggregate,
    aggregate_id: row.aggregate_id,
    source_domain: row.source_domain,
    command_id: row.command_id,
    triggering_command: row.triggering_command,
    causation_id: row.causation_id,
    correlation_id: row.correlation_id,
    actor_id: row.actor_id,
    identity_context: row.identity_context,
    policy_decision_id: row.policy_decision_id,
    capability_id: row.capability_id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : String(row.timestamp),
    payload: row.payload,
    projection_effect: row.projection_effect,
    audit: row.audit,
    actor_chain: row.identity_context?.delegation_chain ?? [],
    retention_metadata: { legal_hold: row.audit?.retention_class === 'permanent' || false },
  };
}
