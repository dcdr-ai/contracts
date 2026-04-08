# CLI (`dcdr`)

This content is moved from the README to keep the package entry point scannable.

The runtime repository includes a small CLI called `dcdr`.

Where it lives:

- It ships with the runtime repository source (it is not a standalone published binary yet).

Run it from the `dcdr-runtime` repository root:

```bash
npm ci
npm run dcdr -- --help
```

## Common commands

```bash
# Healthcheck
npm run dcdr -- health --base-url http://localhost:8000 --api-token dev-token

# Execute an intent
npm run dcdr -- run HELLO_WORLD --base-url http://localhost:8000 --api-token dev-token --vars-json '{"name":"Ada"}'

# Demo
npm run dcdr -- demo DCDR_LOCAL_DEMO --base-url http://localhost:8000 --api-token dev-token --vars-file ./vars.json

# Circuit breaker status
npm run dcdr -- circuit-breaker openai --base-url http://localhost:8000 --api-token dev-token

# Circuit breaker reset (internal-only)
npm run dcdr -- circuit-breaker-reset openai --base-url http://localhost:8000 --api-token dev-token
```

## Output options

- `--json` → machine-readable output
- `--color auto|always|never` → ANSI colors
