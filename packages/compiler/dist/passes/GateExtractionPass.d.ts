/**
 * GateExtractionPass
 *
 * Compiler pass — reads execution_gates from YAML command definitions
 * and embeds them into the compiled command registry artifact.
 *
 * Constitutional principle:
 *   Gate definitions live in YAML only.
 *   The compiler extracts them.
 *   The runtime reads them from the compiled registry.
 *   No gate logic is handwritten in the runtime.
 */
export type GateDefinition = {
    gateId: string;
    type: string;
    config: Record<string, unknown>;
    description: string;
    fatal: boolean;
};
export type GateType = 'BALANCE_SUFFICIENT' | 'STATE_PRECONDITION' | 'AUTHORIZATION_LIMIT' | 'TIME_WINDOW' | 'APPROVAL_QUORUM' | 'COMPLIANCE_HOLD_ABSENT' | 'KYC_VERIFIED' | 'ACCOUNT_ACTIVE' | 'DEPENDENCY_SATISFIED' | 'AMOUNT_WITHIN_LIMIT';
export type GateConfig = Record<string, unknown>;
type YamlGateDefinition = {
    gate_id: string;
    type: string;
    fatal: boolean;
    description: string;
    config: Record<string, unknown>;
};
type YamlCommandSpec = {
    name: string;
    required_capability: string;
    state_machine?: string;
    aggregate_type?: string;
    domain?: string;
    layer?: number;
    execution_gates?: YamlGateDefinition[];
};
export type CompiledCommandEntry = {
    commandName: string;
    requiredCapability: string;
    stateMachine: string;
    aggregateType: string;
    domain: string;
    layer: number;
    executionGates: GateDefinition[];
};
export declare class GateExtractionPass {
    private errors;
    private warnings;
    process(commands: YamlCommandSpec[]): {
        entries: CompiledCommandEntry[];
        errors: string[];
        warnings: string[];
    };
    private processCommand;
    private extractGates;
    private validateConfig;
}
export {};
