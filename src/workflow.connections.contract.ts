import { PromptVariable, PromptVariableType } from "./prompts.contract";

/**
 * Connection transports of the workflows product.
 *
 * A connection is a destination the tenant approved, with its credentials. This module owns what is
 * true of a *destination* - the transports, the settings block each one carries, and the names its
 * secrets are stored under - and knows nothing about the state machine that calls it, which is why
 * it is not part of `workflow.contract`: adding a transport should not mean editing the definition
 * contract, and for four transports and a capability catalogue that file had grown past four
 * thousand lines.
 *
 * Re-exported from `workflow.contract` so nothing that imports it today has to change.
 */


/**
 * Transport a workflow connection speaks.
 *
 * A connection is a destination the tenant approved, with its credentials, so the transport is a
 * property of the destination and everything specific to it lives in its own settings block. Adding
 * a transport is then a settings shape plus a runner, never another column or another entity.
 *
 * Notes
 * - Values are persisted by the control plane; never rename them.
 * - Declared ahead of the implementations on purpose; `WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS`
 *   says which ones actually execute today, so an editor never offers a dead transport.
 * - Plain `FTP` is deliberately absent: it moves credentials and payloads in clear text, and real
 *   deployments use `SFTP`.
 */
export enum WorkflowConnectionProtocol {
  /** Outbound HTTP(S); what `HTTP` states call. */
  HTTP = "HTTP",
  /** Model Context Protocol server: a discovered catalog of tools an `AGENT` may call. */
  MCP = "MCP",
  /** Mail relay for outbound messages. */
  SMTP = "SMTP",
  /** File exchange over SSH. */
  SFTP = "SFTP",
  /**
   * A database the tenant runs, whatever kind.
   *
   * Deliberately not `SQL`: the transport is "a database this tenant owns and we query", and which
   * query language it speaks is a property of the *engine*, not of the connection kind. Naming it
   * `SQL` would have meant a second protocol the day a document store is added, with a second
   * settings block, a second credential path and a second editor for the same idea.
   */
  DATA = "DATA",
}

/**
 * Engines a `DATA` connection may point at.
 *
 * Values are persisted by the control plane; never rename them. Declared ahead of the drivers on
 * purpose - `WORKFLOW_DATA_IMPLEMENTED_ENGINES` says which ones actually run today, so an
 * editor can show what is coming without letting a tenant wire up a dead one.
 */
export enum WorkflowDataEngine {
  POSTGRES = "POSTGRES",
  MYSQL = "MYSQL",
  MARIADB = "MARIADB",
  SQLSERVER = "SQLSERVER",
  ORACLE = "ORACLE",
  /** Document store; its `query` is a JSON find or aggregation rather than a statement. */
  MONGODB = "MONGODB",
}

/**
 * How an engine is reached, which is what decides the shape of its settings.
 *
 * A `DATA` connection covers things that answer the same *question* - "read me these rows" - through
 * completely different front doors, and pretending otherwise produces a settings object where half
 * the fields are meaningless for whichever engine is selected. PostgreSQL has a host and a port;
 * BigQuery has neither, it has a project and a service account. So the settings carry one block per
 * kind, discriminated by the engine, exactly the way `WorkflowConnectionSettings` carries one block
 * per protocol.
 */
export enum WorkflowDataEngineKind {
  /** A server on a host and a port, speaking its own wire protocol. */
  SERVER = "SERVER",
  /** An HTTP endpoint that takes a query in a request body. */
  HTTP = "HTTP",
  /** A managed warehouse reached through its own API, with its own notion of where a query runs. */
  WAREHOUSE = "WAREHOUSE",
}

/** Which front door each engine has. */
export const WORKFLOW_DATA_ENGINE_KINDS: Record<WorkflowDataEngine, WorkflowDataEngineKind> = {
  [WorkflowDataEngine.POSTGRES]: WorkflowDataEngineKind.SERVER,
  [WorkflowDataEngine.MYSQL]: WorkflowDataEngineKind.SERVER,
  [WorkflowDataEngine.MARIADB]: WorkflowDataEngineKind.SERVER,
  [WorkflowDataEngine.SQLSERVER]: WorkflowDataEngineKind.SERVER,
  [WorkflowDataEngine.ORACLE]: WorkflowDataEngineKind.SERVER,
  [WorkflowDataEngine.MONGODB]: WorkflowDataEngineKind.SERVER,
};

