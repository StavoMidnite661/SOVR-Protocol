import projectionsRegistry from '../../../../generated/registries/projections.registry.json' with { type: 'json' };
import type { EventEnvelope, EventStore } from '../server/eventStore.js';

export type ProjectionState = Record<string, unknown>;

export class ProjectionRuntime {
  private projections = new Map<string, ProjectionState>();

  constructor(private eventStore: EventStore) {}

  async handleEvent(event: EventEnvelope): Promise<void> {
    const target = event.projection_effect?.target;
    if (!target || target === 'none') return;
    const current = this.projections.get(target) ?? {};
    this.projections.set(target, this.mergeProjection(current, event));
  }

  async rebuildFromGenesis(): Promise<void> {
    this.projections.clear();
    const events = this.eventStore.getAll().sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    for (const event of events) await this.handleEvent(event);
  }

  getProjection(name: string): ProjectionState | undefined { return this.projections.get(name); }
  getAllProjections(): Record<string, ProjectionState> { return Object.fromEntries(this.projections); }

  private mergeProjection(current: ProjectionState, event: EventEnvelope): ProjectionState {
    return {
      ...current,
      [event.aggregate_id]: {
        event_name: event.event_name,
        payload: event.payload,
        updated_at: event.timestamp,
      },
    };
  }

  registryCount(): number {
    return Object.keys((projectionsRegistry as any).entries ?? {}).length;
  }
}
