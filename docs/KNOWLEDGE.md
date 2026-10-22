# Knowledge for client apps (`DcdrKnowledgeClient`)

> Status: contracts 3.20.0. Knowledge is a DCDR Cloud / Cloud Pro capability.

Your application can search the knowledge collections you configured in the DCDR web UI and get
answers grounded in them, from the same `DcdrClient` it already uses for intents and workflows.

The API is **read-only**. You create collections, upload documents and rebuild indexes in the UI.
From code you can:

- list and read collections and documents,
- search for passages,
- ask for an answer that cites those passages, either in one response or streamed.

---

## Start here

```ts
import { DcdrClient } from "@dcdr/contracts";

const dcdrClient = new DcdrClient({ bearerToken: process.env.DCDR_SERVICE_TOKEN });

const answer = await dcdrClient.answerFromKnowledge({ collections: ["product-sheets"], question });

if (answer.refusal) {
  showNoAnswer(answer.refusal);            // a result, not an error: see "Refusals" below
} else {
  const cited = answer.passages.filter((p) => answer.citedChunkIds.includes(p.chunkId));
  showAnswer(answer.text, cited);
}
```

Knowledge is served by the **control plane** (`https://dcdr.ai`, `controlUrl` on `DcdrClient`), not by
the runtime gateway. It needs a managed **service token**, like the workflow API.

---

## Scopes: an action AND a collection

Each call needs **two** things on the token:

| Action scope | Lets the token |
| --- | --- |
| `knowledge:read` | list and read collections and documents |
| `knowledge:run` | search and answer. Kept separate from read because it costs something: every call embeds the query and an answer also runs a model. Answers count against the tenant's weekly assistant quota (a `NO_PASSAGES` refusal gives the question back, because no model ran) |
| `knowledge:write` | *reserved*: no endpoint uses it yet. Collections are managed in the UI |

| Collection grant | Covers |
| --- | --- |
| `knowledge:collections:*` | every collection of the tenant, including ones created later |
| `knowledge:collection:<key>` | one collection, named by its key (for example `knowledge:collection:product-sheets`) |

**Access needs the action scope and a grant for that collection.** An action scope with no grant
shows no collections. A grant with no action scope allows nothing. `*` allows everything.

- If a collection is outside the grant, it is missing from listings, and reading or searching it
  directly returns `404`, the same as a collection that does not exist.
- Grants use the collection **key**, which never changes once set. A grant written today keeps
  pointing at the same collection.

The rule is published as code, so you do not have to write it yourself:

```ts
import { hasDcdrKnowledgeAccess, grantedDcdrKnowledgeCollections, knowledgeCollectionScope } from "@dcdr/contracts";

knowledgeCollectionScope("product-sheets");                         // "knowledge:collection:product-sheets"
hasDcdrKnowledgeAccess(token.scopes, "run", "product-sheets");      // true only if action AND grant are present
grantedDcdrKnowledgeCollections(token.scopes);                      // "ALL" or ["product-sheets", ...]
```

Scopes are matched exactly, never by prefix. `knowledge:collection:*` is **not** a wildcard. The
wildcard is `knowledge:collections:*`, with an `s`.

---

## Collections and documents

```ts
// Collections the token is granted. Pages are { items, nextCursor }.
let page = await dcdrClient.listKnowledgeCollections({ limit: 50 });
while (page.nextCursor) {
  page = await dcdrClient.listKnowledgeCollections({ limit: 50, cursor: page.nextCursor });
}

// One collection, by key (recommended) or id. A UUID is treated as an id; anything else as a key.
const collection = await dcdrClient.getKnowledgeCollection("product-sheets");
console.log(collection.status, collection.documentsCount, collection.searchModes);

// Its documents: metadata only.
const docs = await dcdrClient.listKnowledgeDocuments("product-sheets", { status: DcdrKnowledgeDocumentStatus.READY, limit: 20 });
const doc = await dcdrClient.getKnowledgeDocument("product-sheets", docs.items[0].id);
console.log(doc.title, doc.pageCount, doc.status);
```

- `nextCursor` is opaque. Pass it back exactly as you received it. It is **absent on the last page**.
- A document's metadata covers title, source type, pages, status and dates. The API never returns
  the document's content or a link to the original file. Content is only available as passages,
  through search.

