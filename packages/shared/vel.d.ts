export type ConditionAST =
  | { type: 'literal'; value: boolean }
  | { type: 'identifier'; name: string }
  | { type: 'not'; expr: ConditionAST }
  | { type: 'boolean'; op: 'AND' | 'OR'; left: ConditionAST; right: ConditionAST }
  | { type: 'exists'; field: string }
  | { type: 'comparison'; op: '<=' | '>=' | '==' | '!=' | '<' | '>'; left: Operand; right: Operand }
  | { type: 'membership'; field: string; values: Operand[] };
export type Operand = { type: 'field'; path: string } | { type: 'literal'; value: string | number | boolean };
export interface ParseResult { valid: boolean; ast?: ConditionAST; error?: string; fieldReferences: string[]; }
export declare const TRIVIAL_TRUE_CONDITIONS: readonly string[];
export declare const BOOLEAN_OPERATORS: readonly string[];
export declare const COMPARISON_OPERATORS: readonly string[];
export declare const MAX_AST_DEPTH: number;
export declare class VELParser {
  constructor(maxDepth?: number);
  parse(condition: string): ParseResult;
  parseToAst(condition: string): ConditionAST;
}
export declare function isTrivialTrue(s: string): boolean;
