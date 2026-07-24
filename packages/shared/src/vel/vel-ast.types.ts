export type ConditionAST =
  | { type: 'literal'; value: boolean }
  | { type: 'identifier'; name: string }
  | { type: 'not'; expr: ConditionAST }
  | { type: 'boolean'; op: 'AND' | 'OR'; left: ConditionAST; right: ConditionAST }
  | { type: 'exists'; field: string }
  | { type: 'comparison'; op: '<=' | '>=' | '==' | '!=' | '<' | '>'; left: Operand; right: Operand }
  | { type: 'membership'; field: string; values: Operand[] };

export type Operand =
  | { type: 'field'; path: string }
  | { type: 'literal'; value: string | number | boolean };

export interface ParseResult {
  valid: boolean;
  ast?: ConditionAST;
  error?: string;
  fieldReferences: string[];
}
