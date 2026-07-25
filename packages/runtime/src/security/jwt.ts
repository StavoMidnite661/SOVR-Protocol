import { randomUUID } from 'node:crypto';

export interface SOVRTokenPayload {
  sub: string;
  identity_id: string;
  actor_id: string;
  actor_type: string;
  session_id: string;
  iss: string;
  iat: number;
  exp: number;
  jti: string;
  aud?: string;
  nbf?: number;
}

export interface JWTVerifyResult {
  valid: boolean;
  payload?: SOVRTokenPayload;
  reason?: string;
}

export interface KeyPairMaterial {
  privateKeyPem: string;
  publicKeyPem: string;
}

export class JWTService {
  private privateKey: any = null;
  private publicKey: any = null;
  private mode: 'production' | 'development' = 'development';

  async initialize(opts?: { privateKeyPem?: string; publicKeyPem?: string }): Promise<void> {
    const privateKeyPem = opts?.privateKeyPem ?? process.env.JWT_PRIVATE_KEY;
    const publicKeyPem = opts?.publicKeyPem ?? process.env.JWT_PUBLIC_KEY;

    if (privateKeyPem && publicKeyPem) {
      try {
        const { importPKCS8, importSPKI } = await import('jose');
        this.privateKey = await importPKCS8(privateKeyPem.replace(/\\n/g, '\n'), 'RS256');
        this.publicKey = await importSPKI(publicKeyPem.replace(/\\n/g, '\n'), 'RS256');
        this.mode = 'production';
        console.log('🔐 JWT: RS256 keys loaded from environment');
      } catch (e: any) {
        throw new Error(`JWT: Failed to load RS256 keys: ${e.message}`);
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production. ' +
        'Generate with: openssl genrsa -out private.pem 4096 && openssl rsa -in private.pem -pubout -out public.pem'
      );
    } else {
      const { generateKeyPair } = await import('jose');
      const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
      this.privateKey = privateKey;
      this.publicKey = publicKey;
      this.mode = 'development';
      console.warn('⚠️  JWT: Using ephemeral RS256 keys (development mode). Tokens invalid after restart.');
    }
  }

  async sign(payload: {
    sub: string;
    actor_type: string;
    session_id: string;
  }, opts?: { ttlSeconds?: number }): Promise<string> {
    if (!this.privateKey) throw new Error('JWTService not initialized');
    const { SignJWT } = await import('jose');
    const signJwt = new SignJWT({
      sub: payload.sub,
      identity_id: payload.sub,
      actor_id: payload.sub,
      actor_type: payload.actor_type,
      session_id: payload.session_id,
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt()
      .setIssuer('sovr-protocol')
      .setAudience('sovr-clients')
      .setJti(crypto.randomUUID());
    if (opts?.ttlSeconds) {
      signJwt.setExpirationTime(`${opts.ttlSeconds}s`);
    } else {
      signJwt.setExpirationTime('1h');
    }
    return signJwt.sign(this.privateKey);
  }

  async verify(token: string): Promise<JWTVerifyResult> {
    if (!this.publicKey) throw new Error('JWTService not initialized');
    try {
      const { jwtVerify } = await import('jose');
      const { payload } = await jwtVerify(token, this.publicKey, {
        issuer: 'sovr-protocol',
        audience: 'sovr-clients',
        algorithms: ['RS256'],
      });
      return {
        valid: true,
        payload: payload as unknown as SOVRTokenPayload,
      };
    } catch (e: any) {
      const reason = e?.code === 'ERR_JWT_EXPIRED' ? 'expired' :
                     e?.code === 'ERR_JWT_NOT_YET_VALID' ? 'not_yet_valid' :
                     e?.code === 'ERR_JWT_ISSUER_MISMATCH' ? 'wrong_issuer' :
                     e?.code === 'ERR_JWT_AUDIENCE_MISMATCH' ? 'wrong_audience' :
                     'bad_signature';
      return { valid: false, reason };
    }
  }

  getMode(): string {
    return this.mode;
  }

  getAlgorithm(): string {
    return 'RS256';
  }

  async getPublicKeyJwk(): Promise<{ kty: string; alg: string; n: string; e: string }> {
    if (!this.publicKey) throw new Error('JWTService not initialized');
    const { exportJWK } = await import('jose');
    const jwk = await exportJWK(this.publicKey);
    return { kty: jwk.kty ?? 'RSA', alg: 'RS256', n: jwk.n ?? '', e: jwk.e ?? 'AQAB' };
  }

  async signJws(payload: any, opts?: { issuer?: string; audience?: string }): Promise<string> {
    if (!this.privateKey) throw new Error('JWTService not initialized');
    const { SignJWT } = await import('jose');
    const signJwt = new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt()
      .setIssuer(opts?.issuer ?? 'sovr-protocol')
      .setAudience(opts?.audience ?? 'sovr-clients')
      .setJti(crypto.randomUUID());
    return signJwt.sign(this.privateKey);
  }
}
