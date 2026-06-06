# Runtime client examples (TypeScript)

This folder contains realistic execution scripts that call the local runtime with the official TypeScript client (`DcdrRuntimeClient`) using typed `ExecuteIntentRequest` payloads.

All scripts follow the same pattern:

1. Define typed interfaces for request variables.
2. Build a typed `vars` object.
3. Build an explicit `ExecuteIntentRequest` object.
4. Call `client.executeIntent(intent, request)`.
5. Print full JSON response (including report metadata).

## Prerequisites

- A running runtime container via Docker Compose
  - See: `../runtime-selfhosted/`
- Node.js `22.x` (same as the runtime repo; includes global `fetch`)

## Available examples

- `npm run start:nutrition`
  - Intent: `NUTRITION_PROTEIN_SUGGESTION`
  - Registry: `src/contracts/examples/registry.nutrition_protein.json`
- `npm run start:banking-incident-classifier`
  - Intent: `BANKING_INCIDENT_CLASSIFIER`
  - Registry: `src/contracts/examples/registry.banking_incident_classifier.json`
- `npm run start:support-ticket-classifier`
  - Intent: `SUPPORT_TICKET_CLASSIFIER`
  - Registry: `src/contracts/examples/registry.support_ticket_classifier.json`
- `npm run start:product-format-parser`
  - Intent: `PRODUCT_FORMAT_PARSER`
  - Registry: `src/contracts/examples/registry.product_format_parser.json`
- `npm run start:supplier-risk-assessment`
  - Intent: `SUPPLIER_RISK_ASSESSMENT`
  - Registry: `src/contracts/examples/registry.supplier_risk_assessment.json`

## Configure the OpenAI credential

Each example registry includes this placeholder credential value:

- `REPLACE_ME_OPENAI_API_KEY`

Before running any example, open the registry file you plan to use and replace it with a real key.

## Install

From this folder:

```powershell
npm install
```

## Run

Make sure the runtime is running (default: `http://localhost:8000`) and started with the registry matching the example you want to execute.

Then run one script (examples):

```powershell
npm run start:nutrition
npm run start:banking-incident-classifier
npm run start:support-ticket-classifier
npm run start:product-format-parser
npm run start:supplier-risk-assessment
```

### Configuration (optional)

By default, the script uses:

- `DCDR_BASE_URL=http://localhost:8000`
- `DCDR_API_TOKEN=dev-token`
- `DCDR_SESSION_BYPASS_TOKEN=dev-session-bypass`

Override them in PowerShell:

```powershell
$env:DCDR_BASE_URL = "http://localhost:8000"
$env:DCDR_API_TOKEN = "dev-token"
$env:DCDR_SESSION_BYPASS_TOKEN = "dev-session-bypass"

npm run start:nutrition
```
