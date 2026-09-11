import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DcdrWorkflowClient,
  isDcdrWorkflowError,
  parseWorkflowDefinitionShorthand,
  validateWorkflowDefinition,
} from "@dcdr/contracts";
import type { WorkflowDefinition } from "@dcdr/contracts";

/**
 * CI gate: does this definition still compile against our tenant?
 *
 * Two validations, and both earn their place:
 *
 * - `validateWorkflowDefinition` runs **locally**, with no network and no tenant context. It catches
 *   everything structural - an unreachable state, a `$ref` to a state that cannot have run yet, a
 *   `CHOICE` with no `default` - which is most of what is ever wrong with a definition.
 * - `client.validateWorkflow` runs **server-side** and is the only one that can check what depends
 *   on the tenant: that the intents exist in their registry, that the connections are theirs, that
 *   the definition fits their caps.
 *
 * Running the local one first keeps the fast, free failures fast and free. Neither one saves
 * anything, which is why this is safe to run on every commit with a read-only token.
 *
 * Note what this example does **not** do: publish. Authoring is not part of the tenant API, because a
 * definition names intents, connections, allowed hosts and allowed shell commands - a token that
 * could write one would reach everything the tenant's connections reach.
 */

const baseUrl = (process.env.DCDR_CONTROL_URL ?? "https://dcdr.ai").trim();
const bearerToken = (process.env.DCDR_SERVICE_TOKEN ?? "").trim();
const definitionPath = (
  process.env.DCDR_WORKFLOW_DEFINITION ?? resolve(__dirname, "..", "workflow.support_ticket_triage.json")
).trim();

/**
 * Validates a definition file locally and then against the tenant.
 */
async function main(): Promise<void> {
  if (!bearerToken) throw new Error("Set DCDR_SERVICE_TOKEN to a token with workflows:read.");

  // The file is written in the author-facing shorthand (`$ref` / `$fn` / `$template`); the parser
  // turns it into the typed value nodes the rest of the contract works with.
  const raw = JSON.parse(readFileSync(definitionPath, "utf8")) as unknown;
  const definition: WorkflowDefinition = parseWorkflowDefinitionShorthand(raw);

  const local = validateWorkflowDefinition(definition);
  // eslint-disable-next-line no-console
  console.log(`[validate] local: ${local.valid ? "OK" : "FAILED"} (${local.stateCount} state(s), depth ${local.nestingDepth})`);
  if (!local.valid) {
    for (const issue of local.issues) {
      // eslint-disable-next-line no-console
      console.error(`  ${issue.path}: [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const workflows = new DcdrWorkflowClient({ baseUrl, bearerToken });
  const remote = await workflows.validateWorkflow(definition);
  // eslint-disable-next-line no-console
  console.log(`[validate] tenant: ${remote.valid ? "OK" : "FAILED"} against registry ${remote.registrySha256 ?? "-"}`);
  if (!remote.valid) {
    for (const issue of remote.issues) {
      // eslint-disable-next-line no-console
      console.error(`  ${issue.path}: [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[validate] ${definition.key} is publishable. Publishing itself happens in the DCDR web UI.`);
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(isDcdrWorkflowError(e) ? `[validate] ${e.code}: ${e.message}` : `[validate] failed: ${String(e)}`);
  process.exitCode = 1;
});
