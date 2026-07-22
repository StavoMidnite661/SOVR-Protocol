# Generating Clients from OpenAPI

```bash
# Example: Python
openapi-generator-cli generate \
  -i generated/openapi.yaml \
  -g python \
  -o clients/python

# Example: Go
openapi-generator-cli generate \
  -i generated/openapi.yaml \
  -g go \
  -o clients/go
```

**Important**: After generation, add:
- Build hash verification helper
- `waitForHealthy()` convenience method
- Proper error handling for SOVR command responses

The generated clients give you the raw HTTP surface. Wrap them with the SOVR semantic layer (capabilities, correlation, etc.).