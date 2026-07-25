import { randomUUID } from 'node:crypto';
import type { JWTService, SOVRTokenPayload } from '../security/jwt.js';

export const RUNTIME_ISSUER_DID = 'did:sovr:runtime-issuer';

export interface DIDDocument {
  '@context': string[];
  id: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyJwk: {
      kty: string;
      alg: string;
      n: string;
      e: string;
    };
  }>;
  authentication: string[];
  created: string;
  updated: string;
}

export interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: {
    id: string;
    actor_type: string;
    trust_level: string;
    verified_at: string;
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    jws: string;
  };
}

export interface DIDServiceOpts {
  databaseUrl: string;
  jwtService: JWTService;
}

type PgPool = any;
type PgRow = Record<string, any>;

export class DIDService {
  private poolPromise: Promise<PgPool>;
  private jwtService: JWTService;
  private publicKeyJwk: { kty: string; alg: string; n: string; e: string } | null = null;

  constructor(opts: DIDServiceOpts) {
    this.jwtService = opts.jwtService;
    this.poolPromise = this.createPool(opts.databaseUrl);
  }

  async initialize(): Promise<void> {
    const pool = await this.poolPromise;
    await pool.query(MIGRATION_SQL);
    this.publicKeyJwk = await this.jwtService.getPublicKeyJwk();
  }

  async createDIDDocument(actorId: string, actorType: string): Promise<DIDDocument> {
    const did = `did:sovr:${actorId}`;
    const keyId = `${did}#key-1`;
    const now = new Date().toISOString();

    const doc: DIDDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: did,
      verificationMethod: [
        {
          id: keyId,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: this.publicKeyJwk ?? {
            kty: 'RSA',
            alg: 'RS256',
            n: '',
            e: 'AQAB',
          },
        },
      ],
      authentication: [keyId],
      created: now,
      updated: now,
    };

    const pool = await this.poolPromise;
    await pool.query(
      'INSERT INTO sovr_did_documents (did, actor_id, document, created_at, updated_at) VALUES ($1, $2, $3::jsonb, NOW(), NOW()) ON CONFLICT (did) DO UPDATE SET document=$3::jsonb, updated_at=NOW()',
      [did, actorId, JSON.stringify(doc)],
    );

