import { Diagnostic } from '../ir/types.js';
export interface BootloaderResult {
    level: 1;
    stage: 'BOOTLOADER';
    passed: boolean;
    buildHash: string;
    verified: boolean;
    manifest: any;
    inputHashes: Record<string, string>;
    diagnostics: Diagnostic[];
    durationMs: number;
    bootLog: string;
}
export declare function runBootloader(rootDir: string): Promise<BootloaderResult>;
