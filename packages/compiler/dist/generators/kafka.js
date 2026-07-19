import { sha256 } from '../utils/hash.js';
export function generateKafka(ir) {
    const protocolVersion = ir.meta.protocolVersion;
    const compilerVersion = ir.meta.compilerVersion;
    const topics = [];
    for (const node of ir.nodes) {
        if (node.type === 'event') {
            const domain = node.domain;
            const aggregate = node.aggregate;
            const eventName = node.sourceRef;
            const parts = eventName.split('.');
            const action = parts.slice(2).join('_');
            // topic_naming: sovr.{domain}.{aggregate}.{event_type} per compiler.yaml
            const topic = `sovr.${domain}.${aggregate}.${action}`;
            topics.push({
                name: topic,
                domain,
                aggregate,
                event: eventName,
                partition_key: 'aggregate_id',
                retention: domain === 'vault' || domain === 'ledger' ? 'PERMANENT' : '7_DAYS',
                compaction: true,
                replication_factor: 3,
                min_in_sync_replicas: 2,
            });
        }
    }
    topics.sort((a, b) => a.name.localeCompare(b.name));
    const body = `# Kafka topics — SOVR generated\n# compiler ${compilerVersion} protocol ${protocolVersion}\n# INV-001 event immutability -> retention PERMANENT for financial/audit\n${JSON.stringify({ topics }, null, 2)}`;
    const full = `# SOVR GENERATED — Kafka Topics\n# hash ${sha256(body)}\n${body}`;
    return [{
            path: 'config/kafka/topics.yaml',
            content: full,
            sha256: sha256(full),
            sourceRefs: topics.map(t => t.event),
        }];
}
export function generateRedis(ir) {
    const compilerVersion = ir.meta.compilerVersion;
    const streams = ir.nodes.filter(n => n.type === 'event').map(n => {
        const domain = n.domain;
        const agg = n.aggregate;
        return {
            stream: `sovr:stream:${domain}:${agg}`,
            consumer_group: `sovr-${domain}-service`,
            max_length: 100000,
            consumer_ack_timeout_ms: 30000,
            event: n.sourceRef,
        };
    });
    const grouped = new Map();
    for (const s of streams) {
        if (!grouped.has(s.stream))
            grouped.set(s.stream, s);
    }
    const uniq = Array.from(grouped.values()).sort((a, b) => a.stream.localeCompare(b.stream));
    const body = JSON.stringify({ streams: uniq }, null, 2);
    const full = `# SOVR GENERATED — Redis Streams\n# hash ${sha256(body)}\n${body}`;
    return [{
            path: 'config/redis/streams.yaml',
            content: full,
            sha256: sha256(full),
            sourceRefs: uniq.map(u => u.event),
        }];
}
//# sourceMappingURL=kafka.js.map