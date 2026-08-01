export declare function sha256(data: string | Buffer): string;
export declare function canonicalJson(obj: any): string;
/**
 * Canonicalize source text before hashing, per BUILD_MANIFEST reproducibility
 * rule R3 (canonical serialization: NFC Unicode, LF line endings).
 *
 * Without this, the same logical file hashes differently depending on the
 * platform / git `core.autocrlf` setting that produced the working tree:
 * a CRLF checkout on Windows and an LF checkout on Linux yield different
 * input hashes, which cascades into a different build_hash and a spurious
 * CONST-LOCK-002 / GEN-007 "tamper detected" halt. R3 was previously only
 * honoured for generated JSON (canonicalJson) and for path separators
 * (yaml-loader relativePath, audit finding F-3) — never for source bytes.
 *
 * Normalization applied:
 *   - strip UTF-8 BOM (an encoding marker, not content)
 *   - CRLF and lone CR  -> LF
 *   - Unicode NFC       (R3 explicitly requires NFC)
 */
export declare function canonicalizeSourceText(content: Buffer | string): string;
export declare function hashFileContent(content: Buffer | string): string;
export declare function buildHashFromParts(parts: string[]): string;
