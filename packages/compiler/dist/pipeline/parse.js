export function parseProtocol(files) {
    const diagnostics = [];
    let protocolVersion = '0.0.0';
    const canonical = {};
    for (const file of files) {
        const parsed = file.parsed;
        if (!parsed) {
            diagnostics.push({
                code: 'SYNTAX-002',
                category: 'SYNTAX',
                severity: 'ERROR',
                stage: 'PASS-002',
                file: file.relativePath,
                message: 'Empty or null document',
                action: 'ABORT_WITH_PARSE_ERROR',
            });
            continue;
        }
        // Extract protocol version from 00_protocol-manifest.yaml
        if (file.relativePath.includes('00_protocol-manifest')) {
            protocolVersion = parsed?.protocol?.version || protocolVersion;
        }
        // Check meta block presence for files that should have it (warning, not fatal for now)
        if (!parsed?.meta && !file.relativePath.includes('DOMAIN_STATUS') && !file.relativePath.includes('DEPENDENCY')) {
            // For frozen specs, some lack meta - emit INFO per METADATA_STANDARD gap
            // Not fatal until AMD-0010 ratified
        }
        canonical[file.relativePath] = parsed;
    }
    return { files, diagnostics, protocolVersion, canonicalList: canonical };
}
//# sourceMappingURL=parse.js.map