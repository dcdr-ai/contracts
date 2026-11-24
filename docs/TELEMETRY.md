# OpenTelemetry telemetry from your AI apps

Your AI apps do not have to run as DCDR intents or call through the AI Gateway for DCDR to see them. Apps built
with LangChain, LlamaIndex, the OpenAI Agents SDK, the Vercel AI SDK, OpenLLMetry, Langfuse, or plain
OpenTelemetry already emit OpenTelemetry (OTel) traces of their model calls, agents and tools. Point their OTLP
exporter at the DCDR runtime and DCDR records, for each app: that it exists, which providers and models it uses,
token usage, errors and latency, agent and tool activity, and whether it follows your workspace's model policy.

Telemetry is evidence the app **reports**. It cannot block a call (the [AI Gateway](GATEWAY.md) does that); the
only control is refusing a service's telemetry. DCDR stores what the app reports and never infers: a provider the
app does not report stays empty, it is never guessed from a model name.

- [Availability](#availability)
- [Set up an app](#set-up-an-app)
- [Snippets per SDK](#snippets-per-sdk)
- [What is recorded](#what-is-recorded)
- [Privacy and payload levels](#privacy-and-payload-levels)
- [Redacting before the data leaves your network (Collector)](#redacting-before-the-data-leaves-your-network-collector)
- [Limits and responses](#limits-and-responses)
- [Send with the DCDR client](#send-with-the-dcdr-client)
- [Check a setup: `dcdr telemetry-test`](#check-a-setup-dcdr-telemetry-test)
- [Troubleshooting](#troubleshooting)

## Availability

| Mode | Telemetry |
|---|---|
| Cloud, Cloud Pro, Enterprise | Yes, within the plan's monthly span quota |
| Self-hosted runtime with `--registry` (no control plane) | No: `/v1/traces` and `/v1/logs` answer `404` |

The endpoints:

- `POST /v1/traces` (OTLP/HTTP traces)
- `POST /v1/logs` (OTLP/HTTP log records; only GenAI events are used, see [below](#log-records))

The **telemetry host**, written `<telemetry host>` below:

| Where | Telemetry host |
|---|---|
| DCDR Cloud | `telemetry.dcdr.ai` |
| DCDR install (private cloud, on-premises) | the install's runtime host |

On DCDR Cloud, `runtime.dcdr.ai` and `gateway.dcdr.ai` also answer both paths; `telemetry.dcdr.ai` serves only
these two paths. The DCDR client and `dcdr telemetry-test` send to `telemetry.dcdr.ai` unless you give them
another host (since 3.25.1).

Both accept `POST` only (any other method answers `405` with `Allow: POST`), protobuf (`application/x-protobuf`)
and JSON (`application/json`), uncompressed or with `Content-Encoding: gzip` / `deflate`. gRPC is not supported:
use the OTLP/HTTP exporter.

## Set up an app

1. **Create a service token with the `traces:write` scope** (AI / Admin → Tokens). The scope covers both
   endpoints and nothing else; `logs:write` does not grant it. The token travels **only** in
   `Authorization: Bearer <token>` (the scheme is case-insensitive): the `token`, `x-api-key` and other headers
   the rest of the runtime accepts are not read on these two endpoints.
2. **Set the standard OpenTelemetry environment variables** in the app:

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=https://<telemetry host>
   OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf          # or http/json
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer%20<service token>
   OTEL_SERVICE_NAME=support-assistant
   OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production,service.version=1.4.2
   OTEL_METRICS_EXPORTER=none                          # DCDR does not take OTLP metrics
   ```

   The SDK appends `/v1/traces` and `/v1/logs` to the endpoint. DCDR does not accept OTLP metrics: with the
   endpoint set, several SDKs (the Node SDK, `opentelemetry-instrument`) also export metrics to `/v1/metrics`,
   get `404` and log an export error on every interval, so turn metrics export off as above (or send metrics to
   your own backend with `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`). In `OTEL_EXPORTER_OTLP_HEADERS` the space after
   `Bearer` is written `%20` (the variable is URL-encoded); some SDKs also accept a literal space.
3. **Name the app.** `OTEL_SERVICE_NAME` plus `deployment.environment.name` identify the service in DCDR. An app
   that does not name itself is recorded as `unknown_service` with a finding. `service.version` is recorded as
   reported and drives the version comparisons.
4. **Turn on the GenAI instrumentation** of your framework (snippets below). Plain HTTP or database spans are not
   needed: DCDR keeps GenAI spans and the spans that connect them, and drops the rest.

The first span of a new service creates it in DCDR (Telemetry Services) with status DISCOVERED, unless your
workspace uses strict mode, where unknown services are recorded as PENDING and their spans refused until an
administrator accepts them.

## Snippets per SDK

All of them read the environment variables above; only the instrumentation differs.

**OpenAI SDK, Python (OTel `openai-v2`)**

```bash
pip install opentelemetry-distro opentelemetry-exporter-otlp-proto-http opentelemetry-instrumentation-openai-v2
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental opentelemetry-instrument python app.py
```

**OpenAI Agents SDK (Python)**: OTel's `opentelemetry-instrumentation-openai-agents-v2`, or OpenInference's
`openinference-instrumentation-openai-agents`:

```python
from opentelemetry.instrumentation.openai_agents import OpenAIAgentsInstrumentor
OpenAIAgentsInstrumentor().instrument()
```

**LangChain / LangGraph / LlamaIndex (OpenInference)**

```python
from openinference.instrumentation.langchain import LangChainInstrumentor
LangChainInstrumentor().instrument()   # tracer provider from opentelemetry-distro / your SDK setup
```

**OpenLLMetry (Traceloop SDK)**

```python
from traceloop.sdk import Traceloop
Traceloop.init(app_name="support-assistant")   # honours OTEL_EXPORTER_OTLP_* when TRACELOOP_BASE_URL is unset
```

Set `TRACELOOP_BASE_URL=https://<telemetry host>` and `TRACELOOP_HEADERS=Authorization=Bearer <token>` if you
prefer Traceloop's own variables.

**Langfuse SDKs**: Langfuse exports OTLP to its own path with Basic auth. Put an OpenTelemetry Collector in
front (below) or configure the SDK's OTLP exporter to `https://<telemetry host>/v1/traces` with the bearer
header. Langfuse sends no provider, so the provider stays empty in DCDR.

**Vercel AI SDK v7 (`@ai-sdk/otel`)**

```ts
import { registerTelemetry } from "ai";
import { OpenTelemetry } from "@ai-sdk/otel";
registerTelemetry(new OpenTelemetry());
// in each call: experimental_telemetry: { isEnabled: true, functionId: "support-assistant" }
```

v4-v6 (`experimental_telemetry: { isEnabled: true }`) emit the older `ai.*` attributes, which DCDR understands too.
The v7 integration does not export `experimental_telemetry.metadata` (a `userId` set there is not sent), so v7 spans
carry no end user unless your code sets `user.id` on the span itself.
With `@vercel/otel`, set `OTEL_EXPORTER_OTLP_*` as above.

**Node, OpenAI SDK (`@opentelemetry/instrumentation-openai`)**

```ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
new NodeSDK({ instrumentations: [new OpenAIInstrumentation()] }).start();
```

## What is recorded

DCDR understands these conventions, current and older forms included:

| Convention | Recognised by |
|---|---|
| OpenTelemetry GenAI semantic conventions | `gen_ai.*` (current), and the older `gen_ai.system`, `prompt_tokens`, indexed `gen_ai.prompt.N.*` and per-message events |
| OpenInference (Arize) | `openinference.span.kind`, `llm.*`, `input.value` |
| OpenLLMetry (Traceloop) | `traceloop.*`, `llm.request.type`, `llm.usage.*` |
| Langfuse | `langfuse.*` |
| Vercel AI SDK | `ai.*` |

For each GenAI span: the operation (chat, embeddings, tool execution, agent invocation, workflow, retrieval...),
the provider and the models (requested and answering) as reported, token usage (input, output, cached, reasoning),
agent and tool names, conversation id, finish reasons, timing, status and error type, the service and its version,
and the trace tree (parent spans). A span whose operation no convention defines is kept as `OTHER` with the value
the app reported. Resource attributes are reduced to an allow-list (`service.*`, `deployment.environment*`,
`telemetry.sdk.*`, cloud region and platform, Kubernetes namespace and deployment, container image): host names,
process command lines and user names from SDK resource detectors never leave the runtime; only their names are
kept.

### Log records

Some instrumentations put prompt and completion content in OTLP **log records** rather than on the span
(OTel `openai-v2` and the Node instrumentation do). Send them to `/v1/logs` as well: GenAI events (`gen_ai.*`,
named in `event_name` or the `event.name` attribute) are merged into their span under the service's payload level.
Other log records, such as application log lines, are dropped. Spans and their log records may arrive in either
order, within a few seconds of each other.

## Privacy and payload levels

Many instrumentations capture prompts and completions **by default** (OpenInference, OpenLLMetry, Langfuse, the
Vercel AI SDK, the OpenAI Agents instrumentation). DCDR removes that content **inside the runtime, before anything
is buffered or sent**, unless you set the service's payload level to FULL.

| Payload level | What leaves the runtime |
|---|---|
| `NONE` | Metadata only: no content, no content summary |
| `METADATA` (default) | Metadata plus a content summary: message counts, character counts, roles, tool names (names that do not look like a function name, letters, digits and `_ . : - /` up to 64 characters, are shown as `other`), tool definition and call counts, and keyed hashes of each content field (the same content gives the same hash within your workspace; a hash cannot be reversed or confirmed by guessing without your workspace key) |
| `FULL` | The content too, after your processors run on it (for example PII redaction), each field cut at 65 536 characters. Available from Cloud; enabling it is an audited, approval-gated change |

Also:

- **End-user ids** (`user.id`, `enduser.id`, Langfuse and Vercel user fields) follow their own setting per service,
  independent of the payload level (see [End-user ids](#end-user-ids) below).
- **Error messages** can contain content, so below FULL only the error type travels; the message is withheld.
- When content arrives on a service that is not FULL, DCDR records that it did (finding `CONTENT_RECEIVED`) so you
  can turn capture off in the app: the app is still sending prompt content to your network and to its provider.
- Attributes DCDR does not map are dropped below FULL, except a short list of request parameters
  (temperature, max tokens, top p...) and response metadata.
- Names your app chooses (service, agent and tool names, conversation ids) are identifiers and are recorded as
  reported at every level, cut at 256 characters. Payload levels remove the content instrumentations capture; they
  do not stop an app that deliberately writes content into an identifier, so do not put personal data in names.

To stop the content at the source, turn capture off in the instrumentation (for example
`OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=false`, `TRACELOOP_TRACE_CONTENT=false`,
`OPENINFERENCE_HIDE_INPUTS=true` / `OPENINFERENCE_HIDE_OUTPUTS=true`, `recordInputs: false` / `recordOutputs: false`
in the Vercel AI SDK), or redact it in a Collector.

### End-user ids

Each service has an end-user id mode, separate from its payload level (since 3.26.0): the payload level decides how
much content leaves your network, the end-user id mode decides how the id of the person using your app does.

| End-user id mode | What leaves the runtime, at every payload level |
|---|---|
| Pseudonymised (default) | A keyed pseudonym of the id, never the id itself, even on a FULL service |
| As sent | The id as your app reported it, cut at 256 characters, even on a NONE or METADATA service. Only when you choose it explicitly |

The pseudonym is `hex(HMAC-SHA256(workspace key, UTF-8 of the id))`: the HMAC-SHA256 of the id **exactly as your app
reported it** (no trimming, no lower-casing, the whole id even past 256 characters) with your workspace's key, in
lowercase hex. The same user gets the same pseudonym within your workspace and key version, so you can count and
follow users without DCDR holding their ids; nobody without your workspace key can reverse it or confirm a guess.
`user-42` and `User-42` are two different users: if your app reports the same person with different spellings,
normalize the id in the app. When the key is rotated, the same user gets a new pseudonym; each span records the key
version it was computed with. If the key is ever unusable, the end-user id is dropped, never sent in clear.

`telemetryEndUserPseudonym()` in `@dcdr/contracts` is that computation, the one the runtime uses (the HMAC is
passed in; Node's `crypto` module fits as is), and `DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS` lists reference
results for checking another implementation.

A runtime that receives no mode for a service (from a control plane older than 3.26.0) keeps the earlier rule:
kept as sent under FULL, pseudonymised under NONE and METADATA. A service the runtime does not know yet (seen for
the first time) follows that rule too.

## Redacting before the data leaves your network (Collector)

An OpenTelemetry Collector between your apps and DCDR can drop or mask attributes before they leave your network,
and lets a Langfuse SDK reach DCDR. A reference configuration:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:
  # Remove content attributes entirely (keep usage, models, timing).
  transform/strip_content:
    trace_statements:
      - context: span
        statements:
          - delete_key(attributes, "gen_ai.input.messages")
          - delete_key(attributes, "gen_ai.output.messages")
          - delete_key(attributes, "gen_ai.system_instructions")
          - delete_key(attributes, "input.value")
          - delete_key(attributes, "output.value")
          - delete_matching_keys(attributes, "^llm\\.(input|output)_messages\\..*")
          - delete_matching_keys(attributes, "^gen_ai\\.(prompt|completion)\\..*")
          - delete_key(attributes, "traceloop.entity.input")
          - delete_key(attributes, "traceloop.entity.output")
          - delete_key(attributes, "langfuse.observation.input")
          - delete_key(attributes, "langfuse.observation.output")
          - delete_matching_keys(attributes, "^ai\\.(prompt|response\\.text|response\\.toolCalls|toolCall\\.(args|result)).*")
  # Or keep content and mask what looks like personal data.
  redaction:
    allow_all_keys: true
    blocked_values:
      - "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"   # e-mail addresses
      - "4[0-9]{12}(?:[0-9]{3})?"                          # card numbers (Visa)
    summary: info
  # The default batch (8192 items, no maximum) exceeds DCDR's 2 000 items per request and would be refused (413).
  batch:
    send_batch_size: 1000
    send_batch_max_size: 1000

exporters:
  otlphttp/dcdr:
    endpoint: https://<telemetry host>
    headers:
      Authorization: "Bearer ${env:DCDR_TELEMETRY_TOKEN}"
    compression: gzip

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [transform/strip_content, redaction, batch]
      exporters: [otlphttp/dcdr]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/dcdr]
```

Use the `transform` processor, the `redaction` processor, or both. With a Collector in front, DCDR still applies
its own payload level; the Collector only removes more. Keep the `batch` limits at or below 2 000: the Collector's
default batch is larger than DCDR accepts in one request.

For Langfuse SDKs, which post to `/api/public/otel/v1/traces` with Basic auth, point the SDK's host at the
Collector and add `traces_url_path: /api/public/otel/v1/traces` under the receiver's `http` protocol; the
Collector then forwards to DCDR with the bearer token above.

## Limits and responses

| Limit | Default |
|---|---|
| Request body as received | 5 MB |
| Body after decompression | 20 MB |
| Spans or log records per request | 2 000 (SDK batch sizes default to 512) |
| Attribute nesting depth | 32 |
| Spans starting in the future | refused beyond 5 minutes |
| Spans older than | 30 days (refused) |
| Monthly spans | your plan's quota |
| Requests per token | a sustained rate with a burst allowance; `429` past it |
| Requests of one workspace decoded at the same time | 4; `429` with `Retry-After: 1` past it |
| Share of the runtime's telemetry buffer one workspace may hold | half; a request that would go past it gets `503` (nothing of it kept) while others keep sending |
| Time to upload one request body | 30 seconds; `408` past it |

A request over a size limit is refused as a whole (`413`), never cut. Answers follow the OTLP/HTTP specification
and use the request's format (protobuf or JSON):

| Status | Meaning | Retry |
|---|---|---|
| `200` | Accepted. `partialSuccess` is present when spans or records were rejected (`rejectedSpans` / `rejectedLogRecords`) or dropped (non-GenAI spans, non-GenAI log records: a warning in `errorMessage`) | No |
| `400` | Malformed OTLP body | No |
| `401` | Missing or invalid token (only `Authorization: Bearer` is read) | No |
| `403` | Token without `traces:write`, workspace without telemetry in its plan, or blocked | No |
| `404` | Telemetry not available in this runtime mode (`--registry`) | No |
| `405` | Not a `POST` | No |
| `408` | The body did not arrive in time; the connection is closed | Yes |
| `413` | Over a size limit | No: reduce the batch size |
| `415` | Content type or encoding not supported | No |
| `429` | Rate limit, too many requests in flight, or monthly quota reached; see `Retry-After` | Yes, after `Retry-After` |
| `503` | Temporarily unavailable (token validation or configuration not reachable, buffer full, or this workspace's share of it); see `Retry-After` | Yes |

Spans of a service that is BLOCKED, or PENDING / unknown in strict mode, are answered `200` with every span in
`rejectedSpans`. Error bodies are `google.rpc.Status` (`{"code": <gRPC code>, "message": "..."}` in JSON).

## Send with the DCDR client

`DcdrRuntimeClient` (and `DcdrClient`) can export OTLP directly, for apps that do not use an OpenTelemetry SDK or
for tests. The bearer is a `traces:write` service token. See [CLIENT.md](CLIENT.md#telemetry-otlp).

The telemetry methods send to `https://telemetry.dcdr.ai` (`DCDR_DEFAULT_TELEMETRY_URL`) when the client was built
without a URL. On an install, pass the install's runtime host as `baseUrl` (telemetry follows it) or set
`telemetryUrl`; `telemetryUrl` always wins and only affects the telemetry methods.

```ts
import { DcdrRuntimeClient, DcdrOtlpContentType } from "@dcdr/contracts";

// DCDR Cloud: no URL needed, telemetry goes to telemetry.dcdr.ai.
const client = new DcdrRuntimeClient({ bearerToken: process.env.DCDR_TELEMETRY_TOKEN });
// DCDR install: new DcdrRuntimeClient({ baseUrl: "https://<runtime host>", bearerToken })
// or, for a separate telemetry host: new DcdrRuntimeClient({ telemetryUrl: "https://<telemetry host>", bearerToken })

// OTLP/JSON, gzip-compressed on the wire.
const result = await client.exportTelemetryTraces({ resourceSpans: [/* ... */] }, { gzip: true });
if (result.partialSuccess?.rejectedSpans) console.warn(result.partialSuccess.errorMessage);

// Bytes an OpenTelemetry exporter already encoded (protobuf), sent as is.
await client.exportTelemetryTraces({ body: protobufBytes, contentType: DcdrOtlpContentType.PROTOBUF });

// One synthetic GenAI span with no content: checks the token, the plan and the service end to end.
const check = await client.telemetryTest({ serviceName: "support-assistant", environment: "production" });
console.log(check.status, check.traceId, check.partialSuccess);
```

Failures throw `DcdrRuntimeError` (`UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `RATE_LIMITED` with
`retryAfterSeconds`, `SERVER_ERROR`...).

## Check a setup: `dcdr telemetry-test`

```bash
dcdr telemetry-test --bearer <service token> \
  --service-name support-assistant --environment production
```

It sends one synthetic GenAI span (no content) and prints whether it was accepted, with its trace id, so you can
find it in Telemetry Traces. Without `--base-url` it sends to `telemetry.dcdr.ai` (DCDR Cloud); on an install add
`--base-url https://<runtime host>`. See [CLI.md](CLI.md).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `401` | The token is wrong, revoked, or not a service token, or it was sent in another header than `Authorization`. `OTEL_EXPORTER_OTLP_HEADERS` must read `Authorization=Bearer%20<token>` |
| `403 ... traces:write` | Create a token with the `traces:write` scope |
| `403` plan | Telemetry is available on Cloud, Cloud Pro and Enterprise |
| `404` | You are pointing at a self-hosted runtime in `--registry` mode, or at the wrong host |
| `200` with `dropped N non-GenAI span(s)` | Expected when the app also traces HTTP or database calls: only GenAI spans (and their ancestors) are kept |
| Every span in `rejectedSpans` | The service is BLOCKED, or PENDING in strict mode: accept it in Telemetry Services |
| Service shows as `unknown_service` | Set `OTEL_SERVICE_NAME` |
| Export errors for `/v1/metrics` (`404`) every few seconds | The SDK also exports metrics, which DCDR does not take: set `OTEL_METRICS_EXPORTER=none` |
| Nothing arrives from the OpenAI SDK (Node) | `@opentelemetry/instrumentation-openai` supports `openai` < 7 and emits nothing, silently, with newer versions |
| `openai-v2` instrumentation fails to import | Pin `opentelemetry-util-genai` to the version the instrumentation declares and install `httpx` |
| Langfuse SDK spans never arrive | Langfuse posts to its own path with Basic auth: use a Collector in front, or point its OTLP exporter at `/v1/traces` with the bearer |
| Content warning (`CONTENT_RECEIVED`) | The app captures prompts: turn capture off in the instrumentation, or set the service to FULL deliberately |
| Content sent in log records is missing | Send `/v1/logs` too. On an install with several runtime replicas, the load balancer must send `/v1/traces` and `/v1/logs` with the same token to the same replica (for example HAProxy `balance hdr(Authorization)` with `hash-type consistent` for those two paths); otherwise a span and its log records can land on different replicas and the log-only content is not merged (the span is still recorded). DCDR Cloud already routes them this way |
