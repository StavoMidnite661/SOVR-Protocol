import { SOVR_IR, Diagnostic } from './ir/types.js';
export interface CompilerOutput {
    ir: SOVR_IR;
    files: Array<{
        path: string;
        content: string;
        sha256: string;
        sourceRefs: string[];
    }>;
    inputHashes: Record<string, string>;
    outputHashes: Record<string, string>;
    buildHash: string;
    manifest: any;
    diagnostics: Diagnostic[];
}
export declare class ProtocolParser {
    private rootDir;
    constructor(rootDir: string);
    parse(): {
        files: any[];
        protocolVersion: string;
        manifestFiles: any[];
    };
}
export declare class CompilerRuntime {
    private rootDir;
    private compilerVersion;
    constructor(rootDir: string);
    execute(): Promise<CompilerOutput>;
    writeOutput(outDir: string, output: CompilerOutput): void;
}
export declare function compile(rootDir: string, outDir: string): Promise<CompilerOutput>;