---

## Search

```ts
const { passages, retrieval } = await dcdrClient.searchKnowledge({
  collections: ["product-sheets", "safety-sheets"],   // 1 to 10, by key or id
  query: "shelf life of T-55 flour",
  topK: 8,                                             // optional; defaults to the search mode's own
  modeKey: "EXACT_LOOKUP",                             // optional; defaults to the collection's mode
  contextWindow: 1,                                    // optional, 0-3: neighbouring chunks added to each hit
});

for (const p of passages) {
  console.log(p.documentTitle, p.locator?.page, p.score, p.text);
}
if (!retrieval.arms.semantic) warn("Results come from keyword search only");
```

Each passage (`DcdrKnowledgePassage`) includes everything you need to cite it: `chunkId`,
`documentId`, `documentTitle`, `collectionId`, `ordinal`, `text`, `locator` (`page`, `section`
trail, character offsets), `score`, the rank in each search method (`lexicalRank` for keyword search,
`semanticRank` for meaning-based search) and an optional `context`, which is the passage with its
neighbouring chunks.

- **Cite `text`, not `context.text`.** `text` is the chunk that matched. `context` is surrounding
  material to help build a prompt. Two hits can share one `context`, so remove duplicates by
  `fromOrdinal`.
- `score` can only be compared with other scores in the same result.
- `locator` and `context` can gain new optional fields in later control-plane versions. Read the
  fields you know and ignore the rest.
- An empty `passages` list is a normal result, not an error.

---

## Answer

```ts
const answer = await dcdrClient.answerFromKnowledge({
  collections: ["product-sheets"],
  question: "¿Cuánto dura la harina T-55 una vez abierta?",
  locale: "es",          // optional; only used when the question is too short to detect its language
});

answer.text;             // the answer, or "" when refused
answer.citedChunkIds;    // the passages it cites, in the order it cites them
answer.passages;         // every passage retrieved, cited or not
answer.report;           // the model call's execution report (provider, model, tokens, cache, request id); null if no model ran
```

The answer is written **from the passages and nothing else**, and its citations are checked against
the passages the model was given.

**Answer over the passages your user already saw.** If your app shows search results first, pass
their ids so the answer cannot cite anything the user has not seen:

```ts
const { passages } = await dcdrClient.searchKnowledge({ collections: ["product-sheets"], query: question });
renderPassages(passages);
const answer = await dcdrClient.answerFromKnowledge({
  collections: ["product-sheets"],
  question,
  chunkIds: passages.map((p) => p.chunkId),   // nothing is searched again
});
```

Without `chunkIds`, the answer runs its own search. Two searches for the same question can return
different passages.

### Refusals are results, not errors

When no grounded answer can be written, the response comes back with HTTP `200`, `text: ""` and
`refusal` set to one of `DcdrKnowledgeAnswerRefusal`:

| Refusal | Meaning | What to show |
| --- | --- | --- |
| `NO_PASSAGES` | the search found nothing. The model is not called (`report` is `null`) | "Nothing in these documents matches." |
| `NOT_IN_CORPUS` | the model judged that the passages do not answer the question | "The documents don't cover this." |
| `NO_CITATIONS` | the model wrote an answer without citing any passage, so it is withheld | treat as "no answer" |
| `MODEL_FAILED` | the model failed, timed out or returned something unusable | "Try again later." |
| `ANSWER_TOO_LONG` | the answer was cut off before it finished | suggest asking for less detail |

Do not show a refused answer's text. There is none, and that is on purpose.

---

## Streaming an answer

`answerFromKnowledgeStream` sends events using the same `meta` / `delta` / `final` / `error` format
as `executeIntentStream`. The `final` event carries the full `DcdrKnowledgeAnswerResponse`.

> **`final` is authoritative.** A refusal can arrive **after** text has already streamed. Only
> `NO_PASSAGES` is decided before the model runs. `NOT_IN_CORPUS`, `NO_CITATIONS`,
> `ANSWER_TOO_LONG` and `MODEL_FAILED` are decided after the model has written. When
> `final.data.response.refusal` is not `null`, `text` is `""` and you **must discard everything the
> deltas displayed**. If your code appends deltas and ignores `final`, it will show an answer the
> platform refused.

