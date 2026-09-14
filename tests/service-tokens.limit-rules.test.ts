import { IntentProvider } from "../src/provider.contract";
import {
  DcdrServiceTokenLimitMetric,
  DcdrServiceTokenLimitSurface,
  DcdrServiceTokenLimitType,
  DcdrServiceTokenLimitWindow,
  dcdrIsoWeekOf,
  dcdrServiceTokenLimitPeriodKey,
  isDcdrServiceTokenLimitRuleDispatchCounted,
  isDcdrServiceTokenModelAllowed,
  resolveDcdrServiceTokenLimitRules,
  translateLegacyServiceTokenLimits,
} from "../src/service-tokens.contract";

describe("service token limit rules (3.14.0)", () => {
  describe("dcdrServiceTokenLimitPeriodKey", () => {
    const at = Date.UTC(2026, 8, 14, 7, 30); // Monday 2026-09-14 07:30 UTC

    it("uses the Provider Limits formats for hour, day and month", () => {
      expect(dcdrServiceTokenLimitPeriodKey(DcdrServiceTokenLimitWindow.HOUR, at)).toBe("2026-09-14-07");
      expect(dcdrServiceTokenLimitPeriodKey(DcdrServiceTokenLimitWindow.DAY, at)).toBe("2026-09-14");
      expect(dcdrServiceTokenLimitPeriodKey(DcdrServiceTokenLimitWindow.MONTH, at)).toBe("2026-09");
      expect(dcdrServiceTokenLimitPeriodKey(DcdrServiceTokenLimitWindow.FIXED, at)).toBe("fixed");
    });

    it.each([
      // [label, instant, expected key]
      ["Monday of week 38", Date.UTC(2026, 8, 14, 0, 0), "2026-W38"],
      ["Sunday closes the same week", Date.UTC(2026, 8, 20, 23, 59), "2026-W38"],
      ["2025-12-29 belongs to 2026-W01", Date.UTC(2025, 11, 29, 12), "2026-W01"],
      ["2027-01-01 (Friday) belongs to 2026-W53", Date.UTC(2027, 0, 1, 12), "2026-W53"],
      ["2021-01-03 (Sunday) belongs to 2020-W53", Date.UTC(2021, 0, 3, 12), "2020-W53"],
      ["2024-12-30 belongs to 2025-W01", Date.UTC(2024, 11, 30, 0), "2025-W01"],
      ["2023-01-01 (Sunday) belongs to 2022-W52", Date.UTC(2023, 0, 1, 0), "2022-W52"],
    ])("WEEK is the ISO week-year: %s", (_label, instant, expected) => {
      expect(dcdrServiceTokenLimitPeriodKey(DcdrServiceTokenLimitWindow.WEEK, instant)).toBe(expected);
    });

    it("dcdrIsoWeekOf reports the week-year apart from the calendar year", () => {
      expect(dcdrIsoWeekOf(Date.UTC(2025, 11, 31))).toEqual({ weekYear: 2026, week: 1 });
    });
  });

  describe("isDcdrServiceTokenLimitRuleDispatchCounted", () => {
    it("is true only when the scope names providers or models", () => {
      expect(isDcdrServiceTokenLimitRuleDispatchCounted({})).toBe(false);
      expect(isDcdrServiceTokenLimitRuleDispatchCounted({ scope: { intents: ["A"], surfaces: [DcdrServiceTokenLimitSurface.INTENT] } })).toBe(false);
      expect(isDcdrServiceTokenLimitRuleDispatchCounted({ scope: { providers: [IntentProvider.OPEN_AI] } })).toBe(true);
      expect(
        isDcdrServiceTokenLimitRuleDispatchCounted({ scope: { intents: ["A"], models: [{ provider: IntentProvider.ANTHROPIC, modelId: "claude-opus-5" }] } }),
      ).toBe(true);
      expect(isDcdrServiceTokenLimitRuleDispatchCounted({ scope: { providers: [] } })).toBe(false);
    });
  });

  describe("translateLegacyServiceTokenLimits", () => {
    it("turns legacy limits into CALLS rules on the INTENT surface, never matching the gateway", () => {
      const rules = translateLegacyServiceTokenLimits([
        { maxCalls: 10, type: DcdrServiceTokenLimitType.LIMITED_BY_DAY },
        { maxCalls: 3, type: DcdrServiceTokenLimitType.FIXED, scopes: ["*"] },
        { maxCalls: 5, type: DcdrServiceTokenLimitType.LIMITED_BY_HOUR, scopes: ["B", "A", "A"] },
        { maxCalls: 0, type: DcdrServiceTokenLimitType.LIMITED_BY_MONTH },
      ]);

      expect(rules).toEqual([
        {
          metric: DcdrServiceTokenLimitMetric.CALLS,
          window: DcdrServiceTokenLimitWindow.DAY,
          max: 10,
          scope: { surfaces: [DcdrServiceTokenLimitSurface.INTENT] },
        },
        {
          metric: DcdrServiceTokenLimitMetric.CALLS,
          window: DcdrServiceTokenLimitWindow.FIXED,
          max: 3,
          scope: { surfaces: [DcdrServiceTokenLimitSurface.INTENT] },
        },
        {
          metric: DcdrServiceTokenLimitMetric.CALLS,
          window: DcdrServiceTokenLimitWindow.HOUR,
          max: 5,
          scope: { surfaces: [DcdrServiceTokenLimitSurface.INTENT], intents: ["A", "B"] },
        },
      ]);
    });
  });

  describe("isDcdrServiceTokenModelAllowed", () => {
    const pair = { provider: IntentProvider.ANTHROPIC, modelId: "claude-haiku-4-5" };

    it("allows everything when the token has no opinion (absent or null)", () => {
      expect(isDcdrServiceTokenModelAllowed(undefined, IntentProvider.OPEN_AI, "gpt-5")).toBe(true);
      expect(isDcdrServiceTokenModelAllowed(null, IntentProvider.OPEN_AI, "gpt-5")).toBe(true);
    });

    it("allows nothing for an empty list", () => {
      expect(isDcdrServiceTokenModelAllowed([], IntentProvider.OPEN_AI, "gpt-5")).toBe(false);
    });

    it("matches provider and model id together", () => {
      expect(isDcdrServiceTokenModelAllowed([pair], IntentProvider.ANTHROPIC, "claude-haiku-4-5")).toBe(true);
      expect(isDcdrServiceTokenModelAllowed([pair], IntentProvider.ANTHROPIC, "claude-opus-5")).toBe(false);
      // The same id under another provider is another pair.
      expect(isDcdrServiceTokenModelAllowed([pair], IntentProvider.OPEN_AI_COMPATIBLE, "claude-haiku-4-5")).toBe(false);
    });
  });

  describe("resolveDcdrServiceTokenLimitRules", () => {
    const legacy = [{ maxCalls: 1, type: DcdrServiceTokenLimitType.LIMITED_BY_DAY }];

    it("prefers rules, even an empty list, over legacy limits", () => {
      expect(resolveDcdrServiceTokenLimitRules({ rules: [], limits: legacy })).toEqual([]);
      const rule = { metric: DcdrServiceTokenLimitMetric.BUDGET, window: DcdrServiceTokenLimitWindow.WEEK, max: 50 };
      expect(resolveDcdrServiceTokenLimitRules({ rules: [rule], limits: legacy })).toEqual([rule]);
    });

    it("falls back to the translated legacy limits when rules are absent", () => {
      expect(resolveDcdrServiceTokenLimitRules({ limits: legacy })).toHaveLength(1);
      expect(resolveDcdrServiceTokenLimitRules({})).toEqual([]);
    });
  });
});
