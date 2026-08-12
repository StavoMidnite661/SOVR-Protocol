import { GeneratedFile } from './typescript.js';
import { ParsedProtocol } from '../pipeline/parse.js';
export interface SimulationScenarioCompiled {
    scenario_id: string;
    name: string;
    version: string;
    amendment?: string;
    description: string;
    actors: Array<{
        actor_id: string;
        actor_type: string;
        identity_id: string;
        session_id?: string;
    }>;
    initial_state?: Record<string, unknown>;
    lifecycle?: {
        initial_state: string;
        terminal_state: string;
    };
    commands: Array<{
        command_id: string;
        command_name: string;
        domain: string;
        aggregate: string;
        payload: Record<string, unknown>;
        capability_id?: string;
        scope?: string;
        expected_result?: string;
        expected_error_type?: string;
        actor_context?: {
            actor_id: string;
            actor_type: string;
            identity_id: string;
            session_id?: string;
        };
        aggregate_id?: string;
    }>;
    expected_events?: Array<{
        event_name: string;
        aggregate_id?: string;
    }>;
    expected_failures?: Array<{
        command_id: string;
        error_type: string;
    }>;
    invariants?: Array<{
        invariant: string;
        required?: boolean;
    }>;
    source_file: string;
    compiled_at: string;
    integrity_hash?: string;
    integrity?: {
        algorithm: 'SHA256';
        hash: string;
        generated_by: {
            compiler_version: string;
        };
        timestamp: string;
    };
}
export interface SimulationRegistry {
    abi_version: string;
    scenarios: Record<string, SimulationScenarioCompiled>;
    entry_count: number;
    integrity: {
        algorithm: 'SHA256';
        hash: string;
        generated_by: {
            compiler_version: string;
        };
        timestamp: string;
    };
}
export declare function generateSimulationRegistry(parsed: ParsedProtocol): GeneratedFile[];
