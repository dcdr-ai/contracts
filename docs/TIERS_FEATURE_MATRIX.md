# 🌟 DCDR Execution Modes & Feature Matrix

This document summarizes what you get with DCDR depending on how you operate it.

DCDR has two parts:

- ⚙️ **DCDR Runtime** (Docker): the execution engine that runs intents
- 🧠 **DCDR Cloud (dcdr.ai)**: managed configuration (versioning, rollouts, credentials, logs, quality workflows)

---

## 🧩 Execution modes

This matrix is organized by execution mode:

- ⚙️ **Runtime (self-hosted)** — you run the runtime yourself from a **Registry** file (`registry.json`)
- ☁️ **Cloud** — managed runtime + managed configuration
- 🚀 **Cloud Pro** — Cloud + advanced quality & operations

### Legend

- ✅ available
- ❌ not available
- 🚧 roadmap (planned / coming soon)

Roadmap notes:

- 🚧 items are directional and do not imply guaranteed timelines.
- Availability can depend on product decisions and may change.

---

## 🚀 Deployment

| Feature                         | Runtime (self-hosted) | Cloud | Cloud Pro |
| ------------------------------- | --------------------: | ----: | --------: |
| Self-hosted runtime             |                    ✅ |    ✅ |        ✅ |
| Managed cloud control plane     |                    ❌ |    ✅ |        ✅ |
| Tenant admin UI                 |                    ❌ |    ✅ |        ✅ |
| Billing portal (Stripe)         |                    ❌ |    ✅ |        ✅ |
| Managed configuration (dcdr.ai) |                    ❌ |    ✅ |        ✅ |

---

## ⚙️ Runtime

| Feature                                   | Runtime (self-hosted) |          Cloud |             Cloud Pro |
| ----------------------------------------- | --------------------: | -------------: | --------------------: |
| Intent execution                          |                    ✅ |             ✅ |                    ✅ |
| Streaming execution (SSE)                 |                    ✅ |             ✅ |                    ✅ |
| Structured output enforcement             |                    ✅ |             ✅ |                    ✅ |
| Input schema validation                   |                    ✅ |             ✅ |                    ✅ |
| Output schema validation                  |                    ✅ |             ✅ |                    ✅ |
| Retry policy                              |                    ✅ |             ✅ |                    ✅ |
| Weighted routing                          |          Basic/manual |             ✅ |                    ✅ |
| Intelligent routing (quality/cost-aware)  |                    ❌ |             ❌ |                    ✅ |
| Execution windows by base model           |                    ❌ |             ✅ |                    ✅ |
| Response caching (cost saver)             |                    ❌ | ✅ (short TTL) | ✅ (configurable TTL) |
| OpenAI-compatible chat execution          |                    ✅ |             ✅ |                    ✅ |
| Fallback execution                        |                 Basic |             ✅ |                    ✅ |
| Advanced execution & exploration policies |                    ❌ |             ❌ |                    ✅ |
| Runtime registry sync                     |           JSON/manual |             ✅ |                    ✅ |
| Policy-based execution                    |                    ❌ |             ❌ |                    ✅ |
| Chained provider fallbacks                |                    ❌ |             ❌ |                    ✅ |
| JSON registry validator                   |                    ✅ |             ✅ |                    ✅ |

---

## 🧠 Intents

| Feature                | Runtime (self-hosted) |        Cloud |        Cloud Pro |
| ---------------------- | --------------------: | -----------: | ---------------: |
| Intent registry        |           JSON/manual |           ✅ |               ✅ |
| Intent admin UI        |                    ❌ |           ✅ |               ✅ |
| Input/output editor    |                    ❌ |           ✅ |               ✅ |
| Intent creator wizard  |                    ❌ | ✅ (Limited) | ✅ (AI-assisted) |
| Intent-level reporting |                    ❌ |        Basic |               ✅ |

---

## ✍️ Prompting

