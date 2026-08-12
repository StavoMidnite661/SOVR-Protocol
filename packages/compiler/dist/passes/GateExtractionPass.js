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
const VALID_GATE_TYPES = new Set([
    'BALANCE_SUFFICIENT',
    'STATE_PRECONDITION',
    'AUTHORIZATION_LIMIT',
    'TIME_WINDOW',
    'APPROVAL_QUORUM',
    'COMPLIANCE_HOLD_ABSENT',
    'KYC_VERIFIED',
    'ACCOUNT_ACTIVE',
    'DEPENDENCY_SATISFIED',
    'AMOUNT_WITHIN_LIMIT'
]);
export class GateExtractionPass {
    errors = [];
    warnings = [];
    process(commands) {
        this.errors = [];
        this.warnings = [];
        const entries = [];
        for (const cmd of commands) {
            const entry = this.processCommand(cmd);
            if (entry)
                entries.push(entry);
        }
        return {
            entries,
            errors: this.errors,
            warnings: this.warnings
        };
    }
    processCommand(cmd) {
        if (!cmd.name) {
            this.errors.push(`Command missing name field`);
            return null;
        }
        if (!cmd.required_capability) {
            this.errors.push(`Command '${cmd.name}' missing required_capability`);
            return null;
        }
        const gates = this.extractGates(cmd);
        return {
            commandName: cmd.name,
            requiredCapability: cmd.required_capability,
            stateMachine: cmd.state_machine ?? cmd.name.split('.').slice(0, 2).join('.'),
            aggregateType: cmd.aggregate_type ?? cmd.name.split('.')[0],
            domain: cmd.domain ?? cmd.name.split('.')[0],
            layer: cmd.layer ?? 0,
            executionGates: gates
        };
    }
    extractGates(cmd) {
        if (!cmd.execution_gates || cmd.execution_gates.length === 0) {
            return [];
        }
        const gates = [];
        for (const yamlGate of cmd.execution_gates) {
            if (!VALID_GATE_TYPES.has(yamlGate.type)) {
                this.errors.push(`Command '${cmd.name}': unknown gate type '${yamlGate.type}'. ` +
                    `Valid types: ${[...VALID_GATE_TYPES].join(', ')}`);
                continue;
            }
            if (!yamlGate.gate_id) {
                this.errors.push(`Command '${cmd.name}': gate missing gate_id`);
                continue;
            }
            if (!yamlGate.description) {
                this.warnings.push(`Command '${cmd.name}', gate '${yamlGate.gate_id}': missing description`);
            }
            const configResult = this.validateConfig(cmd.name, yamlGate.gate_id, yamlGate.type, yamlGate.config);
            if (!configResult.valid) {
                this.errors.push(...configResult.errors);
                continue;
            }
            gates.push({
                gateId: yamlGate.gate_id,
                type: yamlGate.type,
                fatal: yamlGate.fatal ?? true,
                description: yamlGate.description ?? '',
                config: yamlGate.config
            });
        }
        return gates;
    }
    validateConfig(commandName, gateId, gateType, config) {
        const errors = [];
        const ctx = `Command '${commandName}', gate '${gateId}' (${gateType})`;
        switch (gateType) {
            case 'BALANCE_SUFFICIENT':
                if (!config.accountPayloadKey)
                    errors.push(`${ctx}: missing accountPayloadKey`);
                if (!config.amountPayloadKey)
                    errors.push(`${ctx}: missing amountPayloadKey`);
                if (!config.currency)
                    errors.push(`${ctx}: missing currency`);
                break;
            case 'STATE_PRECONDITION':
                if (!Array.isArray(config.requiredStates) || config.requiredStates.length === 0) {
                    errors.push(`${ctx}: requiredStates must be a non-empty array`);
                }
                break;
            case 'AUTHORIZATION_LIMIT':
                if (!config.amountPayloadKey)
                    errors.push(`${ctx}: missing amountPayloadKey`);
                if (!config.limitSource)
                    errors.push(`${ctx}: missing limitSource`);
                if (config.limitSource === 'static' && !config.staticLimit) {
                    errors.push(`${ctx}: limitSource is 'static' but staticLimit is missing`);
                }
                break;
            case 'TIME_WINDOW':
                if (!config.window) {
                    errors.push(`${ctx}: missing window configuration`);
                }
                else {
                    const w = config.window;
                    if (!w.timezone)
                        errors.push(`${ctx}: window missing timezone`);
                    if (!Array.isArray(w.daysOfWeek))
                        errors.push(`${ctx}: window missing daysOfWeek array`);
                    if (w.startHour === undefined)
                        errors.push(`${ctx}: window missing startHour`);
                    if (w.endHour === undefined)
                        errors.push(`${ctx}: window missing endHour`);
                }
                break;
            case 'APPROVAL_QUORUM':
                if (!config.required || typeof config.required !== 'number') {
                    errors.push(`${ctx}: required must be a number`);
                }
                if (!config.role)
                    errors.push(`${ctx}: missing role`);
                break;
            case 'COMPLIANCE_HOLD_ABSENT':
                if (!Array.isArray(config.holdTypes) || config.holdTypes.length === 0) {
                    errors.push(`${ctx}: holdTypes must be a non-empty array`);
                }
                break;
            case 'ACCOUNT_ACTIVE':
                if (!config.accountPayloadKey)
                    errors.push(`${ctx}: missing accountPayloadKey`);
                break;
            case 'AMOUNT_WITHIN_LIMIT':
                if (!config.amountPayloadKey)
                    errors.push(`${ctx}: missing amountPayloadKey`);
                if (!config.maxAmount)
                    errors.push(`${ctx}: missing maxAmount`);
                if (!config.currency)
                    errors.push(`${ctx}: missing currency`);
                break;
        }
        return { valid: errors.length === 0, errors };
    }
}
//# sourceMappingURL=GateExtractionPass.js.map