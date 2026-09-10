import { PromptVariableType } from "../src/prompts.contract";
import {
  WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS,
  WORKFLOW_CONNECTION_SETTINGS_FIELDS,
  WorkflowAgentToolKind,
  WorkflowConnectionProtocol,
  WorkflowDefinition,
  WorkflowSchemaVersion,
  WorkflowStateType,
  WorkflowValidationIntent,
  WorkflowValidationIssueCode,
  formatWorkflowDefinitionShorthand,
  listWorkflowConnections,
  listWorkflowMcpConnections,
  parseWorkflowDefinitionShorthand,
  validateWorkflowDefinition,
} from "../src/workflow.contract";

/**
 * The MCP surface of the workflow contract.
 *
 * An MCP server is the one destination a workflow names without ever describing: the catalog is
 * discovered at run time, so what the contract can check is narrow and precise - that the server is
 * reached through a connection the tenant approved, that the workflow does not pretend to know the
 * argument shape, and that the control plane can find every such connection to resolve it. Those
 * three are what this file pins.
 */
describe("workflow.contract MCP", () => {
  /** Intents the agent definitions below reference. */
  const intents: WorkflowValidationIntent[] = [
    { intent: "RESEARCH_PLANNER", inputSchema: { goal: { type: PromptVariableType.STRING, required: true } } },
  ];

  /**
   * A definition whose only agent tool is an MCP server.
   *
   * @param tool Overrides applied to the MCP tool entry.
   * @param extraStates Extra states merged into the definition.
   * @returns The definition.
   */
  function mcpDefinition(tool: Record<string, unknown> = {}, extraStates: Record<string, unknown> = {}): WorkflowDefinition {
    return parseWorkflowDefinitionShorthand({
      schemaVersion: WorkflowSchemaVersion.V1,
      key: "MCP_FLOW",
      name: "MCP flow",
      settings: { timeoutMs: 60_000, maxTransitionsPerRun: 50 },
      startAt: "research",
      states: {
        research: {
          type: "AGENT",
          next: "done",
          agent: {
            plannerIntent: "RESEARCH_PLANNER",
            goal: { $template: "Check {{input.supplier}}" },
            tools: [{ id: "registry", kind: "MCP", connection: "company_mcp", description: "The official company registry server.", ...tool }],
            maxIterations: 6,
            maxTrackedCalls: 20,
            maxToolErrors: 1,
          },
        },
        done: { type: "END", end: { outcome: "SUCCEED" } },
        ...extraStates,
      },
    });
  }

  /**
   * Validation labels (`path:code`) of a definition.
   *
   * @param definition Definition to validate.
   * @param connections Connection keys the tenant has.
   * @returns The labels.
   */
  function labels(definition: WorkflowDefinition, connections: string[] = ["company_mcp"]): string[] {
    return validateWorkflowDefinition(definition, { intents, connections }).issues.map((issue) => `${issue.path}:${issue.code}`);
  }

  describe("the connection", () => {
    it("declares MCP as a transport with a runner behind it", () => {
      // The editor offers only implemented protocols, so this list is what makes an MCP connection
      // creatable at all; it moved here once the runner's client was proven against a real server.
      expect(WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS).toContain(WorkflowConnectionProtocol.MCP);
      expect(WORKFLOW_CONNECTION_SETTINGS_FIELDS[WorkflowConnectionProtocol.MCP]).toBe("mcp");
    });
  });

  describe("the agent tool", () => {
    it("accepts a server named through a connection the tenant has", () => {
      expect(labels(mcpDefinition())).toEqual([]);
    });

    it("accepts a narrowing list, which may only restrict what the connection already grants", () => {
      expect(labels(mcpDefinition({ tools: ["lookup", "filings"] }))).toEqual([]);
    });

    it("refuses a tool with no connection", () => {
      expect(labels(mcpDefinition({ connection: "   " }))).toContain(
        `states.research.agent.tools[0].connection:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      );
    });

    it("refuses a connection the tenant does not have", () => {
      // Caught at publish time rather than at run time: an agent that loses its whole catalog mid-run
      // looks like a model failure, and the author would debug the prompt instead of the connection.
      expect(labels(mcpDefinition(), ["other"])).toContain(
        `states.research.agent.tools[0].connection:${WorkflowValidationIssueCode.CONNECTION_UNKNOWN}`,
      );
    });

    it("refuses a narrowing that is not a list of names", () => {
      expect(labels(mcpDefinition({ tools: "lookup" }))).toContain(
        `states.research.agent.tools[0].tools:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      );
      expect(labels(mcpDefinition({ tools: ["lookup", "  "] }))).toContain(
        `states.research.agent.tools[0].tools:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      );
    });

    it("refuses a declared argument schema", () => {
      // The argument shape belongs to the server and is only known once discovery ran, so declaring
      // one here is a promise the workflow cannot keep - and the planner would be given the wrong one.
      expect(labels(mcpDefinition({ inputSchema: { number: { type: "string", required: true } } }))).toContain(
        `states.research.agent.tools[0].inputSchema:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      );
    });

    it("refuses an entry that also names an intent or a state", () => {
      // The three kinds are exclusive: an entry naming two of them is an author who meant one kind
      // and got the other's fields, which would silently resolve to whichever branch ran first.
      expect(labels(mcpDefinition({ intent: "RESEARCH_PLANNER" }))).toContain(
        `states.research.agent.tools[0].intent:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      );
      expect(labels(mcpDefinition({ state: "done" }))).toContain(
        `states.research.agent.tools[0].state:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      );
    });

    it("still requires a description, because that is all the planner reads before discovery", () => {
      expect(labels(mcpDefinition({ description: "  " }))).toContain(
        `states.research.agent.tools[0].description:${WorkflowValidationIssueCode.AGENT_TOOL_INVALID}`,
      );
    });

    it("round-trips through the shorthand", () => {
      const definition = mcpDefinition({ tools: ["lookup"] });
      const shorthand = formatWorkflowDefinitionShorthand(definition) as { states: Record<string, Record<string, never>> };
      const tool = (shorthand.states.research as unknown as { agent: { tools: Array<Record<string, unknown>> } }).agent.tools[0];
      expect(tool).toMatchObject({ id: "registry", kind: "MCP", connection: "company_mcp", tools: ["lookup"] });
      expect(formatWorkflowDefinitionShorthand(parseWorkflowDefinitionShorthand(shorthand))).toEqual(shorthand);
    });
  });

  describe("listWorkflowMcpConnections", () => {
    it("finds a server named inside an agent's catalog", () => {
      // The reason this function exists at all: `listWorkflowConnections` walks the states, and no
      // state names an MCP server - so without this the control plane would hand the runner a run
      // with no descriptor for it and every discovery would fail.
      const definition = mcpDefinition();
      expect(listWorkflowConnections(definition)).toEqual([]);
      expect(listWorkflowMcpConnections(definition)).toEqual(["company_mcp"]);
    });

    it("descends into parallel branches and foreach bodies", () => {
      const definition = parseWorkflowDefinitionShorthand({
        schemaVersion: WorkflowSchemaVersion.V1,
        key: "MCP_NESTED",
        name: "Nested",
        settings: { timeoutMs: 60_000, maxTransitionsPerRun: 50 },
        startAt: "fan",
        states: {
          fan: {
            type: "PARALLEL",
            next: "loop",
            parallel: {
              branches: [
                {
                  key: "left",
                  startAt: "a",
                  states: {
                    a: {
                      type: "AGENT",
                      agent: {
                        plannerIntent: "RESEARCH_PLANNER",
                        goal: { $literal: "x" },
                        tools: [{ id: "t", kind: "MCP", connection: "branch_mcp", description: "Branch server." }],
                        maxIterations: 2,
                      },
                    },
                  },
                },
              ],
            },
          },
          loop: {
            type: "FOREACH",
            next: "done",
            foreach: {
              items: { $ref: "input.rows" },
              startAt: "b",
              states: {
                b: {
                  type: "AGENT",
                  agent: {
                    plannerIntent: "RESEARCH_PLANNER",
                    goal: { $literal: "y" },
                    tools: [{ id: "t", kind: "MCP", connection: "loop_mcp", description: "Loop server." }],
                    maxIterations: 2,
                  },
                },
              },
            },
          },
          done: { type: "END", end: { outcome: "SUCCEED" } },
        },
      });

      expect(listWorkflowMcpConnections(definition)).toEqual(["branch_mcp", "loop_mcp"]);
    });

    it("deduplicates a server two agents share and sorts the result", () => {
      const definition = mcpDefinition({}, {
        second: {
          type: "AGENT",
          next: "done",
          agent: {
            plannerIntent: "RESEARCH_PLANNER",
            goal: { $literal: "again" },
            tools: [
              { id: "registry", kind: "MCP", connection: "company_mcp", description: "Same server." },
              { id: "another", kind: "MCP", connection: "a_mcp", description: "Another server." },
            ],
            maxIterations: 2,
          },
        },
      });

      expect(listWorkflowMcpConnections(definition)).toEqual(["a_mcp", "company_mcp"]);
    });

    it("ignores agents whose tools are not MCP", () => {
      const definition = parseWorkflowDefinitionShorthand({
        schemaVersion: WorkflowSchemaVersion.V1,
        key: "NO_MCP",
        name: "No MCP",
        settings: { timeoutMs: 60_000, maxTransitionsPerRun: 50 },
        startAt: "research",
        states: {
          research: {
            type: "AGENT",
            next: "done",
            agent: {
              plannerIntent: "RESEARCH_PLANNER",
              goal: { $literal: "x" },
              tools: [{ id: "look", kind: "STATE", state: "done", description: "Finish." }],
              maxIterations: 2,
            },
          },
          done: { type: "END", end: { outcome: "SUCCEED" } },
        },
      });

      expect(listWorkflowMcpConnections(definition)).toEqual([]);
    });

    it("returns nothing for a definition with no states", () => {
      expect(listWorkflowMcpConnections({ states: {} } as unknown as WorkflowDefinition)).toEqual([]);
    });
  });

  describe("the tool kind itself", () => {
    it("is one of the three an agent may declare", () => {
      expect(Object.values(WorkflowAgentToolKind)).toContain(WorkflowAgentToolKind.MCP);
    });

    it("is not a state type: a server is a catalog, not a step", () => {
      // Worth pinning because the obvious-looking alternative (an `MCP` state) is what the design
      // rejected: one entry becomes N planner-visible tools, and a state cannot expand.
      expect(Object.values(WorkflowStateType)).not.toContain("MCP" as WorkflowStateType);
    });
  });
});
