/// <reference types="jest" />

/**
 * `DcdrKnowledgeClient` (3.20.0): deterministic, no network.
 *
 * Every case runs against an injected `fetch`. What is pinned is the **wire** agreed with the control
 * plane in the KN thread: the seven routes, path encoding, query parameters, the bearer, the error
 * vocabulary per status, and the stream contract - `final` is authoritative, a refusal is a `final`
 * (possibly after deltas, KN-4), never an `error` event.
 */
import { DcdrClient } from "../src/dcdr.client";
import { ExecutionStreamEventType } from "../src/execution.contract";
import {
  DCDR_KNOWLEDGE_DEFAULT_ANSWER_TIMEOUT_MS,
  DcdrKnowledgeClient,
  DcdrKnowledgeError,
  buildDcdrKnowledgeRoutes,
  isDcdrKnowledgeError,
} from "../src/knowledge.client";
import {
  DcdrKnowledgeAnswerRefusal,
  DcdrKnowledgeAnswerResponse,
  DcdrKnowledgeDocumentStatus,
  DcdrKnowledgeErrorCode,
  DcdrKnowledgePassage,
  DcdrKnowledgeSearchResponse,
} from "../src/knowledge.contract";

/** One recorded call to the injected `fetch`. */
interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  signal?: AbortSignal | null;
}

/** A canned response the fake `fetch` answers with. */
interface CannedResponse {
  status?: number;
  json?: unknown;
  text?: string;
  contentType?: string;
  /** SSE text, streamed in small chunks to exercise frame reassembly. */
  sse?: string;
}

const BASE = "https://control.example";
const TOKEN = "svc-token";

/**
 * Turns a string into a byte stream split into small chunks, so frames straddle chunk boundaries.
 *
 * @param text Stream content.
 * @param chunkSize Bytes per chunk.
 * @returns The stream.
 */
function chunkedStream(text: string, chunkSize = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

/**
 * Builds a `Response`-shaped object the client can read.
 *
 * @param canned What to answer.
 * @returns The response.
 */
function makeResponse(canned: CannedResponse): Response {
  const status = canned.status ?? 200;
  if (canned.sse !== undefined) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ "content-type": canned.contentType ?? "text/event-stream; charset=utf-8" }),
      body: chunkedStream(canned.sse),
      text: async () => canned.sse ?? "",
    } as unknown as Response;
  }
  const isJson = canned.json !== undefined;
  const body = isJson ? JSON.stringify(canned.json) : (canned.text ?? "");
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": canned.contentType ?? (isJson ? "application/json" : "text/plain; charset=utf-8") }),
    body: null,
    text: async () => body,
  } as unknown as Response;
}

/**
 * A client wired to canned responses, plus the calls it recorded.
 *
 * @param responses Answers, in order (the last one repeats).
 * @returns The client and its recorded calls.
 */
function makeClient(responses: CannedResponse[]): { client: DcdrKnowledgeClient; calls: RecordedCall[]; fetchFn: (input: string, init?: RequestInit) => Promise<Response> } {
  const calls: RecordedCall[] = [];
  let index = 0;
  const fetchFn = async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({
      url: input,
      method: String(init?.method ?? "GET"),
      headers: { ...((init?.headers as Record<string, string>) ?? {}) },
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      signal: init?.signal,
    });
    const canned = responses[Math.min(index, responses.length - 1)] ?? {};
    index += 1;
    return makeResponse(canned);
  };
  return { client: new DcdrKnowledgeClient({ baseUrl: `${BASE}/`, bearerToken: TOKEN, fetchFn }), calls, fetchFn };
}

/**
 * Formats SSE events as the control plane writes them.
 *
 * @param events Event name and payload pairs.
 * @returns SSE text.
 */
function sse(events: Array<[string, unknown]>): string {
  return `: connected\n\n${events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("")}`;
}

/**
 * Collects every event of a stream.
 *
 * @param stream The generator.
 * @returns The events, in order.
 */
async function collect<T>(stream: AsyncGenerator<T, void, void>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of stream) out.push(event);
  return out;
}

