import type { AgentMemoryEntry } from '../types.js';

export interface AgentMemoryConfig {
  retention_class: 'permanent' | 'regulatory_7y' | 'operational_90d' | 'session';
  max_entries: number;
}

export class AgentMemory {
  private readonly entries: AgentMemoryEntry[] = [];
  private readonly config: AgentMemoryConfig;

  constructor(config: AgentMemoryConfig) {
    this.config = config;
  }

  append(entry: Omit<AgentMemoryEntry, 'memory_event_id' | 'timestamp' | 'event_hash' | 'previous_hash'>): AgentMemoryEntry {
    const previousHash = this.entries.length > 0 ? this.entries[this.entries.length - 1].event_hash : '0'.repeat(64);
    const memoryEventId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const fullEntry: AgentMemoryEntry = {
      ...entry,
      memory_event_id: memoryEventId,
      timestamp,
      previous_hash: previousHash,
      event_hash: this.computeHash({ ...entry, memory_event_id: memoryEventId, timestamp, previous_hash: previousHash }),
    };

    this.entries.push(fullEntry);
    return fullEntry;
  }

  getEntry(memoryEventId: string): AgentMemoryEntry | undefined {
    return this.entries.find((e) => e.memory_event_id === memoryEventId);
  }

  getEntriesByMission(missionId: string): AgentMemoryEntry[] {
    return this.entries.filter((e) => e.mission_id === missionId);
  }

  getAllEntries(): AgentMemoryEntry[] {
    return [...this.entries];
  }

  getCount(): number {
    return this.entries.length;
  }

  validateChain(): { valid: boolean; broken_links: string[] } {
    const brokenLinks: string[] = [];
    for (let i = 1; i < this.entries.length; i++) {
      const prev = this.entries[i - 1];
      const curr = this.entries[i];
      if (curr.previous_hash !== prev.event_hash) {
        brokenLinks.push(`${prev.memory_event_id} -> ${curr.memory_event_id}`);
      }
    }
    return { valid: brokenLinks.length === 0, broken_links: brokenLinks };
  }

  clear(): void {
    this.entries.length = 0;
  }

  private computeHash(data: Record<string, unknown>): string {
    const str = JSON.stringify(data);
    let hash = 0n;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 131n + BigInt(str.charCodeAt(i))) & 0xFFFFFFFFFFFFFFFFn;
    }
    return hash.toString(16).padStart(64, '0').slice(0, 64);
  }
}
