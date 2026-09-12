import { PromptVariable, PromptVariableType } from "./prompts.contract";
import { WorkflowConnectionProtocol } from "./workflow.connections.contract";

/**
 * The capability catalogue: typed actions a `TOOL` state (or a planner) can run.
 *
 * Separate from both the state machine and the transports because it is the extension point of the
 * product: capabilities are added far more often than either, and a catalogue entry is a versioned
 * contract of its own (`version`, `inputSchema`, `outputSchema`) rather than a detail of the state
 * that happens to invoke it.
 *
 * Re-exported from `workflow.contract` so nothing that imports it today has to change.
 */

/**
 * Who holds the credentials a capability runs with.
 *
 * The distinction is what decides whether a `TOOL` state needs a `connection`, and it is a real
 * split rather than a convenience: a platform-brokered capability runs on our account and is billed
 * per call, while a connection-brokered one reaches the tenant's own server with the tenant's own
 * secrets and costs us nothing.
 */
export enum WorkflowCapabilityBroker {
  /** We run it with our own credentials and bill the call. The tenant configures nothing. */
  PLATFORM = "PLATFORM",
  /** The tenant supplies a connection of the capability's protocol. */
  CONNECTION = "CONNECTION",
}

/**
 * One capability of the published catalog.
 *
 * A capability is a *typed* action ("search the web", "send an email"), as opposed to the `HTTP`
 * state, which is the untyped escape hatch where the tenant maps a URL and a body by hand. That is
 * the whole point: the tenant fills a form we designed, and a planner gets an `inputSchema` it can
 * satisfy without knowing anything about transports.
 *
 * Capabilities are versioned independently of the package: `version` moves when the argument or
 * result shape changes, so a workflow pinned to an older revision keeps validating.
 */
export interface WorkflowCapability {
  /** Stable dotted id, e.g. `web.search`. Never reused for a different meaning. */
  id: string;
  /** Revision of this capability's own contract, independent of the package version. */
  version: string;
  /** One line, in English. A planner reads this to decide whether the tool fits. */
  description: string;
  broker: WorkflowCapabilityBroker;
  /** Transport the connection must speak; set only for `CONNECTION` capabilities. */
  protocol?: WorkflowConnectionProtocol;
  /**
   * Whether this capability calls a service the platform operates, so the control plane has to
   * resolve an endpoint for it in the run descriptor.
   *
   * `PLATFORM` says whose credentials are spent, not that there is something to point at: a search
   * engine is a service we run, while fetching a page is the runner's own egress and has no
   * endpoint at all. The descriptor is still required for both - that is how the control plane
   * grants the capability to a run - but only a capability that declares this needs a `baseUrl`
   * inside it, and a runner that demanded one anyway would refuse a perfectly valid grant.
   */
  requiresEndpoint?: boolean;
  /** Arguments the tenant form (or the planner) must produce. */
  inputSchema: Record<string, PromptVariable>;
  /** Shape of the result, so downstream states can reference it without running the flow. */
  outputSchema: Record<string, PromptVariable>;
}

/**
 * The catalog we publish.
 *
 * Deliberately small: every entry is a contract we have to keep working for every tenant that wired
 * it into a workflow, so a capability is added when it earns its place, not because a provider
 * happens to expose an endpoint.
 */
