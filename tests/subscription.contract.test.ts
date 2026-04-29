/// <reference types="jest" />

import { SubscriptionStatus, SubscriptionStatusPolicy } from "../src/subscription.contract";

describe("SubscriptionStatus", () => {
  it("keeps stable wire values", () => {
    expect(SubscriptionStatus.DRAFT).toBe("DRAFT");
    expect(SubscriptionStatus.TRIAL).toBe("TRIAL");
    expect(SubscriptionStatus.ACTIVE).toBe("ACTIVE");
    expect(SubscriptionStatus.ENDED).toBe("ENDED");
    expect(SubscriptionStatus.SUSPENDED).toBe("SUSPENDED");
    expect(SubscriptionStatus.CANCELED).toBe("CANCELED");
  });

  it("policy lists are centralized and non-empty", () => {
    const any = Object.values(SubscriptionStatus);
    expect(any.length).toBeGreaterThan(0);

    expect(SubscriptionStatusPolicy.validStatuses()).toEqual([
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIAL,
      SubscriptionStatus.ENDED,
    ]);

    expect(SubscriptionStatusPolicy.validStatusesToShowCurrentData()).toEqual([
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIAL,
    ]);
  });
});
