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
export type PassHandler<TContext extends CompilerPassContext = CompilerPassContext> = (context: TContext, pass: RegisteredPass) => Promise<void> | void;
export declare class FailClosedCompilationError extends Error {
    readonly diagnostics: Diagnostic[];
    readonly pass?: RegisteredPass | undefined;
    constructor(message: string, diagnostics: Diagnostic[], pass?: RegisteredPass | undefined);
}
export declare class PassRegistryError extends Error {
    constructor(message: string);
}
export declare class CompilerPassRunner<TContext extends CompilerPassContext = CompilerPassContext> {
    readonly registry: PassRegistry;
    readonly passes: RegisteredPass[];
    private handlers;
    private order;
    constructor(registry: PassRegistry, passes: RegisteredPass[]);
    static fromFile<TContext extends CompilerPassContext = CompilerPassContext>(registryPath: string): CompilerPassRunner<TContext>;
    register(passIdOrName: string, handler: PassHandler<TContext>): this;
    registerMany(handlers: Record<string, PassHandler<TContext>>): this;
    getExecutionOrder(): RegisteredPass[];
    private validateRegistry;
    private computeTopologicalOrder;
    private handlerFor;
    private failClosedDiagnostics;
    private assertFailClosed;
    run(context: TContext): Promise<TContext>;
}