/** Settings block each engine kind fills, mirroring `WORKFLOW_CONNECTION_SETTINGS_FIELDS`. */
export const WORKFLOW_DATA_ENGINE_SETTINGS_FIELDS: Record<WorkflowDataEngineKind, "server" | "http" | "warehouse"> = {
  [WorkflowDataEngineKind.SERVER]: "server",
  [WorkflowDataEngineKind.HTTP]: "http",
  [WorkflowDataEngineKind.WAREHOUSE]: "warehouse",
};

/** Engines with a driver behind them in the runner. */
export const WORKFLOW_DATA_IMPLEMENTED_ENGINES: WorkflowDataEngine[] = [
  WorkflowDataEngine.POSTGRES,
  WorkflowDataEngine.MYSQL,
  WorkflowDataEngine.MARIADB,
  WorkflowDataEngine.SQLSERVER,
  WorkflowDataEngine.ORACLE,
  WorkflowDataEngine.MONGODB,
];

/** Engines whose `query` is a SQL statement rather than a document. */
export const WORKFLOW_SQL_ENGINES: WorkflowDataEngine[] = [
  WorkflowDataEngine.POSTGRES,
  WorkflowDataEngine.MYSQL,
  WorkflowDataEngine.MARIADB,
  WorkflowDataEngine.SQLSERVER,
  WorkflowDataEngine.ORACLE,
];

/**
 * Names a connection's encrypted secret pairs must use for the transports that authenticate with a
 * user rather than with a header.
 *
 * `AIModelCredentials` stores name/value pairs, which fits HTTP and MCP - where the pair *is* a
 * header - and says nothing about SMTP or SFTP, where the server wants a username and a password or
 * a key. Published here so the editor that writes them and the runner that reads them agree on the
 * names, instead of the convention living as a magic string in two repositories.
 */
export const WORKFLOW_CONNECTION_SECRET_NAMES = {
  /** SMTP and SFTP: the account to log in as. */
  USER: "user",
  /** SMTP and SFTP: its password. */
  PASSWORD: "password",
  /** SFTP: a private key in PEM form, used instead of the password when present. */
  PRIVATE_KEY: "privateKey",
  /** SFTP: passphrase of that key, when it has one. */
  PASSPHRASE: "passphrase",
} as const;

/**
 * The shell an `SFTP` host answers with, which decides how `ssh.exec` quotes an argument.
 *
 * Not a cosmetic setting. The safety of `ssh.exec` rests on the claim that every argument reaches
 * the host as *one argument*, and that claim is only true of the shell the quoting was written for:
 * POSIX escapes a single quote by ending the string, adding an escaped quote and opening a new one,
 * while PowerShell escapes it by **doubling** it and would read the POSIX form as the end of the
 * string followed by loose text. A Windows host with PowerShell as the account's SSH shell is an
 * ordinary deployment - OpenSSH ships with Windows Server - so this has to be declared rather than
 * assumed.
 *
 * `cmd.exe` is deliberately absent. Quoting arbitrary text for it is not a solved problem: the
 * escaping rules differ between the shell and the C runtime, `%VAR%` expands inside quotes, and
 * `&` splits commands in places the quoting cannot reach. A tenant on Windows sets the account's
 * default SSH shell to PowerShell, which is one registry value and is what the connection help
 * says.
 */
export enum WorkflowShellDialect {
  /** `sh`, `bash`, `zsh`: every Unix host, and the default. */
  POSIX = "POSIX",
  /** Windows PowerShell 5.1 or PowerShell 7, when it is the account's default SSH shell. */
  POWERSHELL = "POWERSHELL",
}

