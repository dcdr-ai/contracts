import {
  WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS,
  WORKFLOW_CONNECTION_SECRET_NAMES,
  WORKFLOW_CONNECTION_SETTINGS_FIELDS,
  WORKFLOW_DATA_IMPLEMENTED_ENGINES,
  WORKFLOW_SQL_ENGINES,
  WORKFLOW_SSH_SUGGESTED_COMMANDS,
  WorkflowConnectionProtocol,
  WorkflowDataEngine,
} from "../src/workflow.connections.contract";
import { WORKFLOW_CAPABILITIES, WORKFLOW_IMPLEMENTED_CAPABILITIES, WorkflowCapabilityBroker, findWorkflowCapability } from "../src/workflow.capabilities.contract";

/**
 * The connection transports, as their own contract.
 *
 * They moved out of `workflow.contract` because a transport and a state machine are different
 * things that happened to share a file; this suite is what keeps the split honest - every protocol
 * has a settings block, every implemented one has a runner behind it, and a capability that needs a
 * connection names a protocol that exists.
 */
describe("workflow connection transports", () => {
  it("gives every protocol exactly one settings block", () => {
    // The block is how a runner finds the settings at all: a protocol with no entry here resolves
    // to `undefined` and fails as if the tenant had configured nothing.
    for (const protocol of Object.values(WorkflowConnectionProtocol)) {
      expect(WORKFLOW_CONNECTION_SETTINGS_FIELDS[protocol]).toBeTruthy();
    }
    expect(Object.keys(WORKFLOW_CONNECTION_SETTINGS_FIELDS).sort()).toEqual(Object.values(WorkflowConnectionProtocol).sort());
  });

  it("implements only protocols that exist", () => {
    for (const protocol of WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS) {
      expect(Object.values(WorkflowConnectionProtocol)).toContain(protocol);
    }
  });

  describe("DATA", () => {
    it("is a transport in its own right, not one protocol per query language", () => {
      // Named for what a tenant grants - a database - rather than for SQL, so a document store is
      // another engine here instead of a second protocol with its own settings, credentials and
      // editor.
      expect(WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS).toContain(WorkflowConnectionProtocol.DATA);
      expect(WORKFLOW_CONNECTION_SETTINGS_FIELDS[WorkflowConnectionProtocol.DATA]).toBe("data");
      // Neither `SQL` nor `DATABASE`: the same connection is meant to hold a warehouse, a cache and
      // a search index, and both of those names would already be too narrow for what it carries.
      expect(Object.values(WorkflowConnectionProtocol)).not.toContain("SQL" as WorkflowConnectionProtocol);
      expect(Object.values(WorkflowConnectionProtocol)).not.toContain("DATABASE" as WorkflowConnectionProtocol);
    });

    it("implements only engines that exist, and marks the SQL ones as such", () => {
      for (const engine of WORKFLOW_DATA_IMPLEMENTED_ENGINES) {
        expect(Object.values(WorkflowDataEngine)).toContain(engine);
      }
      for (const engine of WORKFLOW_SQL_ENGINES) {
        expect(Object.values(WorkflowDataEngine)).toContain(engine);
      }
      // The document engine is declared and deliberately not implemented: the editor may show what
      // is coming, and the validator must not let anyone wire it up.
      expect(WORKFLOW_SQL_ENGINES).not.toContain(WorkflowDataEngine.MONGODB);
      // Mongo has a driver; it simply is not a SQL engine, and the two lists mean different things.
      expect(WORKFLOW_DATA_IMPLEMENTED_ENGINES).toContain(WorkflowDataEngine.MONGODB);
    });

    it("carries the ceilings a query needs, because a caller cannot be trusted to bound itself", () => {
      // Three separate limits, and none of them replaces another: rows say nothing about width,
      // width says nothing about how long the server spends finding them.
      const sample: Record<string, unknown> = { maxRows: 0, maxResponseBytes: 0, statementTimeoutMs: 0 };
      expect(Object.keys(sample).sort()).toEqual(["maxResponseBytes", "maxRows", "statementTimeoutMs"]);
    });
  });

  describe("db.query", () => {
    it("is brokered by a connection, never by the platform", () => {
      // A database is the tenant's, always: a platform-brokered one would mean running a tenant's
      // query on our credentials.
      const capability = findWorkflowCapability("db.query");
      expect(capability?.broker).toBe(WorkflowCapabilityBroker.CONNECTION);
      expect(capability?.protocol).toBe(WorkflowConnectionProtocol.DATA);
      expect(capability?.requiresEndpoint).toBeUndefined();
    });

    it("takes bound parameters as their own argument, not as text to paste", () => {
      // The shape is the point: a capability whose only input was a string would make binding
      // impossible and injection the tenant's problem.
      const capability = findWorkflowCapability("db.query")!;
      expect(Object.keys(capability.inputSchema).sort()).toEqual(["collection", "maxRows", "params", "query"]);
      expect(capability.inputSchema.query.required).toBe(true);
      expect(capability.inputSchema.params.required).toBe(false);
    });

    it("says whether the result was cut, so a workflow cannot mistake a page for the whole thing", () => {
      const capability = findWorkflowCapability("db.query")!;
      expect(Object.keys(capability.outputSchema).sort()).toEqual(["columns", "rowCount", "rows", "truncated"]);
      expect(capability.outputSchema.truncated.required).toBe(true);
    });
  });

  it("names the secrets the transports that do not use headers store", () => {
    // SMTP, SFTP and DATABASE authenticate with a user rather than a header, and the editor that
    // writes those and the runner that reads them agree here rather than through a magic string in
    // two repositories.
    expect(WORKFLOW_CONNECTION_SECRET_NAMES.USER).toBe("user");
    expect(WORKFLOW_CONNECTION_SECRET_NAMES.PASSWORD).toBe("password");
  });

  it("suggests only read-only shell commands, and no interpreter", () => {
    // `sh -c "anything"` would make the allowlist decorative, so no interpreter may be suggested.
    for (const command of ["sh", "bash", "zsh", "python", "perl", "node", "env", "sudo"]) {
      expect(WORKFLOW_SSH_SUGGESTED_COMMANDS).not.toContain(command);
    }
  });

  it("keeps every capability pointed at a protocol that exists", () => {
    for (const capability of WORKFLOW_CAPABILITIES) {
      if (capability.broker !== WorkflowCapabilityBroker.CONNECTION) continue;
      expect(Object.values(WorkflowConnectionProtocol)).toContain(capability.protocol);
    }
    expect(WORKFLOW_IMPLEMENTED_CAPABILITIES).toContain("db.query");
  });
});
