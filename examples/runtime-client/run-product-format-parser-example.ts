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
 * Calls the local runtime with a typed product normalization request.
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(
    `[run] intent=PRODUCT_FORMAT_PARSER baseUrl=${baseUrl} timeoutMs=${timeoutMs}`,
  );

  const client = new DcdrRuntimeClient({
    baseUrl,
    apiToken,
    sessionBypassToken,
    timeoutMs,
  });

  const request: ExecuteIntentRequest = {
    vars: {
      rawTitle:
        "UltraLight Trail Backpack 28L - Water Resistant - Carbon Black",
      rawDescription:
        "Technical backpack for weekend hikes. Includes breathable back panel, hydration compartment, YKK zippers and reinforced shoulder straps. Dimensions approx 52 x 28 x 18 cm.",
      sourceMarketplace: "SHOPIFY",
      currency: "EUR",
      rawPrice: 89.95,
      unitsInStock: 480,
      attributes: {
        brandHint: "NordTrail",
        gtin: "8437012345678",
        isRefurbished: false,
      },
      rawBullets: [
        "Ripstop nylon",
        "Hydration-ready",
        "Laptop sleeve 15 inch",
        "Weight 0.92 kg",
      ],
    },
  };

  const response = await client.executeIntent("PRODUCT_FORMAT_PARSER", request);

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
    `[run] failed intent=PRODUCT_FORMAT_PARSER baseUrl=${baseUrl} error=${headerMessage}`,
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
