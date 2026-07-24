import type { SagaContext, SagaStepDefinition } from './saga-interpreter.js';
import type { StepRecord } from './saga-registry.js';

export interface SagaPayloadMapParams {
  sagaId: string;
  correlationId: string;
  sagaName: string;
  step: SagaStepDefinition;
  sagaPayload: Record<string, any>;
  sagaContext: SagaContext;
  previousStepResults: StepRecord[];
  compensation?: boolean;
  originalStepResult?: StepRecord;
}

export class SagaPayloadMapper {
  map(params: SagaPayloadMapParams): Record<string, any> {
    const mapping = params.compensation
      ? (params.step as any).compensation_payload_mapping ?? {}
      : (params.step as any).payload_mapping ?? {};
    const mapped = this.resolveValue(mapping, params);
    const payload = (mapped && typeof mapped === 'object' && !Array.isArray(mapped)) ? mapped : {};
    return this.applyDefaults(payload, params);
  }

  mapCompensation(params: Omit<SagaPayloadMapParams, 'compensation'>): Record<string, any> {
    return this.map({ ...params, compensation: true });
  }

  private resolveValue(value: any, params: SagaPayloadMapParams): any {
    if (typeof value === 'string') {
      if (value.startsWith('$saga.')) return this.resolvePath(value.slice('$saga.'.length), params);
      return value;
    }
    if (Array.isArray(value)) return value.map(v => this.resolveValue(v, params));
    if (value && typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) out[k] = this.resolveValue(v, params);
      return out;
    }
    return value;
  }

  private resolvePath(path: string, params: SagaPayloadMapParams): any {
    if (path === 'saga_id') return params.sagaId;
    if (path === 'correlation_id') return params.correlationId;
    if (path.startsWith('payload.')) return deepGet(params.sagaPayload, path.slice('payload.'.length));
    if (path.startsWith('context.')) return deepGet(params.sagaContext, path.slice('context.'.length));
    if (path.startsWith('step.')) {
      const parts = path.split('.');
      const stepNo = Number(parts[1]);
      const remainder = parts.slice(2).join('.');
      const step = params.previousStepResults.find(s => s.step === stepNo) ?? (params.originalStepResult?.step === stepNo ? params.originalStepResult : undefined);
      return deepGet(step, remainder);
    }
    return undefined;
  }

  private applyDefaults(payload: Record<string, any>, params: SagaPayloadMapParams): Record<string, any> {
    const now = Date.now();
    const out = { ...payload };

    // Generic defaults for values frequently referenced by saga specs.
    if (out.expiration === undefined) out.expiration = params.sagaContext.expiration ?? new Date(now + 86_400_000).toISOString();
    if (out.journal_id === undefined) out.journal_id = params.sagaContext.journal_id ?? `journal_${params.sagaId}`;
    if (out.transaction_id === undefined) out.transaction_id = params.sagaContext.transaction_id ?? `tx_${params.sagaId}`;
    if (out.event_reference === undefined) out.event_reference = params.previousStepResults[params.previousStepResults.length - 1]?.events?.[0]?.event_id ?? '';
    if (out.correlation_id === undefined) out.correlation_id = params.correlationId;
    if (out.causation_id === undefined) out.causation_id = params.sagaId;
    if (out.description === undefined) out.description = 'Saga ledger entry';
    if (out.entry_type === undefined) out.entry_type = 'STANDARD';

    if (params.sagaContext.simulateFailureAtStep === params.step.step && Array.isArray(out.postings) && out.postings.length >= 2) {
      // Preserve real CommandBus execution while forcing INV-002 failure.
      out.postings = [
        out.postings[0],
        { ...out.postings[1], amount: String(Number(out.postings[0].amount ?? 0) + 1) },
      ];
    }

    return out;
  }
}

function deepGet(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    const key: any = /^\d+$/.test(part) ? Number(part) : part;
    cur = cur[key];
  }
  return cur;
}
