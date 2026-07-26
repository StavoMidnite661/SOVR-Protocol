#!/usr/bin/env node
// scripts/bump-version.js
// Usage: node scripts/bump-version.js 1.0.0

const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
  console.error('Usage: node scripts/bump-version.js <version>');
  process.exit(1);
}

const files = [
  'package.json',
  'packages/runtime/package.json',
  'packages/compiler/package.json'
];

for (const file of files) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;
  const pkg = JSON.parse(fs.readFileSync(full, 'utf8'));
  pkg.version = newVersion;
  fs.writeFileSync(full, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${file} → ${newVersion}`);
}

console.log('Version bump complete.');
