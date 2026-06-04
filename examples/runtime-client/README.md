# Runtime client example (TypeScript): nutrition-protein

This example calls the local runtime using the official TypeScript client (`DcdrRuntimeClient`) instead of raw `curl`.

## Prerequisites

- A running runtime container via Docker Compose
  - See: `../runtime-selfhosted/`
- Node.js `22.x` (same as the runtime repo; includes global `fetch`)

## Configure the OpenAI credential

This example uses the canonical registry file:

- `src/contracts/examples/registry.nutrition_protein.json`

Before running, open that file and replace:

- `REPLACE_ME_OPENAI_API_KEY`

with your real OpenAI API key.

## Install

From this folder:

```powershell
npm install
```

## Run

Make sure the runtime is running (default: `http://localhost:8000`).

Then run:

```powershell
npm start
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

npm start
```
