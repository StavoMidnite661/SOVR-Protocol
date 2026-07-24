import { ParsedProtocol } from '../parse.js';
import { Diagnostic } from '../../ir/types.js';
export interface GuardParseResult {
    valid: boolean;
    error?: string;
    fieldReferences: string[];
}
export declare class Pass008SemanticAnalysis {
    readonly id = "PASS-008";
    readonly name = "SEMANTIC_ANALYSIS";
    execute(parsed: ParsedProtocol): Diagnostic[];
}
export declare function runPass008SemanticAnalysis(parsed: ParsedProtocol): Diagnostic[];
export declare function parseGuardCondition(condition: string): GuardParseResult;
