# Runtime (self-hosted) examples

This example is intended to be validated in CI using the same validator as the runtime:

- `npm run dcdr -- validate-registry <path>`

Available registries are located at:

- `src/contracts/examples/registry.nutrition_protein.json`
- `src/contracts/examples/registry.banking_incident_classifier.json`
- `src/contracts/examples/registry.support_ticket_classifier.json`
- `src/contracts/examples/registry.product_format_parser.json`
- `src/contracts/examples/registry.supplier_risk_assessment.json`

## Quickstart

1. Choose registry with `.env`

From this folder:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and set:

- `DCDR_REGISTRY_FILE=registry.nutrition_protein.json`
- or `DCDR_REGISTRY_FILE=registry.banking_incident_classifier.json`
- or `DCDR_REGISTRY_FILE=registry.support_ticket_classifier.json`
- or `DCDR_REGISTRY_FILE=registry.product_format_parser.json`
- or `DCDR_REGISTRY_FILE=registry.supplier_risk_assessment.json`

1. Edit the selected registry and replace:

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

Nutrition:

```powershell
curl -sS `
 -H 'Content-Type: application/json' `
 -H 'token: dev-token' `
 -H 'x-session-bypass: dev-session-bypass' `
 -X POST http://localhost:8000/api/execution/run/NUTRITION_PROTEIN_SUGGESTION `
 -d '{"vars":{"age":29,"weightKg":78,"sex":"MALE","heightCm":180,"activityLevel":"MODERATE"}}'
```

Banking incident classifier:

```powershell
curl -sS `
 -H 'Content-Type: application/json' `
 -H 'token: dev-token' `
 -H 'x-session-bypass: dev-session-bypass' `
 -X POST http://localhost:8000/api/execution/run/BANKING_INCIDENT_CLASSIFIER `
 -d '{"vars":{"incidentId":"INC-2026-06-00042","customerSegment":"CORPORATE","region":"EU","affectedAccounts":1240,"estimatedExposureEur":248500.75,"fraudSignalsCount":11,"containsPii":true,"description":"Unusual payment velocity detected after privileged API key rotation.","sourceSystem":{"systemName":"payments-gateway","criticalityTier":"TIER_0","isExternalFacing":true},"channels":["API","WEB"]}}'
```

Option B: Official TypeScript client (`DcdrRuntimeClient`)

- See the example project at: `src/contracts/examples/runtime-client/`

From the repo root:

```powershell
cd src/contracts/examples/runtime-client
npm install
npm run start:nutrition
npm run start:banking-incident-classifier
npm run start:support-ticket-classifier
npm run start:product-format-parser
npm run start:supplier-risk-assessment
```

Option C: Swagger UI

- Open: <http://localhost:8000/api/docs>
- If your runtime requires dev auth headers, use the Swagger "Authorize" button to set `token` (ApiTokenAuth).
  - Note: if the runtime is configured to require `x-session-bypass` for `/api/execution/*` and Swagger UI cannot send it, prefer Option A or B.
