// ============================================================
// Redis Stream Publisher — real event streaming using XADD
// Uses ioredis (already in package.json).
// Production: SOVR_REDIS_ENABLED=true and SOVR_REDIS_URL=redis://host:6379
// Sandbox: NullStreamPublisher is used (zero I/O).
// ============================================================

import IORedis, { Redis } from 'ioredis';
import type { EventEnvelope } from './eventStore.js';

export interface StreamPublisher {
  publish(stream: string, envelope: EventEnvelope): Promise<void>;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export class NullStreamPublisher implements StreamPublisher {
  async publish(_stream: string, _envelope: EventEnvelope): Promise<void> { /* no-op */ }
  isConnected(): boolean { return false; }
  async connect(): Promise<void> { /* no-op */ }
  async disconnect(): Promise<void> { /* no-op */ }
}

export class RedisStreamPublisher implements StreamPublisher {
  private client: Redis;
  private connected = false;
  private maxLen: number;

  constructor(opts: { url: string; maxLen: number }) {
    this.client = new IORedis(opts.url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    this.maxLen = opts.maxLen;
    this.client.on('error', (e) => console.warn('Redis error:', e.message));
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.client.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.quit();
    this.connected = false;
  }

  isConnected(): boolean { return this.connected; }

  async publish(stream: string, envelope: EventEnvelope): Promise<void> {
    if (!this.connected) throw new Error('RedisStreamPublisher: not connected');
    // Approximate trimming to keep stream bounded (XADD ... MAXLEN ~ N)
    await this.client.xadd(
      stream,
      'MAXLEN', '~', String(this.maxLen),
      '*',
      'event_id', envelope.event_id,
      'event_name', envelope.event_name,
      'source_domain', envelope.source_domain,
      'aggregate', envelope.aggregate,
      'aggregate_id', envelope.aggregate_id,
      'command_id', envelope.command_id,
      'correlation_id', envelope.correlation_id,
      'actor_id', envelope.actor_id,
      'timestamp', envelope.timestamp,
      'payload', JSON.stringify(envelope.payload),
      'envelope', JSON.stringify(envelope),
    );
  }
}
