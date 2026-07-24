import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { Diagnostic } from '../ir/types.js';

export interface RegisteredPass {
  id: string;
  name: string;
  phase: string;
  purpose?: string;
  consumes?: string[];
  produces?: string[];
  depends_on: string[];
  deterministic?: boolean;
  certification?: string;
  failure_conditions?: string[];
}

export interface PassRegistry {
  schema_version?: string;
  protocol_version?: string;
  compiler_version?: string;
  invariant?: string;
}

export interface PassResult {
  id: string;
  name: string;
  phase: string;
  certification?: string;
  status: 'PASSED' | 'FAILED';
  order: number;
  diagnosticsBefore: number;
  diagnosticsAfter: number;
  produced: string[];
}

export interface CompilerPassContext {
  rootDir: string;
  compilerVersion: string;
  diagnostics: Diagnostic[];
  passResults: PassResult[];
  evidence: Record<string, unknown>;
  [key: string]: unknown;
}

export type PassHandler<TContext extends CompilerPassContext = CompilerPassContext> = (
  context: TContext,
  pass: RegisteredPass
) => Promise<void> | void;

export class FailClosedCompilationError extends Error {
  constructor(
    message: string,
    readonly diagnostics: Diagnostic[],
    readonly pass?: RegisteredPass
  ) {
    super(message);
    this.name = 'FailClosedCompilationError';
  }
}

export class PassRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PassRegistryError';
  }
}

function normalizePass(raw: any): RegisteredPass {
  const p = raw?.pass ?? raw;
  if (!p?.id || !p?.name || !p?.phase) {
    throw new PassRegistryError(`Malformed pass registry entry: ${JSON.stringify(raw)}`);
  }
  return {
    id: String(p.id),
    name: String(p.name),
    phase: String(p.phase),
    purpose: p.purpose ? String(p.purpose) : undefined,
    consumes: Array.isArray(p.consumes) ? p.consumes.map(String) : [],
    produces: Array.isArray(p.produces) ? p.produces.map(String) : [],
    depends_on: Array.isArray(p.depends_on) ? p.depends_on.map(String) : [],
    deterministic: Boolean(p.deterministic),
    certification: p.certification ? String(p.certification) : undefined,
    failure_conditions: Array.isArray(p.failure_conditions) ? p.failure_conditions.map(String) : [],
  };
}

export class CompilerPassRunner<TContext extends CompilerPassContext = CompilerPassContext> {
  private handlers = new Map<string, PassHandler<TContext>>();
  private order: RegisteredPass[];

  constructor(
    readonly registry: PassRegistry,
    readonly passes: RegisteredPass[]
  ) {
    this.validateRegistry();
    this.order = this.computeTopologicalOrder();
  }

  static fromFile<TContext extends CompilerPassContext = CompilerPassContext>(registryPath: string): CompilerPassRunner<TContext> {
    const doc = yaml.load(readFileSync(registryPath, 'utf8')) as any;
    const registry = (doc?.registry ?? {}) as PassRegistry;
    const passes = (doc?.passes ?? []).map(normalizePass);
    return new CompilerPassRunner<TContext>(registry, passes);
  }

  register(passIdOrName: string, handler: PassHandler<TContext>): this {
    this.handlers.set(passIdOrName, handler);
    return this;
  }

  registerMany(handlers: Record<string, PassHandler<TContext>>): this {
    for (const [id, handler] of Object.entries(handlers)) this.register(id, handler);
    return this;
  }

  getExecutionOrder(): RegisteredPass[] {
    return [...this.order];
  }

  private validateRegistry(): void {
    if (!Array.isArray(this.passes) || this.passes.length === 0) {
      throw new PassRegistryError('PASS_REGISTRY.yaml declares no passes');
    }
    const seen = new Set<string>();
    for (const pass of this.passes) {
      if (seen.has(pass.id)) throw new PassRegistryError(`Duplicate pass id ${pass.id}`);
      seen.add(pass.id);
      if (pass.deterministic !== true) {
        throw new PassRegistryError(`Pass ${pass.id} must declare deterministic: true`);
      }
    }
    for (const pass of this.passes) {
      for (const dep of pass.depends_on) {
        if (!seen.has(dep)) throw new PassRegistryError(`Pass ${pass.id} depends on unknown pass ${dep}`);
      }
    }
  }

