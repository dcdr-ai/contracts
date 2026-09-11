/**
 * What one workflow tool call costs.
 *
 * A flat "one call, one unit" undercounts badly and unevenly: a `db.query` returning three rows and
 * one returning fifty thousand are not the same call, and neither are a two-kilobyte `file.put` and
 * a two-hundred-megabyte one. This module is the rating model that fixes that, and it is
 * deliberately the same model the platform already uses for multimodal executions
 * (`tracked-call-rating.contract`) rather than a second one invented beside it:
 *
 * - the **public unit stays simple** - credits, one per call at minimum;
 * - a call's cost is `1 x multiplier`, where the multiplier comes from **buckets, not formulas**;
 * - the matrix is **versioned**, so what a run was charged stays explainable after prices move;
 * - nothing is fetched, probed or re-read in order to rate a call.
 *
 * ## Why credits and not calls
 *
 * `maxCallsPerMonth` and `maxTrackedCallsPerMonth` already say what this product means by the two
 * words: a *call* is one invocation, a *tracked call* is one weighted by what it actually consumed.
 * A ceiling denominated in "calls" that a single invocation can spend four of is a ceiling whose
 * name is wrong on the invoice, so the entitlement this feeds is denominated in **credits** - the
 * word this product already uses for a weighted consumption counter (`creditsThisMonth`).
 *
 * ## Fairness rules this matrix is built on
 *
 * 1. **Every call costs at least one credit.** Resolving the connection, fetching the run's
 *    secrets, running the guard and recording the step are work a call does before it returns
 *    anything, so a query that matched nothing is not free.
 * 2. **The 1x boundary is the connection's own default ceiling.** A default connection is a
 *    one-credit connection. A tenant pays more only after *they* raised a limit - the price follows
 *    a decision they made rather than arriving as a surprise.
 * 3. **A call can never cost more than its connection already permits.** Every meter here is
 *    bounded by a ceiling the tenant configured (`maxRows`, `maxResponseBytes`), so the worst case
 *    of a workflow is computable in advance instead of discovered in a bill.
 * 4. **Read and write of the same size cost the same.** `file.get` and `file.put` of fifty
 *    megabytes are the same work and the same price.
 * 5. **Where two meters apply, the highest bucket wins - never the sum.** A hundred rows a megabyte
 *    wide is a big answer measured in bytes and a small one measured in rows, and taking the larger
 *    is what stops either meter from being the one to game.
 * 6. **An unmeasured call costs one credit.** We measure after the fact, from what the adapter
 *    already returned; if a measure is missing that is our gap and not the tenant's, so it is never
 *    charged punitively.
 */

/** What a capability call is measured on, when the call itself is not a fair unit. */
export enum WorkflowToolMeter {
  /** Rows or documents returned. */
  ROWS = "ROWS",
  /** Bytes that crossed the wire, in either direction. */
  BYTES = "BYTES",
  /** Envelope recipients a message was accepted for. */
  RECIPIENTS = "RECIPIENTS",
}

/** One step of a meter's bucket ladder. */
export interface WorkflowToolRatingBucket {
  /**
   * Largest measure this bucket covers, inclusive. The final bucket of a ladder omits it and
   * catches everything above.
   */
  upTo?: number;
  /** Multiplier applied to the one-credit base. Always at least 1. */
  multiplier: number;
}

/** How one capability is rated. */
export interface WorkflowToolRatingRow {
  /** Capability id, or `MCP` for a tool call on an MCP server. */
  capability: string;
  /**
   * Ladders that apply, by meter. A capability with none always costs one credit, which is the
   * right answer whenever the adapter's own ceiling already bounds what a call can return.
   */
  meters?: Partial<Record<WorkflowToolMeter, readonly WorkflowToolRatingBucket[]>>;
}

/** Lifecycle of a matrix snapshot, mirroring the tracked-call rating matrix. */
export enum WorkflowToolRatingMatrixStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  DEPRECATED = "DEPRECATED",
}

/** A rating matrix, versioned so a run's charge stays explainable after prices change. */
export interface WorkflowToolRatingMatrix {
  version: string;
  status: WorkflowToolRatingMatrixStatus;
  /** Credits every call costs before any multiplier. */
  base: number;
  /** Largest multiplier any call may reach, whatever the ladders say. */
  maxMultiplier: number;
  rows: readonly WorkflowToolRatingRow[];
}

/** What an adapter measured about one call. Every field is optional; absent means "not measured". */
export interface WorkflowToolMeasurement {
  rows?: number;
  bytes?: number;
  recipients?: number;
}

/**
 * The shipped matrix.
 *
 * The ladders below are anchored to the connection defaults the runner ships with - `maxRows` of
 * 1 000, `maxResponseBytes` of 2 MiB for a data connection and 5 MiB for a file one - so an
 * out-of-the-box connection is a one-credit connection and the steps above it correspond to limits
 * a tenant deliberately raised.
 *
 * Capabilities with no ladder are not oversights: `web.fetch` is already capped at five megabytes,
 * `file.list` at a thousand entries, and `web.search` at ten results, so their cost is bounded by
 * the adapter itself and a second ceiling would only be a second thing to keep in step.
 */
