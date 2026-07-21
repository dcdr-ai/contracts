/// <reference types="jest" />

import { DcdrEntitlementsContract } from "../src/entitlements.contract";
import { DcdrAssetScope } from "../src/asset.contract";
import {
  ExecutionAssetDatasourceResolutionMode,
  ExecutionAssetDatasourceType,
} from "../src/execution.contract";
import { IntentProvider } from "../src/provider.contract";
import { DcdrServiceTokenLimitType } from "../src/service-tokens.contract";
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
      assetStorages: [
        {
          id: "managed-default",
          isDefault: true,
          enabled: true,
          maxAssetSizeBytes: 104857600,
          datasource: {
            type: ExecutionAssetDatasourceType.S3,
            resolution: ExecutionAssetDatasourceResolutionMode.BACKEND,
            id: "managed-default",
            container: "tenant-assets",
            basePath: "tenants/customer-1",
          },
          credentialsExpiresAtMs: 1778460966000,
        },
      ],
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
      providerLimits: {
        providers: {
          [IntentProvider.OPEN_AI]: {
            enabled: true,
            maxCalls: 1000,
            maxCallsPeriod: DcdrServiceTokenLimitType.LIMITED_BY_MONTH,
            maxBudget: 250,
            maxBudgetPeriod: DcdrServiceTokenLimitType.LIMITED_BY_MONTH,
            models: {
              "gpt-5": { enabled: true },
            },
          },
          [IntentProvider.ANTHROPIC]: {
            enabled: false,
          },
        },
      },
    };

    const json = JSON.stringify(ent);
    const roundTrip = JSON.parse(json) as DcdrEntitlementsContract;

    expect(roundTrip.cid).toBe(ent.cid);
    expect(roundTrip.limits.maxCallsPerMonth).toBe(100000);
    expect(roundTrip.usageBaseline.periodKey).toBe("2026-04");
    expect(roundTrip.assetStorages?.[0]?.datasource?.id).toBe(
      "managed-default",
    );
    expect(roundTrip.assetStorages?.[0]?.isDefault).toBe(true);
    expect(roundTrip.subscriptionStatus).toBe("TRIAL");
    expect(roundTrip.businessLimits?.maxUsers).toBe(5);
    expect(roundTrip.businessUsage?.serviceTokens).toBe(1);
    expect(roundTrip.providerLimits?.providers?.OPEN_AI?.maxCalls).toBe(1000);
    expect(
      roundTrip.providerLimits?.providers?.OPEN_AI?.models?.["gpt-5"]
        ?.enabled,
    ).toBe(true);
    expect(roundTrip.providerLimits?.providers?.ANTHROPIC?.enabled).toBe(
      false,
    );
  });

  it("omits providerLimits without breaking existing consumers (fail-open, backward compatible)", () => {
    const ent: DcdrEntitlementsContract = {
      cid: "e835c0cd-2c9c-4d37-8e40-6f988ca15b5d",
      limits: { maxCallsPerMonth: null },
      usageBaseline: { periodKey: "2026-04", callsThisMonth: 0 },
    };

    const roundTrip = JSON.parse(
      JSON.stringify(ent),
    ) as DcdrEntitlementsContract;

    expect(roundTrip.providerLimits).toBeUndefined();
  });
});
