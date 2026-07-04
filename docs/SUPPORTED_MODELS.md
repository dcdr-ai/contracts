# Supported models (platform)

This document lists provider model IDs (CHAT only) that are explicitly marked as runtime-supported by DCDR.

Rules

- Includes only models where `runtimeSupport.status === SUPPORTED` in the `ProviderModelRegistry` catalog.
- Includes only models that support `IntentType.CHAT`.
- Excludes the virtual provider `IntentProvider.DCDR` (those are aliases like `openai/gpt-...`).
- Every listed model is runtime-supported for standard text chat and structured JSON workflows.
- Provider tables summarize only the additional multimodal input/output surfaces that have been explicitly validated so far.
- Generated from the contracts catalog; do not edit by hand.

Generated: **2026-07-04**

> Total officially supported models: **105**

## OpenAI

Every model in this table is supported for standard text chat and structured JSON workflows. The multimodal columns only show extra input/output coverage that has been explicitly validated so far.

| Model | Validated multimodal input | Input source kinds | Validated multimodal output | Output source kinds |
| --- | --- | --- | --- | --- |
| `gpt-5.5` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.5-2026-04-23` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.5-pro` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.5-pro-2026-04-23` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4-2026-03-05` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4-mini` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4-mini-2026-03-17` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4-nano` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4-nano-2026-03-17` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4-pro` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.4-pro-2026-03-05` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.3-chat-latest` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.3-codex` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.2` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.2-2025-12-11` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.2-chat-latest` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.2-codex` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.2-pro` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.2-pro-2025-12-11` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.1` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.1-2025-11-13` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.1-chat-latest` | <kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.1-codex` | <kbd>image</kbd>/<kbd>audio</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.1-codex-max` | <kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5.1-codex-mini` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5` | <kbd>audio</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-2025-08-07` | <kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-chat-latest` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-codex` | <kbd>image</kbd>/<kbd>audio</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-mini` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-mini-2025-08-07` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-nano` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-nano-2025-08-07` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-pro` | <kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-5-pro-2025-10-06` | <kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4.1` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4.1-2025-04-14` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4.1-mini` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4.1-mini-2025-04-14` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4.1-nano` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4.1-nano-2025-04-14` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4o` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4o-2024-08-06` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4o-2024-11-20` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4o-mini` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4o-mini-2024-07-18` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gpt-4o-2024-05-13` | not validated | none | not curated | - |
| `gpt-4-turbo` | not validated | none | not curated | - |
| `gpt-4-turbo-2024-04-09` | not validated | none | not curated | - |
| `gpt-4` | not validated | none | not curated | - |
| `gpt-4-0613` | not validated | none | not curated | - |
| `gpt-3.5-turbo` | not validated | none | not curated | - |
| `gpt-3.5-turbo-0125` | not validated | none | not curated | - |
| `gpt-3.5-turbo-1106` | not validated | none | not curated | - |
| `gpt-3.5-turbo-16k` | not validated | none | not curated | - |
| `o4-mini` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o4-mini-2025-04-16` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o3-pro` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o3-pro-2025-06-10` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o3` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o3-2025-04-16` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o3-mini` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o3-mini-2025-01-31` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o1-pro` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o1-pro-2025-03-19` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o1` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `o1-2024-12-17` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |

## Anthropic

Every model in this table is supported for standard text chat and structured JSON workflows. The multimodal columns only show extra input/output coverage that has been explicitly validated so far.

| Model | Validated multimodal input | Input source kinds | Validated multimodal output | Output source kinds |
| --- | --- | --- | --- | --- |
| `claude-opus-4-8` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-opus-4-7` | <kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-opus-4-6` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-opus-4-5-20251101` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-opus-4-1-20250805` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-sonnet-4-6` | <kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-sonnet-4-5-20250929` | <kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-sonnet-5` | <kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-haiku-4-5` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-fable-5` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `claude-haiku-4-5-20251001` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |

## Gemini

Every model in this table is supported for standard text chat and structured JSON workflows. The multimodal columns only show extra input/output coverage that has been explicitly validated so far.

| Model | Validated multimodal input | Input source kinds | Validated multimodal output | Output source kinds |
| --- | --- | --- | --- | --- |
| `gemini-2.5-flash` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-3.5-flash` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-3.1-pro-preview-customtools` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-3.1-pro-preview` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-3.1-flash-lite-preview` | <kbd>text</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-3.1-flash-lite` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-3-flash-preview` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-2.5-pro` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-2.5-flash-lite` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-flash-latest` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-flash-lite-latest` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `gemini-pro-latest` | <kbd>text</kbd>/<kbd>audio</kbd>/<kbd>video</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |

## Grok

Every model in this table is supported for standard text chat and structured JSON workflows. The multimodal columns only show extra input/output coverage that has been explicitly validated so far.

| Model | Validated multimodal input | Input source kinds | Validated multimodal output | Output source kinds |
| --- | --- | --- | --- | --- |
| `grok-4.3` | <kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `grok-4.20-0309-non-reasoning` | <kbd>text</kbd>/<kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `grok-4.20-0309-reasoning` | <kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |
| `grok-build-0.1` | <kbd>image</kbd>/<kbd>document</kbd> | INLINE/URL/ASSET | not curated | - |

## Mistral

Every model in this table is supported for standard text chat and structured JSON workflows. The multimodal columns only show extra input/output coverage that has been explicitly validated so far.

| Model | Validated multimodal input | Input source kinds | Validated multimodal output | Output source kinds |
| --- | --- | --- | --- | --- |
| `mistral-large-latest` | <kbd>image</kbd> | INLINE/URL/ASSET | not curated | - |
| `mistral-medium-latest` | <kbd>image</kbd> | INLINE/URL/ASSET | not curated | - |
| `mistral-small-latest` | <kbd>image</kbd> | INLINE/URL/ASSET | not curated | - |
| `mistral-tiny-latest` | not curated | - | not curated | - |
| `ministral-14b-latest` | <kbd>image</kbd> | INLINE/URL/ASSET | not curated | - |
| `ministral-8b-latest` | <kbd>image</kbd> | INLINE/URL/ASSET | not curated | - |
| `ministral-3b-latest` | <kbd>image</kbd> | INLINE/URL/ASSET | not curated | - |
| `codestral-latest` | not curated | - | not curated | - |
| `mistral-code-latest` | not curated | - | not curated | - |
| `mistral-vibe-cli-latest` | <kbd>image</kbd> | INLINE/URL/ASSET | not curated | - |