    return doc;
  }

  async resolveDIDDocument(did: string): Promise<DIDDocument | null> {
    const pool = await this.poolPromise;
    const res = await pool.query('SELECT document FROM sovr_did_documents WHERE did=$1 LIMIT 1', [did]);
    if (!res.rows[0]) return null;
    return res.rows[0].document as unknown as DIDDocument;
  }

  async issueVerifiableCredential(
    subjectDid: string,
    actorType: string,
    trustLevel: string,
  ): Promise<VerifiableCredential> {
    const now = new Date().toISOString();
    const credentialId = `vc:${randomUUID()}`;
    const issuerDid = RUNTIME_ISSUER_DID;
    const verificationMethod = `${issuerDid}#key-1`;

    const vc: VerifiableCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://sovr.protocol/credentials/v1',
      ],
      type: ['VerifiableCredential', 'SOVRActorCredential'],
      issuer: issuerDid,
      issuanceDate: now,
      credentialSubject: {
        id: subjectDid,
        actor_type: actorType,
        trust_level: trustLevel,
        verified_at: now,
      },
    };

    const jws = await this.signVcJws(vc);
    vc.proof = {
      type: 'JsonWebSignature2020',
      created: now,
      verificationMethod: verificationMethod,
      jws,
    };

    const pool = await this.poolPromise;
    await pool.query(
      'INSERT INTO sovr_credentials (credential_id, subject_did, issuer_did, credential, issued_at, created_at) VALUES ($1, $2, $3, $4::jsonb, $5, NOW())',
      [credentialId, subjectDid, issuerDid, JSON.stringify(vc), now],
    );

    return vc;
  }

  async resolveVerifiableCredential(credentialId: string): Promise<VerifiableCredential | null> {
    const pool = await this.poolPromise;
    const res = await pool.query(
      'SELECT credential FROM sovr_credentials WHERE credential_id=$1 AND revoked=FALSE LIMIT 1',
      [credentialId],
    );
    if (!res.rows[0]) return null;
    return res.rows[0].credential as unknown as VerifiableCredential;
  }

  async verifyVerifiableCredential(credentialId: string): Promise<{ valid: boolean; credential?: VerifiableCredential; reason?: string }> {
    const vc = await this.resolveVerifiableCredential(credentialId);
    if (!vc) return { valid: false, reason: 'credential_not_found' };
    if (!vc.proof) return { valid: false, reason: 'missing_proof' };

    try {
      const { importJWK, jwtVerify } = await import('jose');
      const spki = await this.jwtService.getPublicKeyJwk();
      const publicKey = await importJWK({ ...spki, ext: true }, 'RS256');
      const { payload } = await jwtVerify(vc.proof.jws, publicKey, {
        issuer: RUNTIME_ISSUER_DID,
        algorithms: ['RS256'],
      });
      const restored = payload as unknown as VerifiableCredential;
      return { valid: true, credential: restored };
    } catch (e: any) {
      return { valid: false, reason: e?.message ?? 'invalid_signature' };
    }
  }

  async verifyDIDSignature(did: string, jws: string): Promise<{ valid: boolean; payload?: any; reason?: string }> {
    try {
      const doc = await this.resolveDIDDocument(did);
      if (!doc) return { valid: false, reason: 'did_not_found' };
      const publicKeyJwk = doc.verificationMethod[0]?.publicKeyJwk;
      if (!publicKeyJwk) return { valid: false, reason: 'no_verification_method' };

      const { importJWK, jwtVerify } = await import('jose');
      const publicKey = await importJWK(publicKeyJwk, 'RS256');
      const { payload } = await jwtVerify(jws, publicKey, { algorithms: ['RS256'] });
      return { valid: true, payload };
    } catch (e: any) {
      return { valid: false, reason: e?.message ?? 'bad_signature' };
    }
  }

  async processEvent(envelope: any): Promise<void> {
    const eventName = envelope.event_name;
    const actorId = envelope.actor_id;
    const payload = envelope.payload || {};
    const identityContext = envelope.identity_context || {};
    const actorType = identityContext.actor_type || payload.actor_type || 'human';

    if (eventName === 'identity.actor.registered') {
      await this.createDIDDocument(String(actorId), actorType);
    } else if (eventName === 'identity.actor.verified') {
      const did = `did:sovr:${actorId}`;
      await this.issueVerifiableCredential(did, actorType, 'VERIFIED');
    }
  }

  private async signVcJws(vc: VerifiableCredential): Promise<string> {
    const payload = { ...vc };
    delete (payload as any).proof;
    return this.jwtService.signJws(
      { ...payload, iss: RUNTIME_ISSUER_DID, aud: 'sovr-clients' },
      { issuer: RUNTIME_ISSUER_DID, audience: 'sovr-clients' }
    );
  }

  private async createPool(databaseUrl: string): Promise<PgPool> {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    let pg: any;
    try {
      pg = await dynamicImport('pg');
    } catch (error) {
      throw new Error('DIDService requires optional dependency "pg". Install it in production runtime before setting DATABASE_URL.');
    }
    return new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false,
    });
  }
}

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS sovr_did_documents (
  did           VARCHAR(255) PRIMARY KEY,
  actor_id      VARCHAR(255) NOT NULL,
  document      JSONB        NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sovr_credentials (
  credential_id VARCHAR(255) PRIMARY KEY,
  subject_did   VARCHAR(255) NOT NULL,
  issuer_did    VARCHAR(255) NOT NULL,
  credential    JSONB        NOT NULL,
  issued_at     TIMESTAMPTZ  NOT NULL,
  expires_at    TIMESTAMPTZ,
  revoked       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sovr_did_documents_actor_id ON sovr_did_documents(actor_id);
CREATE INDEX IF NOT EXISTS idx_sovr_credentials_subject_did ON sovr_credentials(subject_did);
CREATE INDEX IF NOT EXISTS idx_sovr_credentials_issuer_did ON sovr_credentials(issuer_did);
`;
