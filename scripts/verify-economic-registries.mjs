import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');

const registries = ['economic.registry.json', 'settlement.registry.json', 'reserve.registry.json'];
let allPass = true;

for (const name of registries) {
  const path = join(ROOT, 'generated', 'registries', name);
  if (!existsSync(path)) {
    console.error(`MISSING: ${name}`);
    allPass = false;
    continue;
  }
  const content = readFileSync(path, 'utf8');
  const registry = JSON.parse(content);
  if (registry.integrity?.algorithm !== 'SHA256' || !registry.integrity?.hash) {
    console.error(`INVALID_INTEGRITY: ${name}`);
    allPass = false;
  } else {
    console.log(`OK: ${name} (entries=${registry.entry_count}, hash=${registry.integrity.hash.slice(0, 16)}...)`);
  }
}

if (allPass) {
  console.log('ECONOMIC_REGISTRY_BUILD_PASS');
  process.exit(0);
} else {
  console.error('ECONOMIC_REGISTRY_BUILD_FAIL');
  process.exit(1);
}
