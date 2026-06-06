import { DcdrRuntimeClient, ExecuteIntentRequest } from "@dcdr/contracts";

const baseUrl = (process.env.DCDR_BASE_URL ?? "http://localhost:8000").trim();
const apiToken = (process.env.DCDR_API_TOKEN ?? "dev-token").trim();
const sessionBypassToken = (
  process.env.DCDR_SESSION_BYPASS_TOKEN ?? "dev-session-bypass"
).trim();
const timeoutMsRaw = Number(process.env.DCDR_TIMEOUT_MS ?? "60000");
const timeoutMs =
  Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 60000;

/**
 * Calls the local runtime with a typed supplier risk assessment request.
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `[run] intent=SUPPLIER_RISK_ASSESSMENT baseUrl=${baseUrl} timeoutMs=${timeoutMs}`,
  );

  const client = new DcdrRuntimeClient({
    baseUrl,
    apiToken,
    sessionBypassToken,
    timeoutMs,
  });

  const request: ExecuteIntentRequest = {
    vars: {
      supplierId: "SUP-4471",
      supplierName: "Iberia Precision Components S.A.",
      country: "ES",
      segment: "MANUFACTURING",
      annualSpendEur: 3250000,
      criticality: "HIGH",
      financials: {
        revenueM: 128.4,
        ebitdaMargin: 0.14,
        debtRatio: 1.8,
        lateFilingCount: 1,
      },
      deliveryMetrics: {
        onTimeRate: 0.89,
        defectRate: 0.024,
        avgLeadTimeDays: 23.5,
      },
      complianceFlags: ["MISSING_ISO27001", "NO_MAJOR_FLAG"],
      recentIncidents: [
        {
          incidentType: "DELIVERY",
          daysAgo: 37,
          impactEur: 42000,
        },
        {
          incidentType: "QUALITY",
          daysAgo: 93,
          impactEur: 18000,
        },
      ],
    },
  };

  const response = await client.executeIntent(
    "SUPPLIER_RISK_ASSESSMENT",
    request,
  );

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(response, null, 2));
}

main().catch((e) => {
  interface RuntimeErrorBody {
    error?: {
      code?: string;
      message?: string;
    };
  }

  const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const bodyMarker = " body=";
  const bodyIndex = message.indexOf(bodyMarker);
  const headerMessage = bodyIndex >= 0 ? message.slice(0, bodyIndex) : message;
  const rawBody =
    bodyIndex >= 0 ? message.slice(bodyIndex + bodyMarker.length) : "";

  let parsedBody: RuntimeErrorBody | null = null;
  if (rawBody && (rawBody.startsWith("{") || rawBody.startsWith("["))) {
    try {
      parsedBody = JSON.parse(rawBody) as RuntimeErrorBody;
    } catch {
      parsedBody = null;
    }
  }

  // eslint-disable-next-line no-console
  console.error(
    `[run] failed intent=SUPPLIER_RISK_ASSESSMENT baseUrl=${baseUrl} error=${headerMessage}`,
  );
  if (parsedBody) {
    // eslint-disable-next-line no-console
    console.error("[run] response body:");
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(parsedBody, null, 2));
  } else if (rawBody) {
    // eslint-disable-next-line no-console
    console.error(`[run] response body=${rawBody}`);
  }

  if (message.toLowerCase().includes("fetch failed")) {
    // eslint-disable-next-line no-console
    console.error(
      "[run] tip: ensure Docker/runtime is up and listening on DCDR_BASE_URL (default http://localhost:8000)",
    );
  }
  if (parsedBody?.error?.code === "NO_ACTIVE_MODEL") {
    // eslint-disable-next-line no-console
    console.error(
      "[run] tip: this intent is not present in the loaded registry. Set runtime-selfhosted/.env DCDR_REGISTRY_FILE to the matching registry and restart docker compose.",
    );
  }
  process.exitCode = 1;
});
