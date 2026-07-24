import { AppendInput, EventEnvelope, EventStore } from '../server/eventStore.js';

export interface IEventStore {
  append(event: AppendInput): EventEnvelope | Promise<EventEnvelope>;
  appendManyAtomic(events: AppendInput[]): EventEnvelope[] | Promise<EventEnvelope[]>;
  getAll(): EventEnvelope[] | Promise<EventEnvelope[]>;
  getByAggregate(aggregate: string, id: string): EventEnvelope[] | Promise<EventEnvelope[]>;
  getByDomain(domain: string, limit?: number): EventEnvelope[] | Promise<EventEnvelope[]>;
  getAfter(timestamp: string): EventEnvelope[] | Promise<EventEnvelope[]>;
  count(): number | Promise<number>;
}

export class JSONEventStore implements IEventStore {
  readonly adapter = 'json';
  constructor(readonly inner: EventStore) {}

  append(event: AppendInput): EventEnvelope { return this.inner.append(event); }
  appendManyAtomic(events: AppendInput[]): EventEnvelope[] { return this.inner.appendManyAtomic(events, { throwOnPersist: true }); }
  getAll(): EventEnvelope[] { return this.inner.getAll(); }
  getByAggregate(aggregate: string, id: string): EventEnvelope[] { return this.inner.getByAggregate(aggregate, id); }
  getByDomain(domain: string, limit = 100): EventEnvelope[] {
    return this.inner.getAll().filter(e => e.source_domain === domain).slice(-limit);
  }
  getAfter(timestamp: string): EventEnvelope[] {
    return this.inner.getAll().filter(e => e.timestamp > timestamp);
  }
  count(): number { return this.inner.stats().totalEvents; }
}

export { EventStore, type AppendInput, type EventEnvelope };
