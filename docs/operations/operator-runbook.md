# SOVR Operator Runbook

## Starting the System

```bash
node packages/runtime/dist/server/index.js
```

## Backup

```bash
cp generated/data/sovr-events.json backups/sovr-events-$(date +%s).json
```

## Restore

1. Stop server
2. Replace `sovr-events.json`
3. Restart — EventStore will rebuild indexes and projections

## Common Issues

- **Build hash mismatch** → Recompile or check you are running the correct compiled artifacts
- **Causation warnings** → Normal on genesis. Enable strict mode in prod.
- **Projection lag** → Check Kafka/Redis consumers or database load

## Emergency Halt

Use governance command:
```bash
POST /api/v1/governance/emergency_halt
```

## Health Monitoring

Poll `/health` and alert if `final_health != "HEALTHY"`.