# Streaming execution (SSE)

The DCDR Runtime supports an additive streaming endpoint for intent execution.

## Endpoint

- JSON (non-streaming): `POST /api/execution/run/:intent`
- Streaming (SSE): `POST /api/execution/stream/:intent`

The streaming endpoint returns `Content-Type: text/event-stream`.

## Event types

Events are framed as standard SSE:

```
event: <type>
data: <json>

```

Types:
- `meta`: stream metadata (gateway request id, intent, startedAt)
- `delta`: incremental text output (`{ "text": "..." }`)
- `final`: final `ExecuteIntentResponse` (`{ "response": { ... } }`)
- `error`: fatal streaming error when a final response cannot be produced

Notes
- Providers without native streaming may emit **zero** `delta` events and will still send a `final` event.

## TypeScript client usage

`DcdrRuntimeClient` exposes `executeIntentStream()` as an async iterator over events.

```ts
import { DcdrRuntimeClient } from "@dcdr/contracts";

const client = new DcdrRuntimeClient({
  baseUrl: "http://localhost:8000",
  apiToken: "dev-token",
  sessionBypassToken: "bypass-token",
});

for await (const evt of client.executeIntentStream("MY_INTENT", { vars: { name: "Ada" } })) {
  if (evt.type === "meta") {
    console.log("started", evt.data.gatewayRequestId);
  }

  if (evt.type === "delta") {
    process.stdout.write(evt.data.text);
  }

  if (evt.type === "final") {
    console.log("\nDONE", evt.data.response.status);
  }

  if (evt.type === "error") {
    console.error("STREAM FAILED", evt.data.error.code, evt.data.error.message);
  }
}
```

## Semantics

- Retries/fallback are allowed only before the first user-visible `delta` is emitted.
- Once streaming starts, the chosen provider implementation is locked.
