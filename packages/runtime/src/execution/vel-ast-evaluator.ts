import { VELParser, isTrivialTrue, type ConditionAST, type Operand } from '@sovr/shared/vel';

export type { ConditionAST, Operand } from '@sovr/shared/vel';

export class VELASTEvaluator {
  private parser = new VELParser();

  parse(condition: string): ConditionAST {
    const result = this.parser.parse(condition);
    if (!result.valid || !result.ast) throw new Error(result.error ?? `Invalid VEL condition: ${condition}`);
    return result.ast;
  }

  tryParse(condition: string) {
    return this.parser.parse(condition);
  }

  evaluate(ast: ConditionAST, context: any): boolean {
    try { return this.evalAst(ast, context); }
    catch { return false; }
  }

  evaluateCondition(condition: string | undefined, context: any): boolean {
    const raw = (condition ?? '').trim();
    if (!raw || isTrivialTrue(raw)) return true;
    return this.evaluate(this.parse(raw), context);
  }

  private evalAst(ast: ConditionAST, context: any): boolean {
    switch (ast.type) {
      case 'literal': return ast.value;
      case 'identifier': {
        const value = resolveField(ast.name, context);
        return typeof value === 'boolean' ? value : false;
      }
      case 'not': return !this.evalAst(ast.expr, context);
      case 'boolean': return ast.op === 'AND'
        ? this.evalAst(ast.left, context) && this.evalAst(ast.right, context)
        : this.evalAst(ast.left, context) || this.evalAst(ast.right, context);
      case 'exists': return resolveField(ast.field, context) !== undefined && resolveField(ast.field, context) !== null;
      case 'membership': {
        const actual = resolveField(ast.field, context);
        if (actual === undefined || actual === null) return false;
        return ast.values.map(v => resolveOperand(v, context)).some(v => String(v) === String(actual));
      }
      case 'comparison': {
        const left = resolveOperand(ast.left, context);
        const right = resolveOperand(ast.right, context);
        if (left === undefined || right === undefined) return false;
        const ln = Number(left);
        const rn = Number(right);
        const numeric = Number.isFinite(ln) && Number.isFinite(rn);
        const l: any = numeric ? ln : String(left);
        const r: any = numeric ? rn : String(right);
        switch (ast.op) {
          case '<=': return l <= r;
          case '>=': return l >= r;
          case '<': return l < r;
          case '>': return l > r;
          case '==': return l === r;
          case '!=': return l !== r;
        }
      }
    }
  }
}

function resolveOperand(operand: Operand, context: any): any {
  if (operand.type === 'literal') return operand.value;
  return resolveField(operand.path, context);
}

function resolveField(path: string, context: any): any {
  const candidates = [
    path,
    path.replace(/^context\./, ''),
    path.replace(/^command\./, 'command.'),
    path.replace(/^actor\./, 'actor.'),
  ];
  for (const candidate of candidates) {
    const value = deepGet(context, candidate);
    if (value !== undefined) return value;
    const factValue = deepGet(context?.facts, candidate);
    if (factValue !== undefined) return factValue;
    const conditionValue = deepGet(context?.conditions, candidate);
    if (conditionValue !== undefined) return conditionValue;
    const payloadValue = deepGet(context?.command?.payload, candidate);
    if (payloadValue !== undefined) return payloadValue;
    const actorValue = deepGet(context?.actor, candidate);
    if (actorValue !== undefined) return actorValue;
    const identityValue = deepGet(context?.command?.identity_context, candidate);
    if (identityValue !== undefined) return identityValue;
  }
  return undefined;
}

function deepGet(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  const parts = path.split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null || !Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}
