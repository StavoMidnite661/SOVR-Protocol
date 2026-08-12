import { ParsedProtocol } from './parse.js';
import { Diagnostic } from '../ir/types.js';

export function validateReferences(parsed: ParsedProtocol): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const files = parsed.files;

  // Build indexes
  const entities = new Set<string>();
  const commands = new Set<string>();
  const events = new Set<string>();
  const capabilities = new Set<string>();
  const invariants = new Set<string>();
  const domains = new Set<string>(['vault','ledger','treasury','payment','identity','policy','intent','agent','governance']);

  let commandCatalog: any = null;
  let eventCatalog: any = null;
  let capabilityCatalog: any = null;
  let domainModel: any = null;
  let stateMachines: any = null;
  let sagaCatalog: any = null;
  let constitution: any = null;

  for (const f of files) {
    if (f.relativePath.includes('02_domain-model')) domainModel = f.parsed;
    if (f.relativePath.includes('03_command-catalog')) commandCatalog = f.parsed;
    if (f.relativePath.includes('04_event-catalog')) eventCatalog = f.parsed;
    if (f.relativePath.includes('05_state-machines')) stateMachines = f.parsed;
    if (f.relativePath.includes('08_security-capabilities')) capabilityCatalog = f.parsed;
    if (f.relativePath.includes('09_saga-orchestration')) sagaCatalog = f.parsed;
    if (f.relativePath.includes('01_constitution')) constitution = f.parsed;
  }

  if (domainModel?.domains) {
    for (const [dName, dDef] of Object.entries(domainModel.domains as any)) {
      domains.add(dName);
      const entitiesMap = (dDef as any).entities || {};
      for (const eName of Object.keys(entitiesMap)) {
        entities.add(`${dName}.${eName}`);
        entities.add(eName);
      }
    }
  }

  if (commandCatalog?.commands) {
    for (const k of Object.keys(commandCatalog.commands)) commands.add(k);
  }

  if (eventCatalog?.events) {
    for (const k of Object.keys(eventCatalog.events)) events.add(k);
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
      if (cap.capability_id) capabilities.add(cap.capability_id);
    }
  }

  if (constitution?.invariants) {
    for (const inv of constitution.invariants) invariants.add(inv.id);
  }

  // Validate command -> event references
  if (commandCatalog?.commands && eventCatalog?.events) {
    for (const [cmdName, cmdDef] of Object.entries(commandCatalog.commands as any)) {
      const result = (cmdDef as any).resulting_events || {};
      const allEvents = [
        ...(result.success || []),
        ...(result.failure || []),
        ...(result.conditional || []),
        ...((cmdDef as any).produces_events || []),
      ];
      for (const ev of allEvents) {
        if (!events.has(ev)) {
          diagnostics.push({
            code: 'REF-003',
            category: 'REFERENCE',
            severity: 'ERROR',
            stage: 'PASS-006',
            file: '03_command-catalog.yaml',
            message: `Command ${cmdName} references unknown event ${ev}`,
            action: 'ABORT_WITH_RESOLUTION_ERROR',
            findingRef: 'G-09',
          });
        }
      }
      const cap = (cmdDef as any).authorization_requirements?.capability || (cmdDef as any).issuer?.minimum_capability;
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
      const gates = (cmdDef as any).constitutional_gates;
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
    for (const [smName, smDef] of Object.entries(stateMachines.state_machines as any)) {
      const states = (smDef as any).states || {};
      for (const [sName, sDef] of Object.entries(states as any)) {
        const allowed = (sDef as any).allowed_commands || [];
        for (const cmd of allowed) {
          if (typeof cmd === 'string' && !commands.has(cmd) && !cmd.startsWith('system ') && !cmd.includes(' ')) {
            diagnostics.push({
              code: 'REF-002',
              category: 'REFERENCE',
              severity: 'ERROR',
              stage: 'PASS-006',
              file: '05_state-machines.yaml',
              message: `State machine ${smName} state ${sName} references unknown command ${cmd}`,
              action: 'ABORT_WITH_RESOLUTION_ERROR',
              findingRef: 'AMD-0003',
            });
          }
        }
      }
      const transitions = (smDef as any).transitions || {};
      const transitionsList: Array<[string, any]> = Array.isArray(transitions)
        ? transitions.map((t: any, i: number) => [String(i), t] as [string, any])
        : Object.entries(transitions as any);
      for (const [tName, tDef] of transitionsList) {
        const cmd = (tDef as any).command;
        if (typeof cmd === 'string' && !commands.has(cmd) && !cmd.startsWith('system ') && !cmd.includes(' ')) {
          diagnostics.push({
            code: 'REF-002',
            category: 'REFERENCE',
            severity: 'ERROR',
            stage: 'PASS-006',
            file: '05_state-machines.yaml',
            message: `State machine ${smName} transition ${tName} references unknown command ${cmd}`,
            action: 'ABORT_WITH_RESOLUTION_ERROR',
            findingRef: 'AMD-0003',
          });
        }
      }
    }
  }

  // REF-005: saga step command references. Live sagas are executable
  // orchestration authority — an unresolved step command is a broken
  // deployment, so it fails the build. saga_templates are documentary
  // patterns until instantiated; unresolved references there are reported
  // loudly but do not halt compilation.
  if (sagaCatalog) {
    const checkSteps = (list: any[], source: string, severity: 'ERROR' | 'WARNING') => {
      const seen = new Set<string>();
      for (const saga of list) {
        for (const step of (saga?.steps ?? [])) {
          const cmd = step?.command;
          if (typeof cmd !== 'string' || !cmd) continue;
          if (cmd.startsWith('system.internal.') || cmd.startsWith('system ') || cmd.includes(' ')) continue;
          if (commands.has(cmd)) continue;
          const key = `${source}:${saga?.saga_id ?? '?'}:${cmd}`;
          if (seen.has(key)) continue;
          seen.add(key);
          diagnostics.push({
            code: 'REF-005',
            category: 'REFERENCE',
            severity,
            stage: 'PASS-006',
            file: '09_saga-orchestration.yaml',
            message: `${source} ${saga?.saga_id ?? '?'} step references unknown command ${cmd}`,
            action: severity === 'ERROR' ? 'ABORT_WITH_RESOLUTION_ERROR' : 'REPORT_WARNINGS',
          });
        }
      }
    };
    checkSteps(Array.isArray(sagaCatalog.sagas) ? sagaCatalog.sagas : [], 'saga', 'ERROR');
    checkSteps(Array.isArray(sagaCatalog.saga_templates) ? sagaCatalog.saga_templates : [], 'saga_template', 'WARNING');
  }

  // REF-006 / REF-007: no silent dropping, no ambiguous authority.
  //
  // REF-006 (ERROR): a command-shaped definition that the compiler does
  // not consume as authority. The authoritative command collection is the
  // commands: map of 03_command-catalog.yaml. A command-shaped entry in
  // any other section of the catalog is dropped from every registry while
  // looking exactly like protocol content — the AMD-0005 failure class —
  // so it fails the build.
  const commandShapeKeys = ['inputs', 'outputs', 'preconditions', 'resulting_events', 'required_payload'];
  const isCommandShaped = (v: any): boolean => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const keys = Object.keys(v);
    return commandShapeKeys.filter((k) => keys.includes(k)).length >= 2;
  };
  if (commandCatalog) {
    for (const [section, value] of Object.entries(commandCatalog) as Array<[string, any]>) {
      if (section === 'commands' || section === 'meta') continue;
      if (!value || typeof value !== 'object') continue;
      for (const [entryKey, entryVal] of Object.entries(value) as Array<[string, any]>) {
        if (isCommandShaped(entryVal)) {
          diagnostics.push({
            code: 'REF-006',
            category: 'REFERENCE',
            severity: 'ERROR',
            stage: 'PASS-006',
            file: '03_command-catalog.yaml',
            message: `Command-shaped definition '${entryKey}' under '${section}:' is outside the authoritative commands: map and is not compiled into any registry (silent drop)`,
            action: 'ABORT_WITH_RESOLUTION_ERROR',
            findingRef: 'AMD-0005',
          });
        }
      }
    }
  }

  // Cross-file authority audit: per-domain files (domains/*.yaml,
  // hybrid-boundary.yaml) carry their own commands: maps. Entries that
  // exactly mirror an authoritative command are documentary duplicates —
  // reported (REF-007 WARNING), never silent. Entries with no counterpart
  // in the authoritative map are authority the compiler does not consume —
  // reported per-entry (REF-006 WARNING) so the divergence is loud and
  // counted; promoting these to ERROR requires a governance decision on
  // the divergent naming (e.g. hybrid.oracle.request_price vs
  // hybrid.oracle.price.fetch) that the compiler must not invent.
  for (const f of files) {
    if (f.relativePath.includes('03_command-catalog')) continue;
    const catalog = f.parsed?.commands;
    // Only top-level key→definition MAPS are candidate command authority.
    // Simulation scenarios carry `commands:` as an ordered invocation list —
    // executions, not definitions — and are out of scope for this check.
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) continue;
    for (const entryName of Object.keys(catalog)) {
      if (commands.has(entryName)) {
        diagnostics.push({
          code: 'REF-007',
          category: 'REFERENCE',
          severity: 'WARNING',
          stage: 'PASS-006',
          file: f.relativePath,
          message: `Mirrored command definition '${entryName}' duplicates the authoritative catalog entry; documentary only, not consumed`,
          action: 'REPORT_WARNINGS',
        });
      } else {
        diagnostics.push({
          code: 'REF-006',
          category: 'REFERENCE',
          severity: 'WARNING',
          stage: 'PASS-006',
          file: f.relativePath,
          message: `Command definition '${entryName}' exists outside the authoritative commands: map and is not compiled into any registry (unconsumed authority)`,
          action: 'REPORT_WARNINGS',
        });
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
    const expected = Array.from({ length: 10 }, (_, i) => `INV-${String(i+1).padStart(3,'0')}`);
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
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if ((a.line || 0) !== (b.line || 0)) return (a.line || 0) - (b.line || 0);
    return a.code.localeCompare(b.code);
  });

  return diagnostics;
}
