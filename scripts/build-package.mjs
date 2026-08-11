import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadYaml(rel) {
  return yaml.load(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, rel), 'utf8'));
}

const compilerManifest = loadYaml('generated/compiler-manifest.yaml');
const registryManifest = loadJson('generated/registries/registry.manifest.json');

const pkg = {
  abi_version: 'v1',
  package_version: '0.6.0',
  manifest: {
    abi_version: 'v1',
    build_hash: compilerManifest.build_hash,
    constitution_hash: compilerManifest.input_hashes['01_constitution.yaml'],
    registries: {}
  },
  compiler_manifest: compilerManifest
};

for (const [name, info] of Object.entries(registryManifest.registries)) {
  pkg.manifest.registries[name] = {
    entry_count: info.entry_count,
    sha256: info.sha256
  };
}

const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const outPath = path.join(distDir, 'sovr-runtime-v0.6.0-abi-v1.svr');
fs.writeFileSync(outPath, JSON.stringify(pkg, null, 2));
console.log(`Package written to ${outPath}`);

const hash = createHash('sha256').update(fs.readFileSync(outPath)).digest('hex');
console.log(`SHA256: ${hash}`);
