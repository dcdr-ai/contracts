# DCDR AI Gateway (`/v1`)

The DCDR AI Gateway lets tools and code that already speak the **OpenAI** or **Anthropic** API send
their traffic through DCDR by changing two settings: the **base URL** and the **API key**. Nothing
else changes in the tool. Every call is authenticated with a DCDR service token, routed to a provider
credential your organization bound to that token, checked against your governance limits, and logged
as metadata for usage, cost and audit.

Use it for:

- coding agents and IDE assistants (Claude Code, Codex, Cursor and other OpenAI-compatible tools);
- chat UIs, automation platforms and SDK code that call a model directly;
- bringing "shadow AI" usage under one set of credentials, limits and logs, without installing
  anything on developer machines.

If you want versioned prompts, schemas, routing and fallbacks instead of raw model calls, use
[Intents](CONTRACTS.md) through the runtime API (`/api/execution/*`). The gateway is for traffic that
is already shaped as vendor API calls.

## Contents

- [How it works](#how-it-works)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Choosing a model](#choosing-a-model)
- [Streaming](#streaming)
- [Limits](#limits)
- [Errors](#errors)
- [Response headers](#response-headers)
- [What is logged](#what-is-logged)
- [Tool setup](#tool-setup)
- [Examples](#examples)
- [Operating a runtime](#operating-a-runtime)

## How it works

1. An administrator creates a **service token** in DCDR with the `gateway` scope and binds one
   **provider credential** per provider it may use (for example an OpenAI key and an Anthropic key).
2. The tool sends a normal OpenAI or Anthropic request to the gateway, with the service token as its
   API key.
3. The gateway validates the token, resolves the requested model to a bound provider, applies your
   organization's **Provider Limits** and the token's own **limits**, and forwards the request to the
   provider with the bound credential.
4. The provider's answer - status, body, streaming events and error bodies - is returned to the tool
   **as the provider sent it**. The provider key never leaves DCDR.

Your tool never sees the provider credential, and revoking the service token cuts access immediately.

## Base URL

| Deployment | OpenAI-compatible tools and SDKs | Anthropic tools and SDKs |
| --- | --- | --- |
| DCDR Cloud | `https://gateway.dcdr.ai/v1` | `https://gateway.dcdr.ai` |
| Your own runtime | `https://<your-runtime-host>/v1` | `https://<your-runtime-host>` |

OpenAI SDKs expect the base URL to include `/v1`. Anthropic SDKs and Claude Code add `/v1/messages`
themselves, so their base URL is the host alone.

The gateway requires the DCDR control plane: service tokens and provider credentials are issued and
checked there.

## Authentication

Send your DCDR service token (scope `gateway`) in either header:

```http
Authorization: Bearer <DCDR service token>
```

```http
x-api-key: <DCDR service token>
```

- `Authorization: Bearer` is what OpenAI SDKs send; `x-api-key` is what Anthropic SDKs send. Both
  work on every endpoint. If both are present, the bearer is used.
- The token is **never** accepted in the URL query string.
- Do not send provider API keys to the gateway. The gateway adds the bound provider credential itself.

A token without the `gateway` scope, or without any provider binding, is refused with `403`.

## Endpoints

| Method | Path | Wire format | Streaming | Upstream providers |
| --- | --- | --- | --- | --- |
| `GET` | `/v1/models` | OpenAI model list | - | every bound provider |
| `POST` | `/v1/chat/completions` | OpenAI Chat Completions | yes | OpenAI, xAI (Grok), Mistral, Anthropic\*, Gemini\*, OpenAI-compatible |
| `POST` | `/v1/responses` | OpenAI Responses | yes | OpenAI, xAI (Grok), OpenAI-compatible |
| `POST` | `/v1/embeddings` | OpenAI Embeddings | no | OpenAI, Mistral, Gemini\*, OpenAI-compatible |
| `POST` | `/v1/messages` | Anthropic Messages | yes | Anthropic |
| `POST` | `/v1/messages/count_tokens` | Anthropic token counting | no | Anthropic |

\* Through the provider's own OpenAI-compatible endpoint. Anthropic describes its compatibility layer
as intended for testing and comparing models: for Anthropic models, prefer `/v1/messages`, which
supports the full feature set (prompt caching, extended thinking, beta features).

**Request bodies are forwarded as you send them.** Fields the gateway does not know - tools, tool
choice, response formats, reasoning settings, `cache_control`, `metadata`, new provider parameters -
reach the provider unchanged. On `/v1/messages`, `anthropic-version` and `anthropic-beta` (and other
`anthropic-*` headers) are forwarded; if you send no `anthropic-version`, the gateway sets
`2023-06-01`. On the OpenAI routes, `openai-beta` is forwarded.

The gateway validates only what it needs to route the call:

| Route | Required |
| --- | --- |
| `/v1/chat/completions` | `model`, `messages` (array) |
| `/v1/responses` | `model` |
| `/v1/embeddings` | `model`, non-empty `input` |
| `/v1/messages`, `/v1/messages/count_tokens` | `model`, `messages` (array) |

`/v1/models` lists the models your token can reach: the models of every bound provider that the
route set can serve (chat models, plus embeddings models for providers that serve `/v1/embeddings`),
minus any provider or model your organization disabled, and - when the token is restricted to a list
of models - only the models on that list. It does not call the providers: a model can be listed and
still be refused by the provider if your provider account cannot use it.

## Choosing a model

Use the provider's own model id, as you would against the provider:

```json
{ "model": "gpt-4.1-nano", "messages": [{ "role": "user", "content": "hi" }] }
```

The gateway finds the bound provider that serves that id. When two bound providers serve the same id
the request is refused as `ambiguous_model`; name the provider explicitly with a prefix:

| Prefix | Provider |
| --- | --- |
| `openai/` | OpenAI |
| `anthropic/` | Anthropic |
| `gemini/` | Google Gemini |
| `grok/` or `xai/` | xAI |
| `mistral/` | Mistral |
| `openai-compatible/` | the OpenAI-compatible endpoint configured on the runtime |

```json
{ "model": "anthropic/claude-haiku-4-5", "max_tokens": 256, "messages": [{ "role": "user", "content": "hi" }] }
```

**Tokens restricted to certain models.** A service token can be limited to a list of provider/model
pairs. Such a token only sees those models on `/v1/models`, and any other model is refused with
`model_not_allowed_for_token` (`403`). When the same model id is served by two bound providers and only
one pair is on the list, that one is used. The restriction narrows what the token's provider bindings
already allow; it never adds a provider.

A model must match the route: an embeddings model cannot answer `/v1/chat/completions`, and a chat
model cannot answer `/v1/embeddings` (`model_not_found`). A route the provider does not serve - for
example `/v1/responses` with a Mistral model - is refused with `route_not_supported_for_provider`.

The list of models DCDR knows per provider is in [SUPPORTED_MODELS.md](SUPPORTED_MODELS.md).

## Streaming

Set `stream: true` as you would against the provider. The gateway relays the provider's server-sent
events **as they arrive**, unchanged - including keep-alive `ping` events - so tools that read tokens
as they come work normally.

- **OpenAI chat streams:** the gateway asks the provider to report token usage at the end of the
  stream so it can be logged. If you did not ask for it yourself (`stream_options.include_usage`),
  that final usage-only chunk is not sent to you; if you did, you receive it as usual.
- **Anthropic streams:** relayed as `message_start`, `content_block_*`, `message_delta`,
  `message_stop`, `ping` events, exactly as Anthropic sends them.
- If the connection to the provider fails after the stream has started, the stream ends with one final
  error event in the route's format (an OpenAI-style `data: {"error": {...}}` or an Anthropic
  `event: error`), because the HTTP status has already been sent.

**Long generations should stream.** A non-streamed request waits for the provider to finish before
anything is returned, and proxies between your tool and the gateway may close a silent connection
earlier than the gateway would. Streaming keeps data flowing for as long as the model is working.

## Limits

Two kinds of limits can refuse a request with `429 Too Many Requests` and a `Retry-After` header
(seconds until the window that refused it resets):

| Code | Set by | Scope |
| --- | --- | --- |
| `provider_limit_exceeded` | your organization's **Provider Limits** | a provider or a model, for the whole organization: calls or budget per hour/day/month |
| `service_token_limit_exceeded` | the **service token's limits** | this token: calls or budget per hour/day/week/month, optionally scoped to providers or models |

A provider or model that your organization disabled is not listed on `/v1/models` and is refused as
`model_forbidden` or `model_not_found`.

How calls are counted:

- A token limit scoped to **providers or models** counts each call sent to a matching provider/model.
- Any other token limit counts **requests** to the gateway, whatever happens to them afterwards.
- When a token limit refuses a request, the token's other limits give back what they counted for it.
- Budget limits apply once DCDR has recorded spend for the current window.

A `429` from the **provider** itself (the provider's own rate limit) is relayed as the provider sent
it, with the provider's rate-limit headers - see [Errors](#errors).

## Errors

There are two kinds of error responses.

**Errors from the provider** - any non-2xx the provider returns after the gateway forwarded the call -
are returned **unchanged**: same status, same body, same error codes and messages. Tools that react to
a provider's rate-limit or context-length errors keep working.

**Errors from the gateway** - refusals before the call was sent, or a failure to reach the provider -
use the route's error format:

OpenAI routes (`/v1/models`, `/v1/chat/completions`, `/v1/responses`, `/v1/embeddings`):

```json
{ "error": { "message": "Unknown or unavailable model 'gpt-9'.", "type": "invalid_request_error", "code": "model_not_found" } }
```

Anthropic routes (`/v1/messages`, `/v1/messages/count_tokens`):

```json
{ "type": "error", "error": { "type": "not_found_error", "code": "model_not_found", "message": "Unknown or unavailable model 'claude-9'." } }
```

On the Anthropic routes `error.type` follows Anthropic's error types (`authentication_error`,
`permission_error`, `not_found_error`, `rate_limit_error`, `invalid_request_error`, `api_error`) and
`error.code` carries the gateway code below.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 401 | `missing_gateway_token` | No token in `Authorization` or `x-api-key`. |
| 401 | `invalid_gateway_token` | The token is unknown, expired or revoked. |
| 403 | `gateway_scope_forbidden` | The token does not have the `gateway` scope. |
| 403 | `missing_gateway_bindings` | The token has no provider credential bound. |
| 403 | `missing_gateway_cid` | The token is not attached to an organization. |
| 400 | `invalid_request_body` | The body is not a JSON object. |
| 400 | `missing_model` | No `model` in the body. |
| 400 | `missing_messages` | No `messages` array (chat and messages routes). |
| 400 | `missing_input` | No non-empty `input` (embeddings). |
| 404 | `model_not_found` | No bound provider serves this model for this route. |
| 403 | `model_forbidden` | The model exists but your organization disabled it. |
| 403 | `model_not_allowed_for_token` | This service token is restricted to other models. |
| 403 | `provider_not_bound` | The prefixed provider is not bound to this token. |
| 400 | `provider_not_supported` | The provider cannot be used through the gateway. |
| 400 | `ambiguous_model` | Several bound providers serve this id; use a provider prefix. |
| 400 | `route_not_supported_for_provider` | The provider does not serve this route (for example `/v1/responses` on Mistral). |
| 403 | `credential_not_found` | The provider credential bound to the token no longer exists. |
| 429 | `provider_limit_exceeded` | An organization Provider Limit is reached. `Retry-After` is set. |
| 429 | `service_token_limit_exceeded` | One of the token's limits is reached. `Retry-After` is set. |
| 502 | `gateway_token_check_failed` | The token could not be checked; retry. |
| 502 | `gateway_credentials_resolve_failed` | The provider credential could not be loaded; retry. |
| 502 | `gateway_upstream_failed` | The provider could not be reached, or its response was too large. |
| 502 | `upstream_address_refused` | The configured OpenAI-compatible endpoint is not reachable from the runtime. |
| 502 | `upstream_aborted` | The call to the provider was aborted. |
| 504 | `upstream_timeout` | The provider did not start answering in time, or went silent mid-response. |

## Response headers

| Header | Meaning |
| --- | --- |
| `x-request-id` | The gateway's id for this request - quote it when contacting support. If you send your own `x-request-id` (or `x-correlation-id`) made of letters, digits and `._:-`, up to 128 characters, it is kept; otherwise one is generated. |
| `x-dcdr-upstream-request-id` | The provider's own request id, when it sent one - quote it to the provider. |
| `retry-after` | On a limit refusal (gateway or provider): seconds until you can retry. |
| `x-ratelimit-*`, `anthropic-ratelimit-*` | The provider's rate-limit headers, relayed. |
| `openai-processing-ms`, `openai-version` | Relayed from OpenAI-compatible providers. |

## What is logged

Every gateway request produces an execution log with **metadata only**:

- who: organization, service token, request id;
- what: route, requested model, resolved provider and model, whether it was streamed;
- outcome: HTTP status, gateway or provider error code, whether the call reached the provider;
- size and cost inputs: token usage reported by the provider (prompt, completion, cached and
  cache-write tokens), number of messages/inputs, character counts, tool-call counts, finish reason,
  time to first streamed chunk, latency.

**Prompts and responses are not stored.** No message text, tool arguments or generated content is
kept. Token usage is used for budgets and cost reporting in DCDR.

## Tool setup

Configuration keys belong to each tool and change over time; check the tool's own documentation for
where to set a custom base URL and API key.

### Claude Code

Claude Code speaks the Anthropic Messages format. Point it at the gateway host and give it the service
token:

```bash
export ANTHROPIC_BASE_URL="https://gateway.dcdr.ai"
export ANTHROPIC_AUTH_TOKEN="<DCDR service token>"   # sent as Authorization: Bearer
# or: export ANTHROPIC_API_KEY="<DCDR service token>"  # sent as x-api-key
```

The token needs an **Anthropic** credential bound. Optional: `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`
lets Claude Code list the Claude models your token can reach from `/v1/models`.

### Codex CLI

Codex speaks the Responses API. In `~/.codex/config.toml`:

```toml
model_provider = "dcdr"

[model_providers.dcdr]
name = "DCDR Gateway"
base_url = "https://gateway.dcdr.ai/v1"
env_key = "DCDR_GATEWAY_TOKEN"
wire_api = "responses"
```

```bash
export DCDR_GATEWAY_TOKEN="<DCDR service token>"
```

The token needs an **OpenAI** (or xAI / OpenAI-compatible) credential bound, since `/v1/responses` is
served by those providers.

### OpenAI-compatible tools (Cursor, Continue, Open WebUI, n8n, LangChain, ...)

Set the tool's OpenAI base URL to `https://gateway.dcdr.ai/v1` and its API key to the service token.
Use model ids as listed by `/v1/models`, or with a provider prefix.

## Examples

### curl - chat completion

```bash
curl https://gateway.dcdr.ai/v1/chat/completions \
  -H "Authorization: Bearer $DCDR_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "model": "gpt-4.1-nano", "messages": [{ "role": "user", "content": "Say hi" }] }'
```

### curl - Anthropic Messages, streamed

```bash
curl https://gateway.dcdr.ai/v1/messages \
  -H "x-api-key: $DCDR_GATEWAY_TOKEN" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{ "model": "claude-haiku-4-5", "max_tokens": 256, "stream": true,
        "messages": [{ "role": "user", "content": "Say hi" }] }'
```

### OpenAI SDK (TypeScript)

```ts
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://gateway.dcdr.ai/v1",
  apiKey: process.env.DCDR_GATEWAY_TOKEN,
});

const stream = await client.chat.completions.create({
  model: "gpt-4.1-nano",
  messages: [{ role: "user", content: "Say hi" }],
  stream: true,
});
for await (const chunk of stream) process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
```

### Anthropic SDK (Python)

```python
import os
from anthropic import Anthropic

client = Anthropic(base_url="https://gateway.dcdr.ai", api_key=os.environ["DCDR_GATEWAY_TOKEN"])

message = client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=256,
    messages=[{"role": "user", "content": "Say hi"}],
)
print(message.content[0].text)
```

### Embeddings

```bash
curl https://gateway.dcdr.ai/v1/embeddings \
  -H "Authorization: Bearer $DCDR_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "model": "text-embedding-3-small", "input": ["first text", "second text"] }'
```

## Operating a runtime

When you run the DCDR runtime yourself (connected to the DCDR control plane), these environment
variables shape the gateway:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DCDR_GATEWAY_OPENAI_COMPATIBLE_BASE_URL` | unset | Base URL of one OpenAI-compatible server (vLLM, Ollama, LM Studio, a hosted endpoint) served as provider `OPEN_AI_COMPATIBLE`. It may be on your private network. |
| `DCDR_GATEWAY_OPENAI_COMPATIBLE_MODEL_IDS` | unset | Comma-separated model ids that server serves; they appear on `/v1/models` and are routable with or without the `openai-compatible/` prefix. |
| `DCDR_GATEWAY_UPSTREAM_TIMEOUT_MS` | `240000` | How long to wait for a provider to start answering. A non-streamed request waits for the whole generation within this time. |
| `DCDR_GATEWAY_UPSTREAM_IDLE_TIMEOUT_MS` | `120000` | How long a response may stay silent once it has started. |

Proxies and load balancers in front of the runtime must not buffer `/v1` responses (so streams are
delivered as they arrive) and must allow idle periods at least as long as the timeouts above.
