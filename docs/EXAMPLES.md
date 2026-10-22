# Examples

## Example registry.json (HELLO_WORLD)

You can find a complete, copy/paste ready `registry.json` file here:

- [`examples/registry.hello_world.json`](../examples/registry.hello_world.json)
- [`examples/registry.hello_world.minimal.json`](../examples/registry.hello_world.minimal.json)

## Example registry.json (NUTRITION_PROTEIN_SUGGESTION)

- [`examples/registry.nutrition_protein.json`](../examples/registry.nutrition_protein.json)

## Example workflow definition (SUPPORT_TRIAGE)

A complete workflow in the author-facing shorthand (`$ref` / `$fn` / `$template`), with a typed `inputSchema` and `outputSchema`, an `HTTP` lookup, two `INTENT` states, a `CHOICE` and an `END`. It validates on its own with `parseWorkflowDefinitionShorthand` + `validateWorkflowDefinition` (see [WORKFLOWS.md](WORKFLOWS.md)):

- [`examples/workflow.support_ticket_triage.json`](../examples/workflow.support_ticket_triage.json)

Runtime (self-hosted) runnable quickstart (Docker Compose):

- [`examples/runtime-selfhosted/README.md`](../examples/runtime-selfhosted/README.md)

Official TypeScript client runnable example (calls your runtime over HTTP):

- [`examples/runtime-client/README.md`](../examples/runtime-client/README.md)

Official workflow client runnable examples (discover, run and wait, answer human tasks, validate a
definition in CI):

- [`examples/workflow-client/README.md`](../examples/workflow-client/README.md)

## Example: knowledge for client apps (search, then answer)

Search a collection, show the passages, then ask for an answer over **exactly** those passages, so it
cannot cite anything the reader has not seen. Needs a service token with `knowledge:run` and a grant for
the collection (`knowledge:collection:product-sheets` or `knowledge:collections:*`). Full guide:
[KNOWLEDGE.md](KNOWLEDGE.md).

```ts
import { DcdrClient, isDcdrKnowledgeError, DcdrKnowledgeErrorCode } from "@dcdr/contracts";

const dcdr = new DcdrClient({ bearerToken: process.env.DCDR_SERVICE_TOKEN });
const question = "How long does T-55 flour keep once opened?";

try {
  const { passages } = await dcdr.searchKnowledge({ collections: ["product-sheets"], query: question, topK: 6 });
  passages.forEach((p, i) => console.log(`[${i + 1}] ${p.documentTitle} p.${p.locator?.page ?? "?"}: ${p.text}`));

  const answer = await dcdr.answerFromKnowledge({
    collections: ["product-sheets"],
    question,
    chunkIds: passages.map((p) => p.chunkId),   // answer over these, no second search
  });

  if (answer.refusal) console.log(`No answer: ${answer.refusal}`);   // a result, not an error
  else console.log(answer.text, answer.citedChunkIds);
} catch (e) {
  if (isDcdrKnowledgeError(e) && e.code === DcdrKnowledgeErrorCode.NOT_FOUND) console.log("Collection missing or not granted");
  else throw e;
}
```

The same from the CLI ([CLI.md](CLI.md#knowledge-commands-kn-)):

```bash
npm run dcdr -- kn-search --control-url https://dcdr.ai --service-token $SVC --collections product-sheets --query "How long does T-55 flour keep once opened?" --json
npm run dcdr -- kn-answer --control-url https://dcdr.ai --service-token $SVC --collections product-sheets --question "How long does T-55 flour keep once opened?" --stream
```
