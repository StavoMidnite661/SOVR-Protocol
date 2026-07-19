import { ParsedProtocol } from '../pipeline/parse.js';
import { SOVR_IR, Diagnostic } from './types.js';
export declare function buildIR(parsed: ParsedProtocol, extraDiagnostics: Diagnostic[]): {
    ir: SOVR_IR;
    diagnostics: Diagnostic[];
};