```ts
import { ExecutionStreamEventType } from "@dcdr/contracts";

let shown = "";
for await (const event of dcdrClient.answerFromKnowledgeStream({ collections: ["product-sheets"], question })) {
  switch (event.type) {
    case ExecutionStreamEventType.DELTA:
      shown += event.data.text;                 // display only
      render(shown);
      break;
    case ExecutionStreamEventType.FINAL: {
      const answer = event.data.response;       // the answer, or the refusal
      if (answer.refusal) {
        render("");                             // clear the streamed text
        showNoAnswer(answer.refusal);
      } else {
        render(answer.text, answer.citedChunkIds);
      }
      break;
    }
    case ExecutionStreamEventType.ERROR:
      showError(event.data.error.message);      // a real failure, never a refusal
      break;
  }
}
```

- A refusal is always a `final` event, never an `error` event. `error` means no answer could be
  produced at all: a credential, grant, limit, index-not-ready or internal failure after the stream
  started.
- A failure **before** the stream starts (`401`, `404`, `409`, `429`, …) is thrown as a
  `DcdrKnowledgeError`, the same way the other methods report errors.
- The answer timeout (120 s by default, `answerTimeoutMs`) covers the **whole** stream.

---

## Errors

Every method throws a `DcdrKnowledgeError` (check with `isDcdrKnowledgeError`). It has `code`,
`status`, `method`, `path`, `details` and `bodyPreview`. The server's error body is
`{ code, message, details }`.

| Status | `code` | When |
| --- | --- | --- |
| `400` | `VALIDATION` | the request is invalid (empty query, more than 10 collections, …); `details` lists the problems |
| `401` | `UNAUTHORIZED` | no token, or an invalid one |
| `403` | `FORBIDDEN` | the token lacks the action scope |
| `404` | `NOT_FOUND` | the collection or document does not exist **or is not granted**. The two cases look the same on purpose |
| `409` | `INVALID_STATE` | the collection has no embedded chunk yet. A collection that is still `INDEXING` answers over what is already indexed |
| `429` | `LIMIT_REACHED` | a knowledge limit of your plan was reached (for answers, the weekly assistant quota) |
| `429` | `RATE_LIMITED` | a rate limiter refused the call (no `LIMIT_REACHED` code) |
| `503` | `DISABLED` | the knowledge assistant is not configured on the platform |
| `500` | `SERVER_ERROR` | the server failed; the control plane's `INTERNAL` code (generic body) is reported as `SERVER_ERROR` |
| none | `TIMEOUT`, `CANCELLED`, `NETWORK`, `UNEXPECTED_RESPONSE`, `CONFIGURATION` | the client-side failure |

```ts
try {
  await dcdrClient.searchKnowledge({ collections: ["product-sheets"], query });
} catch (e) {
  if (isDcdrKnowledgeError(e) && e.code === DcdrKnowledgeErrorCode.LIMIT_REACHED) showUpgrade();
  else throw e;
}
```

### Limits and quota

- **Service-token limit rules do not apply to knowledge calls** (v1). Those rules are enforced by the
  runtime on `/api/execution` and `/v1`, and knowledge calls go to the control plane instead. What bounds
  them is the tenant's weekly assistant quota (answers) and the API rate limiters (`429 RATE_LIMITED`).
- A `NO_PASSAGES` refusal does not use quota; the other four refusals do, because the model ran.
- `report` on an answer is the model call's execution report **without** `request` (the prompt variables
  are not replayed: the passages are already in the response), and it has no cost field.

---

## From a workflow: `knowledge.search`

Workflows run the same search through the `knowledge.search` capability (version `1.0.0`,
`PLATFORM`). It uses the same route, so it is governed by the same scopes and usage counters.

| Input | Type | |
| --- | --- | --- |
| `collections` | string[] | collection keys, 1 to 10, **required** |
| `query` | string | **required** |
| `topK` | integer ≥ 1 | optional |
| `modeKey` | string | optional |

Output: `{ passages }`, the same `DcdrKnowledgePassage` fields as above. The capability returns
passages only. To write the answer, add an `INTENT` state with your own prompt and output schema:

