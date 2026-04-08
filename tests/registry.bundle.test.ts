import { DcdrRegistry } from "../src/control.contract";
import { IntentContract, IntentType } from "../src/intent.contract";
import { ImplementationContract } from "../src/implementations.contract";
import { IntentProvider } from "../src/provider.contract";
import { PromptTemplate } from "../src/prompts.contract";
import { RetryPolicy } from "../src/policies.contract";

/**
 * Builds a minimal PromptTemplate that satisfies the contract.
 * @returns A minimal prompt template object.
 */
function makeMinimalPromptTemplate(): PromptTemplate {
  return {
    id: "prompt-1",
    version: "v1",
    name: "minimal",
    sha256: "sha256-minimal",
    semanticHash: "semantic-minimal",
    messages: [{ role: "user", content: "Hello" }],
  };
}

/**
 * Builds a minimal ImplementationContract that satisfies the contract.
 * @param provider Provider enum value to set.
 * @returns A minimal implementation contract object.
 */
function makeMinimalImplementation(provider: IntentProvider): ImplementationContract {
  return {
    id: `impl-${provider}`,
    provider,
    name: `impl-${provider}`,
    version: "v1",
    sha256: `sha256-${provider}`,
    semanticHash: `semantic-${provider}`,
    model: "model-1",
    endpoint: "https://example.invalid",
    active: true,
  };
}

/**
 * Builds a minimal RetryPolicy that satisfies the contract.
 * @returns A minimal retry policy.
 */
function makeMinimalRetryPolicy(): RetryPolicy {
  return {
    maxAttempts: 1,
    allowFallback: false,
  };
}

/**
 * Builds a minimal IntentContract that satisfies the contract.
 * @returns A minimal intent contract.
 */
function makeMinimalIntentContract(): IntentContract {
  return {
    id: "intent-1",
    intent: "hello_intent",
    type: IntentType.CHAT,
    active: true,
    defaultPrompt: makeMinimalPromptTemplate(),
    retryPolicy: makeMinimalRetryPolicy(),
    implementations: [makeMinimalImplementation(IntentProvider.RULES)],
  };
}

describe("DcdrRegistry bundle", () => {
  it("can build a minimal registry with at least one intent", () => {
    const registry: DcdrRegistry = {
      sha256: "registry-sha256",
      intents: [makeMinimalIntentContract()],
      generatedAt: new Date().toISOString(),
    };

    expect(typeof registry.sha256).toBe("string");
    expect(registry.sha256.length).toBeGreaterThan(0);

    expect(Array.isArray(registry.intents)).toBe(true);
    expect(registry.intents.length).toBeGreaterThan(0);

    const first = registry.intents[0];
    expect(first.active).toBe(true);
    expect(first.type).toBe(IntentType.CHAT);
    expect(first.defaultPrompt.messages.length).toBeGreaterThan(0);
    expect(first.implementations.length).toBeGreaterThan(0);
  });

  it("survives JSON round-trip without losing required fields", () => {
    const registry: DcdrRegistry = {
      sha256: "registry-sha256",
      intents: [makeMinimalIntentContract()],
    };

    const json = JSON.stringify(registry);
    const parsed = JSON.parse(json) as DcdrRegistry;

    expect(parsed.sha256).toBe("registry-sha256");
    expect(Array.isArray(parsed.intents)).toBe(true);
    expect(parsed.intents.length).toBe(1);

    const intent = parsed.intents[0];
    expect(typeof intent.id).toBe("string");
    expect(typeof intent.intent).toBe("string");
    expect(typeof intent.active).toBe("boolean");

    expect(intent.defaultPrompt).toBeTruthy();
    expect(Array.isArray(intent.defaultPrompt.messages)).toBe(true);

    expect(intent.retryPolicy).toBeTruthy();
    expect(typeof intent.retryPolicy.maxAttempts).toBe("number");

    expect(Array.isArray(intent.implementations)).toBe(true);
    expect(intent.implementations.length).toBe(1);

    const impl = intent.implementations[0];
    expect(typeof impl.id).toBe("string");
    expect(typeof impl.provider).toBe("string");
    expect(typeof impl.endpoint).toBe("string");
    expect(typeof impl.active).toBe("boolean");
  });
});