export const DEFAULT_WORKFLOW_TOOL_RATING_MATRIX_V1: WorkflowToolRatingMatrix = {
  version: "1.0.0",
  status: WorkflowToolRatingMatrixStatus.ACTIVE,
  base: 1,
  // Four is the ceiling on purpose. A multiplier that can reach double figures stops being a
  // weighting and becomes a penalty, and the connection's own limits already bound the measure.
  maxMultiplier: 4,
  rows: [
    {
      capability: "db.query",
      meters: {
        // 1 000 rows is the default `maxRows`, so the default connection sits in the first bucket.
        [WorkflowToolMeter.ROWS]: [{ upTo: 1_000, multiplier: 1 }, { upTo: 10_000, multiplier: 2 }, { multiplier: 4 }],
        // And the byte ladder is what stops a hundred very wide rows from riding in the first
        // bucket: 2 MiB is the default `maxResponseBytes` of a data connection.
        [WorkflowToolMeter.BYTES]: [{ upTo: 2 * 1024 * 1024, multiplier: 1 }, { upTo: 20 * 1024 * 1024, multiplier: 2 }, { multiplier: 4 }],
      },
    },
    {
      capability: "file.get",
      meters: {
        [WorkflowToolMeter.BYTES]: [{ upTo: 10 * 1024 * 1024, multiplier: 1 }, { upTo: 100 * 1024 * 1024, multiplier: 2 }, { multiplier: 4 }],
      },
    },
    {
      // Deliberately the same ladder as `file.get`: moving fifty megabytes is the same work in
      // either direction, and charging differently for it would be arbitrary.
      capability: "file.put",
      meters: {
        [WorkflowToolMeter.BYTES]: [{ upTo: 10 * 1024 * 1024, multiplier: 1 }, { upTo: 100 * 1024 * 1024, multiplier: 2 }, { multiplier: 4 }],
      },
    },
    {
      capability: "mail.send",
      meters: {
        // The adapter refuses more than fifty recipients, so the last bucket is reachable but
        // bounded: one message is never more than four credits.
        [WorkflowToolMeter.RECIPIENTS]: [{ upTo: 5, multiplier: 1 }, { upTo: 25, multiplier: 2 }, { multiplier: 4 }],
      },
    },
    {
      capability: "ssh.exec",
      meters: {
        // Output, not runtime: a command's wall-clock is already bounded by the connection budget,
        // and what leaves the host is what the run has to carry.
        [WorkflowToolMeter.BYTES]: [{ upTo: 1024 * 1024, multiplier: 1 }, { upTo: 10 * 1024 * 1024, multiplier: 2 }, { multiplier: 4 }],
      },
    },
    {
      // A tool answer travels in every later prompt of the agent loop, so a large one costs the run
      // repeatedly. The connection's `maxResponseBytes` bounds it; this prices what is left.
      capability: "MCP",
      meters: {
        [WorkflowToolMeter.BYTES]: [{ upTo: 1024 * 1024, multiplier: 1 }, { upTo: 10 * 1024 * 1024, multiplier: 2 }, { multiplier: 4 }],
      },
    },
    { capability: "web.search" },
    { capability: "web.fetch" },
    { capability: "chat.post" },
    { capability: "file.list" },
  ],
};

/** Capability id used to rate a tool call made on an MCP server. */
export const WORKFLOW_TOOL_RATING_MCP_ID = "MCP";

/**
 * Multiplier one ladder assigns to a measure.
 *
 * @param buckets The ladder.
 * @param measure What was measured.
 * @returns The multiplier, or 1 when there is nothing to go on.
 */
function multiplierFor(buckets: readonly WorkflowToolRatingBucket[], measure: number | undefined): number {
  if (measure === undefined || !Number.isFinite(measure) || measure < 0) return 1;
  for (const bucket of buckets) {
    if (bucket.upTo === undefined || measure <= bucket.upTo) return Math.max(1, bucket.multiplier);
  }
  return 1;
}

/**
 * Credits one capability call costs.
 *
 * Rated per call and never on a run's totals: ten calls of six hundred rows each are ten
 * one-credit calls, and adding them up first would price them as one six-thousand-row call and
 * charge two. The difference is a factor of five, in the tenant's favour, and it is the reason the
 * runner rates as it goes rather than reporting sums.
 *
 * @param capability Capability id, or `MCP` for a tool call on an MCP server.
 * @param measurement What the adapter measured about this call.
 * @param matrix Matrix to rate against; the shipped one by default.
 * @returns Credits consumed, at least the matrix base.
 */
export function rateWorkflowToolCall(
  capability: string,
  measurement: WorkflowToolMeasurement = {},
  matrix: WorkflowToolRatingMatrix = DEFAULT_WORKFLOW_TOOL_RATING_MATRIX_V1,
): number {
  const row = matrix.rows.find((entry) => entry.capability === capability);
  if (!row?.meters) return matrix.base;

  const measures: Record<WorkflowToolMeter, number | undefined> = {
    [WorkflowToolMeter.ROWS]: measurement.rows,
    [WorkflowToolMeter.BYTES]: measurement.bytes,
    [WorkflowToolMeter.RECIPIENTS]: measurement.recipients,
  };

  // The highest bucket any meter reaches, never the sum: a wide answer and a long one are the same
  // answer seen two ways, and charging for both would double-count one call.
  let multiplier = 1;
  for (const [meter, buckets] of Object.entries(row.meters) as Array<[WorkflowToolMeter, readonly WorkflowToolRatingBucket[]]>) {
    multiplier = Math.max(multiplier, multiplierFor(buckets, measures[meter]));
  }

  return matrix.base * Math.min(multiplier, matrix.maxMultiplier);
}
