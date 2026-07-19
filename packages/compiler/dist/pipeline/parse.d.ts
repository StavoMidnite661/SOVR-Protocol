import { YamlFile } from '../utils/yaml-loader.js';
import { Diagnostic } from '../ir/types.js';
export interface ParsedProtocol {
    files: YamlFile[];
    diagnostics: Diagnostic[];
    protocolVersion: string;
    canonicalList: Record<string, any>;
}
export declare function parseProtocol(files: YamlFile[]): ParsedProtocol;
