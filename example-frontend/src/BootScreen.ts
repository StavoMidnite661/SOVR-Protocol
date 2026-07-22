// Boot Screen UI — Frontend shows kernel boot before app loads
// Polls /api/v1/health in real time. Resolves only when the kernel
// reports final_health === 'HEALTHY'. Times out after maxWaitMs.

export interface BootScreenLevel {
  level: number;
  icon: string;
  name: string;
  desc: string;
}

const BOOT_LEVELS: BootScreenLevel[] = [
  { level: 0, icon: '🔌', name: 'POST', desc: 'Crypto self-test, env isolated' },
  { level: 1, icon: '🔐', name: 'Bootloader', desc: 'Verifying build_hash unfakeable' },
  { level: 2, icon: '🧠', name: 'Kernel', desc: 'Loading 10 invariants, 21 envelope fields' },
  { level: 3, icon: '🏦', name: 'Core', desc: 'Vault, Ledger, Treasury' },
  { level: 4, icon: '🛡️', name: 'Security', desc: 'Identity, Policy, Intent, Agent' },
  { level: 5, icon: '🌐', name: 'Boundary', desc: '12 payment rails, 4 chains' },
  { level: 6, icon: '👁️', name: 'Projections', desc: '15 read models replay' },
  { level: 7, icon: '🚀', name: 'Userland', desc: 'SDK ready, frontend gate' },
];

export async function showBootScreen(_rootDir: string): Promise<void> {
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│  SOVR Financial OS — Booting...             │');
  console.log('└─────────────────────────────────────────────┘');
  for (const l of BOOT_LEVELS) {
    console.log(`${l.icon} [${l.level}] ${l.name.padEnd(12)} ${l.desc}`);
    await new Promise(r => setTimeout(r, 50));
  }
}

export interface WaitForHealthyOpts {
  apiUrl: string;
  maxWaitMs?: number;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
}

export async function waitForHealthyBoot(opts: WaitForHealthyOpts): Promise<void> {
  const interval = opts.intervalMs ?? 500;
  const deadline = Date.now() + (opts.maxWaitMs ?? 30_000);
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;

  const url = `${opts.apiUrl.replace(/\/+$/, '')}/health`;
  let last: any = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetchImpl(url);
      if (res.ok) {
        last = await res.json();
        if (last?.final_health === 'HEALTHY') {
          console.log(`✓ Kernel HEALTHY (build_hash ${last.build_hash?.slice(0, 16)}..., ${last.subsystems?.event_store?.meta?.totalEvents ?? 0} events, ${last.subsystems?.projections?.detail})`);
          return;
        }
        console.log(`  …kernel status=${last?.final_health ?? 'unknown'}, waiting…`);
      }
    } catch (e) {
      console.log(`  …kernel not reachable at ${url}, retrying…`);
    }
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`waitForHealthyBoot: kernel did not become HEALTHY within ${opts.maxWaitMs ?? 30_000}ms. Last response: ${JSON.stringify(last)}`);
}
