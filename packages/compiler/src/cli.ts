#!/usr/bin/env node
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compile, CompilerRuntime } from './index.js';
import {
  stringTreeToBuffers,
  verifyAgainstTree,
  verifyTwoIndependentCompiles,
} from './determinism.js';
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv: string[]): { command: string; outDirOverride?: string } {
  const args = argv.slice(2);
  const command = args[0] || 'compile';
  let outDirOverride: string | undefined;
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && args[outIdx + 1]) outDirOverride = args[outIdx + 1];
  return { command, outDirOverride };
}

async function main() {
  const { command, outDirOverride } = parseArgs(process.argv);
  const rootDir = resolve(__dirname, '../../..');
  const outDir = outDirOverride ? resolve(outDirOverride) : resolve(rootDir, 'generated');
  const cliPath = __filename;

  if (command === 'boot') {
    const { boot } = await import('./boot/index.js');
    await boot(rootDir, outDir);
    return;
  }

  // Internal subcommand: one isolated compilation, no self-verification.
  // Used ONLY as a child process by the determinism verifier so that each
  // verified run is an independent Node process. Never spawns its own
  // verification (no recursion). Emits an honest NOT_PERFORMED
  // certification rather than a fabricated proof.
  if (command === '__compile-isolated') {
    const runtime = new CompilerRuntime(rootDir);
    const output = await runtime.execute();
    mkdirSync(outDir, { recursive: true });
    runtime.writeOutput(outDir, output, null);
    return;
  }

  if (command === 'compile') {
    console.log('SOVR Compiler v0.6.0 — working yaml protocol kernel');
    console.log(`Root: ${rootDir}`);
    console.log(`Out: ${outDir}`);
    mkdirSync(outDir, { recursive: true });

    // Run 1: this process.
    const runtime = new CompilerRuntime(rootDir);
    const output = await runtime.execute();

    // Determinism gate (compiler/BUILD_MANIFEST.yaml:verification):
    // run 2 is a fully independent Node process compiling into an isolated
    // temporary directory. Every artifact is compared byte-for-byte.
    const run1Tree = stringTreeToBuffers(runtime.buildOutputTree(output, null));
    const proof = verifyAgainstTree(cliPath, run1Tree, output.buildHash);

    if (proof.identical) {
      // Upgrade the manifest determinism claims ONLY on actual evidence.
      output.manifest.reproducibility = {
        R1_closed_frontier: true,
        R2_sorted_lists: true,
        R3_canonical_serialization: true,
        R4_no_randomness: true,
        R5_no_wall_clock: true,
        R6_stable_dispatch: true,
        R7_deterministic_paths: true,
        R8_version_included: true,
        R9_byte_identical: true,
        R10_environment_isolation: true,
      };
      output.manifest.determinism_verification =
        'VERIFIED: two independent isolated compilations byte-identical';
    }

    runtime.writeOutput(outDir, output, proof);

    console.log(`\n=== SOVR KERNEL COMPILATION SUCCESS ===`);
    console.log(`Protocol version: ${output.manifest.protocol_version}`);
    console.log(`Compiler version: ${output.manifest.compiler_version}`);
    console.log(`Input files: ${output.manifest.stats.input_files}`);
    console.log(`IR nodes: ${output.manifest.stats.ir_nodes} edges: ${output.manifest.stats.ir_edges}`);
    console.log(`Generated files: ${output.manifest.stats.generated_files}`);
    console.log(`Diagnostics: ${output.diagnostics.length} (errors: ${output.manifest.stats.errors}, warnings: ${output.manifest.stats.warnings})`);
    if (output.manifest.command_lifecycle_coverage) {
      const c = output.manifest.command_lifecycle_coverage;
      console.log(`PASS-020: Command coverage: ${c.state_machine_covered}/${c.total_commands} machine-covered, ${c.lifecycle_exempt}/${c.total_commands} exempt, ${c.uncovered.length}/${c.total_commands} uncovered`);
    }
    console.log(`Build hash: ${output.buildHash}`);
    console.log(`Manifest: ${join(outDir, 'compiler-manifest.yaml')}`);
    console.log(`\n— Unfakeable: build_hash = sha256(sorted inputs + ir_hash + sorted outputs + compiler_version)`);
    console.log(`— Determinism verification: ${proof.method}`);
    console.log(`  run_1 build_hash: ${proof.run_1_hash}`);
    console.log(`  run_2 build_hash: ${proof.run_2_hash} (independent Node process, isolated output dir)`);
    console.log(`  compared artifacts: ${proof.compared_artifacts} — identical: ${proof.identical}`);
    console.log(`— Deterministic generated timestamp metadata: Canonical Compilation Timestamp (R5).`);
    console.log(`— Frontend devs can now import from generated/src/types/*`);
    if (output.manifest.stats.warnings > 0) {
      console.log(`\nWarnings (reference integrity gaps) — see manifest diagnostics:`);
      for (const d of output.diagnostics.filter(di=>di.severity==='WARNING').slice(0,20)) {
        console.log(`  ${d.code} ${d.file}: ${d.message}`);
      }
      if (output.diagnostics.filter(d=>d.severity==='WARNING').length > 20) {
        console.log(`  ... and ${output.diagnostics.filter(d=>d.severity==='WARNING').length - 20} more`);
      }
    }

    if (!proof.identical) {
      // FAIL BUILD: never emit a successful certification without evidence.
      console.error(`\n✗ DETERMINISM VERIFICATION FAILED — build not byte-identical across independent compilations.`);
      for (const d of proof.differences.slice(0, 40)) console.error(`  ${d}`);
      if (proof.differences.length > 40) console.error(`  ... and ${proof.differences.length - 40} more`);
      console.error(`Certification emitted with identical:false. Exiting non-zero per BUILD_MANIFEST verification policy.`);
      process.exit(1);
    }
  } else if (command === 'package') {
    console.log('Packaging SOVR runtime ABI bundle...');
    if (!existsSync(join(outDir, 'compiler-manifest.yaml')) || !existsSync(join(outDir, 'registries', 'registry.manifest.json'))) {
      console.log('Generated registries missing — running compile first');
      mkdirSync(outDir, { recursive: true });
      await compile(rootDir, outDir);
    }
    const registriesDir = join(outDir, 'registries');
    const registries: Record<string, any> = {};
    for (const file of readdirSync(registriesDir).filter(f => f.endsWith('.json')).sort()) {
      registries[file] = JSON.parse(readFileSync(join(registriesDir, file), 'utf8'));
    }
    const bundle = {
      abi_version: 'v1',
      package_version: '0.6.0',
      manifest: JSON.parse(readFileSync(join(outDir, 'registries', 'registry.manifest.json'), 'utf8')),
      compiler_manifest: JSON.parse(readFileSync(join(outDir, 'compiler-manifest.yaml'), 'utf8')),
      certification: JSON.parse(readFileSync(join(outDir, 'compiler-certification.json'), 'utf8')),
      registries,
    };
    const distDir = join(rootDir, 'dist');
    mkdirSync(distDir, { recursive: true });
    const packagePath = join(distDir, 'sovr-runtime-v0.6.0-abi-v1.svr');
    writeFileSync(packagePath, JSON.stringify(bundle, null, 2) + '\n');
    console.log(`✓ Package written: ${packagePath}`);
  } else if (command === 'verify') {
    console.log('SOVR determinism verification — two fully independent compilations');
    console.log('Each run: separate Node process, isolated temporary output directory.');
    const proof = verifyTwoIndependentCompiles(cliPath);
    console.log(`Method: ${proof.method}`);
    console.log(`Run 1 build hash: ${proof.run_1_hash}`);
    console.log(`Run 2 build hash: ${proof.run_2_hash}`);
    console.log(`Compared artifacts: ${proof.compared_artifacts}`);
    console.log(`Artifacts digest: ${proof.artifacts_hash}`);
    if (proof.identical) {
      console.log(`✓ Reproducible build verified: byte-identical across two independent compilations`);
    } else {
      console.error(`✗ Build NOT reproducible — differences detected:`);
      for (const d of proof.differences.slice(0, 40)) console.error(`  ${d}`);
      if (proof.differences.length > 40) console.error(`  ... and ${proof.differences.length - 40} more`);
      process.exit(1);
    }
  } else if (command === 'dump-ir') {
    const runtime = new CompilerRuntime(rootDir);
    const output = await runtime.execute();
    console.log(JSON.stringify(output.ir, null, 2));
  } else {
    console.log('Usage: sovr <compile|verify|dump-ir|boot|package>');
    console.log('  compile  — build IR + generate artifacts + manifest (with two-process determinism verification)');
    console.log('  verify   — two fully independent compilations, byte-for-byte comparison, exit non-zero on any difference');
    console.log('  dump-ir  — dump canonical IR JSON');
    console.log('  boot     — run full boot sequence 0-7 with attestation (Linux-like)');
    console.log('  package  — package registries + manifest + certification into .svr ABI bundle');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
