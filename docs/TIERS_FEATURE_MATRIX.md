# 🌟 DCDR Tiers & Feature Matrix

This document summarizes what you get with DCDR depending on how you operate it.

DCDR has two parts:

- ⚙️ **DCDR Runtime** (Docker): the execution engine that runs intents
- 🧠 **DCDR Cloud (dcdr.ai)**: the control plane (versioning, rollouts, credentials, logs, quality workflows)

---

## 🧩 Tiers

- 🧰 **runtime** — freeware / self-hosted, operated from a **DCDR Registry** file (JSON)
- ☁️ **cloud** — runtime + managed control plane + UI
- 🚀 **cloud-pro** — cloud + advanced quality & operations

### Legend

- ✅ available
- ❌ not available
- 🚧 roadmap (planned / coming soon)

---

## 🚀 Deployment & Operations

| Feature | runtime | cloud | cloud-pro |
|---|---:|---:|---:|
| Self-hosted runtime (Docker) | ✅ | ✅ | ✅ |
| Managed cloud control plane (dcdr.ai) | ❌ | ✅ | ✅ |
| Tenant admin UI | ❌ | ✅ | ✅ |
| Billing / subscriptions | ❌ | ✅ | ✅ |

---

## ⚙️ Runtime execution

| Feature | runtime | cloud | cloud-pro |
|---|---:|---:|---:|
| Intent execution | ✅ | ✅ | ✅ |
| Retry policy (retries, backoff, fallback) | ✅ | ✅ | ✅ |
| Structured output enforcement | ✅ | ✅ | ✅ |
| Input/output schema validation | ✅ | ✅ | ✅ |
| Weighted routing | Basic/manual | ✅ | ✅ |
| Execution windows (per implementation) | ❌ | ✅ | ✅ |
| Response caching (cost saver) | ❌ | ✅ (short TTL) | ✅ (configurable) |
| Runtime registry source | JSON/manual | ✅ (managed) | ✅ (managed) |
| Intelligent routing (quality/cost aware) | ❌ | 🚧 (limited) | 🚧 |
| Policy-based execution (quality/latency/cost) | ❌ | ❌ | 🚧 |
| Chained provider fallbacks | ❌ | ❌ | 🚧 |

---

## 🧠 Intents & Prompting

| Feature | runtime | cloud | cloud-pro |
|---|---:|---:|---:|
| Intent registry | JSON/manual | ✅ | ✅ |
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

| Feature | runtime | cloud | cloud-pro |
|---|---:|---:|---:|
| OpenAI-compatible chat providers (OpenAI, vLLM) | ✅ | ✅ | ✅ |
| Embeddings | 🚧 | 🚧 | 🚧 |
| Vision / multimodal | 🚧 | 🚧 | 🚧 |
| Implementation registry UI | ❌ | ✅ | ✅ |
| Shared provider credentials | ❌ | ✅ | ✅ |
| Tracking probability (I/O sampling) | ❌ | ✅ | ✅ |
| Implementation health status | ❌ | ❌ | 🚧 |

---

## 🔐 Credentials

| Feature | runtime | cloud | cloud-pro |
|---|---:|---:|---:|
| Encrypted credentials store | ❌ | ✅ | ✅ |
| Reusable credentials | ❌ | ✅ | ✅ |
| Header/query templating/interpolation | ❌ | ✅ | ✅ |

---

## 🔎 Observability

| Feature | runtime | cloud | cloud-pro |
|---|---:|---:|---:|
| Execution reports (attempts, latency, usage) | ✅ | ✅ | ✅ |
| Centralized logs & search | ❌ | ✅ | ✅ |
| Full request/response traces | Self-managed | ✅ | ✅ |
| Export logs | ✅ (file) | ✅ | ✅ |
| Saved filters/views | ❌ | ✅ | ✅ |

---

## ✅ Quality workflows

| Feature | runtime | cloud | cloud-pro |
|---|---:|---:|---:|
| Accuracy reports | ❌ | ✅ | ✅ |
| Drift detection & alerts | ❌ | ✅ | ✅ |
| Human review (QC) | ❌ | ❌ | ✅ |
| Annotations / taxonomy / scoring | ❌ | ❌ | ✅ |
| Review queue | ❌ | ❌ | 🚧 |
| Training-ready exports | ❌ | ❌ | ✅ |

---

## 🤝 Which tier should I start with?

- If you want to **evaluate quickly** and you're OK managing a JSON registry: start with **runtime**.
- If you want to avoid maintaining prompts/versions/routing/credentials by hand: use **cloud**.
- If you care about quality operations (QC, annotations, datasets): use **cloud-pro**.
