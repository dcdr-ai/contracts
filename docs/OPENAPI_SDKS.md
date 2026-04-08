# Generate SDKs (Python/C#/Java) from OpenAPI

This content is moved from the README to keep the package entry point scannable.

The runtime publishes a canonical OpenAPI spec. This is the best way to generate SDKs for other languages.

## 1) Get the OpenAPI JSON

Option A (simplest): download from a running runtime:

```bash
curl -sS http://localhost:8000/api/openapi.json > openapi.runtime.json
```

Option B (reproducible): dump from the runtime repo (recommended for CI and releases):

```bash
# From the `dcdr-runtime` repository root
npm run openapi:dump
```

This writes `openapi.runtime.json` deterministically.

## 2) Generate a client SDK

You can use OpenAPI Generator.

If you don't want to install anything globally, run it via Docker:

```bash
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli \
	generate -i /local/openapi.runtime.json -g python -o /local/out/python
```

Windows PowerShell note: if `$PWD` doesn't mount correctly, try `-v "${PWD}:/local"`.

Other common targets:

```bash
# C#
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli \
	generate -i /local/openapi.runtime.json -g csharp -o /local/out/csharp

# Java
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli \
	generate -i /local/openapi.runtime.json -g java -o /local/out/java
```

## 3) Compatibility guidance

- Prefer generating against a pinned runtime version (or pinned `openapi.runtime.json`) to keep SDKs stable.
- The runtime API uses stable `operationId`s specifically to support SDK generation.
