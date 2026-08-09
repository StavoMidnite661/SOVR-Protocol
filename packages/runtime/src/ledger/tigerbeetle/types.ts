export interface TigerBeetleAccount {
  id: number;
  ledger: number;
  code: string;
  name: string;
  currency: string;
  historical_code: string;
  is_default: boolean;
  is_system: boolean;
  timestamp: bigint;
  user_data: { lo: number; hi: number };
}

export interface TigerBeetleTransfer {
  id: number;
  debit_account_id: number;
  credit_account_id: number;
  amount: bigint;
  pending_id: number;
  user_data: { lo: number; hi: number };
  timeout: number;
  code: string;
  timestamp: bigint;
}

export interface SOVRAccountMapping {
  sovr_id: string;
  tigerbeetle_id: number;
  ledger: number;
  purpose: string;
  state: 'GENESIS' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  ownership_domain: string;
  currency: string;
  historical_code: string;
}

export interface SOVRTransferMapping {
  sovr_event_id: string;
  tigerbeetle_id: number;
  debit_sovr_id: string;
  credit_sovr_id: string;
  amount: bigint;
  currency: string;
  deterministic_hash: string;
}

export interface LedgerAdapterConfig {
  tigerbeetleBinaryPath: string;
  clusterFile: string;
  dataDirectory: string;
  port: number;
  readOnly: boolean;
  writeEnabled: boolean;
}

export interface ShadowExecutionResult {
  scenario_id: string;
  commands: any[];
  expected_tigerbeetle_operations: Array<{
    operation: 'CREATE_ACCOUNT' | 'CREATE_TRANSFER';
    target: SOVRAccountMapping | SOVRTransferMapping;
  }>;
  deterministic_hash: string;
  verified: boolean;
  status?: string;
  executed_at?: string;
  write_enabled?: boolean;
}

export interface GenesisWriteResult {
  success: boolean;
  accounts_created: number;
  transfers_created: number;
  read_back_verified: boolean;
  deterministic_hash: string;
  error?: string;
}
