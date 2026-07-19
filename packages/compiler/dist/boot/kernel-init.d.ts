import { Diagnostic } from '../ir/types.js';
import { SOVR_IR } from '../ir/types.js';
export interface BootStageResult {
    level: number;
    name: string;
    icon: string;
    passed: boolean;
    durationMs: number;
    bootLog: string;
    eventsEmitted: string[];
    diagnostics: Diagnostic[];
}
export interface BootSequenceResult {
    stages: BootStageResult[];
    totalDurationMs: number;
    finalHealth: 'HEALTHY' | 'DEGRADED' | 'HALTED';
    buildHash: string;
    bootLog: string[];
    bootLogHash: string;
    bootTimingsHash: string;
    bootHash: string;
    events: Array<{
        eventName: string;
        timestamp: string;
        level: number;
    }>;
    attestation: any;
}
export declare function runBootSequence(rootDir: string, ir: SOVR_IR, buildHash: string): Promise<BootSequenceResult>;
