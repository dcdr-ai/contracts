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

## 🚀 Deployment & Operations

| Feature | Runtime (self-hosted) | Cloud | Cloud Pro |
|---|---:|---:|---:|
| Self-hosted runtime (Docker) | ✅ | ❌ | ❌ |
| Managed runtime | ❌ | ✅ | ✅ |
| Managed configuration (dcdr.ai) | ❌ | ✅ | ✅ |
| Tenant admin UI | ❌ | ✅ | ✅ |
| Billing / subscriptions | ❌ | ✅ | ✅ |

---

## ⚙️ Runtime execution

| Feature | Runtime (self-hosted) | Cloud | Cloud Pro |
|---|---:|---:|---:|
| Intent execution | ✅ | ✅ | ✅ |
| Streaming execution (SSE) | ✅ | ✅ | ✅ |
| Retry policy (retries, backoff, fallback) | ✅ | ✅ | ✅ |
| Structured output enforcement | ✅ | ✅ | ✅ |
| Input/output schema validation | ✅ | ✅ | ✅ |
| Weighted routing | Basic/manual | ✅ | ✅ |
| Execution windows (per implementation) | ❌ | ✅ | ✅ |
| Response caching (cost saver) | ❌ | ✅ (short TTL) | ✅ (configurable) |
| Runtime Registry source | JSON/manual | ✅ (managed) | ✅ (managed) |
| Exploration policy (epsilon-greedy / top-K sampling) | ❌ | ✅ | ✅ |
| Advanced routing (quality/cost aware) | ❌ | 🚧 (limited) | 🚧 |
| Policy-based execution (quality/latency/cost) + chained fallbacks | ❌ | ❌ | 🚧 |

---

## 🧠 Intents & Prompting

| Feature | Runtime (self-hosted) | Cloud | Cloud Pro |
|---|---:|---:|---:|
| Intent Registry | JSON/manual | ✅ | ✅ |
| Intent admin UI | ❌ | ✅ | ✅ |
| Prompt templates | JSON/manual | ✅ | ✅ |
| Prompt parameters control | JSON/manual | ✅ | ✅ |
| Prompt versioning | Manual | ✅ | ✅ |
| Canary prompts / controlled rollouts | ❌ | ❌ | ✅ |
| Templated variables (e.g. `{{name}}`) | ✅ | ✅ | ✅ |
| Typed variables + validation UI | ❌ | ✅ | ✅ |
| Prompt comparison tools | ❌ | ❌ | 🚧 |

---

## 🔌 Providers & Implementations

| Feature | Runtime (self-hosted) | Cloud | Cloud Pro |
|---|---:|---:|---:|
| OpenAI-compatible chat providers (OpenAI, vLLM) | ✅ | ✅ | ✅ |
| Additional intent types (embeddings, vision, multimodal) | 🚧 | 🚧 | 🚧 |
| Implementation Registry UI | ❌ | ✅ | ✅ |
| Shared provider credentials | ❌ | ✅ | ✅ |
| Tracking probability (I/O sampling) | ❌ | ✅ | ✅ |
| Implementation health status | ❌ | ❌ | 🚧 |

---

## 🔐 Credentials

| Feature | Runtime (self-hosted) | Cloud | Cloud Pro |
|---|---:|---:|---:|
| Encrypted credentials store | ❌ | ✅ | ✅ |
| Reusable credentials | ❌ | ✅ | ✅ |
| Header/query templating/interpolation | ❌ | ✅ | ✅ |

---

## 🔎 Observability

| Feature | Runtime (self-hosted) | Cloud | Cloud Pro |
|---|---:|---:|---:|
| Execution reports (attempts, latency, usage) | ✅ | ✅ | ✅ |
| Centralized logs & search | ❌ | ✅ | ✅ |
| Full request/response traces | Self-managed | ✅ | ✅ |
| Export logs | ✅ (file) | ✅ | ✅ |
| Saved filters/views | ❌ | ✅ | ✅ |

---

## ✅ Quality workflows

| Feature | Runtime (self-hosted) | Cloud | Cloud Pro |
|---|---:|---:|---:|
| Accuracy reports | ❌ | ✅ | ✅ |
| Drift detection & alerts | ❌ | ✅ | ✅ |
| Human review (QC) | ❌ | ❌ | ✅ |
| Annotations / taxonomy / scoring | ❌ | ❌ | ✅ |
| Review queue | ❌ | ❌ | 🚧 |
| Training-ready exports | ❌ | ❌ | ✅ |

---

## 🤝 Which execution mode should I start with?

- If you want to evaluate quickly and you're OK managing a JSON Registry (`registry.json`): start with **Runtime (self-hosted)**.
- If you want managed configuration: start with **Cloud**.
- If you need advanced quality operations (QC, annotations, datasets): start with **Cloud Pro**.
