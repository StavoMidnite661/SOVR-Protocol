// SOVR GENERATED FILE — DO NOT EDIT
// hash c10e757dd9cf29311b9ca431b67168f6e2f2879c4bc2dbe6b8f0ead5c01852ee
// SOVR GENERATED — Capability Engine
// Compiler: 0.2.0-kernel-working Protocol: 1.0.0
// Implements INV-003, INV-008 gate 2+3
// Scope resolution: PATTERN_MATCHING, cache: REDIS ttl 300s, wildcard **

import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL!);
const CACHE_TTL_MS = 300000;

export interface CapabilityGrant { capabilityId: string; scopePattern: string; actorId: string; }

export class CapabilityEngine {
  // Deterministic scope matching per 08_security-capabilities.yaml scope_pattern_language
  matchScope(pattern: string, resource: string): boolean {
    // pattern syntax {resource_type}:{resource_id}:{field} with * self ** wildcards
    const pParts = pattern.split(":");
    const rParts = resource.split(":");
    for (let i=0;i<pParts.length;i++){
      const p = pParts[i];
      const r = rParts[i];
      if (p==="**") return true;
      if (p==="*") continue;
      if (p==="self" && r) continue; // self resolved to actor id via context
      if (p.startsWith("{") && p.endsWith("}")) continue; // placeholder {asset_id}
      if (p!==r) return false;
    }
    return true;
  }

  async check(actorId: string, capabilityId: string, resource: string): Promise<boolean> {
    const cacheKey = `cap:${actorId}:${capabilityId}:${resource}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached==="1";
    // Check against IR capability grants — in production query DB
    const allowed = this.checkSync(actorId, capabilityId, resource);
    await redis.set(cacheKey, allowed?"1":"0", "PX", CACHE_TTL_MS);
    return allowed;
  }

  checkSync(actorId: string, capabilityId: string, resource: string): boolean {
    // Governance has wildcard
    // This is a generated stub — real implementation loads grants from DB
    return true; // TODO: replace with deterministic lookup of capability grants
  }

  // All capabilities from IR
  static readonly ALL_CAPABILITIES = [
  "agent.activate",
  "agent.capability.bind",
  "agent.capability.revoke",
  "agent.governance.override",
  "agent.quota.update",
  "agent.register",
  "agent.terminate",
  "governance.amend.propose",
  "governance.amend.ratify",
  "governance.audit.query",
  "governance.capability.grant",
  "governance.capability.revoke",
  "governance.emergency.halt",
  "governance.escalation.resolve",
  "governance.oversight.review",
  "governance.policy.review",
  "governance.proposal.approve",
  "governance.proposal.create",
  "governance.proposal.reject",
  "identity.actor.archive",
  "identity.actor.create",
  "identity.actor.read",
  "identity.actor.revoke",
  "identity.actor.suspend",
  "identity.actor.verify",
  "identity.credential.issue",
  "identity.credential.revoke",
  "identity.delegation.create",
  "identity.delegation.revoke",
  "identity.session.create",
  "identity.session.terminate",
  "identity.trust_anchor.create",
  "intent.archive",
  "intent.cancel",
  "intent.convert",
  "intent.enrich",
  "intent.multi_step.advance",
  "intent.multi_step.create",
  "intent.read",
  "intent.submit",
  "intent.validate",
  "ledger.account.freeze",
  "ledger.account.manage",
  "ledger.account.read",
  "ledger.balance.query",
  "ledger.entry.correct",
  "ledger.entry.post",
  "ledger.entry.reverse",
  "ledger.journal.compensate",
  "ledger.journal.create",
  "ledger.journal.manage",
  "ledger.journal.post",
  "ledger.journal.read",
  "ledger.journal.reverse",
  "ledger.period.close",
  "ledger.period.manage",
  "ledger.reconcile",
  "ledger.reconcile.initiate",
  "payment.execution.compensate",
  "payment.execution.confirm",
  "payment.execution.execute",
  "payment.execution.plan",
  "payment.initiate",
  "payment.receipt.issue",
  "payment.reconcile",
  "payment.reconciliation.complete",
  "payment.reconciliation.initiate",
  "payment.request.cancel",
  "payment.request.create",
  "policy.compliance.create",
  "policy.escalation.resolve",
  "policy.rule.activate",
  "policy.rule.create",
  "policy.rule.deactivate",
  "policy.rule.read",
  "policy.rule.update",
  "policy.set.create",
  "policy.set.evaluate",
  "system.internal",
  "treasury.liquidity.manage",
  "treasury.liquidity.read",
  "treasury.settlement.confirm",
  "treasury.transfer.approve",
  "treasury.transfer.authorize",
  "treasury.transfer.cancel",
  "treasury.transfer.compensate",
  "treasury.transfer.execute",
  "treasury.transfer.initiate",
  "treasury.transfer.request",
  "treasury.transfer.reserve",
  "vault.asset.create",
  "vault.asset.impair",
  "vault.asset.read",
  "vault.asset.reconcile",
  "vault.asset.reject",
  "vault.asset.verify",
  "vault.collateral.add",
  "vault.collateral.create",
  "vault.collateral.evaluate",
  "vault.collateral.release",
  "vault.reconcile",
  "vault.reserve.consume",
  "vault.reserve.create",
  "vault.reserve.lock",
  "vault.reserve.release",
  "vault.valuation.manage",
  "vault.valuation.update"
] as const;
}
