import { canonicalJson, sha256 } from '../utils/hash.js';
import { canonicalCompilationTimestamp } from '../utils/deterministic-time.js';
/**
 * Canonical semantic payload of a compiled scenario.
 *
 * Strips ALL generated provenance metadata (compiled_at, integrity block,
 * legacy integrity_hash) so integrity hashes computed over this payload
 * are pure functions of the protocol source content — identical across
 * independent compilations. This is the single explicit canonical payload
 * used by both the per-scenario and the registry-level integrity hashes.
 */
function canonicalScenarioPayload(scenario) {
    const payload = { ...scenario };
    delete payload.integrity_hash;
    delete payload.integrity;
    delete payload.compiled_at;
    return payload;
}
export function generateSimulationRegistry(parsed) {
    const simulationDir = 'governance/simulation/scenarios';
    const scenarios = {};
    for (const file of parsed.files) {
        if (!file.relativePath.includes('governance/simulation/scenarios') || !file.relativePath.endsWith('.yaml'))
            continue;
        const raw = file.parsed;
        if (!raw || typeof raw !== 'object' || !raw.scenario_id)
            continue;
        const scenario = {
            scenario_id: raw.scenario_id,
            name: raw.name ?? raw.scenario_id,
            version: raw.version ?? '1.0.0',
            amendment: raw.amendment,
            description: raw.description ?? '',
            actors: (() => {
                const list = raw.actors ?? (raw.actor_context ? [raw.actor_context] : []);
                return list.map((a) => ({
                    actor_id: a.actor_id,
                    actor_type: a.actor_type,
                    identity_id: a.identity_id,
                    session_id: a.session_id,
                }));
            })(),
            initial_state: raw.initial_state,
            lifecycle: raw.lifecycle,
            commands: (raw.commands ?? []).map((cmd) => ({
                command_id: cmd.command_id,
                command_name: cmd.command_name,
                domain: cmd.domain,
                aggregate: cmd.aggregate,
                payload: cmd.payload ?? {},
                capability_id: cmd.capability_id,
                scope: cmd.scope,
                expected_result: cmd.expected_result,
                expected_error_type: cmd.expected_error_type,
                actor_context: cmd.actor_context,
                aggregate_id: cmd.aggregate_id,
            })),
            expected_events: raw.expected_events,
            expected_failures: raw.expected_failures,
            invariants: raw.invariants,
            source_file: file.relativePath,
            // Canonical Compilation Timestamp — deterministic provenance value,
            // satisfies the FROZEN SIMULATION_REGISTRY_ABI_v1 "ISO-8601 timestamp
            // of compilation" contract without wall-clock leakage (R5/R9).
            // Documented in utils/deterministic-time.ts.
            compiled_at: canonicalCompilationTimestamp(),
        };
        // Scenario integrity hash boundary: canonical semantic payload only.
        // Generated provenance metadata (compiled_at, integrity, legacy
        // integrity_hash) is excluded so the hash is a pure function of the
        // scenario's protocol content and identical across compilations.
        const hashPayload = canonicalScenarioPayload(scenario);
        scenario.integrity = {
            algorithm: 'SHA256',
            hash: sha256(canonicalJson(hashPayload)),
            generated_by: { compiler_version: '0.6.0' },
            timestamp: canonicalCompilationTimestamp(),
        };
        delete scenario.integrity_hash;
        scenarios[scenario.scenario_id] = scenario;
    }
    // Simulation registry integrity hash boundary — EXPLICIT canonical
    // payload rule, unified with every other authority artifact and with the
    // runtime IntegrityValidator (packages/runtime/src/authority/
    // integrity-validator.ts):
    //
    //   registry.integrity.hash = sha256(canonicalJson(registry minus its
    //   own top-level integrity block))
    //
    // The payload therefore contains abi_version, entry_count and the full
    // scenario map. It is deterministic across independent compilations
    // because every embedded provenance value is the Canonical Compilation
    // Timestamp (or a hash over canonical scenario content): compiled_at and
    // integrity.timestamp are fixed constants, and per-scenario
    // integrity.hash values are pure functions of protocol content. No
    // wall-clock value enters this payload (R5), so the hash satisfies R9
    // while remaining verifiable by the unmodified runtime validator.
    const regHashPayload = {
        abi_version: 'v1',
        entry_count: Object.keys(scenarios).length,
        scenarios,
    };
    const regIntegrity = {
        algorithm: 'SHA256',
        hash: sha256(canonicalJson(regHashPayload)),
        generated_by: { compiler_version: '0.6.0' },
        timestamp: canonicalCompilationTimestamp(),
    };
    const registry = {
        abi_version: 'v1',
        scenarios,
        entry_count: Object.keys(scenarios).length,
        integrity: regIntegrity,
    };
    const content = canonicalJson(registry) + '\n';
    const file = {
        path: 'simulation/scenarios.registry.json',
        content,
        sha256: sha256(content),
        sourceRefs: Object.values(scenarios).map(s => s.source_file),
    };
    return [file];
}
//# sourceMappingURL=simulation.js.map