/**
 * Commands an editor may offer as a starting point for `WorkflowSftpConnectionSettings.allowedCommands`.
 *
 * Every entry reads or reports and none of them writes, moves, deletes or changes permissions, and
 * none is a shell: `sh -c "anything"` would make the allowlist decorative, which is why no
 * interpreter appears here. The list is a **suggestion, not a ceiling** - a tenant may add whatever
 * their own host needs - so it exists to make the safe choice the easy one rather than to enforce
 * it; the enforcement is whatever ends up in the connection.
 */
export const WORKFLOW_SSH_SUGGESTED_COMMANDS: readonly string[] = [
  "cat",
  "date",
  "df",
  "du",
  "echo",
  "find",
  "grep",
  "head",
  "hostname",
  "ls",
  "md5sum",
  "sha256sum",
  "stat",
  "tail",
  "uptime",
  "wc",
  "whoami",
];

/**
 * The same idea for a PowerShell host: read-only cmdlets, and no way to evaluate a string.
 *
 * `Invoke-Expression`, `Invoke-Command`, `Start-Process` and the call operator are the PowerShell
 * equivalents of `sh -c`, so none of them appears here for the same reason no interpreter appears
 * in the POSIX list.
 */
export const WORKFLOW_POWERSHELL_SUGGESTED_COMMANDS: readonly string[] = [
  "Get-ChildItem",
  "Get-ComputerInfo",
  "Get-Content",
  "Get-Date",
  "Get-Item",
  "Get-ItemProperty",
  "Get-Location",
  "Get-Process",
  "Get-Service",
  "Get-Volume",
  "Measure-Object",
  "Select-String",
  "Test-Path",
  "hostname",
  "whoami",
];

/** The starting point an editor offers, by dialect. */
export const WORKFLOW_SHELL_SUGGESTED_COMMANDS: Record<WorkflowShellDialect, readonly string[]> = {
  [WorkflowShellDialect.POSIX]: WORKFLOW_SSH_SUGGESTED_COMMANDS,
  [WorkflowShellDialect.POWERSHELL]: WORKFLOW_POWERSHELL_SUGGESTED_COMMANDS,
};

/** Protocols with a runner implementation behind them. */
export const WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS: WorkflowConnectionProtocol[] = [
  WorkflowConnectionProtocol.HTTP,
  WorkflowConnectionProtocol.MCP,
  WorkflowConnectionProtocol.SMTP,
  WorkflowConnectionProtocol.SFTP,
  WorkflowConnectionProtocol.DATA,
];

/**
 * What every connection carries whatever its transport.
 *
 * The control plane stores `allowedHosts` and the credentials reference as its own columns and
 * interpolates them into the settings block it hands the runner, so a runner receives one
 * self-contained object and never has to join anything.
 */
export interface WorkflowConnectionCommonSettings {
  /**
   * Destinations the egress guard accepts. The tenant-approved boundary of this connection; the
   * control plane defaults it from the endpoint host when the tenant declares none.
   */
  allowedHosts: string[];
  /** Wall-clock budget of a single operation. */
  timeoutMs: number;
  /**
   * Whether this connection needs secrets. The runner fetches them per run through
   * `GET /api/workflows/:runId/connection/:key`; they never travel in the descriptor.
   */
  requiresCredentials?: boolean;
}

/** `HTTP` connection settings. */
export interface WorkflowHttpConnectionSettings extends WorkflowConnectionCommonSettings {
  /** Absolute base URL every `HTTP` state path is resolved against. */
  baseUrl: string;
  maxResponseBytes: number;
  /**
   * Bytes an outbound request body may reach.
   *
   * The counterpart nobody thinks of. `maxResponseBytes` bounds what arrives, and for a long time
   * nothing bounded what *leaves* - which is the direction that matters more on two counts: a body
   * is built from earlier states, so a hundred-megabyte query result is one mapping away from
   * becoming a hundred-megabyte POST, and outbound is the direction data exfiltrates in. The egress
   * guard already decides *where* a request may go; this decides how much may go there.
   *
   * Absent falls back to the runner's own default rather than to "unbounded", because a connection
   * written before this field existed must not be the one connection with no ceiling.
   */
  maxRequestBytes?: number;
  /**
   * Allow plain `http://` **and a host on a private or loopback address**.
   *
   * Self-hosted deployments only, and ignored in cloud, where nothing private is reachable from the
   * fleet anyway. The private-address half was added in 3.10.0: until then the flag lifted only the
   * scheme, which left the boundary backwards - a self-hosted tenant could not point an `HTTP` state
   * at their own intranet, the one thing this flag exists for, while `web.fetch`, which runs on the
   * *platform's* credentials, could. It now means on an `HTTP` connection exactly what it already
   * meant on an `MCP` one.
   */
  allowInsecure?: boolean;
}

