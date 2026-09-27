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
- `meta`: stream metadata (`gatewayRequestId`, `intent`, `startedAt`, and since 3.19.0 `structured`)
- `delta`: incremental output (`{ "text": "...", "attempt": 1 }`, plus `path` for structured executions)
- `final`: final `ExecuteIntentResponse` (`{ "response": { ... } }`)
- `error`: fatal streaming error when a final response cannot be produced

`meta` always comes first. It is sent once the runtime knows which implementation runs first, so it
can say whether the execution is structured; `structured` is absent when the runtime answered before
that point (an unknown intent, a validation or selection error).

Notes
- Providers without native streaming may emit **zero** `delta` events and will still send a `final` event.
- Act on `final` only. Deltas are for display.

## Structured intents (since 3.19.0)

An execution is structured when its `response_format` is `json_object` or `json_schema`: its `final`
result is an object validated against the intent's output schema. Its deltas never carry raw JSON.
Each one carries the next piece of a **string field's decoded value** and the field's `path`:

```
event: meta
data: {"gatewayRequestId":"...","intent":"KNOWLEDGE_ANSWER","startedAt":"...","structured":true}

event: delta
data: {"text":"The transformer uses \"attention\"","path":"answer","attempt":1}

event: delta
data: {"text":" to weigh tokens.","path":"answer","attempt":1}

event: delta
data: {"text":"Attention is all you need","path":"citations[0].quote","attempt":1}

event: final
data: {"response":{"status":"OK","output":{"answer":"...","citations":[{"quote":"...","page":4}],"unanswerable":false}, ...}}
```

- `text` is decoded: escapes are resolved and a surrogate pair is never split across two deltas, so
  pieces can be appended as they arrive.
- `path` uses dotted keys and bracketed indexes from the root of the result (`answer`,
  `citations[0].quote`). A key that is not a plain identifier is written as a quoted bracket
  (`["my.key"]`).
- Only string fields stream. Numbers, booleans and `null` arrive with `final`.
- For every string field, the deltas of the last attempt, concatenated, equal the value in `final`.
- Structured streaming is supported on OpenAI and OpenAI-compatible Chat Completions (OpenAI, Grok,
  compatible endpoints), Anthropic, Gemini and Mistral. Models served through the OpenAI Responses
  API do not stream yet, in either mode: they send zero deltas and a `final`.

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
    // Structured executions: evt.data.path names the field (e.g. "answer").
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

- Every `delta` carries `attempt`, the 1-based attempt number that produced it (the same number as
  `ExecutionAttemptReport.attempt` in the final report).
- **Text executions:** retries and fallback are allowed only before the first `delta`. Once streaming
  starts, the chosen implementation is locked; a failure after that ends with a `final` whose status is
  `ERROR`.
- **Structured executions** stay retryable after streaming, because the answer is validated only at the
  end: a `SCHEMA_FAIL` can still be repaired, and an upstream failure can still retry or fall back. When
  a delta arrives with a higher `attempt`, discard what earlier attempts painted and start again.
