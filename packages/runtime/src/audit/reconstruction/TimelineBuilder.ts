import type { AuditProof } from './AuditReconstructor.js';

export class TimelineBuilder {
  build(events: any[]): AuditProof['state_transitions'] {
    return events
      .filter(e => e.payload?._state_transitions)
      .flatMap(e => {
        const transitions = Array.isArray(e.payload._state_transitions)
          ? e.payload._state_transitions
          : [e.payload._state_transitions];
        return transitions
          .filter((t: any) => t && (t.to_state || t.toState))
          .map((t: any) => ({
            event_id: e.event_id,
            command_id: e.command_id,
            from_state: t.from_state ?? t.fromState,
            to_state: t.to_state ?? t.toState,
            trigger: t.trigger ?? e.event_name,
            machine_id: t.machine_id ?? t.machineId,
          }));
      });
  }
}
