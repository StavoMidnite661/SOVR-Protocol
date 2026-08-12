import { SOVR_IR, Diagnostic } from './ir/types.js';
export * from './pipeline/pass-runner.js';
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
/**
 * Evidence record of a genuine two-independent-compilation determinism
 * verification. `identical` may be true only when two isolated compiler
 * executions (independent Node processes, isolated output directories)
 * produced byte-identical manifests and artifacts and equal build hashes.
 */
export interface DeterminismProof {
    method: string;
    run_1_hash: string;
    run_2_hash: string;
    identical: boolean;
    compared_artifacts: number;
    artifacts_hash: string;
    differences: string[];
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
    /**
     * Builds the complete output tree (relative path -> exact file content)
     * that writeOutput would persist, WITHOUT touching the filesystem.
     *
     * Exposed so the determinism verifier can compare a run's intended bytes
     * against an independent run's actual bytes artifact-for-artifact.
     *
     * `proof` is null for runs that have not performed a two-compile
     * verification; the certification then truthfully reports
     * verification NOT_PERFORMED instead of a fabricated proof.
     */
    buildOutputTree(output: CompilerOutput, proof?: DeterminismProof | null): Map<string, string>;
    writeOutput(outDir: string, output: CompilerOutput, proof?: DeterminismProof | null): void;
    private buildRegistryManifestContent;
    /**
     * Compiler certification content.
     *
     * The deterministic_proof block is EVIDENCE, never assertion:
     *  - with `proof`: the recorded result of a genuine comparison of two
     *    independent isolated compiler executions (independent Node
     *    processes, isolated output directories, byte-for-byte artifact
     *    comparison). `identical: true` appears only when that comparison
     *    found zero differences;
     *  - without `proof`: verification NOT_PERFORMED is reported and
     *    `identical` is false. A single compilation cannot prove its own
     *    determinism, so no run hash duplication is ever emitted.
     */
    private buildCertificationContent;
}
export declare function compile(rootDir: string, outDir: string): Promise<CompilerOutput>;
