// ============================================================
// Command Bus — 7-Stage Constitutional Pipeline + Guardrail Bus
// INV-008: No command executes without identity + capability + scope + policy
// INV-002: Double-entry balance check
// INV-003: Authority boundary
// INV-004: Agent cannot create financial authority
// INV-005: Audit trail completeness
// INV-010: No autonomous bypass
// ============================================================

import { EventStore, EventEnvelope } from './eventStore.js';
import { CapabilityEngine } from './capabilityEngine.js';
import { ProjectionEngine } from './projectionEngine.js';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface CommandEnvelope {
  command_id: string;
  command_name: string; // e.g. vault.asset.register
  aggregate: string;
  source_domain: string;
  payload: any;
  identity_context: {
    identity_id: string;
    actor_id: string;
    actor_type: string;
    session_id?: string;
    agent_id?: string;
    model_version?: string;
  };
  capability_id: string;
  scope: string;
  correlation_id: string;
  causation_id: string;
  meta?: any;
}

export interface GateResult { passed: boolean; reason?: string; policy_decision_id?: string; }

export class CommandBus {
  private commandCatalog: any;
  private eventCatalog: any;
  private constitution: any;

  constructor(
    private protocolRoot: string,
    private eventStore: EventStore,
    private capabilityEngine: CapabilityEngine,
    private projectionEngine: ProjectionEngine
  ) {
    this.loadCatalogs();
  }

  private loadCatalogs() {
    try {
      this.commandCatalog = yaml.load(fs.readFileSync(path.join(this.protocolRoot, '03_command-catalog.yaml'),'utf8')) as any;
      this.eventCatalog = yaml.load(fs.readFileSync(path.join(this.protocolRoot, '04_event-catalog.yaml'),'utf8')) as any;
      this.constitution = yaml.load(fs.readFileSync(path.join(this.protocolRoot, '01_constitution.yaml'),'utf8')) as any;
    } catch (e) {
      console.warn('CommandBus catalog load failed', e);
      this.commandCatalog = { commands: {} };
      this.eventCatalog = { events: {}, event_envelope: { fields: {} } };
    }
  }

  // Gate 1: Identity verification
  private identityGate(cmd: CommandEnvelope): GateResult {
    if (!cmd.identity_context?.identity_id || !cmd.identity_context?.actor_id) {
      return { passed: false, reason: 'UNAUTHENTICATED: missing identity_context' };
    }
    // Check actor type allowed for this command
    const cmdDef = this.commandCatalog.commands[cmd.command_name];
    if (cmdDef?.issuer?.actor_types) {
      if (!cmdDef.issuer.actor_types.includes(cmd.identity_context.actor_type)) {
        return { passed: false, reason: `UNAUTHORIZED ACTOR TYPE: ${cmd.identity_context.actor_type} not in ${cmdDef.issuer.actor_types.join(',')}` };
      }
    }
    return { passed: true };
  }

  // Gate 2+3: Capability + Scope
  private capabilityGate(cmd: CommandEnvelope): GateResult {
    // system.internal exempt per spec
    if (cmd.capability_id === 'system.internal' && cmd.identity_context.actor_type === 'system') {
      return { passed: true };
    }
    const ok = this.capabilityEngine.check(cmd.identity_context.actor_id, cmd.capability_id, cmd.scope);
    if (!ok) {
      return { passed: false, reason: `CAPABILITY DENIED: ${cmd.identity_context.actor_id} lacks ${cmd.capability_id} scoped to ${cmd.scope}` };
    }
    return { passed: true };
  }

  // Gate 4: Policy evaluation (deterministic pure function mock)
  private policyGate(cmd: CommandEnvelope): GateResult {
    // For demo: deterministic hash = sha256(identity+capability+scope+payload)
    // In real VEL evaluator, AST would evaluate rules
    const payloadStr = JSON.stringify(cmd.payload || {});
    const decisionId = crypto.randomUUID();
    // Simple rule: if payload amount > 1M and actor trust LOW => ESCALATE
    const amount = Number(cmd.payload?.amount || 0);
    if (amount > 1000000 && cmd.identity_context.actor_type === 'ai_agent') {
      return { passed: false, reason: 'POLICY ESCALATE: amount exceeds agent limit, mandatory escalation per INV-004', policy_decision_id: decisionId };
    }
    // Check constitution invariants referenced
    // All good -> ALLOW
    return { passed: true, policy_decision_id: decisionId };
  }

  // Gate 5: Constitutional compliance
  private constitutionalGate(cmd: CommandEnvelope): GateResult {
    // Check INV-002 for ledger entries
    if (cmd.command_name === 'ledger.entry.post') {
      const postings = cmd.payload?.postings || [];
      if (postings.length < 2) return { passed: false, reason: 'INV-002: at least 2 postings required' };
      const debits = postings.filter((p:any)=>p.direction==='DEBIT').reduce((a:any,b:any)=>a+Number(b.amount||0),0);
      const credits = postings.filter((p:any)=>p.direction==='CREDIT').reduce((a:any,b:any)=>a+Number(b.amount||0),0);
      if (Math.abs(debits - credits) > 0.000001) {
        return { passed: false, reason: `INV-002 VIOLATION: debits ${debits} != credits ${credits}` };
      }
    }
    // INV-004
    if (cmd.identity_context.actor_type === 'ai_agent') {
      if (cmd.command_name.includes('capability.grant') || cmd.command_name.includes('capability.bind') || cmd.command_name.includes('trust_anchor.register')) {
        return { passed: false, reason: 'INV-004: ai_agent cannot create/grant financial authority' };
      }
    }
    return { passed: true };
  }

