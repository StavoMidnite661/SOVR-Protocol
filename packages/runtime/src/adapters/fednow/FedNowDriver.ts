/**
 * FedNowDriver
 *
 * Federal Reserve FedNow Instant Payment Service.
 *
 * Settlement: Real-time, 20 seconds, 24/7/365
 * Maximum: $500,000 per transaction
 * Format: ISO 20022 (pacs.008 credit transfer, pacs.002 status)
 * Access: Via FedNow-participating financial institution API
 *
 * SOVR does not connect to Federal Reserve directly.
 * Connection is through a sponsoring bank's FedNow API.
 *
 * ISO 20022 Status Codes (pacs.002):
 *   ACSC — AcceptedSettlementCompleted    → SETTLED
 *   ACCC — AcceptedCreditCompleted        → SETTLED
 *   ACCP — AcceptedCustomerProfile        → PENDING
 *   PDNG — Pending                        → PENDING
 *   RJCT — Rejected                       → FAILED
 */

import {
  BaseRailDriver,
  RailPayload,
  RailSubmissionResult,
  RailStatusResult,
  now
} from '../base/BaseRailDriver'

export type FedNowConfig = {
  participantId:       string   // FedNow ABA routing number
  sponsoringBankUrl:   string   // Sponsoring bank FedNow API base URL
  apiKey:              string
  environment:         'test' | 'production'
}

// ISO 20022 pacs.008 — Credit Transfer Initiation
type Pacs008 = {
  msgId:      string
  creDtTm:    string
  nbOfTxs:    string
  ctrlSum:    string
  cdtTrfTxInf: {
    pmtId: { endToEndId: string; uetr: string }
    intrBkSttlmAmt: { ccy: string; value: string }
    dbtr: { rtgNb: string; acctNb: string }
    cdtr: { rtgNb: string; acctNb: string }
    rmtInf: string
  }
}

export class FedNowDriver extends BaseRailDriver {

  private readonly fnConfig: FedNowConfig

  constructor(config: FedNowConfig) {
    super({
      railId:                  'fednow',
      railName:                'FedNow Instant Payment',
      timeout:                 15_000,   // FedNow: real-time, ~20s settlement
      maxRetries:              2,
      retryBackoff:            2_000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetMs:   60_000
    })
    this.fnConfig = config
  }

  protected async submitToRail(
    payload: RailPayload
  ): Promise<RailSubmissionResult> {

    const msg = this.buildPacs008(payload)

    const res = await fetch(
      `${this.fnConfig.sponsoringBankUrl}/fednow/credit-transfer`,
      {
        method:  'POST',
        headers: {
          'Authorization':    `Bearer ${this.fnConfig.apiKey}`,
          'Content-Type':     'application/json',
          'X-Participant-Id': this.fnConfig.participantId,
          'X-Idempotency-Key': payload.commandId
        },
        body: JSON.stringify(msg)
      }
    )

    const body = await res.json()

    // ISO 20022: ACCP = accepted at customer profile stage
    if (res.ok && (body.status === 'ACCP' || body.status === 'ACSC')) {
      return {
        status:            'SUBMITTED',
        externalReference: body.transactionId ?? body.msgId,
        rawResponse:       body,
        retryable:         false,
        submittedAt:       now(),
        railId:            this.config.railId,
        durationMs:        0
      }
    }

    // ISO 20022: RJCT = rejected
    if (body.status === 'RJCT') {
      return {
        status:       'REJECTED',
        errorCode:    body.reasonCode,
        errorMessage: body.reasonDescription ?? body.additionalInfo,
        rawResponse:  body,
        retryable:    false,
        submittedAt:  now(),
        railId:       this.config.railId,
        durationMs:   0
      }
    }

    return {
      status:      'UNKNOWN_EXTERNAL_STATE',
      rawResponse: body,
      retryable:   true,
      submittedAt: now(),
      railId:      this.config.railId,
      durationMs:  0
    }
  }

  protected async queryRailStatus(ref: string): Promise<RailStatusResult> {
    const res = await fetch(
      `${this.fnConfig.sponsoringBankUrl}/fednow/status/${ref}`,
      {
        headers: {
          'Authorization':    `Bearer ${this.fnConfig.apiKey}`,
          'X-Participant-Id': this.fnConfig.participantId
        }
      }
    )

    const body = await res.json()

    // ISO 20022 pacs.002 status mapping
    const iso20022Map: Record<string, RailStatusResult['status']> = {
      'ACSC': 'SETTLED',
      'ACCC': 'SETTLED',
      'PDNG': 'PENDING',
      'ACCP': 'PENDING',
      'RJCT': 'FAILED'
    }

    return {
      status:            iso20022Map[body.status] ?? 'UNKNOWN_EXTERNAL_STATE',
      externalReference: ref,
      settledAt:         body.settlementDate,
      rawResponse:       body,
      railId:            this.config.railId
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${this.fnConfig.sponsoringBankUrl}/ping`, {
        headers: { 'Authorization': `Bearer ${this.fnConfig.apiKey}` }
      })
      return res.ok
    } catch {
      return false
    }
  }

  private buildPacs008(payload: RailPayload): Pacs008 {
    return {
      msgId:    payload.commandId,
      creDtTm:  now(),
      nbOfTxs:  '1',
      ctrlSum:  payload.amount.value,
      cdtTrfTxInf: {
        pmtId: {
          endToEndId: payload.correlationId,
          uetr:       payload.commandId
        },
        intrBkSttlmAmt: {
          ccy:   payload.amount.currency,
          value: payload.amount.value
        },
        dbtr: {
          rtgNb:  payload.source.routingNumber ?? '',
          acctNb: payload.source.accountNumber ?? ''
        },
        cdtr: {
          rtgNb:  payload.destination.routingNumber ?? '',
          acctNb: payload.destination.accountNumber ?? ''
        },
        rmtInf: payload.metadata.description ?? 'SOVR FedNow Transfer'
      }
    }
  }
}
