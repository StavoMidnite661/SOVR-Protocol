import { createHash } from 'crypto';

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function canonicalJson(obj: any): string {
  // Deterministic JSON: sorted keys, LF, no whitespace beyond necessary, NFC normalization
  return JSON.stringify(sortKeys(obj), null, 2).replace(/\r\n/g, '\n');
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: any = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) {
      sorted[k] = sortKeys(value[k]);
    }
    return sorted;
  }
  return value;
}

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
export function canonicalizeSourceText(content: Buffer | string): string {
  let text = typeof content === 'string' ? content : content.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n?/g, '\n').normalize('NFC');
}

export function hashFileContent(content: Buffer | string): string {
  return sha256(Buffer.from(canonicalizeSourceText(content), 'utf8'));
}

export function buildHashFromParts(parts: string[]): string {
  // parts are pre-sorted as per BUILD_MANIFEST spec
  const concatenated = parts.join('');
  return sha256(concatenated);
}
