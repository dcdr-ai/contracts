/// <reference types="jest" />
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseWorkflowDefinitionShorthand, validateWorkflowDefinition } from "../src/workflow.contract";

const EXAMPLES_DIR = join(__dirname, "..", "examples");

/**
 * Every `examples/workflow.*.json` file must be a valid shorthand definition on its own (no registry context),
 * so customers can copy it as a starting point.
 */
describe("workflow examples", () => {
  const files = readdirSync(EXAMPLES_DIR).filter((f) => f.startsWith("workflow.") && f.endsWith(".json"));

  it("ships at least one workflow example", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s parses and validates", (file) => {
    const raw: unknown = JSON.parse(readFileSync(join(EXAMPLES_DIR, file), "utf8"));
    const definition = parseWorkflowDefinitionShorthand(raw);
    const result = validateWorkflowDefinition(definition);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
