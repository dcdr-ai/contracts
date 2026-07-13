import { DcdrRegistry } from "../src/control.contract";
import { IntentContract, IntentType } from "../src/intent.contract";
import { ImplementationContract } from "../src/implementations.contract";
import { IntentProvider } from "../src/provider.contract";
import { PromptTemplate } from "../src/prompts.contract";
import { RetryPolicy } from "../src/policies.contract";
import {
  ProcessingRuleKind,
  ProcessingStage,
} from "../src/processing.contract";

/**
 * Builds a minimal PromptTemplate that satisfies the contract.
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
 */
function makeMinimalImplementation(
  provider: IntentProvider,
): ImplementationContract {
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
 */
function makeMinimalRetryPolicy(): RetryPolicy {
  return {
    maxAttempts: 1,
    allowFallback: false,
  };
}

/**
 * Builds a minimal IntentContract that satisfies the contract.
 */
function makeMinimalIntentContract(): IntentContract {
  return {
    id: "intent-1",
    intent: "hello_intent",
    type: IntentType.CHAT,
    active: true,
    defaultPrompt: makeMinimalPromptTemplate(),
    retryPolicy: makeMinimalRetryPolicy(),
    processors: [
      {
        id: "normalize-input",
        version: "1",
        stage: ProcessingStage.INPUT,
        rules: [{ id: "trim", kind: ProcessingRuleKind.TRIM, fieldPaths: ["vars.name"] }],
      },
    ],
    implementations: [makeMinimalImplementation(IntentProvider.RULES)],
  };
}

describe("DcdrRegistry bundle", () => {
  it("can build a minimal registry with at least one intent", () => {
    const registry: DcdrRegistry = {
      sha256: "registry-sha256",
      intents: [makeMinimalIntentContract()],
      processors: [
        {
          id: "global-phi",
          version: "1",
          stage: ProcessingStage.INPUT,
          rules: [
            {
              id: "normalize-name",
              kind: ProcessingRuleKind.NORMALIZE_NEW_LINES,
              fieldPaths: ["vars.customerName"],
            },
          ],
        },
      ],
      generatedAt: new Date().toISOString(),
    };

    expect(typeof registry.sha256).toBe("string");
    expect(registry.intents.length).toBeGreaterThan(0);
    expect(registry.processors?.[0]?.version).toBe("1");
  });

  it("survives JSON round-trip without losing required fields", () => {
    const registry: DcdrRegistry = {
      sha256: "registry-sha256",
      intents: [makeMinimalIntentContract()],
      processors: [
        {
          id: "global-phi",
          version: "1",
          stage: ProcessingStage.INPUT,
          rules: [
            {
              id: "normalize-name",
              kind: ProcessingRuleKind.NORMALIZE_NEW_LINES,
              fieldPaths: ["vars.customerName"],
            },
          ],
        },
      ],
    };

    const json = JSON.stringify(registry);
    const parsed = JSON.parse(json) as DcdrRegistry;

    expect(parsed.processors?.[0]?.id).toBe("global-phi");
    expect(parsed.processors?.[0]?.rules?.[0]?.kind).toBe(
      ProcessingRuleKind.NORMALIZE_NEW_LINES,
    );
    expect(parsed.intents[0]?.processors?.[0]?.rules?.[0]?.kind).toBe(
      ProcessingRuleKind.TRIM,
    );
  });
});