const PASSAGE: DcdrKnowledgePassage = {
  chunkId: "c-1",
  documentId: "d-1",
  documentTitle: "Harina T-55 product sheet",
  collectionId: "11111111-1111-4111-8111-111111111111",
  ordinal: 4,
  text: "Shelf life: 12 months in a dry place.",
  locator: { page: 2, section: ["Storage"], unitKey: "s-2" },
  score: 0.031,
  lexicalRank: 1,
  semanticRank: 3,
  context: { text: "Storage. Shelf life: 12 months in a dry place. Keep below 25 C.", fromOrdinal: 3, toOrdinal: 5, tokens: 22, hitOrdinals: [4] },
};

const ANSWER: DcdrKnowledgeAnswerResponse = {
  text: "Twelve months, kept dry [1].",
  refusal: null,
  citedChunkIds: ["c-1"],
  passages: [PASSAGE],
  retrieval: { arms: { lexical: true, semantic: true }, modeKey: "GENERAL", ms: 41, reused: false },
  modelMs: 900,
  report: null,
};

const REFUSAL: DcdrKnowledgeAnswerResponse = { ...ANSWER, text: "", refusal: DcdrKnowledgeAnswerRefusal.NO_CITATIONS, citedChunkIds: [] };

describe("DcdrKnowledgeClient", () => {
  describe("routes", () => {
    it("builds the seven agreed routes, encoding path parameters without re-casing them", () => {
      const routes = buildDcdrKnowledgeRoutes();
      expect(routes.collections()).toBe("/api/dcdr/knowledge/collections");
      expect(routes.collection(" Rice-Literature ")).toBe("/api/dcdr/knowledge/collections/Rice-Literature");
      expect(routes.collection("a/b c")).toBe("/api/dcdr/knowledge/collections/a%2Fb%20c");
      expect(routes.documents("product-sheets")).toBe("/api/dcdr/knowledge/collections/product-sheets/documents");
      expect(routes.document("product-sheets", "d/1")).toBe("/api/dcdr/knowledge/collections/product-sheets/documents/d%2F1");
      expect(routes.search()).toBe("/api/dcdr/knowledge/search");
      expect(routes.answer()).toBe("/api/dcdr/knowledge/answer");
      expect(routes.answerStream()).toBe("/api/dcdr/knowledge/answer/stream");
    });
  });

  describe("collections and documents", () => {
    it("lists collections with limit and cursor, sending the bearer", async () => {
      const page = { items: [{ id: "c", key: "product-sheets", name: "Product sheets", description: null, status: "READY", documentsCount: 3, tags: [], updatedAt: null }], nextCursor: "opaque==" };
      const { client, calls } = makeClient([{ json: page }]);

      const result = await client.listKnowledgeCollections({ limit: 20, cursor: "abc/+=" });

      expect(result).toEqual(page);
      expect(calls[0].method).toBe("GET");
      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/collections?limit=20&cursor=abc%2F%2B%3D`);
      expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(calls[0].body).toBeUndefined();
    });

    it("lists with no query string when none is given, and reads a last page without nextCursor", async () => {
      const { client, calls } = makeClient([{ json: { items: [] } }]);
      const result = await client.listKnowledgeCollections();
      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/collections`);
      expect(result.nextCursor).toBeUndefined();
    });

    it("gets one collection by key", async () => {
      const { client, calls } = makeClient([{ json: { id: "c", key: "product-sheets" } }]);
      await client.getKnowledgeCollection("product-sheets");
      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/collections/product-sheets`);
    });

    it("lists a collection's documents with status, limit and cursor", async () => {
      const { client, calls } = makeClient([{ json: { items: [] } }]);
      await client.listKnowledgeDocuments("rice literature", { status: DcdrKnowledgeDocumentStatus.READY, limit: 5, cursor: "x" });
      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/collections/rice%20literature/documents?status=READY&limit=5&cursor=x`);
    });

    it("gets one document's metadata", async () => {
      const { client, calls } = makeClient([{ json: { id: "d-1", title: "T" } }]);
      const doc = await client.getKnowledgeDocument("product-sheets", "d-1");
      expect(doc.id).toBe("d-1");
      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/collections/product-sheets/documents/d-1`);
    });

    it("refuses a blank key or document id before a request collapses into the listing route", async () => {
      const { client, calls } = makeClient([{ json: {} }]);
      await expect(client.getKnowledgeCollection("  ")).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.CONFIGURATION });
      await expect(client.listKnowledgeDocuments("")).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.CONFIGURATION });
      await expect(client.getKnowledgeDocument("product-sheets", "")).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.CONFIGURATION });
      expect(calls).toHaveLength(0);
    });
  });

  describe("search and answer", () => {
    it("posts a search body as given and returns passages with open locator fields intact", async () => {
      const response: DcdrKnowledgeSearchResponse = {
        passages: [PASSAGE],
        retrieval: { arms: { lexical: true, semantic: true }, candidates: { lexical: 8, semantic: 20 }, timings: { embeddingMs: 12, searchMs: 30, planMs: 2 }, modeKey: "GENERAL" },
      };
      const { client, calls } = makeClient([{ json: response }]);

      const result = await client.searchKnowledge({ collections: ["product-sheets"], query: "shelf life", topK: 5, contextWindow: 1 });

      expect(calls[0].method).toBe("POST");
      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/search`);
      expect(calls[0].body).toEqual({ collections: ["product-sheets"], query: "shelf life", topK: 5, contextWindow: 1 });
      expect(calls[0].headers["Content-Type"]).toBe("application/json");
      expect(result.passages[0].locator?.unitKey).toBe("s-2");
      expect(result.retrieval.candidates.semantic).toBe(20);
    });

    it("posts an answer request with chunkIds and returns the answer", async () => {
      const { client, calls } = makeClient([{ json: ANSWER }]);
      const answer = await client.answerFromKnowledge({ collections: ["product-sheets"], question: "How long does it keep?", locale: "es", chunkIds: ["c-1"] });
      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/answer`);
      expect(calls[0].body).toEqual({ collections: ["product-sheets"], question: "How long does it keep?", locale: "es", chunkIds: ["c-1"] });
      expect(answer.citedChunkIds).toEqual(["c-1"]);
    });

    it("returns a refusal as a result, never as a thrown error", async () => {
      const { client } = makeClient([{ json: { ...REFUSAL, refusal: DcdrKnowledgeAnswerRefusal.NO_PASSAGES, passages: [] } }]);
      const answer = await client.answerFromKnowledge({ collections: ["product-sheets"], question: "Who won the 1930 World Cup?" });
      expect(answer.refusal).toBe(DcdrKnowledgeAnswerRefusal.NO_PASSAGES);
      expect(answer.text).toBe("");
    });
  });

  describe("typed errors", () => {
    it.each([
      [404, { code: "NOT_FOUND", message: "Collection not found" }, DcdrKnowledgeErrorCode.NOT_FOUND],
      [400, { code: "VALIDATION", message: "query is required", details: { field: "query" } }, DcdrKnowledgeErrorCode.VALIDATION],
      [409, { code: "INVALID_STATE", message: "Index not ready" }, DcdrKnowledgeErrorCode.INVALID_STATE],
      [429, { code: "LIMIT_REACHED", message: "Weekly answers used" }, DcdrKnowledgeErrorCode.LIMIT_REACHED],
      [429, { message: "Too many requests" }, DcdrKnowledgeErrorCode.RATE_LIMITED],
      [409, { message: "conflict" }, DcdrKnowledgeErrorCode.CONFLICT],
      [401, { message: "invalid token" }, DcdrKnowledgeErrorCode.UNAUTHORIZED],
      [403, { message: "missing scope" }, DcdrKnowledgeErrorCode.FORBIDDEN],
      [400, { message: "bad" }, DcdrKnowledgeErrorCode.VALIDATION],
      [503, { message: "disabled" }, DcdrKnowledgeErrorCode.DISABLED],
      [500, { message: "boom" }, DcdrKnowledgeErrorCode.SERVER_ERROR],
      // The control plane's own codes for the four statuses KN-7 added.
      [401, { code: "UNAUTHORIZED", message: "no credential" }, DcdrKnowledgeErrorCode.UNAUTHORIZED],
      [403, { code: "FORBIDDEN", message: "knowledge:run missing" }, DcdrKnowledgeErrorCode.FORBIDDEN],
      [503, { code: "DISABLED", message: "assistant not configured" }, DcdrKnowledgeErrorCode.DISABLED],
      [500, { code: "INTERNAL", message: "Internal error" }, DcdrKnowledgeErrorCode.SERVER_ERROR],
    ])("maps HTTP %s %j to %s", async (status, body, code) => {
      const { client } = makeClient([{ status, json: body }]);
      const error = await client.searchKnowledge({ collections: ["k"], query: "q" }).catch((e: unknown) => e);
      expect(isDcdrKnowledgeError(error)).toBe(true);
      const typed = error as DcdrKnowledgeError;
      expect({ code: typed.code, status: typed.status, method: typed.method, path: typed.path }).toEqual({ code, status, method: "POST", path: "/api/dcdr/knowledge/search" });
      expect(typed.message).toContain(`status=${status}`);
      if ((body as { details?: unknown }).details) expect(typed.details).toEqual((body as { details?: unknown }).details);
    });

    it("maps a 500 with a non-JSON body to SERVER_ERROR with a preview", async () => {
      const { client } = makeClient([{ status: 502, text: "<html>bad gateway</html>" }]);
      const error = (await client.listKnowledgeCollections().catch((e: unknown) => e)) as DcdrKnowledgeError;
      expect(error.code).toBe(DcdrKnowledgeErrorCode.SERVER_ERROR);
      expect(error.bodyPreview).toContain("bad gateway");
    });

    it("refuses a 2xx that is not JSON", async () => {
      const { client } = makeClient([{ status: 200, text: "ok" }]);
      await expect(client.listKnowledgeCollections()).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE });
    });

    it("classifies a transport failure as NETWORK", async () => {
      const client = new DcdrKnowledgeClient({ bearerToken: TOKEN, fetchFn: async () => { throw new Error("ECONNREFUSED"); } });
      await expect(client.listKnowledgeCollections()).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.NETWORK });
    });

    it("classifies the timeout as TIMEOUT and a caller abort as CANCELLED", async () => {
      const hang = (_input: string, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
      const slow = new DcdrKnowledgeClient({ bearerToken: TOKEN, timeoutMs: 20, fetchFn: hang });
      await expect(slow.searchKnowledge({ collections: ["k"], query: "q" })).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.TIMEOUT });

      const controller = new AbortController();
      const pending = new DcdrKnowledgeClient({ bearerToken: TOKEN, fetchFn: hang }).searchKnowledge({ collections: ["k"], query: "q" }, { signal: controller.signal });
      controller.abort();
      await expect(pending).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.CANCELLED });
    });

    it("refuses construction without a token", () => {
      expect(() => new DcdrKnowledgeClient({ bearerToken: " " })).toThrow(DcdrKnowledgeError);
    });

    it("recognises an error by shape, as a second package copy would throw it", () => {
      expect(isDcdrKnowledgeError({ name: "DcdrKnowledgeError", code: "NOT_FOUND" })).toBe(true);
      expect(isDcdrKnowledgeError({ name: "DcdrKnowledgeError", code: "NOPE" })).toBe(false);
      expect(isDcdrKnowledgeError(new Error("x"))).toBe(false);
    });
  });

  describe("answerFromKnowledgeStream", () => {
    const request = { collections: ["product-sheets"], question: "How long does it keep?" };

    it("yields meta, deltas and a final carrying the full answer", async () => {
      const { client, calls } = makeClient([
        {
          sse: sse([
            ["meta", { gatewayRequestId: "g-1", intent: "KNOWLEDGE_ANSWER", startedAt: "2026-10-21T10:00:00Z" }],
            ["delta", { text: "Twelve ", attempt: 1 }],
            ["delta", { text: "months, kept dry [1].", attempt: 1 }],
            ["final", { response: ANSWER }],
          ]),
        },
      ]);

      const events = await collect(client.answerFromKnowledgeStream(request));

      expect(calls[0].url).toBe(`${BASE}/api/dcdr/knowledge/answer/stream`);
      expect(calls[0].headers.Accept).toBe("text/event-stream");
      expect(calls[0].body).toEqual(request);
      expect(events.map((event) => event.type)).toEqual(["meta", "delta", "delta", "final"]);
      const deltas = events.filter((event) => event.type === ExecutionStreamEventType.DELTA).map((event) => (event.data as { text: string }).text).join("");
      expect(deltas).toBe("Twelve months, kept dry [1].");
      const final = events[3];
      expect(final.type === ExecutionStreamEventType.FINAL && final.data.response).toEqual(ANSWER);
    });

    it("delivers a refusal decided before the model as a final with no deltas", async () => {
      const noPassages = { ...REFUSAL, refusal: DcdrKnowledgeAnswerRefusal.NO_PASSAGES, passages: [], modelMs: 0 };
      const { client } = makeClient([{ sse: sse([["meta", { gatewayRequestId: "g", intent: "KNOWLEDGE_ANSWER", startedAt: "t" }], ["final", { response: noPassages }]]) }]);

      const events = await collect(client.answerFromKnowledgeStream(request));

      expect(events.map((event) => event.type)).toEqual(["meta", "final"]);
      const final = events[1];
      expect(final.type === ExecutionStreamEventType.FINAL && final.data.response.refusal).toBe(DcdrKnowledgeAnswerRefusal.NO_PASSAGES);
    });

    it("delivers a refusal decided after text streamed as a final that overrides the deltas (KN-4)", async () => {
      // NO_CITATIONS is decided once the model has written: deltas were painted, then `final` withdraws
      // them. A consumer that follows the contract shows nothing of the painted text.
      const { client } = makeClient([
        {
          sse: sse([
            ["meta", { gatewayRequestId: "g", intent: "KNOWLEDGE_ANSWER", startedAt: "t" }],
            ["delta", { text: "It keeps for ", attempt: 1 }],
            ["delta", { text: "a very long time.", attempt: 1 }],
            ["final", { response: REFUSAL }],
          ]),
        },
      ]);

      let painted = "";
      let shown: string | null = null;
      for await (const event of client.answerFromKnowledgeStream(request)) {
        if (event.type === ExecutionStreamEventType.DELTA) painted += event.data.text;
        if (event.type === ExecutionStreamEventType.FINAL) {
          const answer = event.data.response;
          shown = answer.refusal ? "" : answer.text;
          expect(answer.refusal).toBe(DcdrKnowledgeAnswerRefusal.NO_CITATIONS);
          expect(answer.text).toBe("");
        }
      }
      expect(painted).toBe("It keeps for a very long time.");
      expect(shown).toBe("");
    });

    it("yields an error event and stops there", async () => {
      const { client } = makeClient([
        {
          sse: sse([
            ["meta", { gatewayRequestId: "g", intent: "KNOWLEDGE_ANSWER", startedAt: "t" }],
            ["error", { error: { code: "INTERNAL_ERROR", message: "embedder unreachable" } }],
            ["final", { response: ANSWER }],
          ]),
        },
      ]);
      const events = await collect(client.answerFromKnowledgeStream(request));
      expect(events.map((event) => event.type)).toEqual(["meta", "error"]);
      const error = events[1];
      expect(error.type === ExecutionStreamEventType.ERROR && error.data.error.message).toBe("embedder unreachable");
    });

    it("accepts CRLF framing and skips unknown events", async () => {
      const text = `event: meta\r\ndata: {"gatewayRequestId":"g","intent":"KNOWLEDGE_ANSWER","startedAt":"t"}\r\n\r\nevent: progress\r\ndata: {}\r\n\r\nevent: final\r\ndata: ${JSON.stringify({ response: ANSWER })}\r\n\r\n`;
      const { client } = makeClient([{ sse: text }]);
      const events = await collect(client.answerFromKnowledgeStream(request));
      expect(events.map((event) => event.type)).toEqual(["meta", "final"]);
    });

    it("throws a typed error for a failure before the stream starts", async () => {
      const { client } = makeClient([{ status: 429, json: { code: "LIMIT_REACHED", message: "Weekly answers used" } }]);
      await expect(collect(client.answerFromKnowledgeStream(request))).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.LIMIT_REACHED, status: 429 });
    });

    it("throws when the server answers something other than an event stream", async () => {
      const { client } = makeClient([{ status: 200, json: ANSWER }]);
      await expect(collect(client.answerFromKnowledgeStream(request))).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE });
    });

    it("throws when the stream ends without final or error", async () => {
      const { client } = makeClient([{ sse: sse([["meta", { gatewayRequestId: "g", intent: "KNOWLEDGE_ANSWER", startedAt: "t" }], ["delta", { text: "half" }]]) }]);
      await expect(collect(client.answerFromKnowledgeStream(request))).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE });
    });

    it("throws on an event whose data is not JSON", async () => {
      const { client } = makeClient([{ sse: "event: delta\ndata: {not json\n\n" }]);
      await expect(collect(client.answerFromKnowledgeStream(request))).rejects.toMatchObject({ code: DcdrKnowledgeErrorCode.UNEXPECTED_RESPONSE });
    });
  });

  describe("DcdrClient composition", () => {
    it("routes every knowledge method to the control plane with the shared token", async () => {
      const { fetchFn, calls } = makeClient([{ json: { items: [] } }]);
      const dcdrClient = new DcdrClient({ bearerToken: TOKEN, controlUrl: BASE, runtimeUrl: "https://runtime.example", fetchFn });

      await dcdrClient.listKnowledgeCollections({ limit: 1 });
      await dcdrClient.getKnowledgeCollection("product-sheets");
      await dcdrClient.listKnowledgeDocuments("product-sheets");
      await dcdrClient.getKnowledgeDocument("product-sheets", "d-1");
      await dcdrClient.searchKnowledge({ collections: ["product-sheets"], query: "q" });
      await dcdrClient.answerFromKnowledge({ collections: ["product-sheets"], question: "q" });

      expect(calls.map((call) => `${call.method} ${call.url.replace(BASE, "")}`)).toEqual([
        "GET /api/dcdr/knowledge/collections?limit=1",
        "GET /api/dcdr/knowledge/collections/product-sheets",
        "GET /api/dcdr/knowledge/collections/product-sheets/documents",
        "GET /api/dcdr/knowledge/collections/product-sheets/documents/d-1",
        "POST /api/dcdr/knowledge/search",
        "POST /api/dcdr/knowledge/answer",
      ]);
      expect(calls.every((call) => call.headers.Authorization === `Bearer ${TOKEN}`)).toBe(true);
      expect(dcdrClient.knowledge).toBeInstanceOf(DcdrKnowledgeClient);
    });

    it("streams through the composite client", async () => {
      const { fetchFn } = makeClient([{ sse: sse([["final", { response: ANSWER }]]) }]);
      const dcdrClient = new DcdrClient({ bearerToken: TOKEN, controlUrl: BASE, fetchFn });
      const events = await collect(dcdrClient.answerFromKnowledgeStream({ collections: ["product-sheets"], question: "q" }));
      expect(events.map((event) => event.type)).toEqual(["final"]);
    });

    it("fails with CONFIGURATION, lazily, when no token is configured", () => {
      const dcdrClient = new DcdrClient({});
      expect(() => dcdrClient.knowledge).toThrow(expect.objectContaining({ code: DcdrKnowledgeErrorCode.CONFIGURATION }));
    });

    it("gives answers a longer default timeout than listing", () => {
      expect(DCDR_KNOWLEDGE_DEFAULT_ANSWER_TIMEOUT_MS).toBeGreaterThan(15_000);
    });
  });
});
