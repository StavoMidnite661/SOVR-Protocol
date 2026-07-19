export function validateReferences(parsed) {
    const diagnostics = [];
    const files = parsed.files;
    // Build indexes
    const entities = new Set();
    const commands = new Set();
    const events = new Set();
    const capabilities = new Set();
    const invariants = new Set();
    const domains = new Set(['vault', 'ledger', 'treasury', 'payment', 'identity', 'policy', 'intent', 'agent', 'governance']);
    let commandCatalog = null;
    let eventCatalog = null;
    let capabilityCatalog = null;
    let domainModel = null;
    let stateMachines = null;
    let sagaCatalog = null;
    let constitution = null;
    for (const f of files) {
        if (f.relativePath.includes('02_domain-model'))
            domainModel = f.parsed;
        if (f.relativePath.includes('03_command-catalog'))
            commandCatalog = f.parsed;
        if (f.relativePath.includes('04_event-catalog'))
            eventCatalog = f.parsed;
        if (f.relativePath.includes('05_state-machines'))
            stateMachines = f.parsed;
        if (f.relativePath.includes('08_security-capabilities'))
            capabilityCatalog = f.parsed;
        if (f.relativePath.includes('09_saga-orchestration'))
            sagaCatalog = f.parsed;
        if (f.relativePath.includes('01_constitution'))
            constitution = f.parsed;
    }
    if (domainModel?.domains) {
        for (const [dName, dDef] of Object.entries(domainModel.domains)) {
            domains.add(dName);
            const entitiesMap = dDef.entities || {};
            for (const eName of Object.keys(entitiesMap)) {
                entities.add(`${dName}.${eName}`);
                entities.add(eName);
            }
        }
    }
    if (commandCatalog?.commands) {
        for (const k of Object.keys(commandCatalog.commands))
            commands.add(k);
    }
    if (eventCatalog?.events) {
        for (const k of Object.keys(eventCatalog.events))
            events.add(k);
    }
    // Event envelope check
    const envelopeFields = eventCatalog?.event_envelope?.fields ? Object.keys(eventCatalog.event_envelope.fields) : [];
    if (envelopeFields.length < 10) {
        diagnostics.push({
            code: 'SEM-003',
            category: 'SEMANTIC',
            severity: 'ERROR',
            stage: 'PASS-008',
            file: '04_event-catalog.yaml',
            message: `Event envelope incomplete expected >=10 got ${envelopeFields.length}`,
            action: 'ABORT_WITH_VALIDATION_ERROR',
        });
    }
    if (capabilityCatalog?.capabilities) {
        for (const cap of capabilityCatalog.capabilities) {
            if (cap.capability_id)
                capabilities.add(cap.capability_id);
        }
    }
    if (constitution?.invariants) {
        for (const inv of constitution.invariants)
            invariants.add(inv.id);
    }
    // Validate command -> event references
    if (commandCatalog?.commands && eventCatalog?.events) {
        for (const [cmdName, cmdDef] of Object.entries(commandCatalog.commands)) {
            const result = cmdDef.resulting_events || {};
            const allEvents = [
                ...(result.success || []),
                ...(result.failure || []),
                ...(result.conditional || []),
                ...(cmdDef.produces_events || []),
            ];
            for (const ev of allEvents) {
                if (!events.has(ev)) {
                    diagnostics.push({
                        code: 'REF-003',
                        category: 'REFERENCE',
                        severity: 'WARNING',
                        stage: 'PASS-006',
                        file: '03_command-catalog.yaml',
                        message: `Command ${cmdName} references unknown event ${ev}`,
                        action: 'REPORT_WARNINGS',
                        findingRef: 'G-09',
                    });
                }
            }
            const cap = cmdDef.authorization_requirements?.capability || cmdDef.issuer?.minimum_capability;
            if (cap && cap !== 'system.internal' && !cap.includes('varies') && !cap.includes('*') && !capabilities.has(cap)) {
                diagnostics.push({
                    code: 'REF-004',
                    category: 'REFERENCE',
                    severity: 'ERROR',
                    stage: 'PASS-006',
                    file: '03_command-catalog.yaml',
                    message: `Command ${cmdName} requires unknown capability ${cap}`,
                    action: 'ABORT_WITH_RESOLUTION_ERROR',
                });
            }
            // Gates completeness
            const gates = cmdDef.constitutional_gates;
            if (!gates || gates.identity_required === undefined) {
                diagnostics.push({
                    code: 'SEM-004',
                    category: 'SEMANTIC',
                    severity: 'ERROR',
                    stage: 'PASS-008',
                    file: '03_command-catalog.yaml',
                    message: `Command ${cmdName} missing constitutional_gates`,
                    action: 'ABORT_WITH_VALIDATION_ERROR',
                });
            }
        }
    }
    // Validate state machine command references
    if (stateMachines?.state_machines && commandCatalog?.commands) {
        for (const [smName, smDef] of Object.entries(stateMachines.state_machines)) {
            const states = smDef.states || {};
            for (const [sName, sDef] of Object.entries(states)) {
                const allowed = sDef.allowed_commands || [];
                for (const cmd of allowed) {
                    if (typeof cmd === 'string' && !commands.has(cmd) && !cmd.startsWith('system ') && !cmd.includes(' ')) {
                        // Allow some internal
                        if (!['vault.transaction.fund', 'vault.transaction.cancel', 'vault.transaction.authorize_release', 'vault.transaction.disburse', 'vault.transfer.request', 'vault.ownership.transfer', 'vault.asset.write_down', 'governance.proposal.implement', 'governance.proposal.cancel', 'agent.suspend', 'payment.execution.prepare', 'payment.adapter.disable', 'saga.compensate'].includes(cmd)) {
                            diagnostics.push({
                                code: 'REF-002',
                                category: 'REFERENCE',
                                severity: 'WARNING',
                                stage: 'PASS-006',
                                file: '05_state-machines.yaml',
                                message: `State machine ${smName} state ${sName} references unknown command ${cmd}`,
                                action: 'REPORT_WARNINGS',
                                findingRef: 'AMD-0003',
                            });
                        }
                    }
                }
            }
        }
    }
    // Domain resolution
    for (const d of domains) {
        // enforced via PROTOCOL/DOMAIN_REGISTRY.yaml elsewhere
    }
    // Invariant references
    if (constitution) {
        // All invariants should be INV-001..INV-010
        const expected = Array.from({ length: 10 }, (_, i) => `INV-${String(i + 1).padStart(3, '0')}`);
        for (const exp of expected) {
            if (!invariants.has(exp)) {
                diagnostics.push({
                    code: 'INV-003',
                    category: 'INVARIANT',
                    severity: 'ERROR',
                    stage: 'PASS-009',
                    file: '01_constitution.yaml',
                    message: `Missing invariant ${exp}`,
                    action: 'ABORT_WITH_VALIDATION_ERROR',
                });
            }
        }
    }
    // Sort diagnostics for reproducibility: file, line, code
    diagnostics.sort((a, b) => {
        if (a.file !== b.file)
            return a.file.localeCompare(b.file);
        if ((a.line || 0) !== (b.line || 0))
            return (a.line || 0) - (b.line || 0);
        return a.code.localeCompare(b.code);
    });
    return diagnostics;
}
//# sourceMappingURL=validate.js.map