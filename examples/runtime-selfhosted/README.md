# Runtime (self-hosted) example: nutrition-protein

This example is intended to be validated in CI using the same validator as the runtime:

- `npm run dcdr -- validate-registry <path>`

The canonical registry is located at:

- `src/contracts/examples/registry.nutrition_protein.json`

## Quickstart

1. Edit `src/contracts/examples/registry.nutrition_protein.json` and replace:

- `REPLACE_ME_OPENAI_API_KEY`

1. Start the runtime with Docker (using `--registry` mode)

From this folder:

```powershell
docker compose up
```

Or using npm scripts:

```powershell
npm run up
```

1. Execute the intent (choose one)

Option A: `curl`

```powershell
curl -sS `
 -H 'Content-Type: application/json' `
 -H 'token: dev-token' `
 -H 'x-session-bypass: dev-session-bypass' `
 -X POST http://localhost:8000/api/execution/run/NUTRITION_PROTEIN_SUGGESTION `
 -d '{"vars":{"age":29,"weightKg":78,"sex":"MALE","heightCm":180,"activityLevel":"MODERATE"}}'
```

Option B: Official TypeScript client (`DcdrRuntimeClient`)

- See the example project at: `src/contracts/examples/runtime-client/`

From the repo root:

```powershell
cd src/contracts/examples/runtime-client
npm install
npm start
```

Option C: Swagger UI

- Open: <http://localhost:8000/api/docs>
- If your runtime requires dev auth headers, use the Swagger "Authorize" button to set `token` (ApiTokenAuth).
  - Note: if the runtime is configured to require `x-session-bypass` for `/api/execution/*` and Swagger UI cannot send it, prefer Option A or B.
