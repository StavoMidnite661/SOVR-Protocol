import { Diagnostic } from '../ir/types.js';
export interface POSTResult {
    stage: 'POST';
    level: 0;
    passed: boolean;
    checks: Array<{
        name: string;
        passed: boolean;
        detail: string;
    }>;
    diagnostics: Diagnostic[];
    durationMs: number;
    bootLog: string;
}
export declare function runPOST(): Promise<POSTResult>;
