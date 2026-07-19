export interface ProtocolNode {
    id: string;
    type: 'protocol' | 'domain' | 'entity' | 'command' | 'event' | 'state_machine' | 'capability' | 'saga' | 'projection' | 'contract';
    sourceFile: string;
    sourceRef: string;
    version: string;
    constitutionalRefs: string[];
}
export interface DomainNode extends ProtocolNode {
    type: 'domain';
    name: string;
    description: string;
    entities: string[];
    priority: number;
    layer: string;
}
export interface EntityNode extends ProtocolNode {
    type: 'entity';
    domain: string;
    entityName: string;
    attributes: Record<string, any>;
}
export interface CommandNode extends ProtocolNode {
    type: 'command';
    domain: string;
    aggregate: string;
    requiredPayload: string[];
    resultingEvents: string[];
    capability: string;
    gates: {
        identity_required: boolean;
        capability_required: boolean;
        policy_required: boolean;
    };
}
export interface EventNode extends ProtocolNode {
    type: 'event';
    domain: string;
    aggregate: string;
    dataFields: Record<string, any>;
    envelope: any;
}
export interface CapabilityNode extends ProtocolNode {
    type: 'capability';
    capabilityId: string;
    domain: string;
    resourceType: string;
    action: string;
    riskLevel: string;
    scopePattern: string;
}
export interface SOVR_IR {
    meta: {
        protocolVersion: string;
        compilerVersion: string;
        generatedWithoutWallClock: true;
        irHash?: string;
    };
    nodes: ProtocolNode[];
    edges: Array<{
        from: string;
        to: string;
        type: string;
    }>;
    diagnostics: Diagnostic[];
}
export interface Diagnostic {
    code: string;
    category: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
    stage: string;
    file: string;
    line?: number;
    message: string;
    action: string;
    findingRef?: string;
}
