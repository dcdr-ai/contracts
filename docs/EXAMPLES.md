# Examples

## Example registry.json (HELLO_WORLD)

You can find a complete, copy/paste ready `registry.json` file here:

- [`examples/registry.hello_world.json`](../examples/registry.hello_world.json)
- [`examples/registry.hello_world.minimal.json`](../examples/registry.hello_world.minimal.json)

## Example registry.json (NUTRITION_PROTEIN_SUGGESTION)

- [`examples/registry.nutrition_protein.json`](../examples/registry.nutrition_protein.json)

## Example workflow definition (SUPPORT_TRIAGE)

A complete workflow in the author-facing shorthand (`$ref` / `$fn` / `$template`), with a typed `input` and `outputSchema`, an `HTTP` lookup, two `INTENT` states, a `CHOICE` and an `END`. It validates on its own with `parseWorkflowDefinitionShorthand` + `validateWorkflowDefinition` (see [WORKFLOWS.md](WORKFLOWS.md)):

- [`examples/workflow.support_ticket_triage.json`](../examples/workflow.support_ticket_triage.json)

Runtime (self-hosted) runnable quickstart (Docker Compose):

- [`examples/runtime-selfhosted/README.md`](../examples/runtime-selfhosted/README.md)

Official TypeScript client runnable example (calls your runtime over HTTP):

- [`examples/runtime-client/README.md`](../examples/runtime-client/README.md)
