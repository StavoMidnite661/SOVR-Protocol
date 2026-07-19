import { sha256 } from '../utils/hash.js';
export function generatePrisma(ir) {
    const protocolVersion = ir.meta.protocolVersion;
    const compilerVersion = ir.meta.compilerVersion;
    const entitiesByDomain = new Map();
    for (const node of ir.nodes) {
        if (node.type === 'entity') {
            const domain = node.domain;
            if (!entitiesByDomain.has(domain))
                entitiesByDomain.set(domain, []);
            entitiesByDomain.get(domain).push(node);
        }
    }
    const lines = [];
    lines.push('// SOVR GENERATED — Prisma schema');
    lines.push(`// Compiler: ${compilerVersion} Protocol: ${protocolVersion}`);
    lines.push('// DO NOT EDIT — generated from 02_domain-model.yaml');
    lines.push('');
    lines.push('generator client { provider = "prisma-client-js" }');
    lines.push('datasource db { provider = "postgresql" url = env("DATABASE_URL") }');
    lines.push('');
    for (const [domain, entities] of entitiesByDomain) {
        for (const ent of entities) {
            const modelName = `${domain}_${ent.entityName}`;
            lines.push(`model ${toPascal(modelName)} {`);
            const attrs = ent.attributes || {};
            for (const [attrName, attrDef] of Object.entries(attrs)) {
                const def = attrDef;
                const prismaType = mapPrisma(def.type);
                const idMark = def.unique ? ' @id @default(uuid())' : def.required === false ? '?' : '';
                // Map camelCase to snake? per compiler.yaml conventions table_naming snake_case_plural, but keep simple
                lines.push(`  ${toSnake(attrName)} ${prismaType}${idMark}`);
            }
            lines.push('  createdAt DateTime @default(now())');
            lines.push('  updatedAt DateTime @updatedAt');
            lines.push('}');
            lines.push('');
        }
    }
    // Event store table — append-only per INV-001
    lines.push('model event_store {');
    lines.push('  event_id String @id');
    lines.push('  event_name String');
    lines.push('  aggregate String');
    lines.push('  aggregate_id String');
    lines.push('  source_domain String');
    lines.push('  command_id String');
    lines.push('  correlation_id String');
    lines.push('  causation_id String');
    lines.push('  actor_id String');
    lines.push('  payload Json');
    lines.push('  timestamp DateTime');
    lines.push('  @@index([aggregate_id])');
    lines.push('  @@index([source_domain])');
    lines.push('  @@index([correlation_id])');
    lines.push('  @@index([actor_id])');
    lines.push('}');
    lines.push('');
    lines.push('model journal_entry {');
    lines.push('  entry_id String @id');
    lines.push('  journal_id String');
    lines.push('  transaction_id String');
    lines.push('  total_debits Decimal');
    lines.push('  total_credits Decimal');
    lines.push('  balanced Boolean');
    lines.push('  @@index([journal_id])');
    lines.push('}');
    const body = lines.join('\n');
    const full = `// SOVR GENERATED FILE — DO NOT EDIT\n// compiler ${compilerVersion} protocol ${protocolVersion} hash ${sha256(body)}\n${body}`;
    return [{
            path: 'prisma/schema.prisma',
            content: full,
            sha256: sha256(full),
            sourceRefs: ir.nodes.filter(n => n.type === 'entity').map(n => n.sourceRef),
        }];
}
function toPascal(s) { return s.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(''); }
function toSnake(s) { return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''); }
function mapPrisma(t) {
    switch (t) {
        case 'string': return 'String';
        case 'integer': return 'Int';
        case 'decimal': return 'Decimal';
        case 'boolean': return 'Boolean';
        case 'timestamp':
        case 'date': return 'DateTime';
        case 'object': return 'Json';
        case 'array': return 'Json';
        case 'enum': return 'String';
        default: return 'String';
    }
}
//# sourceMappingURL=prisma.js.map