export const WORKFLOW_CAPABILITIES: readonly WorkflowCapability[] = [
  {
    id: "web.search",
    version: "1.0.0",
    description: "Searches the public web and returns ranked results with title, url and snippet.",
    broker: WorkflowCapabilityBroker.PLATFORM,
    requiresEndpoint: true,
    inputSchema: {
      query: new PromptVariable(PromptVariableType.STRING, true, "What to search for, as a person would type it."),
      maxResults: new PromptVariable(PromptVariableType.INTEGER, false, "How many results to return (1-10, default 5).", undefined, undefined, undefined, undefined, 1, 10),
    },
    outputSchema: {
      results: new PromptVariable(PromptVariableType.ARRAY, true, "Ranked results, best first.", PromptVariableType.OBJECT, {
        title: new PromptVariable(PromptVariableType.STRING, true, "Result title."),
        url: new PromptVariable(PromptVariableType.STRING, true, "Absolute result URL."),
        snippet: new PromptVariable(PromptVariableType.STRING, false, "Extract of the page around the match."),
      }),
    },
  },
  {
    id: "web.fetch",
    version: "1.0.0",
    description: "Downloads one URL and returns its readable text. Reads HTML, plain text, Markdown and JSON, so it also works against a status or health endpoint.",
    broker: WorkflowCapabilityBroker.PLATFORM,
    inputSchema: {
      url: new PromptVariable(PromptVariableType.STRING, true, "Absolute https URL to read."),
      maxChars: new PromptVariable(PromptVariableType.INTEGER, false, "Stop after this many characters of text.", undefined, undefined, undefined, undefined, 500),
    },
    outputSchema: {
      url: new PromptVariable(PromptVariableType.STRING, true, "URL that was finally read, after redirects."),
      title: new PromptVariable(PromptVariableType.STRING, false, "Page title, when it declares one."),
      text: new PromptVariable(PromptVariableType.STRING, true, "Readable text of the page, scripts and markup removed."),
      truncated: new PromptVariable(PromptVariableType.BOOLEAN, true, "Whether the text was cut at the limit."),
    },
  },
  {
    id: "chat.post",
    version: "1.0.0",
    description: "Posts a message to a chat channel through the tenant's own incoming webhook.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.HTTP,
    inputSchema: {
      text: new PromptVariable(PromptVariableType.STRING, true, "Message to post."),
      title: new PromptVariable(PromptVariableType.STRING, false, "Headline shown above the message, where the platform supports one."),
    },
    outputSchema: {
      delivered: new PromptVariable(PromptVariableType.BOOLEAN, true, "Whether the webhook accepted the message."),
      status: new PromptVariable(PromptVariableType.INTEGER, true, "HTTP status the webhook answered with."),
    },
  },
  {
    id: "db.query",
    version: "1.0.0",
    description: "Runs one read-only query against the tenant's own database and returns the rows.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.DATA,
    inputSchema: {
      query: new PromptVariable(PromptVariableType.STRING, true, "The query: a single SQL `SELECT` for a relational engine, or a JSON filter document for a document one."),
      params: new PromptVariable(PromptVariableType.ARRAY, false, "Values bound to the query's placeholders, in order. Values are always bound, never pasted into the query text.", PromptVariableType.ANY),
      collection: new PromptVariable(PromptVariableType.STRING, false, "Collection to query; document engines only."),
      maxRows: new PromptVariable(PromptVariableType.INTEGER, false, "Stop after this many rows; the connection ceiling applies anyway.", undefined, undefined, undefined, undefined, 1),
    },
    outputSchema: {
      rows: new PromptVariable(PromptVariableType.ARRAY, true, "The rows the query returned.", PromptVariableType.ANY),
      rowCount: new PromptVariable(PromptVariableType.INTEGER, true, "How many rows are in `rows`."),
      columns: new PromptVariable(PromptVariableType.ARRAY, true, "Column names, in order; empty for a document engine.", PromptVariableType.STRING),
      truncated: new PromptVariable(PromptVariableType.BOOLEAN, true, "Whether the result was cut at a limit."),
    },
  },
  {
    id: "mail.send",
    version: "1.0.0",
    description: "Sends an email through the tenant's own SMTP server.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.SMTP,
    inputSchema: {
      to: new PromptVariable(PromptVariableType.ARRAY, true, "Recipient addresses.", PromptVariableType.STRING),
      subject: new PromptVariable(PromptVariableType.STRING, true, "Subject line."),
      body: new PromptVariable(PromptVariableType.STRING, true, "Message body."),
      html: new PromptVariable(PromptVariableType.BOOLEAN, false, "Whether the body is HTML rather than plain text."),
      cc: new PromptVariable(PromptVariableType.ARRAY, false, "Addresses in copy.", PromptVariableType.STRING),
      bcc: new PromptVariable(PromptVariableType.ARRAY, false, "Addresses in blind copy.", PromptVariableType.STRING),
      replyTo: new PromptVariable(PromptVariableType.STRING, false, "Address replies should go to; defaults to the connection sender."),
    },
    outputSchema: {
      messageId: new PromptVariable(PromptVariableType.STRING, true, "Identifier the SMTP server assigned to the message."),
      accepted: new PromptVariable(PromptVariableType.ARRAY, true, "Addresses the server accepted.", PromptVariableType.STRING),
      rejected: new PromptVariable(PromptVariableType.ARRAY, true, "Addresses the server refused; an empty list means every recipient was taken.", PromptVariableType.STRING),
    },
  },
  {
    id: "file.put",
    version: "1.0.0",
    description: "Writes a text file to the tenant's own SFTP server.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.SFTP,
    inputSchema: {
      path: new PromptVariable(PromptVariableType.STRING, true, "Path relative to the connection base path."),
      content: new PromptVariable(PromptVariableType.STRING, true, "File contents."),
      append: new PromptVariable(PromptVariableType.BOOLEAN, false, "Append instead of replacing an existing file."),
    },
    outputSchema: {
      path: new PromptVariable(PromptVariableType.STRING, true, "Full path the file was written to."),
      bytes: new PromptVariable(PromptVariableType.INTEGER, true, "Bytes written."),
    },
  },
  {
    id: "file.get",
    version: "1.0.0",
    description: "Reads a text file from the tenant's own SFTP server.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.SFTP,
    inputSchema: {
      path: new PromptVariable(PromptVariableType.STRING, true, "Path relative to the connection base path."),
      maxBytes: new PromptVariable(PromptVariableType.INTEGER, false, "Refuse a file larger than this; the connection ceiling applies anyway.", undefined, undefined, undefined, undefined, 1),
    },
    outputSchema: {
      path: new PromptVariable(PromptVariableType.STRING, true, "Full path that was read."),
      content: new PromptVariable(PromptVariableType.STRING, true, "File contents."),
      bytes: new PromptVariable(PromptVariableType.INTEGER, true, "Bytes read."),
    },
  },
  {
    id: "file.list",
    version: "1.0.0",
    description: "Lists a directory on the tenant's own SFTP server.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.SFTP,
    inputSchema: {
      path: new PromptVariable(PromptVariableType.STRING, false, "Directory relative to the connection base path; the base path itself when absent."),
      pattern: new PromptVariable(PromptVariableType.STRING, false, "Glob the names must match, e.g. `*.csv`."),
    },
    outputSchema: {
      entries: new PromptVariable(PromptVariableType.ARRAY, true, "What the directory holds.", PromptVariableType.OBJECT, {
        name: new PromptVariable(PromptVariableType.STRING, true, "Entry name."),
        type: new PromptVariable(PromptVariableType.ENUM, true, "What it is.", undefined, undefined, undefined, ["FILE", "DIRECTORY", "LINK"]),
        bytes: new PromptVariable(PromptVariableType.INTEGER, true, "Size in bytes; zero for a directory."),
        modifiedAt: new PromptVariable(PromptVariableType.STRING, false, "Last modification, ISO-8601."),
      }),
    },
  },
  {
    id: "ssh.exec",
    version: "1.0.0",
    description: "Runs one allowlisted command over SSH on the tenant's own host.",
    broker: WorkflowCapabilityBroker.CONNECTION,
    protocol: WorkflowConnectionProtocol.SFTP,
    inputSchema: {
      command: new PromptVariable(PromptVariableType.STRING, true, "Command to run; its first word must be in the connection's allowed commands."),
      args: new PromptVariable(PromptVariableType.ARRAY, false, "Arguments, passed one by one and quoted by the runner.", PromptVariableType.STRING),
    },
    outputSchema: {
      exitCode: new PromptVariable(PromptVariableType.INTEGER, true, "Exit status the command returned."),
      stdout: new PromptVariable(PromptVariableType.STRING, true, "Standard output, bounded by the connection response ceiling."),
      stderr: new PromptVariable(PromptVariableType.STRING, true, "Standard error, bounded the same way."),
    },
  },
];

/**
 * Capabilities a runner can actually execute today.
 *
 * Same idea as `WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS`: an editor may show the rest so a tenant
 * can see what is coming, but it must not let them wire up something that will not run.
 */
export const WORKFLOW_IMPLEMENTED_CAPABILITIES: readonly string[] = [
  "web.search",
  "web.fetch",
  "chat.post",
  "db.query",
  "mail.send",
  "file.put",
  "file.get",
  "file.list",
  "ssh.exec",
];

/**
 * Looks a capability up by id.
 *
 * @param id Capability id.
 * @returns The capability, or `undefined` when the id is not in the catalog.
 */
export function findWorkflowCapability(id: string | null | undefined): WorkflowCapability | undefined {
  const key = String(id ?? "").trim();
  if (!key) return undefined;
  return WORKFLOW_CAPABILITIES.find((capability) => capability.id === key);
}
