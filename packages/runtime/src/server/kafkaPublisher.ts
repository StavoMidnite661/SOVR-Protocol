// ============================================================
// Kafka Publisher — real event publishing to Kafka topic per envelope
// Uses kafkajs (already in package.json).
// Production: SOVR_KAFKA_ENABLED=true and SOVR_KAFKA_BROKERS=host:9092,...
// Sandbox: NullPublisher is used (zero I/O).
// ============================================================

import { Kafka, Producer, logLevel } from 'kafkajs';
import type { EventEnvelope } from './eventStore.js';

export interface Publisher {
  publish(topic: string, envelope: EventEnvelope): Promise<void>;
  isConnected(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

export class NullPublisher implements Publisher {
  async publish(_topic: string, _envelope: EventEnvelope): Promise<void> { /* no-op */ }
  isConnected(): boolean { return false; }
  async connect(): Promise<void> { /* no-op */ }
  async disconnect(): Promise<void> { /* no-op */ }
}

export class KafkaPublisher implements Publisher {
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor(opts: { brokers: string[]; clientId: string }) {
    if (!opts.brokers?.length) throw new Error('KafkaPublisher: brokers required');
    this.kafka = new Kafka({ clientId: opts.clientId, brokers: opts.brokers, logLevel: logLevel.WARN });
    this.producer = this.kafka.producer({ allowAutoTopicCreation: true, idempotent: true });
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.producer.connect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
  }

  isConnected(): boolean { return this.connected; }

  async publish(topic: string, envelope: EventEnvelope): Promise<void> {
    if (!this.connected) throw new Error('KafkaPublisher: not connected');
    await this.producer.send({
      topic,
      messages: [{
        key: envelope.aggregate_id,
        value: JSON.stringify(envelope),
        headers: {
          'event_name': envelope.event_name,
          'source_domain': envelope.source_domain,
          'aggregate': envelope.aggregate,
          'correlation_id': envelope.correlation_id,
          'build_hash': (envelope as any).build_hash ?? '',
        },
      }],
    });
  }
}