  private computeTopologicalOrder(): RegisteredPass[] {
    const byId = new Map(this.passes.map((p, idx) => [p.id, { pass: p, idx }]));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const pass of this.passes) {
      indegree.set(pass.id, pass.depends_on.length);
      for (const dep of pass.depends_on) {
        if (!outgoing.has(dep)) outgoing.set(dep, []);
        outgoing.get(dep)!.push(pass.id);
      }
    }

    const queue = this.passes
      .filter(p => (indegree.get(p.id) ?? 0) === 0)
      .sort((a, b) => byId.get(a.id)!.idx - byId.get(b.id)!.idx)
      .map(p => p.id);
    const ordered: RegisteredPass[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      ordered.push(byId.get(id)!.pass);
      const children = (outgoing.get(id) ?? [])
        .sort((a, b) => byId.get(a)!.idx - byId.get(b)!.idx);
      for (const child of children) {
        indegree.set(child, (indegree.get(child) ?? 0) - 1);
        if (indegree.get(child) === 0) {
          queue.push(child);
          queue.sort((a, b) => byId.get(a)!.idx - byId.get(b)!.idx);
        }
      }
    }

    if (ordered.length !== this.passes.length) {
      const remaining = this.passes
        .filter(p => !ordered.some(o => o.id === p.id))
        .map(p => p.id)
        .join(', ');
      throw new PassRegistryError(`Pass dependency cycle detected: ${remaining}`);
    }

    return ordered;
  }

  private handlerFor(pass: RegisteredPass): PassHandler<TContext> {
    const handler = this.handlers.get(pass.id) ?? this.handlers.get(pass.name);
    if (!handler) {
      throw new PassRegistryError(`No handler registered for ${pass.id} (${pass.name})`);
    }
    return handler;
  }

  private failClosedDiagnostics(context: TContext): Diagnostic[] {
    return context.diagnostics.filter(d => d.severity === 'ERROR' || d.severity === 'FATAL');
  }

  private assertFailClosed(context: TContext, pass: RegisteredPass): void {
    const errors = this.failClosedDiagnostics(context);
    if (errors.length > 0) {
      throw new FailClosedCompilationError(
        `Fail-closed compilation halted after ${pass.id} (${pass.name}): ${errors.length} ERROR/FATAL diagnostic(s)`,
        errors,
        pass
      );
    }
  }

  async run(context: TContext): Promise<TContext> {
    const completed = new Set<string>();
    context.passResults = context.passResults ?? [];
    context.evidence = context.evidence ?? {};

    for (const pass of this.order) {
      for (const dep of pass.depends_on) {
        if (!completed.has(dep)) {
          throw new PassRegistryError(`Ordering invariant violated: ${pass.id} executed before ${dep}`);
        }
      }

      const before = context.diagnostics.length;
      try {
        await this.handlerFor(pass)(context, pass);
        context.passResults.push({
          id: pass.id,
          name: pass.name,
          phase: pass.phase,
          certification: pass.certification,
          status: 'PASSED',
          order: context.passResults.length + 1,
          diagnosticsBefore: before,
          diagnosticsAfter: context.diagnostics.length,
          produced: pass.produces ?? [],
        });
      } catch (error: any) {
        if (error instanceof FailClosedCompilationError || error instanceof PassRegistryError) throw error;
        const diagnostic: Diagnostic = {
          code: 'COMPILER-PASS-FAILED',
          category: 'COMPILER',
          severity: 'FATAL',
          stage: pass.id,
          file: 'compiler/PASS_REGISTRY.yaml',
          message: `${pass.name} failed: ${error?.message ?? String(error)}`,
          action: 'HALT',
        };
        context.diagnostics.push(diagnostic);
        context.passResults.push({
          id: pass.id,
          name: pass.name,
          phase: pass.phase,
          certification: pass.certification,
          status: 'FAILED',
          order: context.passResults.length + 1,
          diagnosticsBefore: before,
          diagnosticsAfter: context.diagnostics.length,
          produced: pass.produces ?? [],
        });
        throw new FailClosedCompilationError(
          `Fail-closed compilation halted during ${pass.id} (${pass.name})`,
          [diagnostic],
          pass
        );
      }

      completed.add(pass.id);
      this.assertFailClosed(context, pass);
    }

    return context;
  }
}
