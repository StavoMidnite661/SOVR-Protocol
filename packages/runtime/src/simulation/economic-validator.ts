export interface EconomicValidationResult {
  passed: boolean;
  detail: string;
  failure_code?: string;
}

export class EconomicValidator {
  validateConservation(events: any[]): EconomicValidationResult {
    let assetsIn = 0;
    let assetsOut = 0;
    let remainingReserve = 0;

    for (const event of events) {
      const name = event.event_name;
      const amount = Number(event.payload?.amount || 0);

      if (name === 'vault.asset.registered' || name === 'treasury.transfer.requested') {
        assetsIn += amount;
      } else if (name === 'vault.reserve.created') {
        remainingReserve += amount;
      } else if (name === 'vault.reserve.locked') {
        remainingReserve -= amount;
      } else if (name === 'vault.reserve.released') {
        remainingReserve += amount;
      } else if (name === 'treasury.transfer.reserved') {
        remainingReserve += amount;
      } else if (name === 'treasury.transfer.settled') {
        assetsOut += amount;
        remainingReserve -= amount;
      }
    }

    const conserved = assetsIn === assetsOut + remainingReserve;
    return {
      passed: conserved,
      detail: `AssetsIn=${assetsIn}, AssetsOut=${assetsOut}, RemainingReserve=${remainingReserve}`,
      failure_code: conserved ? undefined : 'ECONOMIC_INVARIANT_FAILURE',
    };
  }

  validateLedgerBalance(events: any[]): EconomicValidationResult {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const event of events) {
      if (event.event_name === 'ledger.entry.posted') {
        const postings = Array.isArray(event.payload?.postings) ? event.payload.postings : [];
        for (const posting of postings) {
          const amount = Number(posting.amount || 0);
          const direction = String(posting.direction ?? posting.type ?? '').toUpperCase();
          if (direction === 'DEBIT') {
            totalDebits += amount;
          } else if (direction === 'CREDIT') {
            totalCredits += amount;
          }
        }
      }
    }

    const balanced = totalDebits === totalCredits;
    return {
      passed: balanced,
      detail: `Debits=${totalDebits}, Credits=${totalCredits}`,
      failure_code: balanced ? undefined : 'ECONOMIC_INVARIANT_FAILURE',
    };
  }

  validateTreasuryAuthorization(events: any[]): EconomicValidationResult {
    let requested = 0;
    let approved = 0;
    let reserved = 0;

    for (const event of events) {
      const amount = Number(event.payload?.amount || 0);
      if (event.event_name === 'treasury.transfer.requested') {
        requested = Math.max(requested, amount);
      } else if (event.event_name === 'treasury.transfer.authorized') {
        approved = Math.max(approved, amount);
      } else if (event.event_name === 'treasury.transfer.reserved') {
        reserved = Math.max(reserved, amount);
      }
    }

    const valid = requested <= approved && approved <= reserved;
    return {
      passed: valid,
      detail: `Requested=${requested}, Approved=${approved}, Reserved=${reserved}`,
      failure_code: valid ? undefined : 'ECONOMIC_INVARIANT_FAILURE',
    };
  }
}
