/**
 * TestTigerBeetleAdapter — in-memory balance ledger for the acceptance harness.
 *
 * Surface required by AcceptanceTestHarness:
 *   setBalance(accountId, netBalance)
 *   getBalance(accountId)        ← BALANCE_SUFFICIENT gate
 *   isAccountActive(accountId)   ← ACCOUNT_ACTIVE gate
 *
 * Balances are bigint to match TigerBeetle's fixed-point semantics; no
 * floating point is used anywhere in the ledger path.
 */

export class TestTigerBeetleAdapter {
  private balances = new Map<string, bigint>()
  private inactive = new Set<string>()

  setBalance(accountId: string, netBalance: bigint): void {
    this.balances.set(accountId, netBalance)
  }

  /** Unknown accounts read as zero — the gate then fails closed on amount > 0. */
  getBalance(accountId: string): bigint {
    return this.balances.get(accountId) ?? 0n
  }

  /** Accounts are active unless explicitly deactivated. */
  isAccountActive(accountId: string): boolean {
    return !this.inactive.has(accountId)
  }

  setAccountActive(accountId: string, active: boolean): void {
    if (active) this.inactive.delete(accountId)
    else this.inactive.add(accountId)
  }

  /** Double-entry transfer. Rejects on insufficient funds — never overdraws. */
  transfer(debitAccountId: string, creditAccountId: string, amount: bigint): boolean {
    const debitBalance = this.getBalance(debitAccountId)
    if (debitBalance < amount) return false
    this.balances.set(debitAccountId, debitBalance - amount)
    this.balances.set(creditAccountId, this.getBalance(creditAccountId) + amount)
    return true
  }

  /** INV-002 support: the ledger must net to zero across all accounts. */
  totalNet(): bigint {
    let total = 0n
    for (const balance of this.balances.values()) total += balance
    return total
  }

  async ping(): Promise<boolean> {
    return true
  }

  reset(): void {
    this.balances.clear()
    this.inactive.clear()
  }
}
