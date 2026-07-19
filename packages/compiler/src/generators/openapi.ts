import { SOVR_IR } from '../ir/types.js';
import { GeneratedFile } from './typescript.js';
import { sha256 } from '../utils/hash.js';

export function generateOpenAPI(ir: SOVR_IR): GeneratedFile[] {
  const protocolVersion = ir.meta.protocolVersion;
  const compilerVersion = ir.meta.compilerVersion;

  const paths: any = {};
  for (const node of ir.nodes) {
    if (node.type === 'command') {
      const domain = (node as any).domain;
      const cmdName = node.sourceRef;
      const route = `/api/v1/${domain}/${(node as any).aggregate}`;
      const method = cmdName.includes('create') || cmdName.includes('request') || cmdName.includes('register') || cmdName.includes('submit') ? 'post' : 'post';
      const opId = `${domain}_${(node as any).aggregate}_${cmdName.split('.').pop()}`;
      if (!paths[route]) paths[route] = {};
      paths[route][method] = {
        operationId: opId,
        summary: cmdName,
        description: `Command ${cmdName} requiring capability ${(node as any).capability}`,
        tags: [domain],
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '200': { description: 'Success', content: { 'application/json': { schema: { type: 'object' } } } },
          '401': { description: 'Unauthorized' },
          '403': { description: 'Forbidden - capability or policy' },
          '422': { description: 'Validation error' },
        },
        'x-constitutional-gates': (node as any).gates,
        'x-capability-required': (node as any).capability,
      };
    }
  }

  const openapi = {
    openapi: '3.1.0',
    info: { title: 'SOVR Financial OS', version: protocolVersion, description: 'Generated from SOVR IR — deterministic, unfakeable' },
    servers: [{ url: '/api/v1', description: 'SOVR API' }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {},
    },
    'x-compiler-version': compilerVersion,
    'x-ir-hash': ir.meta.irHash,
    'x-generated': 'SOVR generated file — do not edit',
  };

  const body = JSON.stringify(openapi, null, 2);
  const hash = sha256(body);
  const full = `# SOVR GENERATED FILE — DO NOT EDIT\n# Compiler: ${compilerVersion} Protocol: ${protocolVersion} Hash: ${hash}\n${body}`;

  return [{
    path: 'openapi.yaml',
    content: full,
    sha256: sha256(full),
    sourceRefs: ir.nodes.filter(n=>n.type==='command').map(n=>n.sourceRef),
  }];
}
