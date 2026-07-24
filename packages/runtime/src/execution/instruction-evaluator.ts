export interface InstructionNode {
  abi?: string;
  type: string;
  field?: string;
  value?: unknown;
  values?: unknown[];
  children?: InstructionNode[];
  child?: InstructionNode;
  check_id?: string;
  error_code?: string;
  error_message?: string;
  [key: string]: unknown;
}

export interface EvaluationContext {
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  command?: any;
  request?: any;
  stateRegistry?: any;
  eventStore?: any;
  capabilityStore?: any;
  [key: string]: unknown;
}

export class ABIIncompatibilityError extends Error {
  constructor(readonly actual: string, readonly expected: string) {
    super(`ABIIncompatibilityError: instruction abi ${actual} is not compatible with ${expected}`);
    this.name = 'ABIIncompatibilityError';
  }
}

export class UnknownInstructionTypeError extends Error {
  constructor(readonly instructionType: string) {
    super(`UnknownInstructionTypeError: ${instructionType}`);
    this.name = 'UnknownInstructionTypeError';
  }
}

export class InstructionEvaluator {
  private assertionHandlers = new Map<string, (context: EvaluationContext) => Promise<boolean> | boolean>();

  registerAssertion(checkId: string, handler: (ctx: EvaluationContext) => Promise<boolean> | boolean): void {
    this.assertionHandlers.set(checkId, handler);
  }

  hasAssertion(checkId: string): boolean {
    return this.assertionHandlers.has(checkId);
  }

  async evaluate(node: InstructionNode, context: EvaluationContext): Promise<boolean> {
    if (node.abi && node.abi !== 'v1') throw new ABIIncompatibilityError(String(node.abi), 'v1');

    switch (node.type) {
      case 'EXISTS': return this.resolvePath(String(node.field), context) !== undefined;
      case 'GREATER_THAN': return Number(this.resolvePath(String(node.field), context)) > Number(node.value);
      case 'GREATER_THAN_OR_EQUAL': return Number(this.resolvePath(String(node.field), context)) >= Number(node.value);
      case 'LESS_THAN': return Number(this.resolvePath(String(node.field), context)) < Number(node.value);
      case 'LESS_THAN_OR_EQUAL': return Number(this.resolvePath(String(node.field), context)) <= Number(node.value);
      case 'EQUALS': return this.resolvePath(String(node.field), context) === node.value;
      case 'NOT_EQUALS': return this.resolvePath(String(node.field), context) !== node.value;
      case 'ENUM': return Array.isArray(node.values) && node.values.map(String).includes(String(this.resolvePath(String(node.field), context)));
      case 'MIN_LENGTH': {
        const val = this.resolvePath(String(node.field), context);
        return Array.isArray(val) && val.length >= Number(node.value);
      }
      case 'ARRAY_ITEMS_REQUIRE_FIELDS': {
        const val = this.resolvePath(String(node.field), context);
        const fields = Array.isArray(node.fields) ? node.fields.map(String) : [];
        return Array.isArray(val) && val.every(item => item && typeof item === 'object' && fields.every(field => (item as any)[field] !== undefined));
      }
      case 'BALANCED_POSTINGS': return this.evaluateBalancedPostings(this.resolvePath(String(node.field), context));
      case 'AND': {
        for (const child of node.children ?? []) if (!await this.evaluate(child, context)) return false;
        return true;
      }
      case 'OR': {
        for (const child of node.children ?? []) if (await this.evaluate(child, context)) return true;
        return false;
      }
      case 'NOT': return node.child ? !(await this.evaluate(node.child, context)) : false;
      case 'DECLARATIVE_ASSERTION': {
        const checkId = String(node.check_id ?? '');
        const handler = this.assertionHandlers.get(checkId);
        if (!handler) {
          console.warn(`DECLARATIVE_ASSERTION handler not registered: ${checkId}`);
          return false;
        }
        return Boolean(await handler(context));
      }
      default: throw new UnknownInstructionTypeError(String(node.type));
    }
  }

  resolvePath(path: string, context: EvaluationContext): unknown {
    return path.split('.').reduce((obj: unknown, key) => {
      if (obj !== null && obj !== undefined && typeof obj === 'object') return (obj as Record<string, unknown>)[key];
      return undefined;
    }, context as unknown);
  }

  private evaluateBalancedPostings(postings: unknown): boolean {
    if (!Array.isArray(postings) || postings.length < 2) return false;
    const debits = postings
      .filter((p: any) => String(p.type ?? p.direction ?? '').toLowerCase() === 'debit')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const credits = postings
      .filter((p: any) => String(p.type ?? p.direction ?? '').toLowerCase() === 'credit')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    return Math.abs(debits - credits) < 0.0001;
  }
}
