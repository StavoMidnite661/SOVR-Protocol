export const BOOT_PHASES = [
  'FIRMWARE_POST',
  'BOOTLOADER',
  'KERNEL_INIT',
  'CORE_DOMAINS',
  'SECURITY_SUBSYSTEM',
  'EXECUTION_BOUNDARY',
  'INTERPRETATION',
  'USERLAND'
];

function hr(char = '━', width = 88): string {
  return char.repeat(width);
}

export class BootRenderer {
  private phaseIndex = 0;
  private headerShown = false;

  private ensureHeader(): void {
    if (this.headerShown) return;
    this.headerShown = true;
    console.log('');
    console.log('');
    console.log('');
    console.log('');
    console.log('[ 0.000001 ] SOVR BIOS v1.0.4 — Cryptographic Attestation Mode');
    console.log('[ 0.000142 ] Probe: CPU ... AVX512 OK | MEM ... ISOLATED | ENTROPY ... POOLING');
    console.log('[ 0.000318 ] Mounting /dev/sovr/constitution ...');
    console.log('');
    console.log('░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ALIGNING KERNEL BOUNDARIES');
    console.log('█████████████████████████████████████  BOUNDARIES ESTABLISHED');
    console.log('');
    console.log('  ███████╗ ██████╗ ██╗   ██╗██████╗      ⬢ INITIALIZING TRUSTED COMPUTE');
    console.log('  ██╔════╝██╔═══██╗██║   ██║██╔══██╗     » Hashing Immutable Invariants');
    console.log('  ███████╗██║   ██║██║   ██║██████╔╝     » Sealing Event Store');
    console.log('  ╚════██║██║   ██║██║   ██║██╔══██╗     » Establishing Authority');
    console.log('  ███████║╚██████╔╝╚██████╔╝██║  ██║');
    console.log('  ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝');
    console.log('');
    console.log('  S O V R   |   C O N S T I T U T I O N A L   K E R N E L');
    console.log('  ─────────────────────────────────────────────────────────');
    console.log('  "Source of Canonical Events Activated"');
    console.log('');
  }

  phase(phaseTitle: string, tasks: string[]): void {
    this.ensureHeader();
    while (BOOT_PHASES[this.phaseIndex] !== phaseTitle.split(' » ')[1] && this.phaseIndex < BOOT_PHASES.length) {
      this.phaseIndex++;
    }
    console.log(`│ ${phaseTitle}`);
    for (let i = 0; i < tasks.length; i++) {
      const isLast = i === tasks.length - 1;
      const prefix = isLast ? '└─' : '├─';
      console.log(`${prefix} ${tasks[i]}`);
    }
    console.log('');
  }

  phaseSubItem(label: string, content: string): void {
    console.log(`│  └─ ${content}`);
  }

  phaseSubItemBar(label: string, pct: number): void {
    const filled = Math.round(pct / 5);
    const empty = 20 - filled;
    console.log(`│  └─ [${'▓'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`);
  }

  kernelMounted(): void {
    console.log('◈ KERNEL MEMORY MOUNTED ◈');
    console.log('');
  }

  runningSelfTest(): void {
    console.log('');
    console.log(hr());
    console.log('');
    console.log('');
    console.log('│ RUNNING CONSTITUTIONAL SELF-TEST (CST)');
    console.log('');
  }

  selfTestCategory(name: string): void {
    console.log(`├─ ${name.padEnd(30)} ........ [PASS]`);
  }

  selfTestSummary(passed: number, total: number): void {
    console.log('');
    console.log(`╔═ SELF-TEST PASSED [${passed}/${total}] ════════════════════════════════════╗`);
    console.log('║                                                            ║');
    console.log('║  SYSTEM STATE: USERLAND ACTIVATED                          ║');
    console.log('║                                                            ║');
    console.log('║  Runtime SDK       ████ ONLINE                             ║');
    console.log('║  API Gateway       ████ ONLINE                             ║');
    console.log('║  Event Store       ████ VERIFIED                           ║');
    console.log('║  Projection Layer  ████ ONLINE                             ║');
    console.log('║  Saga Engine       ████ ONLINE                             ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  userlandActivation(statuses: { label: string; state: string }[]): void {
    console.log('');
    console.log(hr());
    console.log('');
    console.log('');
    console.log('│ USERLAND ACTIVATION');
    console.log('');
    for (const status of statuses) {
      console.log(`├─ ${status.label.padEnd(20)} ████ ${status.state}`);
    }
    console.log('');
  }

  finalFrame(config: {
    version: string;
    buildHash: string;
    port: number;
    health: string;
  }): void {
    console.log('  ███████╗ ██████╗ ██╗   ██╗██████╗');
    console.log(`  ██╔════╝██╔═══██╗██║   ██║██╔══██╗     PROTOCOL v${config.version}`);
    console.log(`  ███████╗██║   ██║██║   ██║██████╔╝     SPEC-DRIVEN | CONSTITUTIONAL | AUDITABLE`);
    console.log(`  ╚════██║██║   ██║██║   ██║██╔══██╗     "THE LINUX OF FINANCE"`);
    console.log('  ███████║╚██████╔╝╚██████╔╝██║  ██║');
    console.log('  ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝');
    console.log('');
    console.log(`  ⬢ Listening:        http://localhost:${config.port}`);
    console.log(`  ⬢ Kernel State:     ● ${config.health}`);
    console.log(`  ⬢ Build Hash:       ${config.buildHash.slice(0, 16)}...`);
    console.log(`  ⬢ Attestation:      LOCKED`);
    console.log('');
  }
}
