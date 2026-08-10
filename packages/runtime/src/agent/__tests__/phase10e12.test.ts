import { describe, it, expect, beforeEach } from 'vitest';
import { IntentEngine } from '../intent-engine/index.js';
import { MissionRuntime } from '../mission-runtime/index.js';
import { MissionPlanner } from '../planner/index.js';
import { AgentReasoning } from '../reasoning/index.js';
import { MissionExecutor } from '../executor/index.js';
import { AgentMemory } from '../memory/index.js';
import { AgentAuditTrail } from '../audit/index.js';
import { AgentPolicyInterface } from '../policy-interface/index.js';
import type {
  AgentIntent,
  Mission,
  ExecutionPlan,
  PolicyEvaluationInput,
  AgentPermissions,
  PermissionDecision,
} from '../types.js';

describe('PHASE10E.12 Intent Engine + Agent Mission Runtime Integration', () => {
  let intentEngine: IntentEngine;
  let missionRuntime: MissionRuntime;
  let missionPlanner: MissionPlanner;
  let agentReasoning: AgentReasoning;
  let missionExecutor: MissionExecutor;
  let agentMemory: AgentMemory;
  let agentAuditTrail: AgentAuditTrail;
  let agentPolicyInterface: AgentPolicyInterface;

  const testPermissions: AgentPermissions = {
    read: 'ALLOWED',
    analyze: 'ALLOWED',
    create_intent: 'ALLOWED',
    create_command: 'ALLOWED',
    execute_command: 'REQUIRES_POLICY',
    ledger_access: 'DENIED',
    genesis_access: 'DENIED',
  };

  beforeEach(() => {
    intentEngine = new IntentEngine(
      {
        max_objective_length: 1000,
        allowed_actors: ['test_agent', 'system', 'human'],
        require_constraints: false,
        default_risk_level: 'LOW',
      },
      testPermissions
    );

    missionRuntime = new MissionRuntime(
      {
        max_concurrent_missions: 10,
        default_step_timeout_ms: 5000,
        max_retries: 3,
        require_policy_approval: true,
      },
      testPermissions
    );

    missionPlanner = new MissionPlanner({
      default_step_timeout_ms: 5000,
      max_plan_steps: 10,
      require_policy_check: true,
    });

    agentReasoning = new AgentReasoning();
    missionExecutor = new MissionExecutor({ enable_dry_run: true, require_policy_approval: true });
    agentMemory = new AgentMemory({ retention_class: 'permanent', max_entries: 10000 });
    agentAuditTrail = new AgentAuditTrail({ retention_class: 'permanent', enable_hash_chain: true });
    agentPolicyInterface = new AgentPolicyInterface(
      {
        policy_gateway: {
          evaluate: () => ({ authorized: true, conditions: ['test_policy'], authorization_token: 'test_token' }),
        },
        require_policy_for_mutation: true,
      },
      testPermissions
    );
  });

  // ========================================================================
  // TEST 001 — Treasury Allocation Mission
  // ========================================================================
  describe('TEST 001: Treasury Allocation Mission', () => {
    it('should create intent, validate, plan mission, and execute treasury workflow', async () => {
      const intent = intentEngine.createIntent(
        'test_agent',
        'Allocate internal reserve funds to treasury operating',
        { source: 'agent', purpose: 'test' },
        'MEDIUM'
      );

      expect(intent.intent_id).toBeTruthy();
      expect(intent.status).toBe('PENDING');

      const validation = intentEngine.validateIntent(intent);
      expect(validation.valid).toBe(true);
      expect(intent.status).toBe('VALIDATED');
      expect(intent.classified_type).toBe('TREASURY_ALLOCATION');

      const plan = intentEngine.generateExecutionPlan(intent);
      expect(plan.steps.length).toBeGreaterThanOrEqual(1);
      expect(plan.requires_approval).toBe(true);

      const missionSteps = missionPlanner.convertToMissionSteps(plan);
      expect(missionSteps.length).toBeGreaterThanOrEqual(1);

      const mission = await missionRuntime.createMission(intent.intent_id, 'test_agent', missionSteps, { policy: 'treasury_allocation' });
      expect(mission.mission_id).toBeTruthy();
      expect(mission.status).toBe('CREATED');

      const result = await missionRuntime.executeMission(mission.mission_id);
      expect(result.status).toBe('COMPLETED');
      expect(result.steps_completed).toBe(result.steps_total);

      const auditEvent = agentAuditTrail.recordAction('test_agent', mission.mission_id, 'EXECUTE_TREASURY_ALLOCATION', 'Agent executed treasury allocation mission', 'CREATE_ALLOCATION_REQUEST');
      expect(auditEvent.event_id).toBeTruthy();
      expect(auditEvent.hash).toBeTruthy();

      const memoryEntry = agentMemory.append({
        mission_id: mission.mission_id,
        action: 'EXECUTE_TREASURY_ALLOCATION',
        reasoning_summary: 'Treasury allocation completed successfully',
        outcome: 'SUCCESS',
        metadata: { steps: result.steps_completed },
      });
      expect(memoryEntry.memory_event_id).toBeTruthy();
      expect(memoryEntry.event_hash).toBeTruthy();
    });
  });

  // ========================================================================
  // TEST 002 — Vault Lifecycle Mission
  // ========================================================================
  describe('TEST 002: Vault Lifecycle Mission', () => {
    it('should create intent, validate, plan mission, and execute vault workflow without ledger mutation', async () => {
      const intent = intentEngine.createIntent(
        'test_agent',
        'Create and lock vault for secure value container',
        { vault_type: 'standard' },
        'LOW'
      );

      expect(intent.intent_id).toBeTruthy();

      const validation = intentEngine.validateIntent(intent);
      expect(validation.valid).toBe(true);
      expect(intent.classified_type).toBe('VAULT_LIFECYCLE');

      const plan = intentEngine.generateExecutionPlan(intent);
      expect(plan.requires_approval).toBe(false);

      const missionSteps = missionPlanner.convertToMissionSteps(plan);
      const mission = await missionRuntime.createMission(intent.intent_id, 'test_agent', missionSteps, { policy: 'vault_lifecycle' });

      const result = await missionRuntime.executeMission(mission.mission_id);
      expect(result.status).toBe('COMPLETED');
      expect(result.ledger_mutations).toBe(0);
    });
  });

  // ========================================================================
  // TEST 003 — Payment Simulation Mission
  // ========================================================================
  describe('TEST 003: Payment Simulation Mission', () => {
    it('should create intent, validate, plan mission, and execute payment simulation without external settlement', async () => {
      const intent = intentEngine.createIntent(
        'test_agent',
        'Prepare internal payment simulation',
        { rail_type: 'INTERNAL', external_settlement: false },
        'MEDIUM'
      );

      expect(intent.intent_id).toBeTruthy();

      const validation = intentEngine.validateIntent(intent);
      expect(validation.valid).toBe(true);
      expect(intent.classified_type).toBe('PAYMENT_SIMULATION');

      const plan = intentEngine.generateExecutionPlan(intent);
      const missionSteps = missionPlanner.convertToMissionSteps(plan);
      const mission = await missionRuntime.createMission(intent.intent_id, 'test_agent', missionSteps, { policy: 'payment_simulation' });

      const result = await missionRuntime.executeMission(mission.mission_id);
      expect(result.status).toBe('COMPLETED');
    });
  });

  // ========================================================================
  // Intent Determinism
  // ========================================================================
  describe('Intent Determinism', () => {
    it('should produce identical execution plan for same intent input', () => {
      const intent = intentEngine.createIntent('test_agent', 'Allocate internal reserve funds', {}, 'MEDIUM');
      intentEngine.validateIntent(intent);

      const plan1 = intentEngine.generateExecutionPlan(intent);
      const plan2 = intentEngine.generateExecutionPlan(intent);

      expect(plan1.steps.length).toBe(plan2.steps.length);
      expect(plan1.requires_approval).toBe(plan2.requires_approval);
      expect(plan1.deterministic_hash).toBe(plan2.deterministic_hash);
    });
  });

  // ========================================================================
  // Mission Replay
  // ========================================================================
  describe('Mission Replay', () => {
    it('should reproduce identical workflow state on replay', async () => {
      const intent = intentEngine.createIntent('test_agent', 'Create and lock vault', {}, 'LOW');
      intentEngine.validateIntent(intent);
      const plan = intentEngine.generateExecutionPlan(intent);
      const missionSteps = missionPlanner.convertToMissionSteps(plan);
      const mission = await missionRuntime.createMission(intent.intent_id, 'test_agent', missionSteps, {});

      const result1 = await missionRuntime.executeMission(mission.mission_id);

      const intent2 = intentEngine.createIntent('test_agent', 'Create and lock vault', {}, 'LOW');
      intentEngine.validateIntent(intent2);
      const plan2 = intentEngine.generateExecutionPlan(intent2);
      const missionSteps2 = missionPlanner.convertToMissionSteps(plan2);
      const mission2 = await missionRuntime.createMission(intent2.intent_id, 'test_agent', missionSteps2, {});
      const result2 = await missionRuntime.executeMission(mission2.mission_id);

      expect(result1.status).toBe(result2.status);
      expect(result1.steps_completed).toBe(result2.steps_completed);
      expect(result1.commands_emitted).toBe(result2.commands_emitted);
    });
  });

  // ========================================================================
  // Genesis Protection
  // ========================================================================
  describe('Genesis Protection', () => {
    it('should prevent agent from accessing genesis', () => {
      const result = agentPolicyInterface.validateDirectLedgerAccess('test_agent');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('does not have direct ledger access permission');
    });
  });

  // ========================================================================
  // Agent Reasoning Boundary
  // ========================================================================
  describe('Agent Reasoning Boundary', () => {
    it('should escalate critical risk missions', () => {
      const result = agentReasoning.reason('Transfer all funds', {}, 'CRITICAL');
      expect(result.decision).toBe('ESCALATE');
    });

    it('should proceed with low risk missions', () => {
      const result = agentReasoning.reason('Create vault', {}, 'LOW');
      expect(result.decision).toBe('PROCEED');
    });
  });

  // ========================================================================
  // Memory Integrity
  // ========================================================================
  describe('Memory Integrity', () => {
    it('should maintain valid hash chain in memory', () => {
      agentMemory.append({
        mission_id: 'mission_1',
        action: 'CREATE_INTENT',
        reasoning_summary: 'First action',
        outcome: 'SUCCESS',
        metadata: {},
      });

      agentMemory.append({
        mission_id: 'mission_1',
        action: 'EXECUTE_MISSION',
        reasoning_summary: 'Second action',
        outcome: 'SUCCESS',
        metadata: {},
      });

      const chainValidation = agentMemory.validateChain();
      expect(chainValidation.valid).toBe(true);
      expect(chainValidation.broken_links).toHaveLength(0);
    });
  });

  // ========================================================================
  // Audit Trail Integrity
  // ========================================================================
  describe('Audit Trail Integrity', () => {
    it('should maintain valid hash chain in audit trail', () => {
      agentAuditTrail.recordAction('test_agent', 'mission_1', 'CREATE_INTENT', 'Created intent');
      agentAuditTrail.recordAction('test_agent', 'mission_1', 'VALIDATE_INTENT', 'Validated intent');
      agentAuditTrail.recordAction('test_agent', 'mission_1', 'EXECUTE_MISSION', 'Executed mission');

      const chainValidation = agentAuditTrail.validateChain();
      expect(chainValidation.valid).toBe(true);
      expect(chainValidation.broken_links).toHaveLength(0);
      expect(agentAuditTrail.getCount()).toBe(3);
    });
  });

  // ========================================================================
  // Policy Integration
  // ========================================================================
  describe('Policy Integration', () => {
    it('should evaluate mission policy before execution', () => {
      const input: PolicyEvaluationInput = {
        mission_id: 'mission_test',
        intent_type: 'CREATE_ALLOCATION_REQUEST',
        actor: 'test_agent',
        requested_actions: ['create_allocation', 'approve_allocation'],
        risk_level: 'MEDIUM',
      };

      const result = agentPolicyInterface.evaluateMission(input);
      expect(result.approved).toBe(true);
      expect(result.authorization_token).toBeTruthy();
    });

    it('should reject critical risk missions', () => {
      const input: PolicyEvaluationInput = {
        mission_id: 'mission_critical',
        intent_type: 'EXECUTE_ALLOCATION',
        actor: 'test_agent',
        requested_actions: ['execute_allocation', 'transfer_funds'],
        risk_level: 'CRITICAL',
      };

      const result = agentPolicyInterface.evaluateMission(input);
      expect(result.approved).toBe(false);
      expect(result.violation).toBe('CRITICAL_RISK_REQUIRES_HUMAN_APPROVAL');
    });
  });
});