/** `MCP` connection settings. */
export interface WorkflowMcpConnectionSettings extends WorkflowConnectionCommonSettings {
  /** Absolute URL of the MCP server endpoint. */
  serverUrl: string;
  maxResponseBytes: number;
  /**
   * Tools the tenant approves from this server, by name. Empty or absent means every tool the
   * server advertises; an `AGENT` may narrow this further, never widen it.
   */
  allowedTools?: string[];
  /**
   * Allow plain `http://` and a server on a private or loopback address.
   *
   * Self-hosted deployments only: an MCP server running as a sidecar of the tenant's own stack is
   * the ordinary shape for MCP, unlike an `HTTP` state pointed at a private address. Ignored in
   * cloud, where nothing private is reachable from the fleet anyway.
   */
  allowInsecure?: boolean;
}

/** `SMTP` connection settings. */
export interface WorkflowSmtpConnectionSettings extends WorkflowConnectionCommonSettings {
  host: string;
  port: number;
  /** Implicit TLS (typically `465`); `false` still upgrades through STARTTLS when offered. */
  secure: boolean;
  /** Envelope sender used when a message carries none. */
  fromAddress: string;
}

/** `SFTP` connection settings, shared by the file capabilities and by `ssh.exec`. */
export interface WorkflowSftpConnectionSettings extends WorkflowConnectionCommonSettings {
  host: string;
  port: number;
  /** Directory every path is resolved against, so a workflow stays inside its own tree. */
  basePath: string;
  /**
   * Ceiling on what one operation may bring back: the bytes of a `file.get`, and the combined
   * output of an `ssh.exec`. A remote file is a size the workflow never chose, so without this a
   * single `file.get` on the wrong path is an out-of-memory failure of the whole run.
   */
  maxResponseBytes: number;
  /**
   * Shell the account's SSH session opens with, which decides how an argument is quoted.
   *
   * Absent means `POSIX`, because that is what every Unix host answers with and what most tenants
   * will point this at. Declaring it wrong is not a cosmetic error: the quoting stops being a
   * guarantee, which is the one thing holding `ssh.exec` together.
   */
  shell?: WorkflowShellDialect;
  /**
   * Commands `ssh.exec` may run on this host, matched against the **first word** of the command.
   *
   * Absent or empty means **nothing runs**, which is the opposite default to `allowedTools` on an
   * MCP connection and deliberately so: a tool catalogue is a list of things somebody already built
   * for agents to call, while a shell is every program on the machine. Handing an agent an unlisted
   * shell is not a smaller version of that risk, it is the whole of it, so the tenant has to name
   * what they are allowing.
   */
  allowedCommands?: string[];
}

/** A `DATA` engine reached on a host and a port. */
export interface WorkflowDataServerSettings {
  host: string;
  port: number;
  /**
   * What to open on the server: a database on a relational or document engine, and whatever plays
   * that part on the ones that are not. Kept as `databaseName` because that is what it is for every
   * engine of this kind; on Oracle it is the **service name** the listener registers, which is the
   * one place the word is doing double duty and the editor's help says so.
   */
  databaseName: string;
  /**
   * Schema unqualified names resolve against, where the engine has one. On Oracle it must be
   * written exactly as the server stores it - an unquoted `CREATE USER dcdr` is held as `DCDR` -
   * because the runner quotes it, and quoting is what stops a name from becoming a statement.
   */
  schema?: string;
}

/** A `DATA` engine reached over HTTP, where the query travels in a request body. */
export interface WorkflowDataHttpSettings {
  /** Absolute base URL of the endpoint. */
  baseUrl: string;
  /** Database, index or equivalent the query runs against; the engine's default when absent. */
  databaseName?: string;
  /** Allow plain `http://` (self-hosted deployments only; ignored in cloud). */
  allowInsecure?: boolean;
}

