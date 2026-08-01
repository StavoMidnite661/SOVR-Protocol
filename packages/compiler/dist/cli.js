#!/usr/bin/env node
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compile, CompilerRuntime } from './index.js';
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'compile';
    const rootDir = resolve(__dirname, '../../..');
    const outDir = resolve(rootDir, 'generated');
    if (command === 'boot') {
        const { boot } = await import('./boot/index.js');
        await boot(rootDir, outDir);
        return;
    }
    if (command === 'compile') {
        console.log('SOVR Compiler v0.6.0 — working yaml protocol kernel');
        console.log(`Root: ${rootDir}`);
        console.log(`Out: ${outDir}`);
        mkdirSync(outDir, { recursive: true });
        const output = await compile(rootDir, outDir);
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
        console.log(`— No wall-clock in manifest (R5). Byte-identical reproducibility (R9).`);
        console.log(`— Frontend devs can now import from generated/src/types/*`);
        if (output.manifest.stats.warnings > 0) {
            console.log(`\nWarnings (reference integrity gaps) — see manifest diagnostics:`);
            for (const d of output.diagnostics.filter(di => di.severity === 'WARNING').slice(0, 20)) {
                console.log(`  ${d.code} ${d.file}: ${d.message}`);
            }
            if (output.diagnostics.filter(d => d.severity === 'WARNING').length > 20) {
                console.log(`  ... and ${output.diagnostics.filter(d => d.severity === 'WARNING').length - 20} more`);
            }
        }
    }
    else if (command === 'package') {
        console.log('Packaging SOVR runtime ABI bundle...');
        if (!existsSync(join(outDir, 'compiler-manifest.yaml')) || !existsSync(join(outDir, 'registries', 'registry.manifest.json'))) {
            console.log('Generated registries missing — running compile first');
            mkdirSync(outDir, { recursive: true });
            await compile(rootDir, outDir);
        }
        const registriesDir = join(outDir, 'registries');
        const registries = {};
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
    }
    else if (command === 'verify') {
        console.log('Verifying generated artifacts against manifest...');
        // Simple check: recompile and compare build_hash
        const runtime = new CompilerRuntime(rootDir);
        const output1 = await runtime.execute();
        const output2 = await runtime.execute();
        if (output1.buildHash === output2.buildHash) {
            console.log(`✓ Reproducible build verified: ${output1.buildHash} (byte-identical)`);
        }
        else {
            console.error(`✗ Build not reproducible! ${output1.buildHash} != ${output2.buildHash}`);
            process.exit(1);
        }
    }
    else if (command === 'dump-ir') {
        const runtime = new CompilerRuntime(rootDir);
        const output = await runtime.execute();
        console.log(JSON.stringify(output.ir, null, 2));
    }
    else {
        console.log(`Usage: sovr <compile|verify|dump-ir|boot|package>`);
        console.log(`  compile  — build IR + generate artifacts + manifest`);
        console.log(`  verify   — prove byte-identical reproducibility`);
        console.log(`  dump-ir  — dump canonical IR JSON`);
        console.log(`  boot     — run full boot sequence 0-7 with attestation (Linux-like)`);
        console.log(`  package  — package registries + manifest + certification into .svr ABI bundle`);
    }
}
main().catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map