// ============================================================
// Command Authority — Adapter for the commands registry
// Phase 10B.1: Presents compiler-generated registry data in the
// shape the CommandBus expects, eliminating the second authority path.
// ============================================================

import type { CommandRegistry, CommandRegistryEntry, CommandLifecycleCoverage } from './types.js';

export class CommandAuthority {
  readonly commands: Record<string, CommandRegistryEntry>;
  readonly command_lifecycle_coverage: {
    lifecycle_exemptions: Record<string, any>;
  };

  constructor(private readonly registry: CommandRegistry) {
    this.commands = registry.entries ?? {};
    this.command_lifecycle_coverage = {
      lifecycle_exemptions: registry.command_lifecycle_coverage?.lifecycle_exemptions ?? {},
    };
  }

  has(commandName: string): boolean {
    return commandName in this.commands;
  }

  get(commandName: string): CommandRegistryEntry | undefined {
    return this.commands[commandName];
  }

  getSourceDomain(commandName: string): string | undefined {
    const cmd = this.commands[commandName];
    return cmd ? (cmd.source_domain ?? cmd.domain) : undefined;
  }

  getAggregate(commandName: string): string | undefined {
    const cmd = this.commands[commandName];
    return cmd?.aggregate;
  }

  getRequiredPayload(commandName: string): string[] {
    const cmd = this.commands[commandName];
    if (!cmd) return [];
    const required = (cmd.required_payload ?? []) as any[];
    return required.filter((x) => typeof x === 'string') as string[];
  }

  getSuccessEvents(commandName: string): string[] {
    const cmd = this.commands[commandName];
    if (!cmd) return [];
    return cmd.resulting_events?.success ?? [];
  }

  getExemption(commandName: string): any {
    return this.command_lifecycle_coverage.lifecycle_exemptions[commandName];
  }

  isLifecycleExempt(commandName: string): boolean {
    const cmd = this.commands[commandName];
    const exemption = this.getExemption(commandName);
    return Boolean(
      cmd?.lifecycle_exempt ??
      exemption?.lifecycle_exempt ??
      Boolean(exemption),
    );
  }

  getExemptionReason(commandName: string): string | undefined {
    const cmd = this.commands[commandName];
    const exemption = this.getExemption(commandName);
    return exemption?.lifecycle_exempt_reason ?? cmd?.lifecycle_exempt_reason;
  }

  getExemptionGovernanceRef(commandName: string): string | undefined {
    const cmd = this.commands[commandName];
    const exemption = this.getExemption(commandName);
    return exemption?.lifecycle_exempt_governance_ref ?? cmd?.lifecycle_exempt_governance_ref;
  }

  allCommandNames(): string[] {
    return Object.keys(this.commands);
  }
}
