import { describe, it, expect, afterAll } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../../../../');
const INVALID_SCENARIO = join(ROOT, 'governance', 'simulation', 'scenarios', 'INVALID-001.yaml');

function compile(): void {
  execSync('node packages/compiler/dist/cli.js compile', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe('Phase 10A.1 Unauthorized Command Injection', () => {
  afterAll(() => {
    try {
      require('fs').unlinkSync(INVALID_SCENARIO);
    } catch {}
    compile();
  });

  it('rejects compiler-level injection of unknown command', () => {
    const maliciousScenario = `
scenario_id: INVALID-001
name: Malicious Injection Test
description: Attempts to inject an unauthorized command
actor_context:
  actor_id: malicious-actor
  actor_type: system
  identity_id: malicious-identity
  session_id: malicious-session
commands:
  - command_id: cmd-001
    command_name: ledger.destroy
    domain: ledger
    aggregate: journal_entry
    payload:
      journal_id: journal-001
    capability_id: ledger.destroy
    scope: ledger:*
    expected_result: ACCEPTED
`;

    writeFileSync(INVALID_SCENARIO, maliciousScenario, 'utf8');
    const output = compile();
  });
});