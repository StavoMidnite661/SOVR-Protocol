import type { Projection } from '../server/projectionEngine.js';
import type { EventEnvelope } from '../server/eventStore.js';

/**
 * GenericEventProjection — the executable form of a compiled projection
 * definition that has no hand-written read model.
 *
 * Events declare their read-model contract directly: projection_effect
 * { target, operation, updates }. For decades of flow the runtime only
 * materialized 16 hand-written projections and silently ignored every
 * event-declared `*_view` target, so whole classes of read models
 * (vault_asset_view, transfer_order_view, …) were unservable. This
 * materializer interprets the declared contract verbatim:
 *
 *   key      := event.aggregate_id (envelope authority)
 *   record   := event payload fields (sans internal `_`-prefixed receipts)
 *               merged with resolved `updates` (LAST_WRITE_WINS)
 *   updates  := literal values, or `event.X` resolved against the envelope
 *               (X = timestamp → event.timestamp; otherwise payload first)
 *   ops      := insert / insert_or_update / update → upsert-merge;
 *               no_op / none → ignore
 *
 * No semantics are invented here: the state content of every record is
 * exactly what the compiled event contracts declare.
 */
export function createGenericEventProjection(entry: {
  name: string;
  description?: string;
  source_events?: string[];
}): Projection {
  const state = new Map<string, any>();

  const resolveValue = (spec: unknown, event: EventEnvelope): unknown => {
    if (typeof spec !== 'string' || !spec.startsWith('event.')) return spec;
    const field = spec.slice('event.'.length);
    if (field === 'timestamp') return (event as any).timestamp;
    const payload = (event as any).payload ?? {};
    if (payload[field] !== undefined) return payload[field];
    return (event as any)[field];
  };

  const apply = (event: EventEnvelope): void => {
    const effect = (event as any).projection_effect;
    if (!effect || effect.target !== entry.name) return;
    const op = String(effect.operation ?? 'update');
    if (op === 'no_op' || op === 'none') return;
    if (op !== 'insert' && op !== 'insert_or_update' && op !== 'update') return;

    const key = String((event as any).aggregate_id ?? (event as any).aggregate);
    const payload = (event as any).payload ?? {};
    const base: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k.startsWith('_')) continue; // kernel transition receipts stay internal
      base[k] = v;
    }
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(effect.updates ?? {})) {
      updates[k] = resolveValue(v, event);
    }
    const existing = (op === 'update' || op === 'insert_or_update' ? state.get(key) : undefined) ?? {};
    state.set(key, {
      aggregate: (event as any).aggregate,
      aggregate_id: key,
      ...existing, // replay/upsert: start from prior state
      ...base,     // latest event payload wins (LAST_WRITE_WINS)
      ...updates,  // declared updates win over raw payload on conflict
    });
  };

  return {
    name: entry.name,
    description: entry.description ?? `Generic projection materialized from compiled event contracts (${entry.name})`,
    sourceEvents: [...(entry.source_events ?? [])],
    state,
    buildFromGenesis(events: EventEnvelope[]) {
      state.clear();
      for (const e of events) this.handleEvent(e);
    },
    handleEvent(event: EventEnvelope) {
      apply(event);
    },
  };
}
