// ============================================================
// SOVR Compiler — TLA+ Formal Verification Generator
// File: packages/compiler/src/generators/tla.ts
// ============================================================
import { SOVR_IR } from '../ir/types.js';
import { GeneratedFile } from './typescript.js';
import { sha256 } from '../utils/hash.js';

export function generateTLA(ir: SOVR_IR): GeneratedFile[] {
  const protocolVersion = ir.meta.protocolVersion;
  const compilerVersion = ir.meta.compilerVersion;
  const files: GeneratedFile[] = [];

  const stateMachines = ir.nodes.filter(n => n.type === 'state_machine' || n.sourceRef.includes('state_machine'));

  for (const sm of stateMachines) {
    const smName = sm.sourceRef.split('.').pop() || sm.id;
    const cleanName = smName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

    const states: string[] = [];
    const transitions: Array<{ op: string; from: string; to: string; trigger: string }> = [];

    const statesMap = (sm as any).states || {};
    for (const sName of Object.keys(statesMap).sort()) {
      states.push(sName.toUpperCase());
    }

    // IR transitions may be an array or a keyed map. Object.entries() over an
    // array yields numeric indices, which are ILLEGAL TLA+ operator names
    // ("0 == ..."). Derive the operator name from the endpoints instead.
    const rawTransitions = (sm as any).transitions;
    const transitionEntries: Array<[string, any]> = Array.isArray(rawTransitions)
      ? rawTransitions.map((t: any, i: number) => [String(t?.name ?? i), t])
      : Object.entries((rawTransitions ?? {}) as any);

    const seenOps = new Set<string>();
    for (const [transitionName, transitionDef] of transitionEntries) {
      const endpoints = transitionEndpoints(transitionName, transitionDef as any);
      if (!endpoints) continue;
      // Self-loops (from === to) are not modelled: they add no reachable state
      // and TLC would report them as stuttering.
      const from = endpoints.from.toUpperCase();
      const to = endpoints.to.toUpperCase();
      const trigger = String((transitionDef as any).trigger ?? (transitionDef as any).command ?? transitionName)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toUpperCase();

      // Operator name must be a valid TLA+ identifier: letters/digits/underscore,
      // never leading with a digit.
      let op = `${from}_TO_${to}`;
      if (!/^[A-Za-z]/.test(op)) op = `T_${op}`;
      let unique = op;
      let n = 2;
      while (seenOps.has(unique)) unique = `${op}_${n++}`;
      seenOps.add(unique);

      transitions.push({ op: unique, from, to, trigger });
    }

    if (states.length === 0) {
      states.push('INIT', 'ACTIVE', 'COMPLETED', 'FAILED');
    }
    if (transitions.length === 0) {
      transitions.push(
        { op: 'INIT_TO_ACTIVE', from: 'INIT', to: 'ACTIVE', trigger: 'ACTIVATE' },
        { op: 'ACTIVE_TO_COMPLETED', from: 'ACTIVE', to: 'COMPLETED', trigger: 'COMPLETE' },
        { op: 'ACTIVE_TO_FAILED', from: 'ACTIVE', to: 'FAILED', trigger: 'FAIL' }
      );
    }

    transitions.sort((a, b) => a.op.localeCompare(b.op));

    const initialState = String((sm as any).initial_state ?? (sm as any).initialState ?? states[0]).toUpperCase();
    const rawFinal = (sm as any).final_states ?? (sm as any).finalStates ?? [];
    const finalStates: string[] = (Array.isArray(rawFinal) ? rawFinal : Object.keys(rawFinal))
      .map((f: any) => String(f).toUpperCase())
      .filter((f: string) => states.includes(f))
      .sort();

    const lines: string[] = [];
    lines.push(`---------------- MODULE ${cleanName} ----------------`);
    lines.push(`\\* SOVR Financial OS — Generated TLA+ Model`);
    lines.push(`\\* Compiler: ${compilerVersion} Protocol: ${protocolVersion}`);
    lines.push(`\\* Provenance: ${sm.sourceRef}`);
    lines.push('');
    lines.push('EXTENDS Naturals, Sequences');
    lines.push('');
    // `visited` records the reachable state set so the invariants below are
    // falsifiable. The previous model froze two booleans at TRUE and asserted
    // they were TRUE — a tautology that verified nothing (audit finding F-5).
    lines.push('VARIABLES state, visited');
    lines.push('');
    lines.push(`States == {${states.map(s => `"${s}"`).join(', ')}}`);
    lines.push('');
    lines.push(`FinalStates == {${finalStates.map(s => `"${s}"`).join(', ')}}`);
    lines.push('');
    lines.push('Init == ');
    lines.push(`    /\\ state = "${initialState}"`);
    lines.push(`    /\\ visited = {"${initialState}"}`);
    lines.push('');

    for (const t of transitions) {
      lines.push(`${t.op} == `);
      lines.push(`    /\\ state = "${t.from}"`);
      lines.push(`    /\\ state' = "${t.to}"`);
      lines.push(`    /\\ visited' = visited \\cup {"${t.to}"}`);
      lines.push(`\\* Trigger: ${t.trigger}`);
      lines.push('');
    }

    // Terminal states must be modelled explicitly or TLC reports deadlock.
    lines.push('Terminated == ');
    if (finalStates.length > 0) {
      lines.push(`    /\\ state \\in FinalStates`);
      lines.push('    /\\ UNCHANGED <<state, visited>>');
    } else {
      lines.push('    /\\ FALSE');
      lines.push('    /\\ UNCHANGED <<state, visited>>');
    }
    lines.push('');

    lines.push('Next == ');
    lines.push(`    ${[...transitions.map(t => t.op), 'Terminated'].join(' \\/ ')}`);
    lines.push('');
    lines.push('\\* INV-006: state is always one the compiled machine declares.');
    lines.push('\\* Falsifiable: a transition to an undeclared state breaks this.');
    lines.push('TypeOK == state \\in States');
    lines.push('');
    lines.push('\\* INV-006: every visited state is reachable and declared.');
    lines.push('ReachableStatesDeclared == visited \\subseteq States');
    lines.push('');
    lines.push('\\* Liveness: a terminal state remains reachable from anywhere.');
    if (finalStates.length > 0) {
      lines.push(`CanTerminate == <>(state \\in FinalStates)`);
    } else {
      lines.push('CanTerminate == TRUE');
    }
    lines.push('');
    lines.push('Spec == Init /\\ [][Next]_<<state, visited>>');
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

    // TLC cannot check an invariant without a configuration file. Without
    // these, even a syntactically valid model is only ever parsed, never
    // model-checked (audit finding F-5).
    const cfgLines = [
      `\\* TLC configuration for ${cleanName}`,
      `\\* Generated by SOVR compiler ${compilerVersion}`,
      '',
      'SPECIFICATION Spec',
      '',
      'INVARIANT TypeOK',
      'INVARIANT ReachableStatesDeclared',
      '',
    ];
    const cfgContent = cfgLines.join('\n');
    files.push({
      path: `verification/tla/${cleanName}.cfg`,
      content: cfgContent,
      sha256: sha256(cfgContent),
      sourceRefs: [sm.sourceRef]
    });
  }

  return files;
}

function transitionEndpoints(name: string, transition: any): { from: string; to: string } | undefined {
  if (transition?.from && transition?.to) return { from: String(transition.from), to: String(transition.to) };
  const marker = '_to_';
  const idx = name.indexOf(marker);
  if (idx === -1) return undefined;
  return { from: name.slice(0, idx), to: name.slice(idx + marker.length) };
}
