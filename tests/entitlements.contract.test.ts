/// <reference types="jest" />

import { DcdrEntitlementsContract } from "../src/entitlements.contract";
import { SubscriptionStatus } from "../src/subscription.contract";

describe("DcdrEntitlementsContract", () => {
  it("supports optional subscription and business/UI fields (JSON round-trip)", () => {
    const ent: DcdrEntitlementsContract = {
      cid: "e835c0cd-2c9c-4d37-8e40-6f988ca15b5d",
      limits: {
        maxCallsPerMonth: 100000,
        maxCallsPerHour: 500,
        maxCallsPerDay: 10000,
        maxTrackedCallsPerMonth: 10000,
      },
      usageBaseline: {
        periodKey: "2026-04",
        callsThisMonth: 0,
        trackedCallsThisMonth: 0,
      },
      resetAt: 1777593600000,
      iat: 1777286527497,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      subscriptionEndDateMs: 1778460966000,
      logRetentionDays: 30,
      businessLimits: {
        maxUsers: 5,
        maxServiceTokens: 10,
        logRetentionDays: 30,
        maxIntents: 25,
        maxImplementations: 100,
        maxPromptTemplates: 100,
        maxCredentials: 5,
        maxExecutionWindows: 10,
        maxWebhooks: 0,
      },
      businessUsage: {
        users: 1,
        serviceTokens: 1,
        implementations: 0,
        intents: 0,
        promptTemplates: 0,
        credentials: 0,
        executionWindows: 0,
        webhooks: 0,
      },
    };

    const json = JSON.stringify(ent);
    const roundTrip = JSON.parse(json) as DcdrEntitlementsContract;

    expect(roundTrip.cid).toBe(ent.cid);
    expect(roundTrip.limits.maxCallsPerMonth).toBe(100000);
    expect(roundTrip.usageBaseline.periodKey).toBe("2026-04");
    expect(roundTrip.subscriptionStatus).toBe("TRIAL");
    expect(roundTrip.businessLimits?.maxUsers).toBe(5);
    expect(roundTrip.businessUsage?.serviceTokens).toBe(1);
  });
});
