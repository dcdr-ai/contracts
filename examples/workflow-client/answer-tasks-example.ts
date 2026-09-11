import { DcdrWorkflowClient, WorkflowWaitOutcome, isDcdrWorkflowError } from "@dcdr/contracts";

/**
 * Human-in-the-loop: read the parked work, answer one, follow the run, then read its evidence.
 *
 * A run parks in three situations and the answer is shaped differently in each:
 *
 * - An **approval gate**: the answer is `{ approved, comment? }`. A rejection is not an error; it
 *   fails the gated state so that state's own `onError` policy decides what happens next.
 * - A **`HUMAN_TASK`** wait: the answer is whatever that state's own `form` declares, and the server
 *   validates the payload against it before the run is re-queued.
 * - An **`EXTERNAL_EVENT`** wait: the payload must carry the awaited `eventKey`.
 *
 * `task.approval` tells the first from the second, which is why the inbox carries it.
 */

const baseUrl = (process.env.DCDR_CONTROL_URL ?? "https://dcdr.ai").trim();
const bearerToken = (process.env.DCDR_SERVICE_TOKEN ?? "").trim();
const groupKey = (process.env.DCDR_GROUP_KEY ?? "").trim() || undefined;
const approve = String(process.env.DCDR_APPROVE ?? "true").trim() !== "false";

/**
 * Lists the parked work and answers the first approval gate it finds.
 */
async function main(): Promise<void> {
  if (!bearerToken) throw new Error("Set DCDR_SERVICE_TOKEN to a token with workflows:read and workflows:run.");

  const workflows = new DcdrWorkflowClient({ baseUrl, bearerToken });
  const tasks = await workflows.listWorkflowTasks({ groupKey, limit: 50 });

  // Only runs waiting on a *person* are listed. One sitting on a delay resumes by itself, and
  // putting it in a queue is how a queue stops being read.
  // eslint-disable-next-line no-console
  console.log(`[tasks] ${tasks.items.length} waiting on a person`);
  for (const task of tasks.items) {
    const flag = task.overdue ? "OVERDUE" : "waiting";
    // eslint-disable-next-line no-console
    console.log(
      `  ${task.approval ? "approval" : "task    "} ${task.workflow}/${task.stateId ?? "?"} run=${task.runId} (${flag} since ${task.since ?? "?"})`,
    );
  }

  const gate = tasks.items.find((task) => task.approval);
  if (!gate) {
    // eslint-disable-next-line no-console
    console.log("[tasks] no approval gate to answer.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[tasks] answering ${gate.runId} with approved=${approve}: ${gate.instructions ?? "(no instructions)"}`);
  await workflows.resumeWorkflowRun(gate.runId, {
    approved: approve,
    comment: approve ? "Looks right." : "Numbers do not match the invoice.",
  });

  // The run is re-queued: follow it to whatever it does next.
  const result = await workflows.waitForWorkflowRun(gate.runId, { timeoutMs: 120_000 });
  // eslint-disable-next-line no-console
  console.log(`[tasks] run ${result.runId} is now ${result.status} (${result.outcome})`);
  if (result.outcome === WorkflowWaitOutcome.FINISHED && result.succeeded) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result.output, null, 2));
  }

  // The evidence trail is what makes the decision auditable afterwards, and every item says how far
  // it can be trusted rather than only what was recorded.
  const evidence = await workflows.listWorkflowRunEvidence(gate.runId);
  // eslint-disable-next-line no-console
  console.log(`[tasks] ${evidence.items.length} evidence item(s):`);
  for (const item of evidence.items) {
    // eslint-disable-next-line no-console
    console.log(`  [${item.assurance}] ${item.kind} ${item.ref} (state ${item.stateId}, step ${item.sequence})`);
  }
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(isDcdrWorkflowError(e) ? `[tasks] ${e.code} on ${e.method} ${e.path}: ${e.message}` : `[tasks] failed: ${String(e)}`);
  process.exitCode = 1;
});
