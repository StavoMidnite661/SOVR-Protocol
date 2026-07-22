# Third-Party Integration Cookbook

## Python Example (using requests)

```python
import requests, jwt  # or use PyJWT

BASE = "http://localhost:3001/api/v1"

# 1. Get JWT
r = requests.post(f"{BASE}/identity/session", json={
    "actor_id": "my_bank_app",
    "actor_type": "external_system"
})
jwt = r.json()["jwt"]

headers = {"Authorization": f"Bearer {jwt}", "X-Actor-Id": "my_bank_app"}

# 2. Grant capability (usually done by governance)
requests.post(f"{BASE}/capabilities/grant", json={
    "capability_id": "treasury.transfer.request",
    "actor_id": "my_bank_app",
    "scope_pattern": "treasury.transfer:*"
}, headers={"X-Actor-Id": "governance"})

# 3. Execute command
resp = requests.post(f"{BASE}/treasury/transfer_order", json={
    "commandName": "treasury.transfer.request",
    "capability_id": "treasury.transfer.request",
    "scope": "treasury.transfer:*",
    "payload": { ... }
}, headers=headers)

print(resp.json())
```

## Go Example (sketch)

```go
// Similar pattern using net/http + json
// Always call /health first and verify build_hash
```

## Best Practices

- Always wait for `final_health == "HEALTHY"`
- Verify build hash on first connection
- Use correlation_id for all related operations
- Subscribe to events for async confirmation

See also: `PROTOCOL_API_SERVICE_GUIDE.md` for full curl examples.