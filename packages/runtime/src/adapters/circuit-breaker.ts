export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeoutMs: number;
  name: string;
}

export interface CircuitStatus {
  name: string;
  state: CircuitState;
  failures: number;
  last_failure: string | null;
}

export class CircuitOpenError extends Error {
  constructor(name: string, retryAfterMs: number) {
    super(
      `Circuit breaker OPEN for ${name}. Retry after ${Math.ceil(retryAfterMs / 1000)}s`
    );
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.lastFailureTime ?? 0);
      if (elapsed >= this.config.timeoutMs) {
        this.state = 'HALF_OPEN';
        this.successes = 0;
      } else {
        throw new CircuitOpenError(
          this.config.name,
          this.config.timeoutMs - elapsed
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.state = 'CLOSED';
        this.failures = 0;
        this.successes = 0;
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getStatus(): CircuitStatus {
    return {
      name: this.config.name,
      state: this.state,
      failures: this.failures,
      last_failure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
    };
  }
}
