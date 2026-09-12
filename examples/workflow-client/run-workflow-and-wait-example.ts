import {
  DcdrWorkflowClient,
  DcdrWorkflowErrorCode,
  WorkflowWaitOutcome,
  isDcdrWorkflowError,
} from "@dcdr/contracts";

/**
 * The 80% case: run a workflow and wait for its result.
 *
 * Everything else in this folder is a variation on this. It is deliberately short, because the whole
 * point of `runWorkflowAndWait` is that starting a governed, audited, multi-step run should not read
 * differently from calling a function.
 */

const baseUrl = (process.env.DCDR_CONTROL_URL ?? "https://dcdr.ai").trim();
const bearerToken = (process.env.DCDR_SERVICE_TOKEN ?? "").trim();
const workflowKey = (process.env.DCDR_WORKFLOW_KEY ?? "SUPPORT_TRIAGE").trim();

/** Input this workflow's `inputSchema` declares. Typed here so a typo is a compile error. */
interface SupportTriageInput {
  ticketId: string;
  subject: string;
  body: string;
}

/** Output this workflow's `outputSchema` declares. */
interface SupportTriageOutput {
  category: string;
  priority: string;
  reply: string;
}

/**
 * Runs the workflow and prints what came back.
 */
async function main(): Promise<void> {
  if (!bearerToken) throw new Error("Set DCDR_SERVICE_TOKEN to a token with workflows:read and workflows:run.");

  const workflows = new DcdrWorkflowClient({ baseUrl, bearerToken });

  const input: SupportTriageInput = {
    ticketId: "T-4821",
    subject: "I was charged twice this month",
    body: "My card shows two identical charges on the 3rd. Please refund one.",
  };

  // eslint-disable-next-line no-console
  console.log(`[run] workflow=${workflowKey} baseUrl=${baseUrl}`);

  const result = await workflows.runWorkflowAndWait(
    workflowKey,
    // The ticket id is a natural idempotency key: the same ticket must never open two runs.
    { input, correlationId: input.ticketId, idempotencyKey: input.ticketId },
    {
      // A support triage should not take fifteen minutes; fail fast rather than hold the process.
      timeoutMs: 120_000,
      onPoll: (run, polls) => {
        // eslint-disable-next-line no-console
        console.log(`[run] poll ${polls}: ${run.status} (${Math.round(run.progress * 100)}%)`);
      },
    },
  );

  if (result.outcome === WorkflowWaitOutcome.TIMED_OUT) {
    // The run did not stop: it is still executing server-side, and `runId` is how it is picked up.
    // eslint-disable-next-line no-console
    console.log(`[run] still running after ${result.waitedMs}ms; resume later with runId=${result.runId}`);
    return;
  }

  if (result.outcome === WorkflowWaitOutcome.WAITING) {
    // eslint-disable-next-line no-console
    console.log(
      `[run] parked on ${result.run.waits.map((wait) => `${wait.path ?? wait.stateId}${wait.human ? " (a person must act)" : ""}`).join(", ")}`,
    );
    return;
  }

  if (!result.succeeded) {
    // eslint-disable-next-line no-console
    console.error(`[run] ${result.status}: ${result.error?.code} ${result.error?.message} (state ${result.error?.stateId})`);
    process.exitCode = 1;
    return;
  }

  const output = result.output as SupportTriageOutput;
  // eslint-disable-next-line no-console
  console.log(`[run] ${result.status} in ${result.waitedMs}ms after ${result.polls} poll(s)`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(output, null, 2));

  // Usage is per run, with both halves of the tool counters: raw calls and rated credits.
  const usage = result.run.usage;
  // eslint-disable-next-line no-console
  console.log(`[run] usage: ${usage?.trackedCalls ?? 0} model call(s), ${usage?.toolCallsTotal ?? 0} tool call(s)`);
}

main().catch((e: unknown) => {
  if (isDcdrWorkflowError(e)) {
    // Every failure carries a stable code, so error handling is a switch and not string matching.
    if (e.code === DcdrWorkflowErrorCode.LIMIT_REACHED) {
      // eslint-disable-next-line no-console
      console.error(`[run] tenant limit reached: ${e.limit?.limitKey} ${e.limit?.current}/${e.limit?.max}`);
    } else if (e.code === DcdrWorkflowErrorCode.NOT_FOUND) {
      // eslint-disable-next-line no-console
      console.error(`[run] no workflow named ${workflowKey}, or this token may not see it.`);
    } else if (e.code === DcdrWorkflowErrorCode.UNAUTHORIZED) {
      // eslint-disable-next-line no-console
      console.error("[run] the token is missing, expired, revoked or lacks workflows:run.");
    } else {
      // eslint-disable-next-line no-console
      console.error(`[run] ${e.code} on ${e.method} ${e.path}: ${e.message}`);
    }
    process.exitCode = 1;
    return;
  }
  // eslint-disable-next-line no-console
  console.error(`[run] failed: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
