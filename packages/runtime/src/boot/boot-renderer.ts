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

function box(content: string, width = 88): string {
  const pad = Math.max(0, width - content.length - 4);
  return `┌${hr('─', width)}┐\n│  ${content}${' '.repeat(pad)}│\n└${hr('─', width)}┘`;
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
    console.log('');
    console.log('');
    console.log('');
    console.log('                         ███████╗ ██████╗ ██╗   ██╗██████╗');
    console.log('                         ██╔════╝██╔═══██╗██║   ██║██╔══██╗');
    console.log('                         ███████╗██║   ██║██║   ██║██████╔╝');
    console.log('                         ╚════██║██║   ██║██║   ██║██╔══██╗');
    console.log('                         ███████║╚██████╔╝╚██████╔╝██║  ██║');
    console.log('                         ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝');
    console.log('');
    console.log('                  C O N S T I T U T I O N A L   K E R N E L');
    console.log('');
    console.log('                           S O V R   F I N A N C I A L   O S');
    console.log('');
    console.log('                     "Source of Canonical Events Activated"');
    console.log('');
    console.log(hr());
    console.log('');
    console.log('');
    console.log('                    INITIALIZING SOVR TRUSTED COMPUTE ENVIRONMENT');
    console.log('');
    console.log(`                    [${'█'.repeat(40)}] 100%`);
    console.log('');
  }

  header(): void {
    console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                              ║');
    console.log('║   SOVR PROTOCOL KERNEL                                                       ║');
    console.log('║   Runtime ABI v1                                                             ║');
    console.log('║   Constitutional Execution Environment                                       ║');
    console.log('║                                                                              ║');
    console.log('║   Status: INITIALIZING                                                       ║');
    console.log('║                                                                              ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  phase(phaseName: string): void {
    this.ensureHeader();
    while (BOOT_PHASES[this.phaseIndex] !== phaseName && this.phaseIndex < BOOT_PHASES.length) {
      this.phaseIndex++;
    }
    console.log(`┌──────────────────────────────────────────────────────────────────────────────┐`);
    console.log(`│                                                                              │`);
    console.log(`│  ${`PHASE ${this.phaseIndex} — ${phaseName}`.padEnd(74)}│`);
    console.log(`│                                                                              │`);
    console.log(`└──────────────────────────────────────────────────────────────────────────────┘`);
    console.log('');
  }

  phaseComplete(phaseName: string): void {
    const idx = BOOT_PHASES.indexOf(phaseName);
    if (idx >= 0) {
      console.log(`  ✓ Phase ${idx} complete`);
      console.log('');
    }
  }

  kernelMounted(): void {
    console.log('');
    console.log('                         ◈ KERNEL MEMORY MOUNTED ◈');
    console.log('');
  }

  runningSelfTest(): void {
    console.log('');
    console.log(hr());
    console.log('');
    console.log('');
    console.log('                    RUNNING CONSTITUTIONAL SELF TEST');
    console.log('');
  }

  selfTestCategory(name: string): void {
    console.log(`          ${name.padEnd(30)} ........ PASS`);
  }

  selfTestSummary(total: number): void {
    console.log('');
    console.log(`                 ╔══════════════════════════════╗`);
    console.log(`                 ║                              ║`);
    console.log(`                 ║     BOOT SELF TEST ${total}/${total}       ║`);
    console.log(`                 ║                              ║`);
    console.log(`                 ╚══════════════════════════════╝`);
    console.log('');
  }

  userlandActivation(statuses: { label: string; state: string }[]): void {
    console.log('');
    console.log(hr());
    console.log('');
    console.log('');
    console.log('                        USERLAND ACTIVATION');
    console.log('');
    for (const status of statuses) {
      console.log(`                  ${status.label.padEnd(20)} ${status.state}`);
    }
    console.log('');
    console.log(`                         SYSTEM HEALTHY`);
    console.log('');
  }

  finalFrame(config: {
    version: string;
    buildHash: string;
    port: number;
    health: string;
  }): void {
    console.log(`╔══════════════════════════════════════════════════════════════════════════════╗`);
    console.log(`║                                                                              ║`);
    console.log(`║                 S O V R   P R O T O C O L   ${config.version.padEnd(12)}║`);
    console.log(`║                                                                              ║`);
    console.log(`║             SPEC-DRIVEN  •  CONSTITUTIONAL  •  AUDITABLE                    ║`);
    console.log(`║                                                                              ║`);
    console.log(`║                    THE LINUX OF FINANCE                                     ║`);
    console.log(`║                                                                              ║`);
    console.log(`╚══════════════════════════════════════════════════════════════════════════════╝`);
    console.log('');
    console.log(`                 Listening:`);
    console.log(`                 http://localhost:${config.port}`);
    console.log('');
    console.log(`                 Kernel State:`);
    console.log(`                 ● ${config.health}`);
    console.log('');
    console.log(`                 Build:`);
    console.log(`                 ${config.buildHash.slice(0, 16)}...`);
    console.log('');
  }
}
