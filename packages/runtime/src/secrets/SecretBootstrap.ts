/**
 * SecretBootstrap — Runlevel 1.5 (SECRETS_BOOT), Directive XXVI
 *
 * Loads required secrets at boot and fails closed when a provider or a
 * required secret is unavailable in production.
 *
 * Call contract (packages/runtime/src/server/index.ts):
 *   const secretsBoot = await SecretBootstrap.create({ ... })
 *   secretsBoot.getProviderName()
 *   await secretsBoot.getJwtPrivateKey()
 *   await secretsBoot.getJwtPublicKey()
 *
 * Secrets are cached with a TTL (default 60s) and never logged by value.
 */

export interface SecretProvider {
  readonly name: string
  getSecret(key: string): Promise<string | null>
  isAvailable(): Promise<boolean>
}

export interface SecretBootstrapOptions {
  /** Optional event store for audit emission; wired after boot. */
  eventStore?: unknown
  /** Cache TTL in milliseconds. Default 60_000. */
  ttlMs?: number
  /** Override the provider (tests / AWS Secrets Manager). */
  provider?: SecretProvider
  /** Secrets that must resolve or boot fails. Default: none (dev-friendly). */
  requiredSecrets?: string[]
}

interface CacheEntry {
  value: string
  expiresAt: number
}

/**
 * Environment-backed provider. This is the default and is always available;
 * production deployments inject an AWS Secrets Manager provider instead.
 */
class EnvSecretProvider implements SecretProvider {
  readonly name = 'environment'

  async getSecret(key: string): Promise<string | null> {
    return process.env[key] ?? null
  }

  async isAvailable(): Promise<boolean> {
    return true
  }
}

export class SecretBootstrap {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly ttlMs: number
  private readonly provider: SecretProvider

  private constructor(provider: SecretProvider, ttlMs: number) {
    this.provider = provider
    this.ttlMs = ttlMs
  }

  /**
   * Factory. Verifies the provider is reachable and pre-loads required
   * secrets. Throws (fail-closed) if the provider is down or a required
   * secret is missing — the caller decides whether that is fatal per NODE_ENV.
   */
  static async create(options: SecretBootstrapOptions = {}): Promise<SecretBootstrap> {
    const provider = options.provider ?? new EnvSecretProvider()
    const ttlMs = options.ttlMs ?? 60_000

    const available = await provider.isAvailable()
    if (!available) {
      throw new Error(
        `SecretBootstrap: provider "${provider.name}" unavailable. Cannot boot — fail closed.`
      )
    }

    const instance = new SecretBootstrap(provider, ttlMs)

    for (const key of options.requiredSecrets ?? []) {
      const value = await provider.getSecret(key)
      if (!value) {
        throw new Error(
          `SecretBootstrap: required secret "${key}" not found. Cannot boot — fail closed.`
        )
      }
      instance.setCached(key, value)
      // Audit: key name only. Never the value.
      console.log(`🔐 SecretBootstrap: loaded "${key}" (ttl=${ttlMs}ms)`)
    }

    return instance
  }

  getProviderName(): string {
    return this.provider.name
  }

  /** Resolve a secret, honouring the TTL cache. Throws if unresolvable. */
  async getSecret(key: string): Promise<string> {
    const cached = this.getCached(key)
    if (cached !== null) return cached

    const value = await this.provider.getSecret(key)
    if (!value) {
      throw new Error(`SecretBootstrap: secret "${key}" not available from ${this.provider.name}`)
    }
    this.setCached(key, value)
    return value
  }

  /**
   * Postgres connection string. Prefers a managed `POSTGRES_URL` secret and
   * falls back to `DATABASE_URL`. Throws when neither resolves so the caller
   * can fall back to config explicitly rather than silently connecting nowhere.
   */
  async getPostgresUrl(): Promise<string> {
    const fromSecret = await this.provider.getSecret('POSTGRES_URL')
    if (fromSecret) {
      this.setCached('POSTGRES_URL', fromSecret)
      return fromSecret
    }
    return this.getSecret('DATABASE_URL')
  }

  async getJwtPrivateKey(): Promise<string> {
    return this.getSecret('JWT_PRIVATE_KEY')
  }

  async getJwtPublicKey(): Promise<string> {
    return this.getSecret('JWT_PUBLIC_KEY')
  }

  clear(): void {
    this.cache.clear()
  }

  private getCached(key: string): string | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.value
  }

  private setCached(key: string, value: string): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }
}

/** Process-wide accessor used by modules that boot after SECRETS_BOOT. */
let activeBootstrap: SecretBootstrap | null = null

export function setSecrets(bootstrap: SecretBootstrap | null): void {
  activeBootstrap = bootstrap
}

export function getSecrets(): SecretBootstrap | null {
  return activeBootstrap
}
