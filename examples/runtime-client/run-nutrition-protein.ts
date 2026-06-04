import { DcdrRuntimeClient } from "@dcdr/contracts";

const baseUrl = (process.env.DCDR_BASE_URL ?? "http://localhost:8000").trim();
const apiToken = (process.env.DCDR_API_TOKEN ?? "dev-token").trim();
const sessionBypassToken = (
  process.env.DCDR_SESSION_BYPASS_TOKEN ?? "dev-session-bypass"
).trim();

/**
 * Calls the local runtime with the official TypeScript client and prints the JSON response.
 */
async function main(): Promise<void> {
  const client = new DcdrRuntimeClient({
    baseUrl,
    apiToken,
    sessionBypassToken,
  });

  const res = await client.executeIntent("NUTRITION_PROTEIN_SUGGESTION", {
    vars: {
      age: 29,
      weightKg: 78,
      sex: "MALE",
      heightCm: 180,
      activityLevel: "MODERATE",
    },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => {
  const message = e instanceof Error ? e.message : String(e);
  // eslint-disable-next-line no-console
  console.error(message);
  process.exitCode = 1;
});
