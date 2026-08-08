import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore } from '../eventStore.js';

describe('strict causation integrity', () => {
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore(undefined, { strictCausation: true });
  });

  it('PASS: valid child event referencing parent event_id', () => {
    const parent = store.append({
      event_name: 'test.parent',
      aggregate: 'test',
      aggregate_id: 'agg-1',
      source_domain: 'test',
      command_id: 'cmd-1',
      triggering_command: 'test.create',
      causation_id: 'corr-1',
      correlation_id: 'corr-1',
      actor_id: 'test-actor',
      identity_context: { identity_id: 'test-identity', actor_type: 'human', session_id: 'sess-1' },
      policy_decision_id: 'policy-1',
      capability_id: 'test.capability',
      payload: { foo: 'bar' },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-001'], retention_class: 'permanent' },
    });

    const child = store.append({
      event_name: 'test.child',
      aggregate: 'test',
      aggregate_id: 'agg-1',
      source_domain: 'test',
      command_id: 'cmd-2',
      triggering_command: 'test.update',
      causation_id: parent.event_id,
      correlation_id: 'corr-1',
      actor_id: 'test-actor',
      identity_context: { identity_id: 'test-identity', actor_type: 'human', session_id: 'sess-1' },
      policy_decision_id: 'policy-2',
      capability_id: 'test.capability',
      payload: { foo: 'baz' },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-001'], retention_class: 'permanent' },
    });

    expect(child.event_id).toBeTruthy();
    expect(child.causation_id).toBe(parent.event_id);
  });

  it('FAIL: child event with missing parent rejects CAUSATION_BROKEN', () => {
    store.append({
      event_name: 'test.seed',
      aggregate: 'test',
      aggregate_id: 'agg-seed',
      source_domain: 'test',
      command_id: 'cmd-seed',
      triggering_command: 'test.create',
      causation_id: 'corr-seed',
      correlation_id: 'corr-seed',
      actor_id: 'test-actor',
      identity_context: { identity_id: 'test-identity', actor_type: 'human', session_id: 'sess-seed' },
      policy_decision_id: 'policy-seed',
      capability_id: 'test.capability',
      payload: { foo: 'bar' },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-001'], retention_class: 'permanent' },
    });

    expect(() => store.append({
      event_name: 'test.orphan-child',
      aggregate: 'test',
      aggregate_id: 'agg-2',
      source_domain: 'test',
      command_id: 'cmd-2',
      triggering_command: 'test.update',
      causation_id: 'non-existent-parent',
      correlation_id: 'corr-2',
      actor_id: 'test-actor',
      identity_context: { identity_id: 'test-identity', actor_type: 'human', session_id: 'sess-2' },
      policy_decision_id: 'policy-2',
      capability_id: 'test.capability',
      payload: { foo: 'bar' },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-001'], retention_class: 'permanent' },
    })).toThrow('CAUSATION_BROKEN');
  });

  it('PASS: root event with causation_id === correlation_id', () => {
    const envelope = store.append({
      event_name: 'test.root',
      aggregate: 'test',
      aggregate_id: 'agg-1',
      source_domain: 'test',
      command_id: 'cmd-1',
      triggering_command: 'test.create',
      causation_id: 'corr-1',
      correlation_id: 'corr-1',
      actor_id: 'test-actor',
      identity_context: { identity_id: 'test-identity', actor_type: 'human', session_id: 'sess-1' },
      policy_decision_id: 'policy-1',
      capability_id: 'test.capability',
      payload: { foo: 'bar' },
      projection_effect: { target: 'none', operation: 'no_op' },
      audit: { constitutional_rules_referenced: ['INV-001'], retention_class: 'permanent' },
    });

    expect(envelope.event_id).toBeTruthy();
    expect(envelope.causation_id).toBe('corr-1');
    expect(envelope.causation_id).toBe(envelope.correlation_id);
  });
});
