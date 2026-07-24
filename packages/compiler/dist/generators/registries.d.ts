import { SOVR_IR } from '../ir/types.js';
import { GeneratedFile } from './typescript.js';
import { ParsedProtocol } from '../pipeline/parse.js';
export interface RegistryBundle {
    files: GeneratedFile[];
    entryCounts: Record<string, number>;
}
export declare function generateRegistries(ir: SOVR_IR, parsed: ParsedProtocol): RegistryBundle;
