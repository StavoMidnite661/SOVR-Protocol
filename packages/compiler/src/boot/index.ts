// Boot Sequence Orchestrator — Linux-like runlevels 0-7
import { runPOST } from './post.js';
import { runBootloader } from './bootloader.js';
import { runBootSequence } from './kernel-init.js';
import { CompilerRuntime } from '../index.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { canonicalJson } from '../utils/hash.js';

export async function boot(rootDir: string, outDir: string) {
  console.log('');
  console.log('  SOVR Financial OS — Boot Sequence');
  console.log('  Linux of Finance — Machine-readable, Unfakeable');
  console.log('');

  const bootLogLines: string[] = [];

  // Runlevel 0: POST
  console.log('🔌 [0] FIRMWARE_POST — Power-On Self Test');
  const post = await runPOST();
  console.log(`   ${post.bootLog}`);
  bootLogLines.push(post.bootLog);
  if (!post.passed) {
    console.log('   ✗ POST FAILED — HALT');
    return { passed: false, post };
  }
  console.log('   ✓ POST OK\n');

  // Runlevel 1: Bootloader (secure boot)
  console.log('🔐 [1] BOOTLOADER — Secure boot, build_hash verification');
  const bootloader = await runBootloader(rootDir);
  console.log(`   ${bootloader.bootLog}`);
  bootLogLines.push(bootloader.bootLog);
  if (!bootloader.passed) {
    console.log('   ✗ BOOTLOADER FAILED — HALT (tamper?)');
    for (const d of bootloader.diagnostics) console.log(`   ! ${d.code} ${d.file}: ${d.message}`);
    return { passed: false, post, bootloader };
  }
  console.log('   ✓ Build provenance verified, unfakeable\n');

  // Need IR for remaining stages — execute compiler runtime up to IR
  const runtime = new CompilerRuntime(rootDir);
  const output = await runtime.execute();

  // Runlevels 2-7
  const icons = ['🧠','🏦','🛡️','🌐','👁️','🚀'];
  const names = ['KERNEL_INIT','CORE_DOMAINS','SECURITY_SUBSYSTEM','EXECUTION_BOUNDARY','INTERPRETATION','USERLAND'];
  console.log(`${icons[0]} [2] ${names[0]} — Constitution + Event Envelope`);
  console.log(`${icons[1]} [3] ${names[1]} — Vault, Ledger, Treasury`);
  console.log(`${icons[2]} [4] ${names[2]} — Identity, Policy, Intent, Agent`);
  console.log(`${icons[3]} [5] ${names[3]} — Payment rails, Hybrid chains`);
  console.log(`${icons[4]} [6] ${names[4]} — Projection rebuild, replay determinism`);
  console.log(`${icons[5]} [7] ${names[5]} — Runtime SDK, Frontend gate\n`);

  const seq = await runBootSequence(rootDir, output.ir, bootloader.buildHash);

  for (const stage of seq.stages) {
    console.log(`${stage.icon} [${stage.level}] ${stage.name} — ${stage.bootLog}`);
    bootLogLines.push(stage.bootLog);
    await new Promise(r => setTimeout(r, 50));
  }

  console.log('');
  if (seq.attestation.boot_splash && Array.isArray(seq.attestation.boot_splash)) {
    for (const line of seq.attestation.boot_splash) {
      console.log(line);
    }
  }
  console.log(` Boot hash: ${seq.bootHash.slice(0,16)}... — unfakeable attestation`);
  console.log(` Total boot time: ${seq.totalDurationMs.toFixed(1)}ms — final health: ${seq.finalHealth}`);
  console.log('');

  // Write boot artifacts
  const bootAttestationPath = join(outDir, 'boot-attestation.json');
  const bootLogPath = join(outDir, 'boot.log');
  const bootManifestPath = join(outDir, 'boot-manifest.json');

  mkdirSync(dirname(bootAttestationPath), { recursive: true });
  writeFileSync(bootAttestationPath, canonicalJson(seq.attestation) + '\n');
  writeFileSync(bootLogPath, bootLogLines.join('\n') + '\n');
  writeFileSync(bootManifestPath, canonicalJson({
    build_hash: bootloader.buildHash,
    boot_hash: seq.bootHash,
    boot_log_hash: seq.bootLogHash,
    boot_timings_hash: seq.bootTimingsHash,
    final_health: seq.finalHealth,
    stages: seq.stages,
    events: seq.events,
    total_duration_ms: seq.totalDurationMs,
    verification: 'same YAML + same compiler + same POST = same boot_hash = cannot be fudged',
  }) + '\n');

  console.log(`Boot artifacts written:`);
  console.log(`  ${bootAttestationPath}`);
  console.log(`  ${bootLogPath}`);
  console.log(`  ${bootManifestPath}`);
  console.log('');
  console.log(`Verify: cat generated/boot-attestation.json | grep build_hash — must match compiler-manifest build_hash`);
  console.log(`Frontend gate: Only load SDK after Level 7 HEALTHY event`);

  return { passed: true, post, bootloader, sequence: seq };
}
