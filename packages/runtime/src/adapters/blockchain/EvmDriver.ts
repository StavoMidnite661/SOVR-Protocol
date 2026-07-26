// ─────────────────────────────────────────────────────────────────────────────
// packages/runtime/src/adapters/blockchain/EvmDriver.ts
// ─────────────────────────────────────────────────────────────────────────────
/**
 * EvmDriver — EVM-compatible blockchain transfers
 *
 * Networks: Ethereum mainnet, Base, Polygon, Arbitrum
 * Finality: ~12s (ETH), ~2s (Base/Polygon L2)
 * Access: RPC node — Alchemy, Infura, or self-hosted
 * Gas: Required for all on-chain transactions
 *
 * Note: Raw EVM transfers use ETH/native token.
 * ERC-20 transfers (USDC, USDT) → StablecoinDriver
 *
 * Scaffold: structure complete, live wire pending RPC + funded wallet
 *
 * Production requirement:
 *   Private key in secrets manager — NOT in environment variables
 *   Gas estimation before every submission
 *   Nonce management — concurrent tx ordering
 */

import { BaseRailDriver, RailPayload, RailSubmissionResult, RailStatusResult, now } from '../base/BaseRailDriver'

export type EvmConfig = {
  rpcUrl:      string
  privateKey:  string   // Must come from secrets manager in production
  chainId:     number   // 1=ETH, 8453=Base, 137=Polygon, 42161=Arbitrum
  environment: 'test' | 'production'
}

export class EvmDriver extends BaseRailDriver {
  private readonly evmConfig: EvmConfig

  constructor(config: EvmConfig) {
    super({
      railId:                  'blockchain-evm',
      railName:                'EVM Blockchain',
      timeout:                 60_000,
      maxRetries:              3,
      retryBackoff:            5_000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs:   120_000
    })
    this.evmConfig = config
  }

  protected async submitToRail(p: RailPayload): Promise<RailSubmissionResult> {
    // Production implementation requires ethers.js or viem:
    //   import { ethers } from 'ethers'
    //   const provider = new ethers.JsonRpcProvider(this.evmConfig.rpcUrl)
    //   const wallet = new ethers.Wallet(this.evmConfig.privateKey, provider)
    //   const tx = await wallet.sendTransaction({ to: ..., value: ..., gasLimit: ... })
    //   return { status: 'SUBMITTED', externalReference: tx.hash, ... }
    //
    // Scaffold: returns UNKNOWN until ethers/viem integrated
    return { status: 'UNKNOWN_EXTERNAL_STATE', errorCode: 'SCAFFOLD_NOT_WIRED', errorMessage: 'EvmDriver: integrate ethers.js or viem before live use', retryable: false, submittedAt: now(), railId: this.config.railId, durationMs: 0 }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    // Poll RPC for transaction receipt
    // receipt.status === 1 → SETTLED, 0 → FAILED, null → PENDING
    return { status: 'UNKNOWN_EXTERNAL_STATE', externalReference: ref, failureReason: 'EvmDriver: integrate ethers.js or viem before live use', railId: this.config.railId }
  }

  async validateCredentials(): Promise<boolean> {
    return !!this.evmConfig.rpcUrl && !!this.evmConfig.privateKey
  }
}
