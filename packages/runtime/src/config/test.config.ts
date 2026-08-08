// ============================================================
// SOVR Runtime — Test Environment Configuration
// This module is ONLY loaded when NODE_ENV === 'test'.
// Production configuration remains in src/server/config.ts.
// ============================================================

export interface TestEnvironmentConfig {
  rateLimit: {
    enabled: boolean;
    max: number;
    timeWindow: string;
  };
  timeout: {
    startup: number;
    request: number;
  };
  database: {
    isolated: boolean;
    simulationOnly: boolean;
  };
  ledger: {
    simulationOnly: boolean;
  };
  strictCausation: {
    enabled: boolean;
  };
}

export function loadTestConfig(): TestEnvironmentConfig {
  return {
    rateLimit: {
      enabled: false,
      max: 200,
      timeWindow: '1 minute',
    },
    timeout: {
      startup: 30_000,
      request: 30_000,
    },
    database: {
      isolated: true,
      simulationOnly: true,
    },
    ledger: {
      simulationOnly: true,
    },
    strictCausation: {
      enabled: true,
    },
  };
}
