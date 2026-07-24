import { VELParser } from '@sovr/shared/vel';
export class Pass008SemanticAnalysis {
    id = 'PASS-008';
    name = 'SEMANTIC_ANALYSIS';
    execute(parsed) {
        const diagnostics = [];
        const stateMachines = parsed.files.find(f => f.relativePath.includes('05_state-machines'))?.parsed?.state_machines ?? {};
        const domainModel = parsed.files.find(f => f.relativePath.includes('02_domain-model'))?.parsed ?? {};
        const knownFields = collectDomainFields(domainModel);
        for (const [machineName, machine] of Object.entries(stateMachines)) {
            const transitions = machine?.transitions ?? {};
            for (const [transitionName, transition] of Object.entries(transitions)) {
                const condition = String(transition?.condition ?? '').trim();
                if (!condition || isTrivial(condition))
                    continue;
                const parseResult = new VELParser().parse(condition);
                if (!parseResult.valid) {
                    diagnostics.push({
                        severity: 'ERROR',
                        code: 'SEM-001',
                        category: 'SEMANTIC',
                        stage: 'PASS-008',
                        file: '05_state-machines.yaml',
                        message: `Invalid guard condition in state_machine:${machineName}.${transitionName}: "${condition}"`,
                        action: 'ABORT_WITH_VALIDATION_ERROR',
                    });
                    continue;
                }
                for (const field of parseResult.fieldReferences) {
                    if (!knownFields.has(field) && !knownFields.has(field.replace(/^context\./, '')) && !knownFields.has(field.replace(/^command\.payload\./, ''))) {
                        diagnostics.push({
                            severity: 'WARNING',
                            code: 'SEM-002',
                            category: 'SEMANTIC',
                            stage: 'PASS-008',
                            file: '05_state-machines.yaml',
                            message: `Guard references unknown field: ${field}`,
                            action: 'REPORT_WARNINGS',
                        });
                    }
                }
            }
        }
        diagnostics.sort((a, b) => a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
        return diagnostics;
    }
}
export function runPass008SemanticAnalysis(parsed) {
    return new Pass008SemanticAnalysis().execute(parsed);
}
export function parseGuardCondition(condition) {
    return new VELParser().parse(condition);
}
function collectDomainFields(domainModel) {
    const fields = new Set([
        'amount', 'per_transfer_limit', 'minimum_amount', 'status', 'state', 'actor_type',
        'identity_id', 'capability_id', 'rail', 'settlement', 'delegation_context',
    ]);
    for (const [domainName, domain] of Object.entries(domainModel.domains ?? {})) {
        for (const [entityName, entity] of Object.entries(domain.entities ?? {})) {
            for (const attr of Object.keys(entity.attributes ?? {})) {
                fields.add(attr);
                fields.add(`${entityName}.${attr}`);
                fields.add(`${domainName}.${entityName}.${attr}`);
                fields.add(`context.${attr}`);
                fields.add(`command.payload.${attr}`);
            }
        }
    }
    return fields;
}
function isTrivial(s) {
    return ['none', 'always', 'true', 'n/a', 'not_applicable'].includes(s.toLowerCase());
}
//# sourceMappingURL=pass-008.js.map