| Feature                                             | Runtime (self-hosted) | Cloud | Cloud Pro |
| --------------------------------------------------- | --------------------: | ----: | --------: |
| Prompt templates                                    |           JSON/manual |    ✅ |        ✅ |
| Prompt parameters control (temperature, max_tokens) |           JSON/manual |    ✅ |        ✅ |
| Auto-tune params + retry policy (diff/confirm)      |                    ❌ |    ❌ |        ✅ |
| Prompt versioning                                   |                Manual |    ✅ |        ✅ |
| Prompt canary                                       |                    ❌ |    ❌ |        ✅ |
| System + user prompt separation                     |                    ✅ |    ✅ |        ✅ |
| Templated variables                                 |                    ✅ |    ✅ |        ✅ |
| Typed variables + validation UI                     |                    ❌ |    ✅ |        ✅ |
| Prompt comparison                                   |                    ❌ |    ❌ |        ✅ |
| Prompt parameter presets                            |                    🚧 |    🚧 |        🚧 |

---

## 🔌 Providers

| Feature                          | Runtime (self-hosted) | Cloud | Cloud Pro |
| -------------------------------- | --------------------: | ----: | --------: |
| OpenAI-compatible chat providers |                    ✅ |    ✅ |        ✅ |
| Anthropic (chat)                 |                    ✅ |    ✅ |        ✅ |
| Gemini (chat)                    |                    ✅ |    ✅ |        ✅ |
| Vision models                    |                    🚧 |    🚧 |        🚧 |
| Embedding models                 |                    🚧 |    🚧 |        🚧 |

---

## 🧩 Implementations

| Feature                             | Runtime (self-hosted) | Cloud | Cloud Pro |
| ----------------------------------- | --------------------: | ----: | --------: |
| Implementation registry UI          |                    ❌ |    ✅ |        ✅ |
| Per-intent implementations          |           JSON/manual |    ✅ |        ✅ |
| Shared provider credentials         |                    ❌ |    ✅ |        ✅ |
| Tracking probability (I/O sampling) |                    ❌ |    ✅ |        ✅ |
| Health status per implementation    |                    ❌ |    ❌ |        🚧 |

---

## 🔐 Credentials

| Feature                               | Runtime (self-hosted) | Cloud | Cloud Pro |
| ------------------------------------- | --------------------: | ----: | --------: |
| Encrypted credentials store           |                    ❌ |    ✅ |        ✅ |
| Reusable credentials                  |                    ❌ |    ✅ |        ✅ |
| Header/query templating/interpolation |                    ❌ |    ✅ |        ✅ |

---

## 🔎 Observability

| Feature                                      | Runtime (self-hosted) | Cloud | Cloud Pro |
| -------------------------------------------- | --------------------: | ----: | --------: |
| Execution reports (attempts, latency, usage) |                    ✅ |    ✅ |        ✅ |
| Centralized logs & search                    |                    ❌ |    ✅ |        ✅ |
| Full request/response traces                 |          Self-managed |    ✅ |        ✅ |
| Export logs                                  |             ✅ (file) |    ✅ |        ✅ |
| Saved filters/views                          |                    ❌ |    ✅ |        ✅ |

---

## ✅ Quality workflows

| Feature                          | Runtime (self-hosted) | Cloud | Cloud Pro |
| -------------------------------- | --------------------: | ----: | --------: |
| Accuracy reports                 |                    ❌ |    ✅ |        ✅ |
| Drift detection & alerts         |                    ❌ |    ✅ |        ✅ |
| Human review (QC)                |                    ❌ |    ❌ |        ✅ |
| Annotations / taxonomy / scoring |                    ❌ |    ❌ |        ✅ |
| Review queue                     |                    ❌ |    ❌ |        🚧 |
| Training-ready exports           |                    ❌ |    ❌ |        ✅ |

---

## 🤝 Which execution mode should I start with?

- If you want to evaluate quickly and you're OK managing a JSON Registry (`registry.json`): start with **Runtime (self-hosted)**.
- If you want managed configuration: start with **Cloud**.
- If you need advanced quality operations (QC, annotations, datasets): start with **Cloud Pro**.
