import { SOVR_IR } from '../ir/types.js';
import { GeneratedFile } from './typescript.js';
import { ParsedProtocol } from '../pipeline/parse.js';
export interface IntegrityBlock {
    algorithm: 'SHA256';
    hash: string;
    generated_by: {
        compiler_version: string;
    };
    timestamp: string;
}
export interface RegistryBundle {
    files: GeneratedFile[];
    entryCounts: Record<string, number>;
}
export declare function generateRegistries(ir: SOVR_IR, parsed: ParsedProtocol, compilerVersion?: string): RegistryBundle;