/**
 * A `DATA` engine that is a managed warehouse, reached through its own API.
 *
 * Every field here is optional because no two of these agree on which ones exist - Snowflake wants
 * an account, a warehouse and a role, BigQuery a project and a location, Databricks a workspace host
 * and the HTTP path of a SQL warehouse - and inventing a shared vocabulary they do not have would
 * only move the confusion into the editor. Which of them an engine actually requires is the
 * engine's own business, checked where it is used.
 */
export interface WorkflowDataWarehouseSettings {
  /** Workspace or endpoint host, for the warehouses that have one. */
  host?: string;
  /** Account identifier (Snowflake) or project id (BigQuery). */
  account?: string;
  /** Compute the query runs on: a Snowflake warehouse, a Databricks SQL warehouse path. */
  warehouse?: string;
  /** Role the query assumes, where the engine supports one. */
  role?: string;
  /** Database or dataset. */
  databaseName?: string;
  /** Schema, where the engine has one. */
  schema?: string;
  /** Region or location, where the engine needs one to route the query. */
  region?: string;
}

/**
 * `DATA` connection settings.
 *
 * One connection is one store, read through one account. There is no "run anything anywhere" shape
 * here on purpose: the tenant grants a store, and the account they grant it with is the real
 * boundary - everything the runner enforces on top of it is a second lock on a door the tenant
 * should have locked, not a substitute for locking it.
 *
 * The ceilings and the engine sit at the top because they mean the same thing everywhere; how the
 * engine is *reached* lives in exactly one of the three blocks below, matching
 * `WORKFLOW_DATA_ENGINE_KINDS[engine]`.
 */
export interface WorkflowDataConnectionSettings extends WorkflowConnectionCommonSettings {
  engine: WorkflowDataEngine;
  /** Rows one query may return, whatever it asks for. */
  maxRows: number;
  /** Bytes the serialised result may reach; a row count says nothing about a row's width. */
  maxResponseBytes: number;
  /**
   * Wall-clock budget handed to the **server**, so a heavy query is cancelled where it is running
   * rather than abandoned here. A client that merely stops waiting leaves the query burning the
   * tenant's own store, which is the failure mode that turns one bad workflow into an incident.
   */
  statementTimeoutMs: number;
  /** Require TLS. */
  ssl?: boolean;
  /**
   * Tables, views, collections or indices the query may name. Empty or absent means the account's
   * own grants are the only boundary, which is the honest default: a name allowlist over arbitrary
   * SQL is a parser pretending to be a permission system, and the tenant's `GRANT` is the real one.
   */
  allowedRelations?: string[];

  /** Exactly one of these, matching the engine's kind. */
  server?: WorkflowDataServerSettings;
  http?: WorkflowDataHttpSettings;
  warehouse?: WorkflowDataWarehouseSettings;
}

/**
 * Settings of a connection: exactly one block, matching its `protocol`.
 *
 * Shaped like `WorkflowState` (one optional block per type) rather than as a union, so it follows
 * the same discrimination rule the rest of this contract uses.
 */
export interface WorkflowConnectionSettings {
  http?: WorkflowHttpConnectionSettings;
  mcp?: WorkflowMcpConnectionSettings;
  smtp?: WorkflowSmtpConnectionSettings;
  sftp?: WorkflowSftpConnectionSettings;
  data?: WorkflowDataConnectionSettings;
}

/** Settings block a protocol must fill, mirroring `WORKFLOW_STATE_CONFIG_FIELDS`. */
export const WORKFLOW_CONNECTION_SETTINGS_FIELDS: Record<WorkflowConnectionProtocol, keyof WorkflowConnectionSettings> = {
  [WorkflowConnectionProtocol.HTTP]: "http",
  [WorkflowConnectionProtocol.MCP]: "mcp",
  [WorkflowConnectionProtocol.SMTP]: "smtp",
  [WorkflowConnectionProtocol.SFTP]: "sftp",
  [WorkflowConnectionProtocol.DATA]: "data",
};
