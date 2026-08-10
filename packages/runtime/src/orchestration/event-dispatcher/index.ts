import type { SOVREvent, EventStatus } from '../types.js';

export interface EventDispatcherConfig {
  max_retries: number;
  retry_delay_ms: number;
  dead_letter_queue: boolean;
}

export interface DispatchResult {
  event_id: string;
  status: EventStatus;
  handlers_invoked: number;
  errors: string[];
}

export class EventDispatcher {
  private readonly handlers: Map<string, Array<(event: SOVREvent) => void>> = new Map();
  private readonly eventStore: SOVREvent[] = [];
  private readonly dispatchLog: DispatchResult[] = [];

  constructor(private config: EventDispatcherConfig) {}

  registerHandler(eventType: string, handler: (event: SOVREvent) => void) {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  dispatch(event: SOVREvent): DispatchResult {
    const handlers = this.handlers.get(event.event_type) || [];
    const errors: string[] = [];
    let handlersInvoked = 0;

    for (const handler of handlers) {
      try {
        handler(event);
        handlersInvoked++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    this.eventStore.push(event);

    const result: DispatchResult = {
      event_id: event.event_id,
      status: errors.length > 0 ? 'PROCESSED' : 'DISPATCHED',
      handlers_invoked: handlersInvoked,
      errors,
    };

    this.dispatchLog.push(result);
    return result;
  }

  dispatchMany(events: SOVREvent[]): DispatchResult[] {
    return events.map((event) => this.dispatch(event));
  }

  getDispatchLog() {
    return [...this.dispatchLog];
  }

  getEventsByCommand(commandId: string): SOVREvent[] {
    return this.eventStore.filter((e) => e.command_id === commandId);
  }

  getEventsByDomain(domain: string): SOVREvent[] {
    return this.eventStore.filter((e) => e.source_domain === domain);
  }

  getAllEvents(): SOVREvent[] {
    return [...this.eventStore];
  }

  getEventCount(): number {
    return this.eventStore.length;
  }

  validateChain(): { valid: boolean; broken_links: string[] } {
    const brokenLinks: string[] = [];
    for (let i = 1; i < this.eventStore.length; i++) {
      const prev = this.eventStore[i - 1];
      const curr = this.eventStore[i];
      if (curr.previous_hash !== prev.event_hash) {
        brokenLinks.push(`${prev.event_id} -> ${curr.event_id}`);
      }
    }
    return { valid: brokenLinks.length === 0, broken_links: brokenLinks };
  }
}
