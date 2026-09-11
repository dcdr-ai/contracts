import { DcdrWorkflowClient, isDcdrWorkflowError } from "@dcdr/contracts";

/**
 * Discovery: what may this token run, and what does each one take?
 *
 * The first thing an integration should do, and the answer to two questions people usually find out
 * the hard way: whether a workflow is callable from outside at all (`runnable` — the tenant has to
 * give it an active HTTP trigger), and what its input has to look like (`inputSchema`).
 */

const baseUrl = (process.env.DCDR_CONTROL_URL ?? "https://dcdr.ai").trim();
const bearerToken = (process.env.DCDR_SERVICE_TOKEN ?? "").trim();

/**
 * Prints the catalogue and the run contract of each runnable workflow.
 */
async function main(): Promise<void> {
  if (!bearerToken) throw new Error("Set DCDR_SERVICE_TOKEN to a token with workflows:read.");

  const workflows = new DcdrWorkflowClient({ baseUrl, bearerToken });
  const page = await workflows.listWorkflows({ limit: 100 });

  // eslint-disable-next-line no-console
  console.log(`[catalogue] ${page.items.length} workflow(s)`);
  for (const workflow of page.items) {
    const state = !workflow.active ? "inactive" : workflow.runnable ? "runnable" : "no HTTP trigger";
    // eslint-disable-next-line no-console
    console.log(`  ${workflow.key.padEnd(24)} v${workflow.version ?? "-"}  (${state})  ${workflow.name}`);
  }

  for (const workflow of page.items.filter((item) => item.runnable)) {
    const detail = await workflows.getWorkflow(workflow.key);
    // eslint-disable-next-line no-console
    console.log(`\n[${detail.key}] published ${detail.publishedAt ?? "-"} sha256=${detail.sha256 ?? "-"}`);
    // eslint-disable-next-line no-console
    console.log(`  input : ${describeSchema(detail.inputSchema)}`);
    // eslint-disable-next-line no-console
    console.log(`  output: ${describeSchema(detail.outputSchema)}`);
  }
}

/**
 * Renders a prompt-variable schema as one readable line.
 *
 * @param schema Schema, or `null` when the definition declares none.
 * @returns A `name: type` list, or a dash.
 */
function describeSchema(schema: Record<string, { type?: string; required?: boolean }> | null): string {
  if (!schema || !Object.keys(schema).length) return "-";
  return Object.entries(schema)
    .map(([name, variable]) => `${name}${variable.required ? "" : "?"}: ${variable.type ?? "?"}`)
    .join(", ");
}

main().catch((e: unknown) => {
  // eslint-disable-next-line no-console
  console.error(isDcdrWorkflowError(e) ? `[catalogue] ${e.code}: ${e.message}` : `[catalogue] failed: ${String(e)}`);
  process.exitCode = 1;
});
