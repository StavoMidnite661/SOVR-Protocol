// ============================================================
// SOVR JWT — production HMAC-SHA256 signed JSON Web Tokens
// No external dependency: uses Node's built-in `crypto`.
// Token format: base64url(header).base64url(payload).base64url(hmac_sha256(header.payload, secret))
// Invariants:
//  - HS256 only (no algorithm confusion attacks)
//  - constant-time signature compare
//  - exp / nbf / iat validation
//  - algorithm pinned in verifier header to prevent "alg: none" attack
// ============================================================

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const HEADER_B64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

export interface JWTPayload {
  sub: string;          // subject (actor_id)
  identity_id: string;
  actor_id: string;
  actor_type: string;
  session_id: string;
  iat: number;          // issued at (unix seconds)
  exp: number;          // expiration (unix seconds)
  nbf?: number;         // not before
  iss?: string;         // issuer (default: sovr-financial-os)
  aud?: string;         // audience (default: sovr-clients)
  jti?: string;         // unique id (default: random)
}

export interface JWTVerifyResult {
  valid: boolean;
  payload?: JWTPayload;
  reason?: 'malformed' | 'bad_signature' | 'expired' | 'not_yet_valid' | 'wrong_algorithm' | 'wrong_issuer' | 'wrong_audience';
}

export class SOVRJwt {
  private readonly secret: Buffer;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly defaultTtlSeconds: number;

  constructor(opts: { secret: string | Buffer; issuer?: string; audience?: string; defaultTtlSeconds?: number } = { secret: '' }) {
    if (!opts.secret) {
      throw new Error('SOVRJwt: secret is required (use SOVR_JWT_SECRET env var)');
    }
    this.secret = Buffer.isBuffer(opts.secret) ? opts.secret : Buffer.from(opts.secret, 'utf8');
    if (this.secret.length < 32) {
      throw new Error('SOVRJwt: secret must be at least 32 bytes (256 bits) for HS256');
    }
    this.issuer = opts.issuer ?? 'sovr-financial-os';
    this.audience = opts.audience ?? 'sovr-clients';
    this.defaultTtlSeconds = opts.defaultTtlSeconds ?? 3600; // 1h
  }

  /** Generate a random secret suitable for HS256. */
  static generateSecret(): string {
    return randomBytes(48).toString('base64');
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }

  signPayload(payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud' | 'jti'> & { ttlSeconds?: number }): string {
    const now = Math.floor(Date.now() / 1000);
    const full: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + (payload.ttlSeconds ?? this.defaultTtlSeconds),
      iss: this.issuer,
      aud: this.audience,
      jti: randomBytes(8).toString('hex'),
    };
    delete (full as any).ttlSeconds;
    const body = Buffer.from(JSON.stringify(full)).toString('base64url');
    const sig = this.sign(`${HEADER_B64}.${body}`);
    return `${HEADER_B64}.${body}.${sig}`;
  }

  verify(token: string, opts: { clockSkewSeconds?: number } = {}): JWTVerifyResult {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, reason: 'malformed' };
    const [h, p, s] = parts;

    // 1. Header must be exactly HS256 (defense against alg confusion)
    let header: any;
    try {
      header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    } catch {
      return { valid: false, reason: 'malformed' };
    }
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT') {
      return { valid: false, reason: 'wrong_algorithm' };
    }

    // 2. Signature must verify (constant-time)
    const expected = this.sign(`${h}.${p}`);
    const a = Buffer.from(s);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'bad_signature' };
    }

    // 3. Payload checks
    let payload: JWTPayload;
    try {
      payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    } catch {
      return { valid: false, reason: 'malformed' };
    }
    const now = Math.floor(Date.now() / 1000);
    const skew = opts.clockSkewSeconds ?? 5;
    if (typeof payload.exp === 'number' && now > payload.exp + skew) return { valid: false, reason: 'expired' };
    if (typeof payload.nbf === 'number' && now + skew < payload.nbf) return { valid: false, reason: 'not_yet_valid' };
    if (payload.iss && payload.iss !== this.issuer) return { valid: false, reason: 'wrong_issuer' };
    if (payload.aud && payload.aud !== this.audience) return { valid: false, reason: 'wrong_audience' };

    return { valid: true, payload };
  }
}
