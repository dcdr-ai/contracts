import { CapabilityKey, getRequiredCapabilitiesFromRegistry } from "../src/capabilities.contract";
import { DcdrRegistry } from "../src/control.contract";
import { IntentContract, IntentType } from "../src/intent.contract";
import { ImplementationContract } from "../src/implementations.contract";
import { ExecutionPolicyType } from "../src/policies.contract";
import { IntentProvider } from "../src/provider.contract";
import { PromptTemplate } from "../src/prompts.contract";
import { RetryPolicy } from "../src/policies.contract";

/**
 * Builds a minimal PromptTemplate that satisfies the contract.
 */
function makePrompt(): PromptTemplate {
  return {
    id: "p1",
    version: "1",
    name: "demo",
    sha256: "x",
    semanticHash: "y",
    messages: [{ role: "user", content: "hi" }],
  };
}

/**
 * Builds a minimal RetryPolicy for tests.
 */
function makeRetry(): RetryPolicy {
  return { maxAttempts: 1, allowFallback: false };
}

/**
 * Builds a minimal ImplementationContract for tests.
 */
function makeImpl(extra?: Partial<ImplementationContract>): ImplementationContract {
  return {
    id: "impl-1",
    provider: IntentProvider.RULES,
    name: "impl",
    version: "1",
    sha256: "sha",
    semanticHash: "sem",
    model: "m1",
    endpoint: "https://example.invalid",
    active: true,
    ...extra,
  };
}

/**
 * Builds a minimal IntentContract for tests.
 */
function makeIntent(extra?: Partial<IntentContract>): IntentContract {
  return {
    id: "intent-1",
    intent: "hello",
    type: IntentType.CHAT,
    active: true,
    defaultPrompt: makePrompt(),
    retryPolicy: makeRetry(),
    implementations: [makeImpl()],
    ...extra,
  };
}

describe("capabilities.contract", () => {
  it("returns empty list for minimal registry", () => {
    const reg: DcdrRegistry = {
      sha256: "r",
      intents: [makeIntent()],
    };

    const caps = getRequiredCapabilitiesFromRegistry(reg);
    expect(caps).toEqual([]);
  });

  it("detects prompt canary usage", () => {
    const reg: DcdrRegistry = {
      sha256: "r",
      intents: [makeIntent({ canaryPrompt: makePrompt(), canaryPromptWeight: 0.1 })],
    };

    const caps = getRequiredCapabilitiesFromRegistry(reg);
    expect(caps).toContain(CapabilityKey.AI_PROMPTS_CANARY);
  });

  it("detects advanced execution policy usage (non-WEIGHTED)", () => {
    const reg: DcdrRegistry = {
      sha256: "r",
      intents: [makeIntent({ executionPolicy: { type: ExecutionPolicyType.FALLBACK_CHAIN } })],
    };

    const caps = getRequiredCapabilitiesFromRegistry(reg);
    expect(caps).toContain(CapabilityKey.AI_INTENTS_ADVANCED_EXECUTION_POLICY);
  });

  it("detects per-implementation cache TTL", () => {
    const reg: DcdrRegistry = {
      sha256: "r",
      intents: [makeIntent({ implementations: [makeImpl({ cacheTTLSeconds: 60 })] })],
    };

    const caps = getRequiredCapabilitiesFromRegistry(reg);
    expect(caps).toContain(CapabilityKey.AI_RUNTIME_CACHE_TTL_CONFIGURABLE);
  });

  it("detects per-implementation execution windows", () => {
    const reg: DcdrRegistry = {
      sha256: "r",
      intents: [makeIntent({ implementations: [makeImpl({ executionWindow: { active: true } })] })],
    };

    const caps = getRequiredCapabilitiesFromRegistry(reg);
    expect(caps).toContain(CapabilityKey.AI_BASE_MODEL_EXECUTION_WINDOWS_OVERRIDE_PER_IMPLEMENTATION);
  });

  it("dedupes capabilities across intents", () => {
    const reg: DcdrRegistry = {
      sha256: "r",
      intents: [
        makeIntent({ implementations: [makeImpl({ cacheTTLSeconds: 60 })] }),
        makeIntent({ implementations: [makeImpl({ cacheTTLSeconds: 120 })] }),
      ],
    };

    const caps = getRequiredCapabilitiesFromRegistry(reg);
    const occurrences = caps.filter((c) => c === CapabilityKey.AI_RUNTIME_CACHE_TTL_CONFIGURABLE).length;
    expect(occurrences).toBe(1);
  });
});
