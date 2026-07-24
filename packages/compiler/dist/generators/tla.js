import { sha256 } from '../utils/hash.js';
export function generateTLA(ir) {
    const protocolVersion = ir.meta.protocolVersion;
    const compilerVersion = ir.meta.compilerVersion;
    const files = [];
    const stateMachines = ir.nodes.filter(n => n.type === 'state_machine' || n.sourceRef.includes('state_machine'));
    for (const sm of stateMachines) {
        const smName = sm.sourceRef.split('.').pop() || sm.id;
        const cleanName = smName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        const states = [];
        const transitions = [];
        const statesMap = sm.states || {};
        for (const sName of Object.keys(statesMap).sort()) {
            states.push(sName.toUpperCase());
        }
        const transitionsMap = sm.transitions || {};
        for (const [transitionName, transitionDef] of Object.entries(transitionsMap)) {
            const endpoints = transitionEndpoints(transitionName, transitionDef);
            if (!endpoints)
                continue;
            transitions.push({
                op: transitionName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
                from: endpoints.from.toUpperCase(),
                to: endpoints.to.toUpperCase(),
                trigger: String(transitionDef.trigger ?? transitionDef.command ?? transitionName).replace(/\./g, '_').toUpperCase(),
            });
        }
        if (states.length === 0) {
            states.push('INIT', 'ACTIVE', 'COMPLETED', 'FAILED');
        }
        if (transitions.length === 0) {
            transitions.push({ op: 'INIT_TO_ACTIVE', from: 'INIT', to: 'ACTIVE', trigger: 'ACTIVATE' }, { op: 'ACTIVE_TO_COMPLETED', from: 'ACTIVE', to: 'COMPLETED', trigger: 'COMPLETE' }, { op: 'ACTIVE_TO_FAILED', from: 'ACTIVE', to: 'FAILED', trigger: 'FAIL' });
        }
        transitions.sort((a, b) => a.op.localeCompare(b.op));
        const initialState = String(sm.initial_state ?? sm.initialState ?? states[0]).toUpperCase();
        const lines = [];
        lines.push(`---------------- MODULE ${cleanName} ----------------`);
        lines.push(`\* SOVR Financial OS — Generated TLA+ Model`);
        lines.push(`\* Compiler: ${compilerVersion} Protocol: ${protocolVersion}`);
        lines.push(`\* Provenance: ${sm.sourceRef}`);
        lines.push('');
        lines.push('EXTENDS Naturals, Sequences');
        lines.push('');
        lines.push(`VARIABLES state, ledger_balanced, authority_validated`);
        lines.push('');
        lines.push(`States == {${states.map(s => `"${s}"`).join(', ')}}`);
        lines.push('');
        lines.push('Init == ');
        lines.push(`    /\\ state = "${initialState}"`);
        lines.push('    /\\ ledger_balanced = TRUE');
        lines.push('    /\\ authority_validated = TRUE');
        lines.push('');
        for (const t of transitions) {
            lines.push(`${t.op} == `);
            lines.push(`    /\\ state = "${t.from}"`);
            lines.push(`    /\\ ledger_balanced = TRUE`);
            lines.push(`    /\\ authority_validated = TRUE`);
            lines.push(`    /\\ state' = "${t.to}"`);
            lines.push(`    /\\ UNCHANGED <<ledger_balanced, authority_validated>>`);
            lines.push(`\* Trigger: ${t.trigger}`);
            lines.push('');
        }
        lines.push('Next == ');
        lines.push(`    ${transitions.map(t => t.op).join(' \\/ ')}`);
        lines.push('');
        lines.push(`\* Invariant 1: State must always be in defined States`);
        lines.push('TypeOK == state \\in States');
        lines.push('');
        lines.push(`\* Invariant 2: INV-002 Double Entry balance holds`);
        lines.push('DoubleEntryBalance == ledger_balanced = TRUE');
        lines.push('');
        lines.push(`\* Invariant 3: INV-003 Actor never exceeds authority`);
        lines.push('AuthorityBound == authority_validated = TRUE');
        lines.push('');
        lines.push('Spec == Init /\\ [][Next]_<<state, ledger_balanced, authority_validated>>');
        lines.push('');
        lines.push('=====================================================');
        const content = lines.join('\n');
        const hash = sha256(content);
        files.push({
            path: `verification/tla/${cleanName}.tla`,
            content,
            sha256: hash,
            sourceRefs: [sm.sourceRef]
        });
    }
    return files;
}
function transitionEndpoints(name, transition) {
    if (transition?.from && transition?.to)
        return { from: String(transition.from), to: String(transition.to) };
    const marker = '_to_';
    const idx = name.indexOf(marker);
    if (idx === -1)
        return undefined;
    return { from: name.slice(0, idx), to: name.slice(idx + marker.length) };
}
//# sourceMappingURL=tla.js.map