```jsonc
{
  "startAt": "search",
  "states": {
    "search": {
      "type": "TOOL",
      "tool": {
        "capability": "knowledge.search",
        "args": {
          "collections": ["product-sheets"],
          "query": { "$ref": "input.question" },
          "topK": 6
        }
      },
      "next": "answer"
    },
    "answer": {
      "type": "INTENT",
      "intent": {
        "intent": "PRODUCT_SHEET_ANSWER",
        "vars": {
          "question": { "$ref": "input.question" },
          "passages": { "$ref": "states.search.output.passages" }
        }
      },
      "next": "done"
    },
    "done": { "type": "END", "end": { "outcome": "SUCCEED", "output": { "$ref": "states.answer.output" } } }
  }
}
```

- The state names collections by **key**. When the workflow is saved, the control plane checks
  that its author may use them. At run time it checks that the collections still belong to the
  tenant, then gives the runner a short-lived session limited to `knowledge:run` and those
  collections. You configure no token.
- The runner sends the search to its own control plane, the one it already polls for runs, and
  never to an address taken from the run. The session therefore stays inside your deployment, and
  you configure no endpoint either.
- An empty `passages` list is a successful step. Let your intent (or a `CHOICE` state) decide what
  "nothing found" means.
- A `404`, `409` or `429` from the search fails the state, and the state's error message includes
  the control plane's code (`NOT_FOUND`, `INVALID_STATE`, `LIMIT_REACHED`). Handle it with `onError`
  like any other failure.
- Platform workflows (those not owned by a tenant) cannot use knowledge in this version.

---

## Reference

| Method | Route | Scope |
| --- | --- | --- |
| `listKnowledgeCollections({ limit?, cursor? })` | `GET /api/dcdr/knowledge/collections` | `knowledge:read` |
| `getKnowledgeCollection(idOrKey)` | `GET /api/dcdr/knowledge/collections/:idOrKey` | `knowledge:read` |
| `listKnowledgeDocuments(idOrKey, { status?, limit?, cursor? })` | `GET /api/dcdr/knowledge/collections/:idOrKey/documents` | `knowledge:read` |
| `getKnowledgeDocument(idOrKey, documentId)` | `GET /api/dcdr/knowledge/collections/:idOrKey/documents/:documentId` | `knowledge:read` |
| `searchKnowledge(request, { timeoutMs?, signal? })` | `POST /api/dcdr/knowledge/search` | `knowledge:run` |
| `answerFromKnowledge(request, { timeoutMs?, signal? })` | `POST /api/dcdr/knowledge/answer` | `knowledge:run` |
| `answerFromKnowledgeStream(request, { timeoutMs?, signal? })` | `POST /api/dcdr/knowledge/answer/stream` (SSE) | `knowledge:run` |

Each scope also needs a collection grant. Path parameters are URL-encoded and kept exactly as you
wrote them: keys are case-sensitive and may contain hyphens.

You can use the client on its own when you do not need `DcdrClient`:

```ts
import { DcdrKnowledgeClient } from "@dcdr/contracts";

const knowledge = new DcdrKnowledgeClient({
  baseUrl: "https://dcdr.ai",                  // control plane, not the runtime
  bearerToken: process.env.DCDR_SERVICE_TOKEN,
  timeoutMs: 15_000,                           // list, read, search
  answerTimeoutMs: 120_000,                    // answer, and the whole stream
});
```

Through `DcdrClient`, override the knowledge client's settings under `knowledge: { … }` (for example
a different token or timeouts). It uses `controlUrl` like the workflow client.

---

## From the CLI

The `kn-*` commands of the runtime repository's CLI call the same client:

```bash
npm run dcdr -- kn-collections --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN
npm run dcdr -- kn-search --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN \
  --collections product-sheets --query "shelf life of T-55 flour" --top-k 8
npm run dcdr -- kn-answer --control-url https://dcdr.ai --service-token $DCDR_SERVICE_TOKEN \
  --collections product-sheets --question "How long does T-55 keep once opened?" --stream
```

`kn-answer --stream` follows the rule above: when the `final` event is a refusal, it declares the
streamed text discarded and prints the refusal. `kn-answer` exits with code 1 on a refusal. Full
command list: [CLI.md](CLI.md).
