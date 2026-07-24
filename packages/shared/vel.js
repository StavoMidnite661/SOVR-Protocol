export const TRIVIAL_TRUE_CONDITIONS = ['always', 'true', 'none', 'n/a', 'not_applicable'];
export const BOOLEAN_OPERATORS = ['AND', 'OR', 'NOT'];
export const COMPARISON_OPERATORS = ['<=', '>=', '==', '!=', '<', '>'];
export const MAX_AST_DEPTH = 5;

export class VELParser {
  constructor(maxDepth = MAX_AST_DEPTH) { this.maxDepth = maxDepth; this.cache = new Map(); }
  parse(condition) {
    try { const normalized = condition.trim(); const ast = this.parseToAst(normalized); return { valid: true, ast, fieldReferences: collectFieldReferences(ast) }; }
    catch (error) { return { valid: false, error: error?.message ?? String(error), fieldReferences: [] }; }
  }
  parseToAst(condition) {
    const normalized = condition.trim();
    const cached = this.cache.get(normalized);
    if (cached) return cached;
    if (/<<|>>|<\s*<=|>\s*>=|={3,}|!={2,}|<==|>==/.test(normalized)) throw new Error('invalid comparison operator');
    const ast = this.parseExpression(normalized, 0);
    this.cache.set(normalized, ast);
    return ast;
  }
  parseExpression(input, depth) {
    if (depth > this.maxDepth) throw new Error(`VEL_AST_DEPTH_EXCEEDED: ${input}`);
    const s = stripOuterParens(input.trim());
    if (!s || isTrivialTrue(s)) return { type: 'literal', value: true };
    if (['false', 'never'].includes(s.toLowerCase())) return { type: 'literal', value: false };
    const orParts = splitTopLevel(s, 'OR');
    if (orParts.length > 1) return orParts.map(p => this.parseExpression(p, depth + 1)).reduce((left, right) => ({ type: 'boolean', op: 'OR', left, right }));
    const andParts = splitTopLevel(s, 'AND');
    if (andParts.length > 1) return andParts.map(p => this.parseExpression(p, depth + 1)).reduce((left, right) => ({ type: 'boolean', op: 'AND', left, right }));
    if (/^NOT\s+/i.test(s)) return { type: 'not', expr: this.parseExpression(s.replace(/^NOT\s+/i, ''), depth + 1) };
    if (/^!/.test(s)) return { type: 'not', expr: this.parseExpression(s.slice(1), depth + 1) };
    const exists = s.match(/^EXISTS\s+(.+)$/i);
    if (exists) return { type: 'exists', field: exists[1].trim() };
    const membership = s.match(/^(.+?)\s+IN\s+\[(.*)]$/i);
    if (membership) return { type: 'membership', field: membership[1].trim(), values: splitCsv(membership[2]).map(parseListOperand) };
    const comparison = s.match(/^(.+?)\s*(<=|>=|==|!=|<|>)\s*(.+)$/);
    if (comparison) return { type: 'comparison', left: parseOperand(comparison[1]), op: comparison[2], right: parseOperand(comparison[3]) };
    if (/[<>=!\[\]()]/.test(s)) throw new Error(`unrecognized expression: ${s}`);
    return { type: 'identifier', name: s };
  }
}

export function isTrivialTrue(s) { return TRIVIAL_TRUE_CONDITIONS.includes(s.toLowerCase()); }

function collectFieldReferences(ast) {
  const fields = new Set();
  const walkOperand = op => { if (op.type === 'field') fields.add(op.path); };
  const walk = node => {
    switch (node.type) {
      case 'identifier': fields.add(node.name); break;
      case 'exists': fields.add(node.field); break;
      case 'comparison': walkOperand(node.left); walkOperand(node.right); break;
      case 'membership': fields.add(node.field); node.values.forEach(walkOperand); break;
      case 'not': walk(node.expr); break;
      case 'boolean': walk(node.left); walk(node.right); break;
    }
  };
  walk(ast);
  return [...fields].sort();
}
function stripOuterParens(input) { let s = input; while (s.startsWith('(') && s.endsWith(')')) { const inner = s.slice(1, -1); if (balanced(inner)) s = inner.trim(); else break; } return s; }
function splitTopLevel(input, op) { const parts=[]; let depth=0, bracket=0, start=0, quote=null; const pattern=op==='AND'?/^(AND|&&)$/i:/^(OR|\|\|)$/i; for(let i=0;i<input.length;i++){const ch=input[i]; if(quote){if(ch===quote)quote=null; continue;} if(ch==='"'||ch==="'"){quote=ch; continue;} if(ch==='(')depth++; else if(ch===')')depth--; else if(ch==='[')bracket++; else if(ch===']')bracket--; if(depth===0&&bracket===0&&/\s/.test(ch)){const rest=input.slice(i).match(/^\s+(AND|OR|&&|\|\|)\s+/i); if(rest&&pattern.test(rest[1])){parts.push(input.slice(start,i).trim()); i+=rest[0].length-1; start=i+1;}}} if(parts.length===0)return[input]; parts.push(input.slice(start).trim()); return parts.filter(Boolean); }
function splitCsv(input){const parts=[]; let current='', quote=null; for(const ch of input){if(quote){if(ch===quote)quote=null; current+=ch; continue;} if(ch==='"'||ch==="'"){quote=ch; current+=ch; continue;} if(ch===','){parts.push(current.trim()); current=''; continue;} current+=ch;} if(current.trim())parts.push(current.trim()); return parts;}
function parseOperand(raw){const s=raw.trim(); if((s.startsWith('"')&&s.endsWith('"'))||(s.startsWith("'")&&s.endsWith("'")))return{type:'literal',value:s.slice(1,-1)}; if(/^-?\d+(\.\d+)?$/.test(s))return{type:'literal',value:Number(s)}; if(/^(true|false)$/i.test(s))return{type:'literal',value:s.toLowerCase()==='true'}; if(!/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(s))throw new Error(`invalid operand: ${s}`); return{type:'field',path:s};}
function parseListOperand(raw){const operand=parseOperand(raw); if(operand.type==='field'&&!operand.path.includes('.')&&!operand.path.startsWith('context.')&&!operand.path.startsWith('command.')&&!operand.path.startsWith('actor.'))return{type:'literal',value:operand.path}; return operand;}
function balanced(input){let depth=0; for(const ch of input){if(ch==='(')depth++; if(ch===')')depth--; if(depth<0)return false;} return depth===0;}
