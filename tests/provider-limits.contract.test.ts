import { IntentProvider } from "../src/provider.contract";
import {
  DcdrProviderLimitsConfig,
  DcdrProviderLimitGate,
} from "../src/provider-limits.contract";
import { DcdrServiceTokenLimitType } from "../src/service-tokens.contract";

describe("DcdrProviderLimitsConfig", () => {
  it("supports provider and per-model governance limits (JSON round-trip)", () => {
    const imageModelGate: DcdrProviderLimitGate = {
      enabled: false,
    };

    const cfg: DcdrProviderLimitsConfig = {
      providers: {
        [IntentProvider.OPEN_AI]: {
          enabled: true,
          maxCalls: 1000,
          maxCallsPeriod: DcdrServiceTokenLimitType.LIMITED_BY_MONTH,
          maxBudget: 250,
          maxBudgetPeriod: DcdrServiceTokenLimitType.LIMITED_BY_MONTH,
          models: {
            "gpt-5": {
              enabled: true,
            },
            "gpt-image-1": imageModelGate,
          },
        },
        [IntentProvider.ANTHROPIC]: {
          enabled: false,
        },
      },
    };

    const json = JSON.stringify(cfg);
    const roundTrip = JSON.parse(json) as DcdrProviderLimitsConfig;

    expect(roundTrip.providers?.OPEN_AI?.maxCalls).toBe(1000);
    expect(roundTrip.providers?.OPEN_AI?.maxCallsPeriod).toBe(
      DcdrServiceTokenLimitType.LIMITED_BY_MONTH,
    );
    expect(roundTrip.providers?.OPEN_AI?.maxBudget).toBe(250);
    expect(roundTrip.providers?.OPEN_AI?.models?.["gpt-5"]?.enabled).toBe(
      true,
    );
    expect(
      roundTrip.providers?.OPEN_AI?.models?.["gpt-image-1"]?.enabled,
    ).toBe(false);
    expect(roundTrip.providers?.ANTHROPIC?.enabled).toBe(false);
  });
});
