/// <reference types="jest" />

/**
 * `IntentProvider` is wire-level and stored: a registry, an implementation row and every
 * `ExecutionReport` carry these strings. Renaming one breaks stored data, so the list is pinned.
 *
 * The retired members are pinned too, and deliberately so. `OCR`, `CLIP` and `HTTP_TOOL` were
 * declared, offerable in the editor, and had no adapter and no catalogue entry - so an intent that
 * chose one failed at execution with `NO_CONFIG: Provider not implemented yet`. They were removed in
 * 3.9.0 rather than implemented, because what they described is now done elsewhere and better:
 * `HTTP_TOOL` by the workflow `HTTP` state and the `TOOL` capabilities, `OCR` by multimodal models
 * reading a document through `inputParts`. `CLIP` was embeddings, which the platform does not do at
 * all. Re-declaring any of them later is additive and free; that asymmetry is why removing them
 * while 3.9.0 was already a breaking release was the cheap moment.
 */
import { IntentProvider } from "../src/provider.contract";
import { PROVIDER_MODEL_CATALOG } from "../src/provider.catalog.contract";

describe("IntentProvider", () => {
  it("pins the whole vocabulary", () => {
    expect(Object.values(IntentProvider).sort()).toEqual(
      [
        "ANTHROPIC",
        "COHERE",
        "DCDR",
        "GEMINI",
        "GROK",
        "MISTRAL",
        "OFFICE",
        "OLLAMA",
        "OPEN_AI",
        "OPEN_AI_COMPATIBLE",
        "RULES",
      ].sort(),
    );
  });

  it("no longer declares the three providers that could never execute", () => {
    const values = Object.values(IntentProvider) as string[];
    for (const retired of ["OCR", "CLIP", "HTTP_TOOL"]) {
      expect(values).not.toContain(retired);
    }
  });

  it("keeps RULES, which is not a provider but the marker for a call no provider made", () => {
    // Load-bearing: the runtime reports it on a rejection, a dry run, a demo answer and any failure
    // that never reached a model. Removing it would need a replacement marker, not a deletion.
    expect(IntentProvider.RULES).toBe("RULES");
  });

  it("gives every declared provider a catalogue entry", () => {
    // The gap this closes is the one that produced the retired three: a provider a UI can offer and
    // the catalogue knows nothing about.
    for (const provider of Object.values(IntentProvider)) {
      expect(PROVIDER_MODEL_CATALOG).toHaveProperty(provider);
    }
  });

  it("has no catalogue entry for a provider that is not declared", () => {
    const declared = new Set(Object.values(IntentProvider) as string[]);
    for (const key of Object.keys(PROVIDER_MODEL_CATALOG)) {
      expect(declared.has(key)).toBe(true);
    }
  });
});