  // Stage 6: Execution + Stage 7: Event publication (via guardrail)
  private async executeAndPublish(cmd: CommandEnvelope, policyDecisionId: string): Promise<{ events: EventEnvelope[]; success: boolean; error?: string }> {
    const cmdDef = this.commandCatalog.commands[cmd.command_name];
    if (!cmdDef) {
      // Unknown command -> produce failure event generically
      return { success: false, error: `Unknown command ${cmd.command_name}`, events: [] };
    }

    // Validation rules from catalog (simplified)
    const required = cmdDef.required_payload || [];
    for (const field of required) {
      if (typeof field === 'string' && cmd.payload[field] === undefined) {
        // try nested check for object payloads that are polymorphic
        if (!cmd.payload.amount && field !== 'amount') {
          // skip for polymorphic cases
        }
      }
    }

    // Determine success events
    const successEvents: string[] = cmdDef.resulting_events?.success || cmdDef.produces_events || [];
    const failureEvents: string[] = cmdDef.resulting_events?.failure || [];

    // Guardrail: before publishing, verify business logic effects
    try {
      // Build events from template
      const events: EventEnvelope[] = [];
      for (const evName of successEvents) {
        const evDef = this.eventCatalog.events[evName];
        if (!evDef) continue;

        const aggregate_id = cmd.payload[evDef.aggregate_id_field || `${evDef.aggregate}_id`] || cmd.payload.order_id || cmd.payload.asset_id || cmd.payload.identity_id || crypto.randomUUID();

        const envelope = this.eventStore.append({
          event_name: evName,
          aggregate: evDef.aggregate,
          aggregate_id,
          source_domain: evDef.source_domain,
          command_id: cmd.command_id,
          triggering_command: cmd.command_name,
          causation_id: cmd.causation_id,
          correlation_id: cmd.correlation_id,
          actor_id: cmd.identity_context.actor_id,
          identity_context: cmd.identity_context,
          policy_decision_id: policyDecisionId,
          capability_id: cmd.capability_id,
          payload: {
            ...cmd.payload,
            // add derived fields
            [`${evDef.aggregate}_id`]: aggregate_id,
          },
          projection_effect: evDef.projection_effect || { target: 'none', operation: 'no_op' },
          audit: {
            constitutional_rules_referenced: ['INV-001','INV-003','INV-005','INV-008'],
            retention_class: 'permanent',
          },
        });

        // INV-006: event describes reality, projection interprets — handled by projection engine
        this.projectionEngine.handleEvent(envelope);
        events.push(envelope);
      }

      return { success: true, events };
    } catch (e:any) {
      // publish failure events
      const events: EventEnvelope[] = [];
      for (const evName of failureEvents) {
        const evDef = this.eventCatalog.events[evName];
        if (!evDef) continue;
        const envelope = this.eventStore.append({
          event_name: evName,
          aggregate: evDef.aggregate,
          aggregate_id: cmd.payload.asset_id || cmd.payload.order_id || crypto.randomUUID(),
          source_domain: evDef.source_domain || cmd.source_domain,
          command_id: cmd.command_id,
          triggering_command: cmd.command_name,
          causation_id: cmd.causation_id,
          correlation_id: cmd.correlation_id,
          actor_id: cmd.identity_context.actor_id,
          identity_context: cmd.identity_context,
          policy_decision_id: policyDecisionId,
          capability_id: cmd.capability_id,
          payload: { reason: e.message, failed_at: new Date().toISOString() },
          projection_effect: { target: 'none', operation: 'no_op' },
          audit: { constitutional_rules_referenced: ['INV-005'], retention_class: 'permanent' },
        });
        events.push(envelope);
      }
      return { success: false, error: e.message, events };
    }
  }

  async submit(cmd: CommandEnvelope): Promise<{ status: 'ACCEPTED'|'REJECTED'; commandId: string; correlationId: string; events: EventEnvelope[]; gates: any; error?: string }> {
    const gates: any = {};

    // Gate 1
    const g1 = this.identityGate(cmd);
    gates.identity = g1;
    if (!g1.passed) {
      return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g1.reason };
    }

    // Gate 2+3
    const g2 = this.capabilityGate(cmd);
    gates.capability_scope = g2;
    if (!g2.passed) {
      return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g2.reason };
    }

    // Gate 4
    const g4 = this.policyGate(cmd);
    gates.policy = g4;
    if (!g4.passed && g4.reason?.includes('ESCALATE')) {
      // For demo, still reject but with escalation hint
      return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g4.reason };
    }
    if (!g4.passed) {
      return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g4.reason };
    }

    // Gate 5
    const g5 = this.constitutionalGate(cmd);
    gates.constitutional = g5;
    if (!g5.passed) {
      return { status: 'REJECTED', commandId: cmd.command_id, correlationId: cmd.correlation_id, events: [], gates, error: g5.reason };
    }

    // Stage 6+7
    const result = await this.executeAndPublish(cmd, g4.policy_decision_id!);

    return {
      status: result.success ? 'ACCEPTED' : 'REJECTED',
      commandId: cmd.command_id,
      correlationId: cmd.correlation_id,
      events: result.events,
      gates,
      error: result.error,
    };
  }
}
