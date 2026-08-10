import { describe, it, expect, beforeEach } from 'vitest';
import { EventDispatcher } from '../event-dispatcher/index.js';
import { PolicyGateway } from '../policy-gateway/index.js';
import { CommandRouter } from '../command-router/index.js';
import { TransactionCoordinator } from '../transaction-coordinator/index.js';
import { WorkflowEngine } from '../workflow-engine/index.js';
import { VaultDomain } from '../domains/vault/index.js';
import { TreasuryDomain } from '../domains/treasury/index.js';
import { PaymentDomain } from '../domains/payment/index.js';
import { IntentEngine } from '../domains/intent-engine/index.js';
import { AgentRuntimeDomain } from '../domains/agent-runtime/index.js';
import type { SOVRCommand, CommandRoute, CommandRouterConfig, PolicyGatewayConfig, TransactionCoordinatorConfig, WorkflowEngineConfig } from '../types.js';

describe('PHASE10E.11 Domain Transaction Orchestration', () => {
  let dispatcher: EventDispatcher;
  let policyGateway: PolicyGateway;
  let commandRouter: CommandRouter;
  let coordinator: TransactionCoordinator;
  let workflowEngine: WorkflowEngine;
  let vaultDomain: VaultDomain;
  let treasuryDomain: TreasuryDomain;
  let paymentDomain: PaymentDomain;
  let intentEngine: IntentEngine;
  let agentRuntime: AgentRuntimeDomain;

  beforeEach(() => {
    dispatcher = new EventDispatcher({ max_retries: 3, retry_delay_ms: 100, dead_letter_queue: true });
    policyGateway = new PolicyGateway({
      enabled: true,
      mutation_authorization_policy: {
        policy_id: 'MUTATION_AUTHORIZATION_POLICY',
        rules: [
          { rule_id: 'rule_command_exists', condition: 'command_exists', action: 'ALLOW', domain: 'all' },
          { rule_id: 'rule_actor_authorized', condition: 'actor_authorized', action: 'ALLOW', domain: 'all' },
          { rule_id: 'rule_intent_valid', condition: 'intent_valid', action: 'ALLOW', domain: 'all' },
          { rule_id: 'rule_domain_permitted', condition: 'domain_permitted', action: 'ALLOW', domain: 'all' },
          { rule_id: 'rule_audit_enabled', condition: 'audit_enabled', action: 'ALLOW', domain: 'all' },
          { rule_id: 'rule_max_amount', condition: 'max_amount', action: 'DENY', domain: 'treasury', max_amount: '1000000' },
        ],
        version: '1.0.0',
        effective_at: new Date().toISOString(),
      },
      strict_mode: true,
    });

    const routes: CommandRoute[] = [
      { command_type: 'CREATE_VAULT_INTENT', domain: 'vault', handler: 'VaultCommandHandler', required_capability: 'vault.intent.create', policy_gate_required: true, ledger_mutation_allowed: false },
      { command_type: 'OPEN_VAULT', domain: 'vault', handler: 'VaultCommandHandler', required_capability: 'vault.open', policy_gate_required: true, ledger_mutation_allowed: false },
      { command_type: 'LOCK_VAULT', domain: 'vault', handler: 'VaultCommandHandler', required_capability: 'vault.lock', policy_gate_required: true, ledger_mutation_allowed: false },
      { command_type: 'CREATE_ALLOCATION_REQUEST', domain: 'treasury', handler: 'TreasuryCommandHandler', required_capability: 'treasury.allocation.request', policy_gate_required: true, ledger_mutation_allowed: true },
      { command_type: 'APPROVE_ALLOCATION', domain: 'treasury', handler: 'TreasuryCommandHandler', required_capability: 'treasury.allocation.approve', policy_gate_required: true, ledger_mutation_allowed: true },
      { command_type: 'EXECUTE_ALLOCATION', domain: 'treasury', handler: 'TreasuryCommandHandler', required_capability: 'treasury.allocation.execute', policy_gate_required: true, ledger_mutation_allowed: true },
      { command_type: 'CREATE_PAYMENT_INTENT', domain: 'payment', handler: 'PaymentCommandHandler', required_capability: 'payment.intent.create', policy_gate_required: true, ledger_mutation_allowed: false },
      { command_type: 'AUTHORIZE_PAYMENT', domain: 'payment', handler: 'PaymentCommandHandler', required_capability: 'payment.authorize', policy_gate_required: true, ledger_mutation_allowed: false },
      { command_type: 'EXECUTE_INTERNAL_SETTLEMENT', domain: 'payment', handler: 'PaymentCommandHandler', required_capability: 'payment.settlement.execute', policy_gate_required: true, ledger_mutation_allowed: true },
    ];

    const routerConfig: CommandRouterConfig = {
      routes,
      default_handler: 'DefaultCommandHandler',
      audit_enabled: true,
    };

    commandRouter = new CommandRouter(routerConfig);
    coordinator = new TransactionCoordinator({
      event_dispatcher: dispatcher,
      policy_gateway: policyGateway,
      command_router: commandRouter,
      audit_enabled: true,
      replay_verification: true,
    });
    workflowEngine = new WorkflowEngine({ max_concurrent_workflows: 10, default_step_timeout_ms: 5000, max_retries: 3 }, coordinator);
    vaultDomain = new VaultDomain();
    treasuryDomain = new TreasuryDomain();
    paymentDomain = new PaymentDomain();
    intentEngine = new IntentEngine({ max_payload_size: 1024, allowed_intent_types: ['CREATE_VAULT_INTENT', 'OPEN_VAULT', 'LOCK_VAULT', 'CREATE_ALLOCATION_REQUEST', 'CREATE_PAYMENT_INTENT'], require_policy_context: true });
    agentRuntime = new AgentRuntimeDomain();
  });

  // ========================================================================
  // TEST 001 — Vault Lifecycle
  // ========================================================================
  describe('TEST 001: Vault Lifecycle', () => {
    it('should create vault intent, open vault, lock vault, and emit 3 events', async () => {
      const vaultId = `vault_${Date.now()}`;

      const createIntentCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_001`,
        command_type: 'CREATE_VAULT_INTENT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'vault_policy',
        payload: {},
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      };

      const result1 = await coordinator.execute(createIntentCommand);
      expect(result1.status).toBe('COMPLETED');
      expect(result1.events_emitted).toBe(1);

      const openCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_002`,
        command_type: 'OPEN_VAULT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: createIntentCommand.intent_id,
        policy_context: 'vault_policy',
        payload: { vault_id: vaultId, asset_type: 'USD' },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      };

      const result2 = await coordinator.execute(openCommand);
      expect(result2.status).toBe('COMPLETED');

      const lockCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_003`,
        command_type: 'LOCK_VAULT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: createIntentCommand.intent_id,
        policy_context: 'vault_policy',
        payload: { vault_id: vaultId, reason: 'maintenance' },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      };

      const result3 = await coordinator.execute(lockCommand);
      expect(result3.status).toBe('COMPLETED');

      const totalEvents = dispatcher.getEventCount();
      expect(totalEvents).toBe(3);

      const replayResult = coordinator.verifyReplay();
      expect(replayResult.valid).toBe(true);
    });
  });

  // ========================================================================
  // TEST 002 — Treasury Internal Allocation
  // ========================================================================
  describe('TEST 002: Treasury Internal Allocation', () => {
    it('should create allocation, approve, execute with balanced double entry', async () => {
      const request = treasuryDomain.createAllocationRequest({
        from_pool: 'SYSTEM_RESERVE_POOL',
        to_pool: 'TREASURY_OPERATING',
        amount: '10',
        currency: 'USD',
        reason: 'Phase 10E.11 test allocation',
        actor: 'system',
      });

      expect(request.status).toBe('PENDING');

      const createCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_001`,
        command_type: 'CREATE_ALLOCATION_REQUEST',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'treasury_policy',
        payload: { request_id: request.request_id, amount: '10' },
        authorization: 'LEDGER_MUTATION_AUTHORIZED',
        hash: '',
        domain: 'treasury',
      };

      const result1 = await coordinator.execute(createCommand);
      expect(result1.status).toBe('COMPLETED');

      const approved = treasuryDomain.approveAllocation(request.request_id, 'system');
      expect(approved?.status).toBe('APPROVED');

      const approveCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_002`,
        command_type: 'APPROVE_ALLOCATION',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'treasury_policy',
        payload: { request_id: request.request_id },
        authorization: 'LEDGER_MUTATION_AUTHORIZED',
        hash: '',
        domain: 'treasury',
      };

      const result2 = await coordinator.execute(approveCommand);
      expect(result2.status).toBe('COMPLETED');

      const executed = treasuryDomain.executeAllocation(request.request_id);
      expect(executed?.status).toBe('EXECUTED');

      const executeCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_003`,
        command_type: 'EXECUTE_ALLOCATION',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'treasury_policy',
        payload: { request_id: request.request_id },
        authorization: 'LEDGER_MUTATION_AUTHORIZED',
        hash: '',
        domain: 'treasury',
      };

      const result3 = await coordinator.execute(executeCommand);
      expect(result3.status).toBe('COMPLETED');

      const reservePool = treasuryDomain.getPool('SYSTEM_RESERVE_POOL');
      const operatingPool = treasuryDomain.getPool('TREASURY_OPERATING');

      expect(reservePool?.balance).toBe('999990');
      expect(operatingPool?.balance).toBe('10');

      const replayResult = coordinator.verifyReplay();
      expect(replayResult.valid).toBe(true);
    });
  });

  // ========================================================================
  // TEST 003 — Payment Simulation
  // ========================================================================
  describe('TEST 003: Payment Simulation', () => {
    it('should create payment intent without external settlement', async () => {
      const payment = paymentDomain.createIntent({
        amount: '100',
        currency: 'USD',
        from_account: 'SYSTEM_RESERVE_POOL',
        to_account: 'TREASURY_OPERATING',
        rail_type: 'INTERNAL',
        actor: 'system',
      });

      expect(payment.state).toBe('INTENT_CREATED');

      const createCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_001`,
        command_type: 'CREATE_PAYMENT_INTENT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'payment_policy',
        payload: { payment_id: payment.payment_id, amount: '100' },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'payment',
      };

      const result1 = await coordinator.execute(createCommand);
      expect(result1.status).toBe('COMPLETED');
      expect(result1.ledger_mutations).toBe(0);

      const authorized = paymentDomain.authorizePayment(payment.payment_id, 'system');
      expect(authorized?.state).toBe('AUTHORIZED');

      const authorizeCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_002`,
        command_type: 'AUTHORIZE_PAYMENT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'payment_policy',
        payload: { payment_id: payment.payment_id },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'payment',
      };

      const result2 = await coordinator.execute(authorizeCommand);
      expect(result2.status).toBe('COMPLETED');
      expect(result2.ledger_mutations).toBe(0);

      const events = dispatcher.getEventsByDomain('payment');
      expect(events.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // TEST 004 — Agent Controlled Workflow
  // ========================================================================
  describe('TEST 004: Agent Controlled Workflow', () => {
    it('should prevent agent from bypassing governance', async () => {
      agentRuntime.registerAgent('test_agent_001');

      const governanceResult = agentRuntime.verifyGovernanceBoundary('test_agent_001');
      expect(governanceResult.compliant).toBe(true);
      expect(governanceResult.violations).toHaveLength(0);

      const intent = intentEngine.submitIntent('CREATE_VAULT_INTENT', 'test_agent_001', { vault_id: 'test_vault', asset_type: 'USD' }, { policy_version: '1.0.0' });
      const validation = intentEngine.validate(intent);
      expect(validation.valid).toBe(true);
      expect(intent.status).toBe('VALIDATED');

      const command: SOVRCommand = {
        command_id: `cmd_${Date.now()}_001`,
        command_type: 'OPEN_VAULT',
        actor: 'test_agent_001',
        timestamp: new Date().toISOString(),
        intent_id: intent.intent_id,
        policy_context: 'vault_policy',
        payload: { vault_id: 'test_vault', asset_type: 'USD' },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      };

      const result = await coordinator.execute(command);
      expect(result.status).toBe('COMPLETED');
      expect(result.events_emitted).toBeGreaterThanOrEqual(1);

      const bypassCommand: SOVRCommand = {
        command_id: `cmd_${Date.now()}_002`,
        command_type: 'EXECUTE_ALLOCATION',
        actor: 'test_agent_001',
        timestamp: new Date().toISOString(),
        intent_id: intent.intent_id,
        policy_context: 'treasury_policy',
        payload: { request_id: 'fake_request' },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'treasury',
      };

      const bypassResult = await coordinator.execute(bypassCommand);
      expect(bypassResult.status).toBe('FAILED');
      expect(bypassResult.errors.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Event Chain Validation
  // ========================================================================
  describe('Event Chain Validation', () => {
    it('should maintain valid hash chain across events', async () => {
      const vaultId = `vault_${Date.now()}`;

      await coordinator.execute({
        command_id: `cmd_${Date.now()}_1`,
        command_type: 'CREATE_VAULT_INTENT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'vault_policy',
        payload: {},
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      });

      await coordinator.execute({
        command_id: `cmd_${Date.now()}_2`,
        command_type: 'OPEN_VAULT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'vault_policy',
        payload: { vault_id: vaultId, asset_type: 'USD' },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      });

      const chainValidation = dispatcher.validateChain();
      expect(chainValidation.valid).toBe(true);
      expect(chainValidation.broken_links).toHaveLength(0);
    });
  });

  // ========================================================================
  // Replay Verification
  // ========================================================================
  describe('Replay Verification', () => {
    it('should verify all transactions are replayable', async () => {
      await coordinator.execute({
        command_id: `cmd_${Date.now()}_1`,
        command_type: 'CREATE_VAULT_INTENT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'vault_policy',
        payload: {},
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      });

      await coordinator.execute({
        command_id: `cmd_${Date.now()}_2`,
        command_type: 'OPEN_VAULT',
        actor: 'system',
        timestamp: new Date().toISOString(),
        intent_id: `intent_${Date.now()}`,
        policy_context: 'vault_policy',
        payload: { vault_id: `vault_${Date.now()}`, asset_type: 'USD' },
        authorization: 'READ_ONLY',
        hash: '',
        domain: 'vault',
      });

      const replayResult = coordinator.verifyReplay();
      expect(replayResult.valid).toBe(true);
      expect(replayResult.totalTransactions).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // Genesis Preservation
  // ========================================================================
  describe('Genesis Preservation', () => {
    it('should not modify genesis accounts', async () => {
      const vaults = vaultDomain.getAllVaults();
      const pools = treasuryDomain.getAllPools();

      const genesisVaults = vaults.filter(v => v.vault_id.includes('genesis'));
      const genesisPools = pools.filter(p => p.pool_id.includes('SYSTEM_RESERVE_POOL') || p.pool_id.includes('TREASURY_OPERATING'));

      expect(genesisPools.length).toBeGreaterThanOrEqual(2);
      expect(genesisPools[0].balance).toBe('1000000');
    });
  });
});
