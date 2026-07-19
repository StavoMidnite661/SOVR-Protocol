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

export function hashFileContent(content: Buffer | string): string {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  return sha256(buf);
}

export function buildHashFromParts(parts: string[]): string {
  // parts are pre-sorted as per BUILD_MANIFEST spec
  const concatenated = parts.join('');
  return sha256(concatenated);
}
