import {
  DcdrServiceTokenLimitType,
  DcdrServiceTokenScope,
  DcdrServiceTokensSnapshotContract,
} from "../src/service-tokens.contract";
import { IntentProvider } from "../src/provider.contract";

describe("DcdrServiceTokensSnapshotContract", () => {
  it("supports optional execution limits and gateway credential bindings metadata (JSON round-trip)", () => {
    const snapshot: DcdrServiceTokensSnapshotContract = {
      cid: "tenant-1",
      tokens: [
        {
          id: "ci-pipeline",
          sha256: "abc123",
          status: "ACTIVE",
          scopes: ["*", DcdrServiceTokenScope.GATEWAY],
          limits: [
            {
              maxCalls: 25,
              type: DcdrServiceTokenLimitType.LIMITED_BY_DAY,
              scopes: ["INTENT_A", "INTENT_B"],
            },
          ],
          gatewayBindings: [
            {
              provider: IntentProvider.OPEN_AI,
              credentialRef: "cred-openai-1",
            },
            {
              provider: IntentProvider.ANTHROPIC,
              credentialRef: "cred-anthropic-1",
            },
          ],
        },
      ],
      iat: Date.now(),
    };

    const json = JSON.stringify(snapshot);
    const roundTrip = JSON.parse(json) as DcdrServiceTokensSnapshotContract;

    expect(roundTrip.tokens[0]?.limits?.[0]?.maxCalls).toBe(25);
    expect(roundTrip.tokens[0]?.limits?.[0]?.type).toBe("LIMITED_BY_DAY");
    expect(roundTrip.tokens[0]?.limits?.[0]?.scopes).toEqual([
      "INTENT_A",
      "INTENT_B",
    ]);
    expect(roundTrip.tokens[0]?.scopes).toContain(DcdrServiceTokenScope.GATEWAY);
    expect(roundTrip.tokens[0]?.gatewayBindings?.[0]?.provider).toBe(
      IntentProvider.OPEN_AI,
    );
    expect(roundTrip.tokens[0]?.gatewayBindings?.[0]?.credentialRef).toBe(
      "cred-openai-1",
    );
    expect(roundTrip.tokens[0]?.gatewayBindings?.[1]?.provider).toBe(
      IntentProvider.ANTHROPIC,
    );
    expect(roundTrip.tokens[0]?.gatewayBindings?.[1]?.credentialRef).toBe(
      "cred-anthropic-1",
    );
  });
});
