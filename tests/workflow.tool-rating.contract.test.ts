import { WORKFLOW_CAPABILITIES, WORKFLOW_IMPLEMENTED_CAPABILITIES } from "../src/workflow.capabilities.contract";
import {
  DEFAULT_WORKFLOW_TOOL_RATING_MATRIX_V1,
  WORKFLOW_TOOL_RATING_MCP_ID,
  WorkflowToolMeter,
  WorkflowToolRatingMatrixStatus,
  rateWorkflowToolCall,
} from "../src/workflow.tool-rating.contract";

/**
 * What a tool call costs.
 *
 * Most of this file asserts **properties** rather than prices, on purpose. A test that pins
 * `db.query` at four credits for fifty thousand rows locks a business decision that is meant to
 * move; a test that pins "a bigger answer never costs less than a smaller one" locks the thing that
 * has to stay true whatever the numbers become. The prices live in the matrix, which is versioned so
 * it can change - and these are the rules any future version still has to satisfy.
 */
describe("workflow tool rating", () => {
  const matrix = DEFAULT_WORKFLOW_TOOL_RATING_MATRIX_V1;

  describe("the matrix itself", () => {
    it("is active, and charges at least one credit for a call", () => {
      expect(matrix.status).toBe(WorkflowToolRatingMatrixStatus.ACTIVE);
      expect(matrix.base).toBeGreaterThanOrEqual(1);
    });

    it("prices every capability a runner can execute, and the MCP tool call", () => {
      // A capability with no row is not free - it falls through to the base - but it is also
      // unconsidered, and "nobody decided" is not a price. This is the check that makes adding a
      // capability without pricing it a failing test rather than a silent one-credit default.
      const priced = new Set(matrix.rows.map((row) => row.capability));
      for (const id of WORKFLOW_IMPLEMENTED_CAPABILITIES) expect(priced.has(id)).toBe(true);
      expect(priced.has(WORKFLOW_TOOL_RATING_MCP_ID)).toBe(true);
    });

    it("prices nothing that is not in the catalogue", () => {
      const known = new Set([...WORKFLOW_CAPABILITIES.map((capability) => capability.id), WORKFLOW_TOOL_RATING_MCP_ID]);
      for (const row of matrix.rows) expect(known.has(row.capability)).toBe(true);
    });

    it("keeps every ladder monotonic, so a bigger answer never costs less", () => {
      // The one property a rating ladder cannot get wrong. A dip anywhere in it is an incentive to
      // ask for *more* data to pay less, which is the opposite of what a meter is for.
      for (const row of matrix.rows) {
        for (const [meter, buckets] of Object.entries(row.meters ?? {})) {
          const multipliers = buckets.map((bucket) => bucket.multiplier);
          expect({ capability: row.capability, meter, multipliers }).toEqual({
            capability: row.capability,
            meter,
            multipliers: [...multipliers].sort((left, right) => left - right),
          });
        }
      }
    });

    it("ends every ladder open, so no measure falls off the end", () => {
      for (const row of matrix.rows) {
        for (const buckets of Object.values(row.meters ?? {})) {
          expect(buckets[buckets.length - 1].upTo).toBeUndefined();
          // And every bucket before the last is bounded, or the ones after it are unreachable.
          for (const bucket of buckets.slice(0, -1)) expect(bucket.upTo).toBeGreaterThan(0);
        }
      }
    });

    it("bounds what any single call can cost", () => {
      // A multiplier that can reach double figures stops being a weighting and becomes a penalty,
      // and the connection's own ceilings already bound the measure.
      for (const row of matrix.rows) {
        for (const buckets of Object.values(row.meters ?? {})) {
          for (const bucket of buckets) expect(bucket.multiplier).toBeLessThanOrEqual(matrix.maxMultiplier);
        }
      }
    });
  });

  describe("what a call costs", () => {
    it("charges the base for a call nobody measured", () => {
      // We measure after the fact, from what the adapter already returned. A missing measure is our
      // gap, not the tenant's, and must never be charged punitively.
      expect(rateWorkflowToolCall("db.query")).toBe(matrix.base);
      expect(rateWorkflowToolCall("file.get", {})).toBe(matrix.base);
      expect(rateWorkflowToolCall("something.unknown", { rows: 999_999 })).toBe(matrix.base);
    });

    it("charges the base for a capability whose own ceiling already bounds it", () => {
      // `web.fetch` stops at five megabytes, `file.list` at a thousand entries, `web.search` at ten
      // results. A second ceiling on top would only be a second thing to keep in step.
      expect(rateWorkflowToolCall("web.fetch", { bytes: 5 * 1024 * 1024 })).toBe(1);
      expect(rateWorkflowToolCall("file.list", { rows: 1_000 })).toBe(1);
      expect(rateWorkflowToolCall("web.search", {})).toBe(1);
      expect(rateWorkflowToolCall("chat.post", { bytes: 4_000 })).toBe(1);
    });

    it("leaves a default connection in the first bucket", () => {
      // The fairness rule that matters most: out of the box, everything is one credit. A tenant
      // pays more only after *they* raised a limit, so the price follows a decision they made.
      expect(rateWorkflowToolCall("db.query", { rows: 1_000, bytes: 2 * 1024 * 1024 })).toBe(1);
      expect(rateWorkflowToolCall("file.get", { bytes: 5 * 1024 * 1024 })).toBe(1);
      expect(rateWorkflowToolCall("ssh.exec", { bytes: 512 * 1024 })).toBe(1);
      expect(rateWorkflowToolCall("mail.send", { recipients: 3 })).toBe(1);
    });

    it("climbs with the measure, and stops climbing at the cap", () => {
      const ladder = [1, 1_000, 10_000, 100_000, 10_000_000].map((rows) => rateWorkflowToolCall("db.query", { rows }));
      expect(ladder).toEqual([...ladder].sort((left, right) => left - right));
      expect(Math.max(...ladder)).toBeLessThanOrEqual(matrix.base * matrix.maxMultiplier);
    });

    it("takes the highest meter and never the sum", () => {
      // A hundred rows a megabyte wide is a big answer measured in bytes and a small one measured in
      // rows. Charging for both would double-count one call; taking the larger is what stops either
      // meter from being the one to game.
      const wide = rateWorkflowToolCall("db.query", { rows: 100, bytes: 100 * 1024 * 1024 });
      const long = rateWorkflowToolCall("db.query", { rows: 50_000, bytes: 1_000 });
      const both = rateWorkflowToolCall("db.query", { rows: 50_000, bytes: 100 * 1024 * 1024 });
      expect(wide).toBe(4);
      expect(long).toBe(4);
      expect(both).toBe(Math.max(wide, long));
    });

    it("charges a read and a write of the same size the same", () => {
      // Same work, same price. Charging differently would be arbitrary, and arbitrary is what a
      // customer notices.
      for (const bytes of [1_000, 50 * 1024 * 1024, 500 * 1024 * 1024]) {
        expect(rateWorkflowToolCall("file.get", { bytes })).toBe(rateWorkflowToolCall("file.put", { bytes }));
      }
    });

    it("never charges a message more than the adapter would accept", () => {
      // `mail.send` refuses more than fifty recipients, so the worst case of one message is knowable
      // in advance rather than discovered in a bill.
      expect(rateWorkflowToolCall("mail.send", { recipients: 50 })).toBeLessThanOrEqual(matrix.base * matrix.maxMultiplier);
    });

    it("ignores a nonsensical measure rather than charging for it", () => {
      for (const rows of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(rateWorkflowToolCall("db.query", { rows })).toBe(matrix.base);
      }
    });

    it("rates ten small calls as ten, not as one big one", () => {
      // The reason the runner rates as it goes instead of reporting sums: ten calls of six hundred
      // rows are ten one-credit calls, while six thousand rows rated once would be two. A factor of
      // five, in the tenant's favour, decided by *when* the rating happens.
      const perCall = Array.from({ length: 10 }, () => rateWorkflowToolCall("db.query", { rows: 600 }));
      const summedThenRated = rateWorkflowToolCall("db.query", { rows: 6_000 });
      expect(perCall.reduce((total, credits) => total + credits, 0)).toBe(10);
      expect(summedThenRated).toBe(2);
    });
  });
});
