import { AppendInput, EventEnvelope } from '../server/eventStore.js';
import { StateRegistry, StateTransition } from './state-registry.js';
import type { IEventStore } from './event-store.js';

export interface AtomicStateUpdate {
  aggregate: string;
  id: string;
  state: string;
  domain?: string;
  transition?: StateTransition;
}

export interface AtomicCommitParams {
  stateUpdates: AtomicStateUpdate[];
  events: AppendInput[];
  stateRegistry: StateRegistry;
  eventStore: IEventStore;
}

export interface CommitResult {
  committed: true;
  events: EventEnvelope[];
  stateUpdates: AtomicStateUpdate[];
}

export class AtomicCommitFailureError extends Error {
  constructor(cause: unknown) {
    super(`AtomicCommitFailureError: state/event commit failed; state rolled back and no partial event batch was committed`);
    this.name = 'AtomicCommitFailureError';
    (this as any).cause = cause;
  }
}

interface PreparedStateUpdate extends AtomicStateUpdate {
  previousState: string | undefined;
}

export class AtomicCommit {
  async execute(params: AtomicCommitParams): Promise<CommitResult> {
    const prepared = await this.prepare(params);

    try {
      // Phase 2: commit state first. This is in-memory and rollback-safe.
      for (const update of params.stateUpdates) {
        await params.stateRegistry.setState(
          update.aggregate,
          update.id,
          update.state,
          update.domain,
          update.transition,
        );
      }

      // Phase 3: atomically commit the full event batch. EventStore rolls back
      // its in-process log and indexes if persistence fails.
      const events = await Promise.resolve(params.eventStore.appendManyAtomic(params.events));

      return { committed: true, events, stateUpdates: params.stateUpdates };
    } catch (error) {
      // Phase 4: rollback state if any event append/persist operation fails.
      for (const update of prepared.slice().reverse()) {
        await params.stateRegistry.rollback(update.aggregate, update.id, update.previousState, update.domain);
      }
      throw new AtomicCommitFailureError(error);
    }
  }

  private async prepare(params: AtomicCommitParams): Promise<PreparedStateUpdate[]> {
    const prepared: PreparedStateUpdate[] = [];
    const seen = new Set<string>();

    for (const update of params.stateUpdates) {
      const key = `${update.domain ?? '*'}:${update.aggregate}:${update.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const previousState = params.stateRegistry.hasState(update.aggregate, update.id, update.domain)
        ? await params.stateRegistry.getState(update.aggregate, update.id, update.domain)
        : undefined;
      prepared.push({ ...update, previousState });
    }

    return prepared;
  }
}
