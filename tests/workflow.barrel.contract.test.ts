/**
 * What the package's entry point actually hands a JavaScript consumer.
 *
 * This suite exists because of a bug it would have caught on the day it was written. Splitting the
 * transports and the capability catalogue out of `workflow.contract` left the root barrel without
 * re-exports for either, and **nothing failed**: TypeScript resolves the types through the package's
 * subpath exports, so the runtime, the backend and the frontend all compiled cleanly while
 * `require("@dcdr/contracts").WorkflowConnectionProtocol` was `undefined`. The first sign would have
 * been a `TypeError` in a tenant's run, after publishing.
 *
 * Types cannot be checked at run time, so what is pinned here is every **value** a consumer reaches
 * for: the enums it compares against, the constants it iterates, the functions it calls. A new one
 * belongs on this list the moment something outside this package imports it.
 *
 * There are **two** barrels and both are checked. `src/index.ts` is what `tsconfig` compiles into
 * `dist`, which is what `main`, `types` and the `exports` map all point at - so that one is what a
 * consumer of the published package gets. The package-root `index.ts` is what this repository's own
 * `tsconfig` path mapping resolves, so it is what every local `tsc --noEmit` typechecks against.
 * A module added to one and not the other compiles perfectly here and is missing for everyone else,
 * which is exactly the shape of the gap this suite was written for.
 */
import { readdirSync } from "fs";
import { join } from "path";

import * as rootBarrel from "../index";
import * as barrel from "../src/index";

describe("@dcdr/contracts entry point", () => {
  /**
   * Values the backend, the frontend and the runner import by name from the package root.
   *
   * Grouped by the module they live in, so a missing group reads as "that module is not
   * re-exported" rather than as nine unrelated failures.
   */
  const EXPECTED: Record<string, string[]> = {
    "workflow.connections.contract": [
      "WorkflowConnectionProtocol",
      "WorkflowDataEngine",
      "WorkflowShellDialect",
      "WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS",
      "WORKFLOW_CONNECTION_SETTINGS_FIELDS",
      "WORKFLOW_CONNECTION_SECRET_NAMES",
      "WORKFLOW_SSH_SUGGESTED_COMMANDS",
      "WORKFLOW_POWERSHELL_SUGGESTED_COMMANDS",
      "WORKFLOW_SHELL_SUGGESTED_COMMANDS",
      "WORKFLOW_DATA_IMPLEMENTED_ENGINES",
      "WORKFLOW_SQL_ENGINES",
    ],
    "workflow.tool-rating.contract": [
      "WorkflowToolMeter",
      "WorkflowToolRatingMatrixStatus",
      "DEFAULT_WORKFLOW_TOOL_RATING_MATRIX_V1",
      "WORKFLOW_TOOL_RATING_MCP_ID",
      "rateWorkflowToolCall",
    ],
    "workflow.capabilities.contract": [
      "WorkflowCapabilityBroker",
      "WORKFLOW_CAPABILITIES",
      "WORKFLOW_IMPLEMENTED_CAPABILITIES",
      "findWorkflowCapability",
    ],
    "workflow.contract": [
      "WorkflowStateType",
      "WorkflowSchemaVersion",
      "WorkflowHttpMethod",
      "WorkflowAgentToolKind",
      "validateWorkflowDefinition",
      "parseWorkflowDefinitionShorthand",
      "listWorkflowConnections",
      "listWorkflowMcpConnections",
    ],
  };

  describe.each(Object.entries(EXPECTED))("%s", (_module, names) => {
    it.each(names)("exports %s from both barrels", (name) => {
      expect((barrel as Record<string, unknown>)[name]).toBeDefined();
      expect((rootBarrel as Record<string, unknown>)[name]).toBeDefined();
    });
  });

  it("keeps the two barrels in step", () => {
    // Not "they are identical" - the root one may legitimately carry an explicit re-export the
    // other does not - but nothing may be reachable locally and missing from what ships.
    const published = new Set(Object.keys(barrel));
    const missing = Object.keys(rootBarrel).filter((name) => !published.has(name));
    expect(missing).toEqual([]);
  });

  it("re-exports every value every contract module declares", () => {
    // The check the hand-written list above cannot make: comparing the two barrels only finds a
    // symbol reachable from one and not the other, and says nothing about one missing from both.
    // Walking the modules is what caught `ExecutionAssetStorageOwner`, which the runtime used as a
    // value while every consumer of the published package received `undefined` - for months, with
    // a clean compile the whole time.
    //
    // Type-only modules contribute no runtime keys and simply do not appear here.
    const directory = join(__dirname, "..", "src");
    const gaps: Record<string, string[]> = {};

    for (const file of readdirSync(directory).filter((name) => name.endsWith(".contract.ts"))) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const module = require(join(directory, file)) as Record<string, unknown>;
      const missing = Object.keys(module).filter((name) => name !== "default" && (barrel as Record<string, unknown>)[name] === undefined);
      if (missing.length) gaps[file] = missing;
    }

    expect(gaps).toEqual({});
  });

  it("hands over enums a consumer can actually read a member from", () => {
    // `toBeDefined` on a module namespace is not enough on its own: an interop shape that resolves
    // to an empty object would pass it and still break `WorkflowConnectionProtocol.MCP`.
    expect(barrel.WorkflowConnectionProtocol.MCP).toBe("MCP");
    expect(barrel.WorkflowConnectionProtocol.DATA).toBe("DATA");
    expect(barrel.WorkflowDataEngine.POSTGRES).toBe("POSTGRES");
    expect(barrel.WorkflowShellDialect.POSIX).toBe("POSIX");
    expect(barrel.WorkflowCapabilityBroker.CONNECTION).toBe("CONNECTION");
  });

  it("hands over catalogues with entries in them", () => {
    expect(barrel.WORKFLOW_CAPABILITIES.length).toBeGreaterThan(0);
    expect(barrel.WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS.length).toBeGreaterThan(0);
    expect(barrel.findWorkflowCapability("db.query")?.id).toBe("db.query");
  });

  it("gives every protocol a settings key through the barrel, not only through its own module", () => {
    // The editor builds a connection form from these two together, reading both from the package
    // root; either one missing is a form with no fields and no error.
    for (const protocol of Object.values(barrel.WorkflowConnectionProtocol)) {
      expect(barrel.WORKFLOW_CONNECTION_SETTINGS_FIELDS[protocol]).toBeTruthy();
    }
  });
});
