import { SOVR_IR } from '../ir/types.js';
export interface GeneratedFile {
    path: string;
    content: string;
    sha256: string;
    sourceRefs: string[];
}
export declare function generateTypes(ir: SOVR_IR): GeneratedFile[];
