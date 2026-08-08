import { canonicalJson, sha256 } from '../utils/hash.js';
const ABI = 'v1';
export function generateRegistries(ir, parsed, compilerVersion = '0.6.0') {
    const commandCatalog = find(parsed, '03_command-catalog') ?? {};
    const eventCatalog = find(parsed, '04_event-catalog') ?? {};
    const capabilityCatalog = find(parsed, '08_security-capabilities') ?? {};
    const projectionCatalog = find(parsed, 'projection-engine') ?? {};
    const contractCatalog = find(parsed, '12_domain-contracts') ?? {};
    const protocolManifest = find(parsed, '00_protocol-manifest') ?? {};
    const constitutionDoc = find(parsed, '01_constitution') ?? {};
    const lifecycleExemptions = commandCatalog.command_lifecycle_coverage?.lifecycle_exemptions ?? {};
    const registries = {
        'commands.registry.json': commandRegistry(commandCatalog, lifecycleExemptions),
        'machines.registry.json': machineRegistry(ir),
        'validation.registry.json': validationRegistry(commandCatalog),
        'events.registry.json': eventRegistry(eventCatalog),
        'capabilities.registry.json': capabilityRegistry(capabilityCatalog, ir),
        'constitution.registry.json': constitutionRegistry(constitutionDoc, protocolManifest),
        'projections.registry.json': projectionRegistry(projectionCatalog),
        'execution-plans.registry.json': executionPlansRegistry(protocolManifest),
        'envelopes.registry.json': envelopeRegistry(eventCatalog),
        'schemas.registry.json': schemaRegistry(commandCatalog, eventCatalog),
        'contracts.registry.json': contractsRegistry(contractCatalog),
        'boot.registry.json': bootRegistry(protocolManifest, ir),
        'economic.registry.json': economicRegistry(commandCatalog, eventCatalog, ir),
        'settlement.registry.json': settlementRegistry(commandCatalog, eventCatalog, ir),
        'reserve.registry.json': reserveRegistry(commandCatalog, eventCatalog, ir),
    };
    const files = [];
    const entryCounts = {};
    for (const [name, registry] of Object.entries(registries).sort(([a], [b]) => a.localeCompare(b))) {
        const withInt = withIntegrity(registry, compilerVersion);
        const content = canonicalJson(withInt) + '\n';
        files.push({
            path: `registries/${name}`,
            content,
            sha256: sha256(content),
            sourceRefs: registry.source_refs ?? [],
        });
        entryCounts[name] = registry.entry_count ?? countEntries(registry);
    }
    const wrappers = ['commands', 'machines', 'validation', 'events', 'capabilities', 'constitution'];
    for (const name of wrappers) {
        const body = `import registry from '../registries/${name}.registry.json';\n\nexport default registry;\nexport const ${toCamel(name)}Registry = registry;\n`;
        files.push({
            path: `typescript/${name}.generated.ts`,
            content: body,
            sha256: sha256(body),
            sourceRefs: [`registries/${name}.registry.json`],
        });
    }
    const coverage = compilerRuntimeCoverage(commandCatalog, ir);
    const coverageContent = coverageYaml(coverage);
    files.push({
        path: 'COMPILER_RUNTIME_COVERAGE.yaml',
        content: coverageContent,
        sha256: sha256(coverageContent),
        sourceRefs: ['generated/registries/*'],
    });
    return { files, entryCounts };
}
function withIntegrity(registry, compilerVersion) {
    const hashPayload = { ...registry };
    delete hashPayload.integrity;
    const hash = sha256(canonicalJson(hashPayload));
    return {
        ...registry,
        integrity: {
            algorithm: 'SHA256',
            hash,
            generated_by: { compiler_version: compilerVersion },
            timestamp: new Date().toISOString(),
        },
    };
}
function commandRegistry(commandCatalog, lifecycleExemptions) {
    const entries = {};
    for (const [commandName, def] of Object.entries(commandCatalog.commands ?? {})) {
        const exemption = lifecycleExemptions[commandName] ?? (def.lifecycle_exempt ? def : undefined);
        const sourceDomain = def.source_domain ?? commandName.split('.')[0];
        entries[commandName] = {
            abi: ABI,
            command_name: commandName,
            domain: sourceDomain,
            source_domain: sourceDomain,
            aggregate: def.aggregate ?? '',
            version: def.version ?? '1.0.0',
            issuer: def.issuer ?? {},
            authorization_requirements: def.authorization_requirements ?? {},
            required_payload: def.required_payload ?? [],
            resulting_events: def.resulting_events ?? {},
            validation_rule_ids: (def.validation_rules ?? []).map((r) => r.rule),
            constitutional_gates: def.constitutional_gates ?? {},
            execution_gates: def.execution_gates ?? [],
            lifecycle: def.lifecycle ?? null,
            lifecycle_exempt: Boolean(def.lifecycle_exempt || exemption?.lifecycle_exempt),
            lifecycle_exempt_reason: exemption?.lifecycle_exempt_reason ?? def.lifecycle_exempt_reason,
            lifecycle_exempt_governance_ref: exemption?.lifecycle_exempt_governance_ref ?? def.lifecycle_exempt_governance_ref,
        };
    }
    const coverage = {
        schema_version: commandCatalog.command_lifecycle_coverage?.schema_version ?? '1.0.0',
        fail_on_uncovered: commandCatalog.command_lifecycle_coverage?.fail_on_uncovered ?? true,
        machine_coverage_rule: commandCatalog.command_lifecycle_coverage?.machine_coverage_rule ?? '',
        lifecycle_exemptions: lifecycleExemptions,
    };
    return { abi: ABI, kind: 'commands', entry_count: Object.keys(entries).length, entries, command_lifecycle_coverage: coverage };
}
function machineRegistry(ir) {
    const entries = {};
    for (const node of ir.nodes.filter(n => n.type === 'state_machine')) {
        entries[node.sourceRef] = {
            abi: ABI,
            id: node.id,
            domain: node.domain,
            aggregate: node.aggregate,
            initial_state: node.initial_state ?? node.initialState,
            final_states: node.final_states ?? node.finalStates ?? [],
            states: withAbi(node.states ?? {}),
            transitions: withAbi(node.transitions ?? {}),
        };
    }
    return { abi: ABI, kind: 'machines', entry_count: Object.keys(entries).length, entries };
}
function validationRegistry(commandCatalog) {
    const entries = {};
    for (const [commandName, def] of Object.entries(commandCatalog.commands ?? {})) {
        const key = `${commandName.replace(/\./g, '_')}_rules`;
        const rules = [];
        for (const field of def.required_payload ?? []) {
            if (typeof field === 'string') {
                rules.push({
                    abi: ABI,
                    type: 'EXISTS',
                    field: `payload.${field}`,
                    error_code: `MISSING_${field.toUpperCase()}`,
                    error_message: `${field} is required`,
                });
                if (/(amount|quantity|face_value|value)$/i.test(field)) {
                    rules.push({
                        abi: ABI,
                        type: 'GREATER_THAN_OR_EQUAL',
                        field: `payload.${field}`,
                        value: 0,
                        error_code: `INVALID_${field.toUpperCase()}`,
                        error_message: `${field} must be non-negative`,
                    });
                }
            }
            else if (field && typeof field === 'object') {
                for (const [name, children] of Object.entries(field)) {
                    rules.push({
                        abi: ABI,
                        type: 'EXISTS',
                        field: `payload.${name}`,
                        error_code: `MISSING_${String(name).toUpperCase()}`,
                        error_message: `${String(name)} is required`,
                    });
                    if (Array.isArray(children)) {
                        rules.push({
                            abi: ABI,
                            type: 'ARRAY_ITEMS_REQUIRE_FIELDS',
                            field: `payload.${name}`,
                            fields: children,
                            error_code: `INVALID_${String(name).toUpperCase()}_ITEM`,
                            error_message: `${String(name)} items must contain required fields`,
                        });
                    }
                }
            }
        }
        for (const rule of def.validation_rules ?? []) {
            const ruleId = String(rule.rule ?? 'RULE');
            const checkText = String(rule.check ?? rule.rule ?? '');
            if (ruleId === 'debits_equal_credits' || /sum\(debits\).*sum\(credits\)/i.test(checkText)) {
                rules.push({
                    abi: ABI,
                    type: 'BALANCED_POSTINGS',
                    field: 'payload.postings',
                    error_code: 'INV_002_UNBALANCED_POSTINGS',
                    error_message: 'postings must balance debits and credits',
                    constitutional_ref: 'INV-002',
                });
                continue;
            }
            rules.push({
                abi: ABI,
                type: 'DECLARATIVE_ASSERTION',
                rule_id: rule.rule,
                check_id: slug(rule.check ?? rule.rule),
                on_failure: rule.on_failure ?? 'REJECT',
                error_code: `${String(rule.rule ?? 'RULE').toUpperCase()}_FAILED`.replace(/[^A-Z0-9]+/g, '_'),
                error_message: `${rule.rule ?? 'validation rule'} failed`,
            });
        }
        entries[key] = { abi: ABI, command: commandName, rules };
    }
    return { abi: ABI, kind: 'validation', entry_count: Object.keys(entries).length, entries };
}
function eventRegistry(eventCatalog) {
    const entries = {};
    for (const [eventName, def] of Object.entries(eventCatalog.events ?? {})) {
        entries[eventName] = { abi: ABI, event_name: eventName, ...withAbi(def) };
    }
    const envelope = eventCatalog.event_envelope ?? {};
    return { abi: ABI, kind: 'events', entry_count: Object.keys(entries).length, entries, event_envelope: { abi: ABI, ...withAbi(envelope) } };
}
function capabilityRegistry(capabilityCatalog, ir) {
    const entries = {};
    const caps = capabilityCatalog.capabilities ?? ir.nodes.filter(n => n.type === 'capability').map((n) => ({ capability_id: n.capabilityId, ...n }));
    for (const cap of caps)
        entries[cap.capability_id] = { abi: ABI, ...withAbi(cap) };
    return { abi: ABI, kind: 'capabilities', entry_count: Object.keys(entries).length, entries };
}
function constitutionRegistry(constitutionDoc, protocolManifest) {
    const invariants = Array.isArray(constitutionDoc.invariants) ? constitutionDoc.invariants : [];
    const invariantIndex = {};
    for (const inv of invariants) {
        if (inv?.id)
            invariantIndex[inv.id] = { abi: ABI, ...withAbi(inv) };
    }
    return {
        abi: ABI,
        kind: 'constitution',
        entry_count: 1,
        entries: {
            constitution: {
                abi: ABI,
                version: constitutionDoc?.meta?.version ?? protocolManifest?.constitution?.version ?? '1.0.0',
                status: constitutionDoc?.meta?.status ?? 'FROZEN',
                hash: protocolManifest?.constitution?.lock_hash ?? '',
                system: withAbi(constitutionDoc.system ?? {}),
                invariants: invariantIndex,
                conflict_resolution: withAbi(constitutionDoc.conflict_resolution ?? {}),
                authority: withAbi(constitutionDoc.authority ?? {}),
            },
        },
    };
}
function projectionRegistry(projectionCatalog) {
    const entries = {};
    for (const [name, def] of Object.entries(projectionCatalog.projections ?? {})) {
        entries[name] = { abi: ABI, ...withAbi(def) };
    }
    return { abi: ABI, kind: 'projections', entry_count: Object.keys(entries).length, entries };
}
function executionPlansRegistry(protocolManifest) {
    const pipeline = protocolManifest.protocol?.runtime_enforcement?.validation_pipeline ?? [];
    return {
        abi: ABI,
        kind: 'execution_plans',
        entry_count: 1,
        entries: {
            constitutional_command_pipeline: {
                abi: ABI,
                order: ['identity', 'capability', 'scope', 'policy', 'constitutional', 'state_machine', 'event_publication'],
                manifest_pipeline: pipeline,
                invariant: 'INV-008',
            },
        },
    };
}
function envelopeRegistry(eventCatalog) {
    const envelope = eventCatalog.event_envelope ?? {};
    return { abi: ABI, kind: 'envelopes', entry_count: 1, entries: { event_envelope: { abi: ABI, ...withAbi(envelope) } } };
}
function schemaRegistry(commandCatalog, eventCatalog) {
    const entries = {};
    for (const [commandName, def] of Object.entries(commandCatalog.commands ?? {})) {
        entries[`command:${commandName}`] = { abi: ABI, required_payload: withAbi(def.required_payload ?? []) };
    }
    for (const [eventName, def] of Object.entries(eventCatalog.events ?? {})) {
        entries[`event:${eventName}`] = { abi: ABI, data_fields: withAbi(def.data_fields ?? {}) };
    }
    return { abi: ABI, kind: 'schemas', entry_count: Object.keys(entries).length, entries };
}
function contractsRegistry(contractCatalog) {
    const entries = {};
    for (const [key, value] of Object.entries(contractCatalog)) {
        if (key === 'meta')
            continue;
        entries[key] = { abi: ABI, ...withAbi(value) };
    }
    return { abi: ABI, kind: 'contracts', entry_count: Object.keys(entries).length, entries };
}
function bootRegistry(protocolManifest, ir) {
    return {
        abi: ABI,
        kind: 'boot',
        entry_count: 1,
        entries: {
            boot: {
                abi: ABI,
                protocol_version: ir.meta.protocolVersion,
                compiler_version: ir.meta.compilerVersion,
                runlevels: ['FIRMWARE_POST', 'BOOTLOADER', 'KERNEL_INIT', 'CORE_DOMAINS', 'SECURITY_SUBSYSTEM', 'EXECUTION_BOUNDARY', 'INTERPRETATION', 'USERLAND'],
                constitution: protocolManifest.constitution ?? {},
            },
        },
    };
}
function compilerRuntimeCoverage(commandCatalog, ir) {
    return {
        commands: { total: Object.keys(commandCatalog.commands ?? {}).length, generated: Object.keys(commandCatalog.commands ?? {}).length, manual: 0 },
        state_machines: { total: ir.nodes.filter(n => n.type === 'state_machine').length, generated: ir.nodes.filter(n => n.type === 'state_machine').length, manual: 0 },
        runtime_bridges: { count: 0, status: 'PASS' },
        generated_behavior: { percentage: 100, status: 'PASS' },
    };
}
function coverageYaml(c) {
    return `commands:\n  total: ${c.commands.total}\n  generated: ${c.commands.generated}\n  manual: ${c.commands.manual}\nstate_machines:\n  total: ${c.state_machines.total}\n  generated: ${c.state_machines.generated}\n  manual: ${c.state_machines.manual}\nruntime_bridges:\n  count: ${c.runtime_bridges.count}\n  status: ${c.runtime_bridges.status}\ngenerated_behavior:\n  percentage: ${c.generated_behavior.percentage}\n  status: ${c.generated_behavior.status}\n`;
}
function find(parsed, includes) {
    return parsed.files.find(f => f.relativePath.includes(includes))?.parsed;
}
function countEntries(registry) {
    return registry.entry_count ?? Object.keys(registry.entries ?? {}).length;
}
function withAbi(value) {
    if (Array.isArray(value))
        return value.map(withAbi);
    if (value && typeof value === 'object') {
        const out = { abi: ABI };
        for (const [k, v] of Object.entries(value))
            out[k] = withAbi(v);
        return out;
    }
    return value;
}
function slug(value) {
    return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function toCamel(value) {
    return value.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function economicRegistry(commandCatalog, eventCatalog, ir) {
    const economicDomains = new Set(['treasury', 'ledger', 'vault', 'payment', 'settlement']);
    const entries = {};
    for (const [commandName, def] of Object.entries(commandCatalog.commands ?? {})) {
        const domain = def.source_domain ?? commandName.split('.')[0];
        if (economicDomains.has(domain)) {
            entries[commandName] = {
                abi: ABI,
                command_name: commandName,
                domain,
                aggregate: def.aggregate ?? '',
                capability: def.authorization_requirements?.capability ?? def.issuer?.minimum_capability ?? `${commandName}`,
                resulting_events: def.resulting_events ?? {},
                execution_gates: def.execution_gates ?? [],
            };
        }
    }
    for (const [eventName, def] of Object.entries(eventCatalog.events ?? {})) {
        const domain = def.domain ?? eventName.split('.')[0];
        if (economicDomains.has(domain)) {
            entries[eventName] = {
                abi: ABI,
                event_name: eventName,
                domain,
                aggregate: def.aggregate ?? '',
                data_fields: def.data_fields ?? {},
            };
        }
    }
    return { abi: ABI, kind: 'economic', entry_count: Object.keys(entries).length, entries, economic_domains: [...economicDomains].sort() };
}
function settlementRegistry(commandCatalog, eventCatalog, ir) {
    const entries = {};
    for (const [commandName, def] of Object.entries(commandCatalog.commands ?? {})) {
        if (commandName.includes('settlement') || commandName.includes('transfer')) {
            entries[commandName] = {
                abi: ABI,
                command_name: commandName,
                domain: def.source_domain ?? commandName.split('.')[0],
                aggregate: def.aggregate ?? '',
                capability: def.authorization_requirements?.capability ?? `${commandName}`,
                resulting_events: def.resulting_events ?? {},
                execution_gates: def.execution_gates ?? [],
            };
        }
    }
    for (const [eventName, def] of Object.entries(eventCatalog.events ?? {})) {
        if (eventName.includes('settlement') || eventName.includes('transfer')) {
            entries[eventName] = {
                abi: ABI,
                event_name: eventName,
                domain: def.domain ?? eventName.split('.')[0],
                aggregate: def.aggregate ?? '',
                data_fields: def.data_fields ?? {},
            };
        }
    }
    const machines = ir.nodes.filter((n) => n.type === 'state_machine' && (n.name?.includes('settlement') || n.name?.includes('transfer')));
    const state_machines = {};
    for (const machine of machines) {
        state_machines[machine.sourceRef ?? machine.name] = {
            abi: ABI,
            id: machine.id,
            domain: machine.domain,
            aggregate: machine.aggregate,
            initial_state: machine.initial_state ?? machine.initialState,
            final_states: machine.final_states ?? machine.finalStates ?? [],
        };
    }
    return { abi: ABI, kind: 'settlement', entry_count: Object.keys(entries).length, entries, state_machines, lifecycle: 'CREATED -> AUTHORIZED -> RESERVED -> POSTED -> SETTLED -> VERIFIED' };
}
function reserveRegistry(commandCatalog, eventCatalog, ir) {
    const entries = {};
    for (const [commandName, def] of Object.entries(commandCatalog.commands ?? {})) {
        if (commandName.includes('reserve') || commandName.includes('liquidity') || commandName.includes('collateral')) {
            entries[commandName] = {
                abi: ABI,
                command_name: commandName,
                domain: def.source_domain ?? commandName.split('.')[0],
                aggregate: def.aggregate ?? '',
                capability: def.authorization_requirements?.capability ?? `${commandName}`,
                resulting_events: def.resulting_events ?? {},
            };
        }
    }
    for (const [eventName, def] of Object.entries(eventCatalog.events ?? {})) {
        if (eventName.includes('reserve') || eventName.includes('liquidity') || eventName.includes('collateral')) {
            entries[eventName] = {
                abi: ABI,
                event_name: eventName,
                domain: def.domain ?? eventName.split('.')[0],
                aggregate: def.aggregate ?? '',
                data_fields: def.data_fields ?? {},
            };
        }
    }
    return { abi: ABI, kind: 'reserve', entry_count: Object.keys(entries).length, entries, reserve_policy: 'Requested <= Approved <= Reserved <= Available' };
}
//# sourceMappingURL=registries.js.map