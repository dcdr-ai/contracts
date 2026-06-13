import {
  DcdrServiceTokenLimitType,
  DcdrServiceTokensSnapshotContract,
} from "../src/service-tokens.contract";

describe("DcdrServiceTokensSnapshotContract", () => {
  it("supports optional execution limits metadata (JSON round-trip)", () => {
    const snapshot: DcdrServiceTokensSnapshotContract = {
      cid: "tenant-1",
      tokens: [
        {
          id: "ci-pipeline",
          sha256: "abc123",
          status: "ACTIVE",
          scopes: ["*"],
          limits: [
            {
              maxCalls: 25,
              type: DcdrServiceTokenLimitType.LIMITED_BY_DAY,
              scopes: ["INTENT_A", "INTENT_B"],
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
  });
});
