export interface YamlFile {
    path: string;
    relativePath: string;
    content: string;
    parsed: any;
    sha256: string;
}
export declare function loadYamlFile(fullPath: string, rootDir: string): YamlFile;
export declare function discoverProtocolInputs(rootDir: string): string[];
