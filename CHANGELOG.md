# Changelog

This changelog is automatically generated from the runtime release process.
Entries show the changes introduced in each published build.
Labels indicate the affected area: <kbd>RUNTIME</kbd> or <kbd>CONTRACTS</kbd>.

## [20260911.6] — 14:23UTC

<!--
sourceCommit: 73564a164206d21b4f4e0c1407adc5037bbc65a8
queuedAtUtc: 
previousMirroredBuild: 20260911.3 (2026-09-11)
contractsSubmodule: 9cdd82edef43..443879f2442f
-->

### Removed
- <kbd>CONTRACTS</kbd> v3.9.0 **(breaking, authorized)** — **`IntentProvider.OCR`, `CLIP` and `HTTP_TOOL` are retired.** Same shape of gap as the S3 and NAS ones, found the same way - by asking what is actually behind a value the UI can offer. `provider.executor.service.ts` dispatches seven providers; these three fell through to the default and threw `NO_CONFIG: Provider not implemented yet`, and their catalogue builders all returned `[]`, so the editor could offer a provider with zero models that was guaranteed to fail. They are not unfinished work: `HTTP_TOOL` is the workflow `HTTP` state and the `TOOL` capabilities, `OCR` is a multimodal model reading a document through `inputParts`, and `CLIP` was embeddings the platform has never done. Authorized by the owner on 2026-09-11 after confirming nothing is stored under them and the admin UI does not offer them. Removing an enum member is breaking while re-declaring one is additive and free, so it lands in the release that was already breaking. `RULES` is kept and re-documented: it is **not a provider** but the marker reported when no provider executed the call, which is load-bearing in fourteen places in `run.service.ts` alone.
- <kbd>RUNTIME</kbd> The remote demo reported `HTTP_TOOL` as the provider of an answer no provider produced; it now reports `RULES`, which is what that field means.
### Added
- <kbd>RUNTIME</kbd> **A parked run keeps its state outputs.** `workflow-runner.payload-assets.service.ts` stores a checkpointed output in the tenant's own asset storage and leaves a `WorkflowRunnerPayloadAssetRef` in the run history; `rehydrateWorkflowStateOutputs` puts the value back before the first state runs on resume, verifying the SHA-256 first. This closes a bug that was silent and **on by default**: `payloadLogging` defaults to `METADATA`, which replaced a checkpointed output with `{ type, bytes }`, and that stub was what the resume snapshot carried - so a workflow that waited on a human task, an approval or a delay and afterwards read an earlier state's output resumed with `undefined`. Nothing failed; the run continued on missing data. Only **outputs** take this path: a state's input is observability, derivable from the references that produced it, and nothing resumes from it. The storage is not chosen by the runner - it sends no `storageId`, so the runtime resolves the tenant's own default from their entitlements and falls back to the platform's, the same rule every other asset follows. A failed upload is never fatal: the run falls back to the stub, which is exactly what it did before this existed. A digest that does not match on read **is** fatal, because resuming on the wrong bytes is worse than not resuming.
### Fixed
- <kbd>RUNTIME</kbd> `extractAuthToken` now reports a request that carries two **different** credentials, naming the slots they came from and never the values. The precedence itself is unchanged and correct - the bearer wins - but it is silent, so a client sending a session bearer alongside an API-token header was authenticated with the bearer and then rejected with a message blaming the credential it was not thinking about. The same shape cost three debugging attempts on a test whose fake bearer was shadowing a perfectly good `token` header. The same credential arriving twice is redundancy, not a conflict, and stays quiet. Covered by `tests/services/security.auth-token-precedence.test.ts`, which also pins that a non-bearer `Authorization` (Basic) is not treated as a DCDR credential.
- <kbd>CONTRACTS</kbd> **Submodule pointer bumped to `@dcdr/contracts` 3.9.0** (`9cdd82edef43` → `443879f2442f`). The release carries: the tenant workflow client (`DcdrWorkflowClient`) and `DcdrClient` over both surfaces; the full service-token scope vocabulary with `hasDcdrServiceTokenScope`; the `WorkflowDefinition.input` → `inputSchema` rename; `WorkflowRunnerAssetAccess` / `WorkflowRunnerPayloadAssetRef` for payloads kept outside the run history; and the retirement of `IntentProvider.OCR`, `CLIP` and `HTTP_TOOL`. Two breaking changes, both authorized — see the bullets below and `src/contracts/CHANGELOG.md`.
- <kbd>CONTRACTS</kbd> v3.9.0 — **`DcdrWorkflowClient` and `DcdrClient`.** The tenant workflow API (`/api/dcdr/workflows/*`) gets the typed client the runtime has had since 1.0: catalogue, run, follow, steps, evidence, report, tasks, cancel, resume, plus `runWorkflowAndWait` (start + geometric-backoff polling) as the single call most integrations need. `DcdrClient` composes it with `DcdrRuntimeClient` for the common case of one bearer reaching both, each half built on first use so neither is a prerequisite of the other. Deliberately **not** built on `/api/ai_workflows*`: that is the web UI's API - session auth, per-entity ACLs and the datatable's `filterBy_N_c_1_match` filter DSL - and publishing it would have frozen all of that as public contract and handed a machine a credential it cannot hold. Authoring is absent for the same reason a run token is not a write token: a definition names intents, connections, allowed hosts and allowed shell commands.
- <kbd>CONTRACTS</kbd> v3.9.0 — **the service-token scope vocabulary is published in full**, with `hasDcdrServiceTokenScope` as the single comparison point. The enum carried only `gateway` while the real list lived in `interfaces/entities/dcdr/DcdrContractConfig.ts`, so the vocabulary existed in two places and nothing compared them. `workflows:read` and `workflows:write` join it; the second is reserved with no endpoint behind it, published now because a scope renamed later is a scope every issued token must be re-minted for. The backend keeps its own copy until 3.9.0 is installed there, with the removal noted in place.
- <kbd>RUNTIME</kbd> **A tenant workflow API, `/api/dcdr/workflows/*` (equivalo-backend).** One credential - a managed service token, whose `cid` is the tenant - and no session branch at all, so an internal operator has no door in rather than a denied one. Addressed by workflow **key**, never by an internal UUID; stable DTOs rather than entity rows, so `permissions`, `history` and the relation graph stay ours; `{ items, nextCursor }` keyset paging, because runs are append-only and offset paging over a table that grows while you read it skips rows. `run/:key` and `trigger/:key` are the same endpoint under both names the product uses. A workflow's definition is never served - only its `inputSchema` and `outputSchema`, which is its interface rather than a description of the tenant's infrastructure.
- <kbd>CONTRACTS</kbd> v3.9.0 **(breaking, authorized)** — `WorkflowDefinition.input` becomes **`inputSchema`**. It declares the *shape* of a run's input exactly as `outputSchema` declares the shape of its output, and naming it `input` made it read like the run's values - which is precisely what `subworkflow.input` and the `input` reference root are, one level down. No back-compatible parse and no migration: nothing is running on it yet, so the fixtures, the example, the docs, the backend's two readers and the two frontend editors were rewritten in the same change. `WorkflowRefRoot.INPUT` keeps its `"input"` wire value, because that one really is the values.
- <kbd>CONTRACTS</kbd> v3.9.0 — `WorkflowRunnerAssetAccess` on the run input, and `WorkflowRunnerPayloadAssetRef` with its `isWorkflowRunnerPayloadAssetRef` guard. Together they let a step payload live in the tenant's own asset storage instead of the run history, which is what a tenant asking us not to persist payloads actually wants - and what stops the engine losing the value at the same time.
- <kbd>RUNTIME</kbd> The backend mints an asset session for every tenant run (`buildWorkflowRunnerAssetAccess`) and hands it out with the input. It carries **no scopes at all**, which is the least-privilege choice rather than an oversight: the runtime enforces scopes only for intent execution - `isIntentAllowedByScopes` returns `false` for an empty list - while the asset routes accept any valid customer session and take the tenant from it. So the token can write that tenant's assets and cannot execute a single intent. Which storage it lands in stays the runtime's decision, from the tenant's entitlements: their own default, the platform's when they have none.

## [20260911.3] — 02:20UTC

<!--
sourceCommit: 119d82fb1979b9d4e19383090a707ee5a1ff94c4
queuedAtUtc: 
previousMirroredBuild: 20260910.5 (2026-09-10)
contractsSubmodule: 147c96dee9aa..9cdd82edef43
-->

### Fixed
- <kbd>RUNTIME</kbd> `jest.config.cjs` sets `workerIdleMemoryLimit: "1GB"`, so a worker that grows past it is recycled between suites. CI was losing a run to the kernel's OOM killer, not to a failing test: one pass died with `exit 137` on the whole step, the next reported `Test suite failed to run - signal=SIGKILL` against whichever suite happened to sit in the heaviest worker, which is why the named suite moved between runs and passes locally. The mismatch is the container one - jest sizes its pool from `os.cpus()`, which reports the *host* cores, while the memory limit is the *cgroup's* - and `coverageProvider: "v8"` makes it worse, since a worker holds the coverage of every suite it has run and never gives it back. Recycling is the half that belongs in the repo; capping `--maxWorkers` belongs in the pipeline, where the container's real limit is known.
### Removed
- <kbd>CONTRACTS</kbd> v3.8.0 **(breaking, authorized)** — **SMB / NAS is retired.** `AssetStorageCredentialsKind.NAS_BASIC`, `AssetStorageNasBasicCredentials`, the `nasBasic` field and `ExecutionAssetDatasourceType.NAS` are gone, along with the backend's normalizer branch, the datasource switch case and the admin editor's option. Measured before deciding rather than assumed: every Node SMB client is unmaintained (`@marsaud/smb2`, `smb2`, `v9u-smb2` last published in 2022), and `node-smb2`, the only one with recent activity, speaks **SMB2 only** - a NAS configured SMB3-only will not answer it - and pulls `moment` plus `moment-timezone` for **9.7 MB** of node_modules. Over a WAN a tenant needs a VPN to expose a NAS at all, and inside that VPN SFTP does the same job with a client that is alive. No stored data is affected: the kind was disabled in the editor from the day it was declared. See `RM-054`.
- <kbd>RUNTIME</kbd> A credentials payload naming a kind the runtime has no descriptor for is still refused cleanly with `UNSUPPORTED_OPERATION` rather than crashing. That branch had lost its only subject when FTP was implemented and NAS removed, and it is not hypothetical: it is what an older runtime sees from a newer backend, and what a storage stored before a kind was retired now looks like.
### Added
- <kbd>CONTRACTS</kbd> v3.8.0 — **asset storage providers are described in the contract.** `storage.providers.contract.ts` publishes, per credential kind, the fields a storage needs - each with its **dotted path** into `AssetStorageCredentialsContract` (`s3AccessKey.accessKeyId`, `endpoint`), a requirement of `REQUIRED` / `OPTIONAL` / `ONE_OF`, and a `secret` flag - plus `validateAssetStorageCredentials`, `ASSET_STORAGE_PROVIDERS` and `ASSET_STORAGE_IMPLEMENTED_CREDENTIAL_KINDS`. The dotted path is what makes a generic form and a generic validator possible over a payload neither has to understand field by field. This is the root cause of the S3 gap rather than a tidy-up after it: "what we support" lived in the runtime's normalizer, in the admin editor's form and in a markdown table, and nothing compared the three, so the editor could offer MinIO and R2 for months while the runtime had only Google's client. The S3 endpoint presets move here too, each carrying the template that **builds** an endpoint and the pattern that **recognises** one, because the editor hand-wrote both directions and they had already drifted.
- <kbd>CONTRACTS</kbd> v3.8.0 — `SFTP_KEY` credentials and `ExecutionAssetDatasourceType.SFTP`. The credential contract is what settles which protocol `FTP_BASIC` means: it carries `passive`, which exists only in FTP. SFTP is an SSH subsystem with no passive mode and no plaintext variant, so it needed its own kind before the adapter - written and proven against a real server days ago - could be reached by a configured storage at all. `password` and `privateKey` are alternatives, and the key wins when a storage carries both, since that storage is one mid-rotation where the key is the new half.
- <kbd>RUNTIME</kbd> **SFTP asset storages work end to end.** `ManagedStorageClientConfig` gains an `SFTP` member, `normalizeManagedStorageClientConfig` resolves `SFTP_KEY` (logging which half of the credential is in play, because "it authenticated" and "it authenticated the way you configured" are different facts), and the client factory builds the adapter. As with FTP there are no buckets: the container is the directory assets are written under.
- <kbd>RUNTIME</kbd> **The base image now carries the SSH client** (`ssh2` + `ssh2-sftp-client`, 2.4 MB) despite `--omit=optional`. Asset storage is served *here* - `/api/assets/*` is a runtime route, not a workflow-runner one - so a tenant with an SFTP storage configured would otherwise meet a configuration error naming a package nobody asked them to install. The rest of the transport clients stay optional.
- <kbd>CONTRACTS</kbd> v3.8.0 — **the workflow contract is split by protocol.** `workflow.connections.contract.ts` owns the transports, their settings blocks and the secret names; `workflow.capabilities.contract.ts` owns the capability catalogue; `workflow.contract.ts` keeps the state machine. Re-exported from the barrel, so nothing that imports today changes. The three had been one 4,100-line file where adding a transport meant editing the definition contract. The re-exports live in `index.ts` and not in the module, because `check-no-barrel-cycles` refuses an `export *` in a module that has exports of its own.
- <kbd>CONTRACTS</kbd> v3.8.0 — `web.fetch` and `chat.post` join the catalogue; `mail.send` gains `bcc`, `replyTo` and a `rejected` output; `file.put` / `file.get` / `file.list` / `ssh.exec` are declared over `SFTP`. `WorkflowSftpConnectionSettings` gains `maxResponseBytes` and `allowedCommands` (empty means **nothing runs**). `WorkflowCapability.requiresEndpoint` separates a platform service from a platform credential — `web.search` needs an engine we operate, `web.fetch` needs only our egress, and a runner that demanded an endpoint for both would refuse a valid grant. `SMTP` and `SFTP` join `WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS` now that adapters exist behind them.
- <kbd>CONTRACTS</kbd> v3.8.0 — a **`DATA`** transport and `db.query`. Not `SQL` and not `DATABASE`: the query language belongs to the engine, and the same connection is meant to reach an analytics warehouse, a cache or a search index later, both of which those names would already be too narrow for. `WorkflowDataEngine` declares six engines and `WORKFLOW_DATA_IMPLEMENTED_ENGINES` says which run today. Three ceilings on the settings (`maxRows`, `maxResponseBytes`, `statementTimeoutMs`) because a row count says nothing about a row's width, and neither says anything about how long the server spends finding them.
- <kbd>RUNTIME</kbd> **`db.query` adapter** across **six engines** - PostgreSQL, MySQL, MariaDB, SQL Server (`tedious`), Oracle (`oracledb` thin mode) and MongoDB - streaming rows so the cap is a cap rather than a slice taken after the whole result is already in memory. One module per family (`.data.sql`, `.data.mongo`) behind one dispatcher, so a seventh engine is a driver and a table entry. Four layers stop a write, and the file names them in the order they are trusted: the **account's own grants** (the only one that does not depend on us being right), a **read-only transaction** the server enforces, a **server-side statement timeout**, and only then the statement guard. That order is not rhetorical — measured against a real server, **`pg` with no bind parameters uses the simple query protocol and really does run `SELECT 1; INSERT INTO t VALUES (99)`**, insert included, so a guard that assumed the driver only ever runs one statement would have been wrong on the most common engine.
- <kbd>RUNTIME</kbd> `db.query` masks comments and quoted text (including PostgreSQL dollar quoting and doubled quotes) before reading a single keyword, so `WHERE note = 'please DELETE me'` is an ordinary query and `SELECT 'a;b'; DELETE FROM t` is not. Parameters are always bound; a decimal stays a string rather than becoming a float that silently changes a number a workflow is about to act on; dates come back as ISO strings so a `CHOICE` compares what the model saw.
- <kbd>RUNTIME</kbd> **The read-only guarantee is layered, and honest about where it is thinner.** PostgreSQL, MySQL, MariaDB and Oracle run every query inside a **read-only transaction** the server enforces; **SQL Server and MongoDB have no equivalent**, so on those two the account's own grants carry the weight alone and the documentation and the connection help say so rather than implying a lock that is not there. On every engine the tenant's `GRANT` remains the only layer that does not depend on our parser being right, which is why the E2E containers seed a restricted account and prove it refuses a table the guard was perfectly happy with.
- <kbd>RUNTIME</kbd> Six database containers in the E2E stack (PostgreSQL 16, MySQL 8.4, MariaDB 11, SQL Server 2022, Oracle Free 23ai, MongoDB 7), each seeding a reporting schema and a **read-only account**. They corrected eight beliefs a fixture would have preserved: pg's `query_timeout` is a trap (it replaces the query's callback, and `Query.handleError` then calls that *instead of* emitting `error`, so a failing streamed query never settles and the run hangs); MariaDB reports an interrupted statement with **no `code` at all**, only `errno` 1969, where MySQL says `ER_QUERY_TIMEOUT`/3024, Oracle `NJS-123` and SQL Server `ELOGIN` for a refused login with no `number` at all; `SELECT SLEEP(10)` is the one query MySQL does not raise on when it cuts it (`SLEEP` returns `1` as an ordinary row, so that query proves the opposite of what it appears to); Oracle folds an unquoted identifier to upper case, so a quoted schema name must be written as the server stores it; and **`ORA-00942` deliberately means either "no such table" or "you may not see it"** - Oracle refuses to distinguish them so nobody can enumerate a schema they have no rights to, and the adapter says so instead of guessing.
- <kbd>RUNTIME</kbd> **What a workflow *sends* is bounded now, not only what it receives.** Every adapter capped its response from the first day and nothing capped its request, which is the direction that matters more on two counts: an outbound body is built from earlier states, so a hundred-megabyte query result is one mapping away from becoming a hundred-megabyte POST, and outbound is the direction data exfiltrates in. Three holes of the same shape, found by auditing the set rather than by any of them failing:
- <kbd>RUNTIME</kbd> `HTTP` states get `maxRequestBytes` on the connection (`HTTP_REQUEST_TOO_LARGE`), checked **before the socket opens** - half a body on the wire is still a body on the wire. Absent falls back to the runner's 5 MiB rather than to "unbounded", so a connection written before the field existed is not the one connection with no ceiling.
- <kbd>RUNTIME</kbd> A backstop on capability **arguments**, checked once in the dispatcher rather than in each adapter, because a rule every capability needs is a rule the next capability will forget. It is deliberately not the real limit - `mail.send` caps its body, `chat.post` its text, `db.query` its result - it is the floor under the cases nobody wrote a policy for: a statement, a filter document or a command line measured in megabytes. Raised to the connection's own ceiling where it declares a larger one, so a tenant who allowed hundred-megabyte files is not overruled by a platform default.
- <kbd>RUNTIME</kbd> `web.search` gets a response ceiling. It was the one axios call in the runner without one, on the grounds that we operate the instance ourselves - which is exactly the assumption the MCP work taught us not to make, and an engine answering with a hundred megabytes of JSON is a bad deployment rather than an attack with the same outcome either way.
- <kbd>CONTRACTS</kbd> v3.8.0 — **tool calls are rated, not just counted.** A flat unit per call undercounts unevenly, so `rateWorkflowToolCall` prices one against a versioned bucket matrix: base one credit, multiplier capped at four, the 1x boundary of every ladder set to the connection's own default ceiling so an out-of-the-box connection stays a one-credit connection. `WorkflowRunnerUsage.tools` carries **two** counters, raw `calls` and weighted `credits`, mirroring `maxCallsPerMonth` beside `maxTrackedCallsPerMonth` — a ceiling on either alone is gameable through the other. Rated **per call as the run goes**, never from a run's totals: ten calls of six hundred rows are ten one-credit calls, and rating six thousand rows once would charge two for the same work.
- <kbd>RUNTIME</kbd> Every adapter reports **what it moved** (`WorkflowCapabilityExecution.measurement`) rather than the host guessing it from each capability's output shape: rows and bytes for `db.query`, bytes for `file.*` and `ssh.exec`, the accepted envelope for `mail.send`. A failed call reports nothing and costs the base, which is right — resolving the connection and running the guard happened, and nothing crossed the wire.
- <kbd>CONTRACTS</kbd> v3.8.0 — **a second export gap, found by the audit written for the first one.** `ExecutionAssetStorageOwner` was reachable from the package-root barrel and missing from the one that compiles into `dist`, so the runtime used it as a value while every consumer of the published package — including 3.7.0, already out — received `undefined`. There are two barrels: `src/index.ts` becomes `dist` and is what `main`, `types` and `exports` all point at, while the root `index.ts` is what this repository's own path mapping resolves. A module added to one and not the other compiles cleanly here and is broken for everyone else. `workflow.barrel.contract.test.ts` now walks every contract module and asserts each runtime export reaches the published barrel; it found exactly one gap across the package, which is this one.
- <kbd>CONTRACTS</kbd> v3.8.0 — **the package entry point re-exports the split workflow modules again.** Moving the transports and the capability catalogue out of `workflow.contract` left `index.ts` without them, and nothing failed: TypeScript resolves the types through the package subpaths, so this repository, the backend and the frontend all compiled while `require("@dcdr/contracts").WorkflowConnectionProtocol` was `undefined`. The first symptom would have been a `TypeError` in a tenant's run, after publishing. `tests/workflow.barrel.contract.test.ts` now asserts every value a consumer imports by name is actually on the barrel - types cannot be checked at run time, and it is exactly the values that went missing.
- <kbd>RUNTIME</kbd> **`ssh.exec` quotes for the shell the connection declares.** `shellQuote` had one implementation and it was POSIX's; against a Windows host with PowerShell as the account's SSH shell it silently stopped being a guarantee, which is the one thing holding this capability together. The dialect now comes from `WorkflowSftpConnectionSettings.shell`, and the assembled line differs in two more ways that would each have produced a wrong answer rather than an error: **`&&` is a parser error in Windows PowerShell 5.1**, so the command uses `Set-Location -LiteralPath …; if ($?) { … }`; and **PowerShell does not propagate a native command's exit code** to the session, so it ends with `exit $LASTEXITCODE` - `ssh.exec` reports a non-zero exit as a *result* a workflow branches on, and a swallowed code is a branch quietly taken the wrong way. Verified against PowerShell 7 in a container: an argument carrying `'; Write-Output PWNED; #` printed as literal text and `$env:PATH` was not interpolated.
- <kbd>RUNTIME</kbd> **Capability adapters, one module per protocol** under `src/workflow-runner/capabilities/`: `.web` (`web.search`, `web.fetch`), `.chat` (`chat.post`), `.mail` (`mail.send`, nodemailer), `.files` (`file.*` and `ssh.exec`, `ssh2-sftp-client` and `ssh2`). `workflow-runner.capabilities.service.ts` keeps resolution and dispatch and re-exports every public name, so the host and the existing suites are untouched. Adding a transport is now an adapter and a line in a table, not another branch in a file that knows about search engines, mail relays and shells at once.
- <kbd>RUNTIME</kbd> `TOOL` states now resolve **connection secrets** for `CONNECTION`-brokered capabilities, through the same per-run `connectionSecrets` path an `HTTP` state and an MCP server use — fetched only when the capability actually spends a tenant credential, so a run that never reaches the state never asks for one.
- <kbd>RUNTIME</kbd> **`web.fetch` follows redirects by hand, re-guarding every hop, and resolves through an agent that refuses a private address at connect time.** Guarding only the URL the workflow wrote is not enough twice over: a public page answering `302 http://169.254.169.254/` is how an allowlisted fetcher reads cloud credentials, and the gap between a resolution check and the socket is DNS rebinding. Every resolved address is checked, not the first, so a name answering with one public and one private address is refused instead of raced.
- <kbd>RUNTIME</kbd> **`ssh.exec` is deny-by-default and stays that way under a hostile caller.** The command must be a single word (an allowlist that reads the first word is meaningless against `ls; curl evil.example`), that word must be in the connection's `allowedCommands`, every argument is single-quoted, a wall-clock budget destroys the session (a command that runs forever connects instantly, so a connect timeout covers nothing), and stdout and stderr share a ceiling applied per chunk. The E2E proves the quoting against the host's own answer: `echo` prints `hello; touch /tmp/pwned` and the file does not exist afterwards.
- <kbd>RUNTIME</kbd> **`mail.send` cannot be turned into a mailer for somebody else.** CR and LF are stripped from the subject and reply-to (`Subject: Report
Bcc: …` is how a message acquires invisible recipients), each address must be a single mailbox, 50 recipients is the ceiling across `to`+`cc`+`bcc`, and the sender and the TLS setting are the connection's and never the message's. The relay host and the SFTP host are checked against the connection's own `allowedHosts` like every `HTTP` destination already was — a descriptor is data that arrived over the network.
- <kbd>RUNTIME</kbd> **A container per protocol for the tests** (`tests/e2e/capabilities/`): a repo-run web/webhook server, Mailpit with and without AUTH, and a purpose-built alpine OpenSSH host offering both the SFTP subsystem and a real shell, generating its key pair on start so no private key lives in the repository. The first run corrected six beliefs a fixture would have preserved — `ssh2-sftp-client` v12 takes a filter *function* where v11 took a glob string (type-checks either way, throws at run time), a directory entry's type is `-` and not `FILE`, `modifyTime` is epoch milliseconds, a relay refusing an unauthenticated message reports `530` as an *envelope* failure rather than `EAUTH`, `accepted` is the envelope and carries `cc`/`bcc`, and an empty path resolved against a webhook base URL appends a slash that turns delivery into a 404. All recorded in `internal_docs/WORKFLOW_CAPABILITY_E2E.md`.
- <kbd>RUNTIME</kbd> **`npm run clients:check`** reports the pinned version of every protocol client (`@modelcontextprotocol/sdk`, `nodemailer`, `ssh2`, `ssh2-sftp-client`, `axios`, `pg`, `mysql2`) against what is published, and the repo instructions make that a monthly review: falling behind on one of these is a protocol revision we cannot speak or an unpatched advisory in a library holding an SSH session open, not a style question. Its first run found nodemailer three majors behind — upgraded to `nodemailer@^10.0.3`, `ssh2-sftp-client@^12.1.1` and `axios@^1.20.0`, with the whole connector E2E suite green on the new versions.

## [20260910.5] — 09:05UTC

<!--
sourceCommit: 82b56a2069043b5cae8e3065e04cb2bbfbe26b83
queuedAtUtc: 
previousMirroredBuild: 20260910.3 (2026-09-10)
contractsSubmodule: 750c070ba25d..147c96dee9aa
-->

### Added
- <kbd>CONTRACTS</kbd> v3.7.0 — the MCP tool kind is completed and `MCP` joins `WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS`, so the editor can create an MCP connection. `WorkflowAgentTool.connection` / `.tools` say which server an agent reaches and which of its tools it exposes, with validation refusing an `inputSchema` on that kind — the argument shape belongs to the server and is only known once discovery ran, so declaring one would hand the planner the wrong one. `listWorkflowMcpConnections` exists because `listWorkflowConnections` walks the states and an MCP server is named inside an agent's catalog: without it the control plane hands the runner a run with no descriptor for the server, and every discovery fails looking like a tenant misconfiguration. `WorkflowMcpConnectionSettings.allowInsecure` allows plain `http://` and a private address for self-hosted deployments, because an MCP sidecar on the tenant's own stack is the ordinary deployment for MCP where the same address behind an `HTTP` state would be an exfiltration route.
- <kbd>RUNTIME</kbd> **MCP client** `src/workflow-runner/workflow-runner.mcp.service.ts`, rebuilt on the official `@modelcontextprotocol/sdk`. The protocol is not the hard part; keeping up with a moving revision and with the transports servers actually deploy is a permanent cost that buys nothing, and the SDK gives us SSE, which a plain POST client cannot talk to at all. What stays ours is the part that decides what a tenant is exposed to, described in the four bullets below and in `internal_docs/WORKFLOW_MCP.md`.
- <kbd>RUNTIME</kbd> MCP: **two allowlists, intersected, never unioned.** The connection's `allowedTools` is the tenant's grant; an agent's `tools` narrowing can only restrict further inside it. A union would let a workflow author reach a tool the tenant never approved. The tool name is also **re-checked before the call**, not trusted from discovery: the name is produced by the planner, which is a language model, and a name it invented must never reach the server.
- <kbd>RUNTIME</kbd> MCP: **the endpoint is guarded at resolution, not at call time** (`MCP_ENDPOINT_REFUSED`): https unless `allowInsecure`, no credentials in the URL, host inside the connection's `allowedHosts`, no private or loopback address. Resolving early is deliberate — a refused endpoint has to keep its tools out of the planner's catalog entirely, rather than failing once the planner has already chosen one and spent iterations on it. Without the host check an MCP connection would have been a way around the egress guard `HTTP` states are held to.
- <kbd>RUNTIME</kbd> MCP: **a response ceiling** (`MCP_RESPONSE_TOO_LARGE`). A tool answer is handed back to the planner as an observation and travels in every later prompt of the loop, so an unbounded answer is a context-window failure and a bill, not just a big payload. It is refused rather than truncated, because half a content block is not something a planner can reason about.
- <kbd>RUNTIME</kbd> MCP: **a session per operation.** A runner executes one run at a time and an agent loop can idle for minutes between calls, so nothing is held open.
- <kbd>RUNTIME</kbd> **One MCP entry becomes N planner-visible tools.** `expandCatalog` in the agent loop discovers a server's catalog once per loop — not once per iteration, since a catalog does not change mid-run and asking again would add its latency to every turn — and offers each remote tool to the planner under `<entry>__<tool>`, carrying the **server's own** description and argument schema rather than the workflow's description of the server. Discovery failure is survivable: a dead server contributes no tools and the loop continues with whatever else it has, which is what an agent should do when one source is down. An MCP call is recorded as evidence (`mcp:<connection>/<tool>`) like any other outbound action, and its credentials are fetched per run through the same `connectionSecrets` path an `HTTP` state uses.
- <kbd>RUNTIME</kbd> Every MCP operation logs into the **run's** log, not only the runner's stdout: what was asked, how long it took, how many blocks and bytes came back, and why a call was refused. An MCP call reaches third-party code we broker, so a run has to stay explainable from its own log. Two of those lines are warnings on purpose - a server whose whole catalog was filtered out by the allowlists (an agent about to run its entire loop with no tools, which reads as a model failure and is a configuration one) and a planner naming a tool it may not call.
- <kbd>RUNTIME</kbd> Two properties of the `AGENT` loop are now pinned by tests rather than merely true: the **summarizer receives no tool catalog** (a summarizer that could call tools would be a second, unbounded agent inside the first, whose calls escape the loop's budget and whose decisions are never traced), and the **whole trace survives for audit** while `historyWindow` narrows only what the planner is shown - the window is a context-size decision, not a retention one.
- <kbd>RUNTIME</kbd> **A real MCP server for the tests**, `tests/e2e/mcp/server/server.cjs` (with `tests/e2e/mcp/docker-compose.yml`), built on the same SDK and exposing five tools chosen for what the client must survive: a normal call, a second tool so narrowing has something to narrow, one that reports `isError`, one that sleeps past the timeout, and one that answers with an arbitrary number of bytes. A stubbed transport can only prove the client is consistent with what we *believe* a server does; this proves the belief — the handshake, the revision negotiation, the response envelope and the error shape are the SDK's real ones, over real HTTP.

## [20260910.3] — 02:32UTC

<!--
sourceCommit: d4df5386fccaae9936f690395faea9598fbc0825
queuedAtUtc: 
previousMirroredBuild: 20260910.2 (2026-09-10)
contractsSubmodule: 7e43637880c2..750c070ba25d
-->

### Fixed
- <kbd>CONTRACTS</kbd> v3.6.1 — the shorthand parser now walks a `TOOL` state's `args`, and the formatter mirrors it. Found by importing a real definition: every argument came back as `VALUE_INVALID`, because the mappings of every other state type were parsed at the boundary and this one had been overlooked when `TOOL` was added.

## [20260910.2] — 00:57UTC

<!--
sourceCommit: 0bf39c84426979335c95fc87a625add745f36e52
queuedAtUtc: 
previousMirroredBuild: 20260910.1 (2026-09-10)
contractsSubmodule: 4f69d25ccdb3..7e43637880c2
-->

### Added
- <kbd>CONTRACTS</kbd> v3.6.0 — batched additions for the next roadmap rows, published in one go rather than one per change: `TOOL` joins `isHostExecutedWorkflowState` (without it a runner evaluates a capability locally and returns an empty output instead of calling anything); `WorkflowQcSamplingPolicy` + `WorkflowQcFailAction` on `WorkflowSettings` for per-workflow quality sampling, defaulting to `CONTINUE` so turning sampling on never changes control flow by surprise; `WorkflowRunnerUsage.capabilityCalls` counting platform-brokered capability calls per id, kept apart from the model-call counter because the two are billed on different terms; and `WorkflowMcpDiscoveredTool`, the post-allowlist shape a planner sees for an MCP tool.
- <kbd>RUNTIME</kbd> Workflow runner executes `TOOL` states, in the main state dispatch and as a planner tool (`runToolState`) alike — which is the point of `TOOL` being in `WORKFLOW_AGENT_TOOL_STATE_TYPES`: a capability is written once and works in a deterministic flow and inside an agent loop. A capability's timeout is capped by its state's own budget however generous the descriptor is, and the step records which capability ran and at which catalog revision, so a run stays explainable after the catalog moves on. An unavailable capability fails the state **without attempting a call**: that is a configuration failure, not a failed attempt.

## [20260910.1] — 00:40UTC

<!--
sourceCommit: eca36e9aa62cab58956b09f50c4ede3b688c6ec6
queuedAtUtc: 
previousMirroredBuild: 20260909.6 (2026-09-09)
contractsSubmodule: 36025ec62948..4f69d25ccdb3
-->

### Added
- <kbd>CONTRACTS</kbd> v3.5.0 — `WorkflowRunnerCapabilityDescriptor` (`{ id, version, settings }`) plus the optional `WorkflowRunnerInputResponse.capabilities`. This is how a `PLATFORM`-brokered capability reaches a runner: the tenant configures nothing, so there is no connection to point at, and the control plane resolves the endpoint and the credentials and hands over one self-contained block. It reuses `WorkflowConnectionSettings` on purpose — a second settings shape for the same job would have to be kept in step with the first. `CONNECTION`-brokered capabilities are unaffected and keep resolving through `connections`. Additive.
- <kbd>RUNTIME</kbd> **Capability executor** `src/workflow-runner/workflow-runner.capabilities.service.ts`: resolves where a `TOOL` state's call must go (platform descriptor vs tenant connection, refusing a connection that speaks the wrong protocol) and runs `web.search` against SearxNG with axios.
  Both details that shape the adapter were measured against a live container on 2026-09-10, not read from documentation: a result carries its extract in **`content`**, not `snippet`, and a JSON request to an instance without `json` in `search.formats` is answered with a bare **403** and no body — so that status is translated into a message naming the setting, instead of surfacing as "no results". Engine failures are deliberately not fatal: the same probe had DuckDuckGo answering with a CAPTCHA and Startpage failing to parse while the aggregate still returned 39 results.
  Covered by `tests/workflow-runner/workflow-runner.capabilities.test.ts` (11 unit cases over a real trimmed payload) and `tests/e2e/capabilities/web.search.e2e.test.ts`, which runs against an actual instance (`DCDR_E2E_SEARXNG_URL`) and asserts that at least one extract comes back non-empty — the one failure a fixture-only suite cannot see, since a renamed field would map to empty strings and keep every unit test green.

## [20260909.6] — 23:47UTC

<!--
sourceCommit: 294af23df1034486f3cea8e9971f67383b905457
queuedAtUtc: 
previousMirroredBuild: 20260909.3 (2026-09-09)
contractsSubmodule: f1c5090acd36..36025ec62948
-->

### Added
- <kbd>CONTRACTS</kbd> v3.4.0 — **Capability catalog and the `TOOL` state (D34b).** `WORKFLOW_CAPABILITIES` publishes typed actions with their own `version`, `inputSchema` and `outputSchema`, so a workflow anchored to an older revision of a capability keeps validating when the shape moves. `WorkflowCapabilityBroker` says who holds the credentials: `PLATFORM` (we run it on our account and bill the call, like `web.search`) or `CONNECTION` (the tenant supplies a connection of the declared protocol, like `mail.send` over SMTP) — which is what lets the validator demand a connection on one and refuse it on the other, because a connection hung off a platform-brokered call reads as if the tenant controlled it. The `TOOL` state (`{ capability, connection?, args }`) runs one capability from a typed form instead of a hand-mapped URL and body, and joins `WORKFLOW_AGENT_TOOL_STATE_TYPES`, so a capability written once is reachable from a deterministic flow and from a planner alike — this is the point of D34: the catalog is the extension point, not the state-type list. `WORKFLOW_IMPLEMENTED_CAPABILITIES` lists what a runner executes today (`web.search`), so an editor can show `mail.send` without letting anyone wire up something that will not run. `findWorkflowCapability` looks one up and `inferWorkflowStateOutputSchema` resolves a `TOOL` state's output from the catalog, so a downstream state can reference `states.<id>.output.*` before the workflow has ever run — exactly what a hand-mapped HTTP call cannot offer. New issue codes: `CAPABILITY_UNKNOWN`, `CAPABILITY_NOT_IMPLEMENTED`, `CAPABILITY_ARG_UNKNOWN`, `CAPABILITY_ARG_MISSING`.
- <kbd>RUNTIME</kbd> Runner support for `TOOL` states is **not** in this version: `WORKFLOW_IMPLEMENTED_CAPABILITIES` is the contract's own warning about that, and the validator rejects a capability without runner support, so nothing can be published that the runner would fail to execute.

## [20260909.3] — 21:32UTC

<!--
sourceCommit: 6cacf5c61a51430135abdfc18bbe463111db03fa
queuedAtUtc: 
previousMirroredBuild: 20260909.2 (2026-09-09)
contractsSubmodule: de11bb23ee66..f1c5090acd36
-->

### Added
- <kbd>CONTRACTS</kbd> v3.3.1 — `ARRAY_OBJECT_PROPERTIES_REQUIRED` also fires when `properties` is an empty record. An `array<object>` declaring `properties: {}` supplies no item shape, yet it passed validation and then threw in the provider path; it now fails at the editor like a missing one.
- <kbd>RUNTIME</kbd> **Schema conformance suite** `tests/providers/schema.type-conformance.test.ts`: 60 shapes — every prompt variable type bare, shorthand, optional, bounded, inside an array, inside an object, three levels deep, and malformed — measured through both `@dcdr/contracts` and the provider path. It pins two invariants that had never been checked: **nothing the platform calls valid may fail to build for a provider**, and **nothing the platform rejects may build anyway**. It also records which valid shapes survive strict Structured Outputs, which is the table the schema editor's free-form warning is aligned against.
- <kbd>RUNTIME</kbd> `tests/providers/schema.output-type-conformance.test.ts`: the per-type output matrix (`strict` / open object / `anyOf`) that the conformance invariants build on.
- <kbd>RUNTIME</kbd> Provider E2E extended with `any`, `array<any>` and `openInput` shapes. Measured 2026-09-09: `array<any>` in an output schema makes **Anthropic refuse the request** (`additionalProperties: true is not supported`) while Grok, OpenAI and Gemini accept it; an **open input schema costs nothing on all four**, since an input schema never reaches a provider.
### Fixed
- <kbd>RUNTIME</kbd> Shorthand `"object"` no longer disagrees with `{ type: "object" }`. The provider path and the registry check validated with `strictShorthandObject: true` while the control plane uses `false`, so a schema a tenant could save was rejected at registry load and threw on every execution. Both now accept it and treat it as the open object it is; shorthand `"array"` stays rejected, because with no `itemsType` it is genuinely unusable and the platform validator rejects it too.

## [20260909.2] — 20:25UTC

<!--
sourceCommit: 0d279571b6a507d6acdfebcf426395343b458ee1
queuedAtUtc: 
previousMirroredBuild: 20260909.1 (2026-09-09)
contractsSubmodule: 63ddbcc0dfd4..de11bb23ee66
-->

### Added
- <kbd>CONTRACTS</kbd> v3.3.0 — `WorkflowAgentDecisionPayload`: what the `AGENT` planner emits, separate from `WorkflowAgentDecision`, which is documented as the parsed form the host works with. The open parts of a decision (`args`, `result`) travel as JSON strings (`argsJson`, `resultJson`), so the decision schema is made of primitives and can be enforced structurally by every provider.
- <kbd>RUNTIME</kbd> Workflow runner: `parseAgentDecision` accepts the portable wire shape and parses `argsJson` / `resultJson` back into `args` / `result`; a plain object is still accepted, so a tenant clone on the older prompt keeps working, and an unparseable string names the field in the error.
- <kbd>RUNTIME</kbd> New provider E2E `tests/e2e/providers/freeform.schema.e2e.test.ts`: measures strict, open-object and planner-shaped output schemas against OpenAI, Grok, Anthropic and Gemini, and prints the matrix. **Why this was needed:** the freeform fallback (`isFreeformJsonPromptVariable` -> JSON mode) exists only in the OpenAI adapter, so the behaviour of the other three was unknown. Measured 2026-09-09: with an open object in the output schema **Anthropic refuses the request** (`additionalProperties: true is not supported`) and **OpenAI answers 200 with the field silently empty**; Grok and Gemini return it intact. With the primitives-only planner shape all four answer 200 and honour the schema.

## [20260909.1] — 14:19UTC

<!--
sourceCommit: 27738c260bf2bfa61001308e7bba6365e6e440b6
queuedAtUtc: 
previousMirroredBuild: 20260908.3 (2026-09-08)
contractsSubmodule: 3d176c6c3bc0..63ddbcc0dfd4
-->

### Added
- <kbd>CONTRACTS</kbd> v3.2.0 — Connection protocols. A workflow connection declares the transport it speaks (`WorkflowConnectionProtocol`: `HTTP`, `MCP`, `SMTP`, `SFTP`) and carries one self-contained settings block per transport (`WorkflowConnectionSettings` with an optional block per protocol, discriminated like `WorkflowState`, plus `WORKFLOW_CONNECTION_SETTINGS_FIELDS`). Each block declares everything a runner needs to operate the destination, including `allowedHosts` and `timeoutMs`, so the control plane interpolates its own columns into it and the runner never joins anything. `WORKFLOW_CONNECTION_IMPLEMENTED_PROTOCOLS` lists what actually executes today (`HTTP`), so an editor never offers a dead transport. Plain `FTP` is deliberately absent: it moves credentials and payloads in clear text.
- <kbd>CONTRACTS</kbd> v3.2.0 — `WorkflowAgentToolKind.MCP`: an `AGENT` may expose every tool an `MCP` connection advertises, discovered at run time and optionally narrowed by name. One entry expands into as many catalog entries as the server exposes, which is why it cannot be enumerated when the workflow is authored.
- <kbd>CONTRACTS</kbd> v3.2.0 — `computeDominators` is exported. The definition editor can now compute which `states.<id>.output` references are guaranteed at a given state, exactly the way the validator decides `REF_STATE_NOT_DOMINATING`, instead of duplicating the dataflow and drifting from it.
- <kbd>RUNTIME</kbd> Workflow runner: `httpSettingsOf` in the egress guard refuses an `HTTP` state pointed at a connection that does not speak HTTP, with the protocol in the message, instead of failing further down as a malformed URL. `allowedHostsOf` now derives the fallback host from whichever settings block the connection carries.
### Changed
- <kbd>CONTRACTS</kbd> **BREAKING (v3.2.0)** — `WorkflowRunnerConnectionDescriptor` is protocol-shaped: `baseUrl`, `timeoutMs`, `maxResponseBytes`, `allowedHosts` and `allowInsecure` move into `settings.http`, and the descriptor becomes `{ key, protocol, settings }`. Authorized as a breaking change because no runner of 3.1.x is deployed; the runner and its fixtures were migrated in the same change.

## [20260908.3] — 18:46UTC

<!--
sourceCommit: 94396b837b95c4ad8b051eece1255c07ff7b5212
queuedAtUtc: 
previousMirroredBuild: 20260908.2 (2026-09-08)
contractsSubmodule: 22e5331c9a51..3d176c6c3bc0
-->

### Added
- <kbd>CONTRACTS</kbd> v3.1.1 — `WorkflowState.approval`: optional human approval gate on any state but `END` (`WorkflowStateApproval`, fixed `WORKFLOW_APPROVAL_FORM` decision, `WORKFLOW_APPROVAL_REJECTED_CODE`); `WorkflowRunnerWaitDetails.approval` / `WorkflowRunnerResumeState.approval` flag the parked wait as a gate. Validator, shorthand and `docs/WORKFLOWS.md` updated.
- <kbd>RUNTIME</kbd> Workflow runner: approval gates. A state carrying `approval` parks the run before executing (`WAITING`, `HUMAN_TASK` semantics, step `details.approval = true`); on resume an approved decision executes the state as usual and a rejected one fails it with `APPROVAL_REJECTED` so the state `onError` policy applies.

## [20260908.2] — 10:18UTC

<!--
sourceCommit: aed109b35e0817c74d466cbbefda3917629d8fa0
queuedAtUtc: 
previousMirroredBuild: 20260907.3 (2026-09-07)
contractsSubmodule: 544b7a520249..22e5331c9a51
-->

### Added
- <kbd>RUNTIME</kbd> Workflow runner launchers in `package.json` (`dev:workflow-runner`, `workflow-runner`, `start:workflow-runner`, `test:workflow-runner`) and a runtime-style start-up banner with the effective configuration.
- <kbd>RUNTIME</kbd> New `dcdr-workflow-runner` process (`src/workflow-runner.ts`, `Dockerfile.workflow-runner`): polls the backend workflow protocol, walks workflow definitions with the shared engine helpers, runs `INTENT` states through the runtime, `HTTP` states through an egress guard, `WAIT` as checkpoint-and-exit and `AGENT` as a bounded, checkpointed loop. Work in progress: see `internal_docs/WORKFLOW_RUNNER.md`.
- <kbd>CONTRACTS</kbd> v3.1.0 — `WorkflowRunnerResumeState.agent` carries the `AGENT` loop cursor of a resumed run.

## [20260907.3] — 18:44UTC

<!--
sourceCommit: 6dfaa1be1ec2c8e73e759e6ccaf9b319dd6afb5a
queuedAtUtc: 
previousMirroredBuild: 20260907.2 (2026-09-07)
contractsSubmodule: eca020132643..544b7a520249
-->

### Changed
- <kbd>CONTRACTS</kbd> v3.0.1 — `WorkflowRunnerWorkflowDescriptor.version` typed as a string label (masked versions), matching the control plane; patch release, no consumer existed.

## [20260907.2] — 15:55UTC

<!--
sourceCommit: 07f53cf06dcf1ea41fa96ef0c0024985bf74da76
queuedAtUtc: 
previousMirroredBuild: 20260906.3 (2026-09-06)
contractsSubmodule: f23680bc50e9..eca020132643
-->

### Added
- <kbd>CONTRACTS</kbd> v3.0.0 — long-horizon `AGENT` bounds (`maxDurationMs`, `maxEstimatedCost`, `historyWindow`, `summarizerIntent`), planner `notes`/`evidence`, `WAIT` as an agent tool, shared `WorkflowEvidence`, runner step `iteration`/`toolId`/typed `evidence`, cursor `agent` resume block, output `summary`; tier matrix "Workflows & Agents" section and `examples/workflow.support_ticket_triage.json`.
- <kbd>CONTRACTS</kbd> v3.0.0 — workflows declare a typed `outputSchema` (same prompt-variable schema as intents); output mappings and `END` overrides are validated against it, and `SUBWORKFLOW` inputs are validated against the child workflow's input schema.
- <kbd>CONTRACTS</kbd> v3.0.0 — new `conditions.contract.ts` — shared condition tree (`ConditionLeaf`, `ConditionGroup`, `ConditionOperator`, `validateConditionTree`, `evaluateConditionTreeOnScope`) with an extended operator set (array operators, bounded `MATCHES_REGEX`, `[index]` paths, `valueNRef` parameters). Existing operator values are unchanged.
- <kbd>CONTRACTS</kbd> v3.0.0 — new `workflow.contract.ts` — declarative workflow definitions (state machine, value-mapping DSL with a closed function catalog, validator, shared helpers, `AGENT` state). See `docs/WORKFLOWS.md`.
- <kbd>CONTRACTS</kbd> v3.0.0 — new `workflow.runner.contract.ts` — shapes and typed client of the internal control-plane/runner protocol (not a customer-facing surface).
### Changed
- <kbd>CONTRACTS</kbd> v3.0.0 — Bumped `@dcdr/contracts` to `3.0.0` (major, RM-102/RM-103/RM-104). Breaking for condition consumers: `condition` fields are typed as `ConditionLeaf | ConditionGroup<ConditionLeaf>` (deprecated aliases kept for 3.x), the duplicate `ExecutionWindow` declaration in `implementations.contract` is gone, and `resolveConditionPath` enters arrays on numeric segments. The workflow, agent, evidence and runner-protocol surfaces are new and additive. The runtime consumes the package from the submodule and needs no code change beyond the condition facade already shipped.
- <kbd>CONTRACTS</kbd> v3.0.0 — `ImplementationCondition`, `LogicalImplementationCondition` and `ConditionOp` are deprecated in favour of `ConditionLeaf`, `ConditionGroup` and `ConditionOperator`; they remain available throughout 3.x.
- <kbd>RUNTIME</kbd> Condition evaluation for conditioned routing and processing rules now uses the shared contracts evaluator; behavior is unchanged.
### Fixed
- <kbd>RUNTIME</kbd> Added a `Preflight: npm publish credentials` step to `azure_templates/publish-and-deploy-docker-runtime.yml`, right after the Node install and gated on the same conditions as the publish step, so a credential problem fails in seconds instead of after the full install/typecheck/build/test/Docker-push cycle. This was prompted by a real failure: the npm token expired and `npm publish` reported `E404 Not Found - PUT`, which never mentions credentials — the registry deliberately answers 404 rather than 401/403 on publish so it cannot be used to probe for private packages. The preflight calls `npm whoami`, which returns a plain `E401 Unauthorized` instead. It also rejects a `NPM_PUBLISH_TOKEN` that Azure left unexpanded as the literal `$(NPM_PUBLISH_TOKEN)` (non-empty, so the previous emptiness guard passed it through), and refuses a version already present on the registry. npm granular access tokens always carry an expiry, so this will recur; note also that bypass-2FA tokens lose direct publish around January 2027, and npm trusted publishing (OIDC) does not currently support Azure Pipelines or self-hosted runners.

## [20260906.3] — 03:32UTC

<!--
sourceCommit: 9a1ae51c0ece9a60a598dc9515921b0d2edb7797
queuedAtUtc: 
previousMirroredBuild: 20260721.4 (2026-07-21)
contractsSubmodule: 00db9ddf5d61..f23680bc50e9
-->

### Added
- <kbd>RUNTIME</kbd> Completed the provider SDK upgrade wave under the `RM-046` protocol: `openai` 6.42.0 -> 7.10.0, `@anthropic-ai/sdk` 0.110.0 -> 0.124.0, `@google/genai` 2.10.0 -> 2.21.0, `@mistralai/mistralai` 2.2.5 -> 2.6.4. Each bump was isolated, validated non-E2E, and then re-curated exhaustively across the affected provider's entire published set before being accepted; per-bump evidence is in `internal_docs/PROVIDER_SDK_REFRESH_SNAPSHOT_2026-09-06.md`. The `openai` major additionally re-validated Grok, which routes through the OpenAI-compatible adapter: **Grok passed 13/13 chat and all six published rectangles came back identical to the catalog, cell for cell**. `npm run openapi:dump` produced no diff, so the major does not move the runtime's public surface.
- <kbd>RUNTIME</kbd> **Breaking change absorbed** (`openai` v7): `zodResponseFormat` and `zodTextFormat` now assert strict Structured Outputs compatibility client-side and throw on freeform object nodes, where previously the request was sent and rejected upstream — which is the path the adapter's documented JSON-mode fallback relied on. Three call sites in `src/providers/openai.provider.ts` were migrated around the existing `containsFreeformJsonPromptVariable` guard: the debug-only schema render can no longer abort a request, and both the Responses and Chat Completions paths now decide *before* rendering and degrade to `{ type: "json_object" }` with local validation. `tests/providers/zod.schema.helpers.test.ts` was split so one case pins the new client-side rejection and the "no empty JSON-schema nodes" invariant moved onto an enforceable schema.
- <kbd>RUNTIME</kbd> The `RM-046` protocol proved its worth three times in one wave. Each of `@google/genai`, `@anthropic-ai/sdk` and `openai` produced an apparent regression, and in all three cases the bump was rolled back and the failure reproduced on the previous version — so none was an SDK regression: `gemini-flash-lite-latest` (upstream 400 on a floating alias), `claude-haiku-4-5-20251001` (a `TEXT` claim that had been extended from an INLINE-only smoke run and never held), and `gpt-4.1-mini-2025-04-14` (a non-deterministic `TEXT` cell). Rollback-and-reproduce is what separated model drift from SDK regression every time.
- <kbd>RUNTIME</kbd> Removed the inert `runtimeSupport.preferredApi` metadata from the Grok catalog (`RM-047`). Grok routing selects its upstream surface by whether the request carries `inputParts` — `shouldUseOpenAICompatibleResponsesApi()` only consults `preferredApi` for `IntentProvider.OPEN_AI` — so those four entries stated a routing decision the runtime never applied. The behaviour itself is correct and unchanged: text-only traffic stays on chat completions, and requests with input parts use the Responses API because xAI rejects file content on `/v1/chat/completions`. The rule is now documented on the catalog module and pinned by `tests/providers/grok.provider.responses-routing.test.ts`.
- <kbd>CONTRACTS</kbd> v2.9.0 — Completed the OpenAI multimodal re-measurement (`RM-050`): the last 11 rectangles still resting on transport-only evidence — the `gpt-4.1` and `gpt-4o` families and their dated aliases — were re-measured under the unified comprehension contract. Eight confirmed their claim and three narrowed to `IMAGE`/`DOCUMENT` (`gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4.1-nano-2025-04-14`). Every OpenAI rectangle published as `SUPPORTED` now carries evidence from 2026-09-05 or later.
- <kbd>RUNTIME</kbd> **Bug fix** (`RM-050`): the OpenAI multimodal curator (`tests/e2e/providers/openai.multimodal.curate.e2e.test.ts`) accepted `sawProvidedInput=true` as proof of multimodal support, so it validated transport rather than comprehension — the exact thing `internal_docs/PROVIDER_MULTIMODAL_TRANSPORT_CONTRACT.md` forbids. The Grok, Anthropic, Gemini and Mistral curators had all been migrated to comprehension-grade assertions; OpenAI never was, despite the docs citing it as the baseline to copy. It now requests and validates a `comprehensionEcho` against the shared canonical fixtures using the same cue groups as the other four, and its URL axis now allows the managed signed-URL fallback the other providers already used (it previously reported `remote URL fixture missing` for every URL case instead of real results).
- <kbd>CONTRACTS</kbd> v2.9.0 — Corrected the OpenAI multimodal rectangles this exposed, and modernised the managed public model set. See the contracts changelog; the customer-visible part is that `gpt-5.4-nano` was public while advertising audio and video input it does not support, and that OpenAI's public trio moves to the cheaper, flat-priced `gpt-5.6` family.
- <kbd>CONTRACTS</kbd> v2.9.0 — Refreshed and curated the OpenAI model catalog against the official sources (2026-09-05). Added the fifteen newly discovered IDs and curated the four new flagship chat models (`gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`) from real provider E2E: all four are `SUPPORTED` with verified `tokenUsageCovered` and their published standard pricing. Added `LEGACY` E2E overrides for the three de-listed IDs. A full re-verification of every priced OpenAI chat/reasoning entry against the official standard-tier table found **zero pricing discrepancies** — the only provider in this refresh wave with no pricing defects.
- <kbd>CONTRACTS</kbd> v2.9.0 — Refreshed and curated the Gemini model catalog and pricing snapshot against the official sources (2026-09-05). Added the nine newly discovered IDs and curated each from real provider E2E: five are now `SUPPORTED` with verified `tokenUsageCovered`, and four are `NOT_SUPPORTED` because they require an API surface the runtime CHAT adapter does not implement (Interactions API, or WebSocket `bidiGenerateContent`). Backfilled `tokenUsageCovered` on `gemini-2.5-pro`. **Corrected `gemini-3.1-flash-lite-image`, which carried the `gemini-2.5-flash-image` batch rates (0.15/0.0195) instead of its own published standard rates (0.25/1.50)**, and filled the previously missing pricing for `gemini-3.1-flash-image` and `gemini-3-pro-image`.
- <kbd>CONTRACTS</kbd> v2.9.0 — Curated the Mistral catalog with targeted provider E2E: five previously uncured models are now `SUPPORTED` (`codestral-2508`, `ministral-14b-2512`, `ministral-3b-2512`, `ministral-8b-2512`, `mistral-code-fim-latest`) and ten Mistral models now carry verified `tokenUsageCovered=true` where the catalog previously had none at all. The `mistral-medium*`, `mistral-small*` and `mistral-vibe-cli*` families remain unverified because the available credential returns an immediate per-model `429` for them; that is a key entitlement, not a runtime capability, so their statuses are intentionally left untouched.
- <kbd>CONTRACTS</kbd> v2.9.0 — Refreshed the Mistral model catalog and pricing snapshot against the official sources (2026-09-05). **Corrected `mistral-small-latest`, which was priced at the superseded 0.10/0.30 per MTok while the published Mistral Small 4 rate is 0.15/0.60** — a 50-100% understatement of that model's cost. Re-verified the other priced entries (unchanged) and added `LEGACY` provider-E2E overrides for the five catalog IDs `/v1/models` no longer returns. Mistral publishes marketing names rather than API model IDs, so pricing is attached only where the mapping to a single `*-latest` ID is unambiguous; dated aliases are deliberately left unpriced rather than inferred, and that reasoning is recorded on the entries.
- <kbd>CONTRACTS</kbd> v2.9.0 — Refreshed and curated the Anthropic (Claude) model catalog and pricing snapshot against the official sources (2026-09-05). Added `claude-opus-5` and `claude-fable-5-1`, both validated by targeted provider E2E (run + structured, token usage, and comprehension-grade multimodal): `claude-opus-5` publishes `TEXT`/`IMAGE`/`DOCUMENT` and `claude-fable-5-1` publishes `IMAGE`/`DOCUMENT`, each across `INLINE`/`URL`/`ASSET`. Backfilled `tokenUsageCovered` on `claude-opus-4-7` and `claude-fable-5`, so every Anthropic entry now has verified token usage. Filled the previously missing cache-read prices across the whole provider, **corrected `claude-sonnet-5` by removing a stale pricing tier that would have overstated its cost by 50% from 2026-09-01** (Anthropic cancelled that increase), and flagged the upstream-retired `claude-opus-4-1-20250805` with a `LEGACY` E2E override so first-party sweeps skip it while its curation stands (it is still served on Bedrock and Google Cloud).
- <kbd>RUNTIME</kbd> Provider E2E now uses one flat 1024-token output budget for every provider and model (`tests/e2e/providers/_registry.ts`) — the same baseline the multimodal curators already use and that `internal_docs/PROVIDER_E2E_TESTS.md` already mandated — overridable per run with `DCDR_E2E_CHAT_MAX_TOKENS`. The previous per-family heuristic (16/64 tokens, widened to 256 only for a hardcoded list of OpenAI/Gemini families) produced false `PROVIDER_EMPTY_RESPONSE` results on any thinking-capable model outside that list: the model spent the whole budget reasoning and returned a thinking-only content block with `stop_reason=max_tokens`. This was masking a real failure — `claude-fable-5` was marked `SUPPORTED` while its text path failed every run.
- <kbd>RUNTIME</kbd> Documented a mandatory provider SDK upgrade protocol (`internal_docs/PROVIDER_ONBOARDING_GENERIC.md` section 11, tracked as `RM-046`): when a failing model is fixed by bumping a provider SDK, the affected provider's **entire** curated set must be re-validated in the same round — every `SUPPORTED` model, every `tokenUsageCovered=true` model, and every published `inputParts` rectangle — because the bump changes the transport under all of them. Includes the adapter/SDK ownership table (an `openai` bump also moves Grok, which routes through the OpenAI-compatible adapter) and a rollback-over-partial-validation rule.
- <kbd>CONTRACTS</kbd> v2.9.0 — Refreshed the Grok (xAI) model catalog and pricing snapshot against the official sources (2026-09-05). Added the newly discovered `grok-4.6`, `grok-4.5` (CHAT) and `grok-imagine-image-2.0` (IMAGE_GENERATION) IDs, then curated the two chat models with targeted provider E2E: both pass run + structured, report token usage, and publish an `IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` `inputParts` rectangle, so they are now `SUPPORTED` with `tokenUsageCovered=true` (still `publicForCustomers=false`). `TEXT` is deliberately excluded from both rectangles (it failed comprehension on all three source kinds for `grok-4.6`, and on `ASSET` for `grok-4.5`), and `AUDIO`/`VIDEO` failed the canonical cues everywhere. `grok-imagine-image-2.0` stays `IN_PROGRESS` pending an image generation adapter. Also captured the published `>= 200k` context price column, which was missing entirely: every priced Grok text model now carries a `long_context` pricing tier alongside its base per-MTok values (base values themselves were re-verified and unchanged). The `grok-imagine-*` generation models remain deliberately unpriced because xAI bills them per image/second, which the current pricing components do not model.
### Fixed
- <kbd>RUNTIME</kbd> Recorded a provider-E2E hygiene trap found during the `openai` re-curation: the multimodal URL axis reports `remote URL fixture missing` rather than failing when `DCDR_E2E_<PROVIDER>_MULTIMODAL_ALLOW_SIGNED_URLS` and `DCDR_E2E_STORAGE_ENABLED` are unset, so a run can look green while measuring only `INLINE` and `ASSET`. The first OpenAI re-curation pass hit exactly this and had to be repeated; the audit table must show real URL rows before a rectangle is read as validated.
- <kbd>RUNTIME</kbd> Renamed the underscore-prefixed E2E helper modules to descriptive names (`_env` → `providers.env`, `_throttle` → `providers.throttle`, `_registry` → `providers.registry`, `_multimodal.shared` → `multimodal.shared`, plus the new `multimodal.comprehension` / `multimodal.curator.engine`, and `tests/e2e/storage/_env` → `storage.env`), and removed the dead `_multimodal.fixtures.ts`, which was an unreferenced one-line re-export. The prefix had no functional role: jest selects suites by the `*.e2e.test.ts` suffix, not by the helper prefix.
- <kbd>RUNTIME</kbd> **Bug fix** (`RM-052`): `npm run check` did not typecheck anything under `tests/` (`tsconfig.json` excludes it; only `tsconfig.jest.json` includes it), so a test-only compile break passed the cheap gate and was caught only by a full jest run — the rename above left broken imports in 17 suites while `npm run check` still reported PASS. `check` now chains `check:src` (`tsconfig.json`) and `check:tests` (`tsconfig.jest.json`); CI needed no change because it already calls `npm run check`, and `tsconfig.json` was left untouched so build output is unaffected.
- <kbd>RUNTIME</kbd> Unified the five provider multimodal curators onto one engine and one comprehension contract (`RM-051`), replacing ~4360 lines of near-duplicate suites with 251 lines of configuration wrappers. The duplication had allowed three divergences that changed what a published support rectangle meant: OpenAI never checked comprehension at all (`RM-050`), the IMAGE cue groups were stricter for Anthropic/Gemini than for Grok/Mistral/OpenAI, and Gemini ran on a 256-token budget where every other provider used 1024. Every curator now emits a reviewable audit table (expected cue vs. what the model actually said) under the git-ignored `test-results/multimodal-audit/`.
- <kbd>CONTRACTS</kbd> v2.9.0 — Re-measured every customer-facing model's multimodal rectangle under the unified contract. Gemini is confirmed as the only provider with genuine AUDIO and VIDEO comprehension (four of its five public models publish a full five-asset rectangle, two of them gaining families that the older, stricter per-provider cue lists had wrongly rejected). Mistral's rectangles are corrected downward after its curator could run at all — it had been failing on a missing `--experimental-vm-modules` flag rather than on model behaviour. **`claude-opus-5` is withdrawn from the managed public set**: its rectangle passed 3/3 on 2026-09-04 and no longer reproduces, and the regression was confirmed against the pre-refactor curator restored from git, so it is now marked untrusted while the model itself stays `SUPPORTED` for chat. The Anthropic Best slot returns to `claude-opus-4-8` and the Fast slot moves to `claude-haiku-4-5-20251001`, because the bare `claude-haiku-4-5` alias carries a `LEGACY` provider-E2E override and could therefore never be re-verified while customer-facing.
- <kbd>RUNTIME</kbd> **Bug fix** (`RM-048`): the Anthropic adapter classified only a fixed list of SDK error classes and sent everything else to a generic `UPSTREAM_5XX` fallback, so deterministic upstream rejections (400 `invalid_request_error`, 403, 409) were reported as upstream server failures. Because `UPSTREAM_5XX` is a member of `RetryPolicy.retryOn`, a request the caller had to fix was retried against a healthy provider — burning paid calls and feeding failure signal into the circuit breaker — and surfaced to the client as HTTP 502. Upstream `400-499` now map to the existing `PROVIDER_ERROR` code, which is not a member of `retryOn` and is therefore terminal; genuine 5xx and statusless transport failures still map to `UPSTREAM_5XX`, and `providerStatus` is now propagated on both paths. The client-visible status is deliberately unchanged (`PROVIDER_ERROR` already mapped to 502 for the Mistral and OpenAI-compatible paths, and the specific caller-fixable cases already return 422). Mistral, Gemini, and the OpenAI-compatible path already classified by status and are unaffected.
- <kbd>RUNTIME</kbd> **Bug fix**: `node tools/generate-supported-models-doc.cjs` — the mandatory doc regeneration step for provider catalog curation — crashed with `Cannot read properties of undefined (reading 'listProviderModels')`. It still imported `ProviderModelRegistry` and `ProviderModelRuntimeSupportStatus` from `@dcdr/contracts/provider.contract`, but those symbols moved to `@dcdr/contracts/provider.catalog.contract` when the catalog was split out, so `src/contracts/docs/SUPPORTED_MODELS.md` could not be regenerated at all. Fixed the imports, added an explicit error when the catalog exports are missing (stale contracts build), added a `DCDR_SUPPORTED_MODELS_DOC_OUT` output override so the tool can be exercised without rewriting the committed doc, and added a regression test (`tests/infra/supported-models-doc.generator.test.ts`).

## [20260721.4] — 12:20UTC

<!--
sourceCommit: 52b087d1a39a79aea17a8f7384b841e60e85474b
queuedAtUtc: 
previousMirroredBuild: 20260721.3 (2026-07-21)
contractsSubmodule: 272fb0ad47f5..00db9ddf5d61
-->

### Added
- <kbd>CONTRACTS</kbd> v2.8.5 — Renamed `DcdrProviderLimitUsageBaseline.budget.consumedUsd` (v2.8.4, unreleased) to `consumed` and made it explicitly currency-agnostic: the runtime only ever compares `maxBudget` against `usage.budget.consumed` as an opaque unit, and backend is fully responsible for keeping both denominated the same way. This was caught before anything shipped — the original `Usd` suffix wrongly assumed the same currency as the upstream provider catalog pricing (commonly USD), but `maxBudget` is actually EUR-denominated, matching existing Governance/wallet product semantics.
- <kbd>CONTRACTS</kbd> v2.8.4 — Added `DcdrProviderLimitUsageBaseline` (`usage.calls`/`usage.budget`, each with its own `periodKey`) as an optional field on `DcdrProviderLimitGate`, and added `ExecutionErrorCode.PROVIDER_LIMIT_EXCEEDED` (mapped to HTTP 429). Backend-computed baselines let runtime enforce `maxCalls`/`maxBudget` without ever computing cost itself — see the `RUNTIME` entry below.
- <kbd>RUNTIME</kbd> Governance `Provider Limits` (`DcdrProviderLimitsConfig`) are now enforced for **both** intent execution (`/api/execution/*`) and the OpenAI-compatible gateway (`/v1/*`), through one shared gate (`src/services/provider.limits.service.ts`). Provider/model `enabled:false` gates block a candidate the same way `denyProviders` already does (intent execution filters blocked candidates once before the retry/fallback loop in `executeCandidatesWithRetry()` so fallback to the next BYOK candidate still works; gateway rejects at dispatch time via `proxyGatewayRequest()`). `maxCalls` combines a backend-supplied baseline (`providerLimits.providers[p].usage.calls`) with a real-time local Redis/in-memory delta, mirroring the existing tenant-wide monthly-quota baseline pattern in `tenant.middleware.ts`. `maxBudget` is enforced purely against a backend-supplied baseline (`usage.budget.consumed`) — the runtime treats it as a currency-agnostic opaque unit and never computes cost from token usage × catalog pricing itself, avoiding drift from backend's own billing calculation (backend confirmed it is EUR end-to-end, converted from catalog pricing via the same ECB-fixing approach DCDR wallet billing already uses). Provider-level and model-level gates apply independently (both must pass). `IntentProvider.DCDR` (virtual provider) candidates are gate-checked against their *effective* upstream provider/model (e.g. `OPEN_AI`/`gpt-4o-mini`), not the raw `DCDR`/prefixed-virtual-id fields, since Governance rules are authored against the effective provider and the real substitution otherwise only happens later at the executor boundary. When every candidate is blocked, both surfaces return a stable `PROVIDER_LIMIT_EXCEEDED` (HTTP 429 / `error.code = "provider_limit_exceeded"` on the gateway). Fail-open: enforcement only activates for tenants where backend actually populates `providerLimits` (and its `usage` baselines) on `/dcdr/entitlements` and `/dcdr/token/check` — backend has this implemented and locally verified (2026-07-21); live/staging rollout confirmation is the last step before closing `RM-045` in `internal_docs/ROADMAP.md`.

## [20260721.3] — 03:18UTC

<!--
sourceCommit: aee878199873f4d6f05e6a26137e6297aa8baf37
queuedAtUtc: 
previousMirroredBuild: 20260721.1 (2026-07-21)
contractsSubmodule: d6b491c42dd6..272fb0ad47f5
-->

### Added
- <kbd>CONTRACTS</kbd> v2.8.4 — Added `DcdrProviderLimitUsageBaseline` (`usage.calls`/`usage.budget`, each with its own `periodKey`) as an optional field on `DcdrProviderLimitGate`, and added `ExecutionErrorCode.PROVIDER_LIMIT_EXCEEDED` (mapped to HTTP 429). Backend-computed baselines let runtime enforce `maxCalls`/`maxBudget` without ever computing USD cost itself — see the `RUNTIME` entry below.
- <kbd>RUNTIME</kbd> Governance `Provider Limits` (`DcdrProviderLimitsConfig`) are now enforced for **both** intent execution (`/api/execution/*`) and the OpenAI-compatible gateway (`/v1/*`), through one shared gate (`src/services/provider.limits.service.ts`). Provider/model `enabled:false` gates block a candidate the same way `denyProviders` already does (intent execution filters blocked candidates once before the retry/fallback loop in `executeCandidatesWithRetry()` so fallback to the next BYOK candidate still works; gateway rejects at dispatch time via `proxyGatewayRequest()`). `maxCalls` combines a backend-supplied baseline (`providerLimits.providers[p].usage.calls`) with a real-time local Redis/in-memory delta, mirroring the existing tenant-wide monthly-quota baseline pattern in `tenant.middleware.ts`. `maxBudget` is enforced purely against a backend-supplied baseline (`usage.budget.consumedUsd`) — the runtime does not compute cost from token usage × catalog pricing, avoiding drift from backend's own billing calculation. Provider-level and model-level gates apply independently (both must pass). `IntentProvider.DCDR` (virtual provider) candidates are gate-checked against their *effective* upstream provider/model (e.g. `OPEN_AI`/`gpt-4o-mini`), not the raw `DCDR`/prefixed-virtual-id fields, since Governance rules are authored against the effective provider and the real substitution otherwise only happens later at the executor boundary. When every candidate is blocked, both surfaces return a stable `PROVIDER_LIMIT_EXCEEDED` (HTTP 429 / `error.code = "provider_limit_exceeded"` on the gateway). Fail-open and currently inert in production: enforcement only activates once backend populates `providerLimits` (and its `usage` baselines) on `/dcdr/entitlements` and `/dcdr/token/check` — see `RM-045` in `internal_docs/ROADMAP.md` for the exact backend requirement.
- <kbd>CONTRACTS</kbd> v2.8.3 — Added optional `DcdrEntitlementsContract.providerLimits` (reusing `DcdrProviderLimitsConfig`) so the tenant-scoped Governance provider/model limits already exposed to the gateway via `/dcdr/token/check` can also be surfaced through `/dcdr/entitlements`, the path intent execution actually consumes.
### Changed
- <kbd>RUNTIME</kbd> Factored the candidate-selection error-response builder out of `selectCandidatesOrErrorResponse()`'s catch block into a shared `buildCandidateSelectionErrorResponse()` helper in `run.service.ts`, so both synchronous planning failures (e.g. the DCDR virtual gate) and the new async Governance Provider Limits pre-loop gate produce the same stable report/error shape instead of duplicating the logic.

## [20260721.1] — 01:57UTC

<!--
sourceCommit: 4bf6eb7088b880209be3adf74823d4767b4dd559
queuedAtUtc: 
previousMirroredBuild: 20260718.1 (2026-07-18)
contractsSubmodule: c2606d7b9bb6..d6b491c42dd6
-->

### Added
- <kbd>CONTRACTS</kbd> v2.8.3 — Added optional `DcdrEntitlementsContract.providerLimits` (reusing `DcdrProviderLimitsConfig`) so the tenant-scoped Governance provider/model limits already exposed to the gateway via `/dcdr/token/check` can also be surfaced through `/dcdr/entitlements`, the path intent execution actually consumes. Contract-only in this pass — runtime enforcement for intent mode is tracked as `RM-045` (planned).

## [20260718.1] — 10:45UTC

<!--
sourceCommit: 03398aeb3603e4846d00b172a93bb4ce51fc5a4a
queuedAtUtc: 
previousMirroredBuild: 20260714.4 (2026-07-14)
contractsSubmodule: 697c24091302..c2606d7b9bb6
-->

### Added
- <kbd>CONTRACTS</kbd> v2.8.2 — Promoted `DcdrGatewayTokenCheckResponse` to the public `service-tokens.contract` surface. It was already being imported by `equivalo-backend` as if published, but only existed as a local interface in `dcdr-runtime`'s `DcdrAPIClient`.
### Fixed
- <kbd>RUNTIME</kbd> **Bug fix**: `array<enum>` output fields (`itemsType: "enum"`) were not handled by the OpenAI structured-output Zod schema builder and silently fell back to a freeform "any JSON value" type, which embeds an open (`additionalProperties`-unset) object node. OpenAI's Chat Completions structured outputs (`response_format: json_schema`) reject any schema containing such a node, so any intent whose `outputSchema` included an `array<enum>` field (e.g. `suitableAssetClasses`) failed every OpenAI chat-completions call with `400 Invalid schema for response_format`. Fixed by building a proper `z.enum()`-backed array type for `itemsType: "enum"`.
- <kbd>RUNTIME</kbd> **Bug fix**: `array<enum>` fields in `inputSchema`/`outputSchema` (via `ModelSemantics.validateAndNormalizeContract`, used to validate/normalize `vars`) always rejected every array element with `"values" must be a non-empty string[] for enum`, because the allowed enum values live on the array-level definition but were never read for `type: array` nodes, nor forwarded to the synthetic per-item definition used to validate each element. Any request sending a value for an `array<enum>` variable (e.g. `excludedSectors: ["TECHNOLOGY", "HEALTHCARE"]`) failed validation regardless of the actual values sent.

## [20260714.4] — 16:47UTC

<!--
sourceCommit: e25fa7c52be113f64c802d0a153676dc6d0f6b44
queuedAtUtc: 
previousMirroredBuild: 20260714.2 (2026-07-14)
contractsSubmodule: dd450259b05b..697c24091302
-->

### Added
- <kbd>CONTRACTS</kbd> v2.8.1 — Added optional top-level `ExecutionLogEvent.cid` so backend can persist `AICallLog.customer` directly from the log envelope instead of deriving tenant identity from `sessionId`.
### Changed
- <kbd>RUNTIME</kbd> Every execution log/event sent to the backend (intent runs, eval/stream sub-runs, and gateway `/v1/*` logs) now sets `executionMode` (`INTENT` or `GATEWAY`) and a top-level `cid` alongside the existing `serviceTokenId`, so backend can resolve tenant/customer identity without deriving it from `sessionId`.

## [20260714.2] — 15:56UTC

<!--
sourceCommit: ff78911326a9c8b05aec1b9d5d80e8b1e5844bd3
queuedAtUtc: 
previousMirroredBuild: 20260713.1 (2026-07-13)
contractsSubmodule: 22f2c820d394..dd450259b05b
-->

### Added
- <kbd>CONTRACTS</kbd> v2.8.0 — Added optional `ExecutionReport.serviceTokenId` so managed customer/service-token executions can expose the backend-issued token id as additive audit metadata without overloading `sessionId` or `context`.
### Changed
- <kbd>RUNTIME</kbd> Runtime now propagates `serviceTokenId` consistently into `ExecutionReport` and backend execution logs for customer-token executions, including standard intent runs, eval/stream/demo flows, gateway logs, and router-level fallback error responses.
- <kbd>CONTRACTS</kbd> v2.7.0 â€” Extended the shared backend log envelope so gateway `/v1/*` traffic can emit additive `executionMode=GATEWAY` metadata plus safe gateway request/response summaries without pretending to be a full intent execution report.
### Added
- <kbd>CONTRACTS</kbd> v2.8.0 — Added optional `ExecutionReport.serviceTokenId` so managed customer/service-token executions can persist the backend-issued token id as additive audit metadata without overloading `context` or `sessionId`.
- <kbd>RUNTIME</kbd> Runtime now propagates the backend-issued `serviceTokenId` into `ExecutionReport` for customer-token intent executions, eval/stream/demo variants, and OpenAI-compatible gateway logs.
- <kbd>RUNTIME</kbd> OpenAI-compatible gateway routes now enqueue backend execution logs through the same shared log pipeline used by intents, using an additive `executionMode=GATEWAY` envelope with safe `/v1/models`, `/v1/responses`, and `/v1/chat/completions` request/response summaries plus resolved provider/model/credential metadata.

## [20260713.1] — 02:41UTC

<!--
sourceCommit: 790d78839d4d24fa482e767fb66faaf84a5c54e4
queuedAtUtc: 
previousMirroredBuild: 20260712.1 (2026-07-12)
contractsSubmodule: 8763bd03c8a2..22f2c820d394
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.7.0 â€” Enriched intent-processing governance rules with typed policy trail metadata (`ProcessingPolicyOutcome`, `ProcessingPolicyReasonCode`) and contract-ready optional region filters on provider/model policy checks, using non-blocking `REGION_CONTEXT_MISSING` trail outcomes when runtime has no explicit region context to enforce.
- <kbd>CONTRACTS</kbd> v2.7.0 â€” Tightened intent-processing governance authoring with shared enum catalogs: provider allow/deny lists now validate against `IntentProvider`, `OUTPUT_POLICY_CHECK.policyRef` now uses `ProcessingOutputPolicyRef`, and `REVIEW_ROUTING.queue` now uses `ProcessingReviewQueue`.
- <kbd>CONTRACTS</kbd> v2.7.0 — Added the public intent-processing contract wave: `processing.contract`, optional `DcdrRegistry.processors` and `IntentContract.processors`, shared validation/default helpers, explicit rule-group metadata for UI grouping, a broader first-wave primitive catalog, enum-backed regex options, and shared condition-tree reuse (`ConditionOp` / `ConditionLogicOp`) so routing-condition builders and processing-rule builders can stay nearly identical in frontend.
### Added
- <kbd>RUNTIME</kbd> Intent processing now executes as a real stage-based engine instead of a no-op scaffold: runtime orders processors deterministically, evaluates optional shared condition trees before each rule, applies built-in switch-dispatched handlers, records bounded trail/evidence, logs the effective `PRE -> INTENT -> POST` pipeline, and handles rule failures explicitly via `FAIL_CLOSED` / `FAIL_OPEN` / `WARN_ONLY` instead of letting handler errors tear down execution opaquely.
- <kbd>RUNTIME</kbd> Intent processing now resolves both `DcdrRegistry.processors` and `IntentContract.processors` with explicit execution order, validates configured processors/conditions at registry-load time, and skips rules cleanly when their shared condition tree does not match.
- <kbd>CONTRACTS</kbd> v2.7.0 — Added a public `processing.contract` surface for the intent-only governed processing engine: shared enums/interfaces for `INPUT`/`OUTPUT` stages, built-in rule kinds, bounded processing/mutation trail reporting, cache-safety metadata, and pure `IntentProcessingSemantics` helpers so frontend/runtime can preview and test the same rule semantics.
- <kbd>RUNTIME</kbd> Added the first intent-processing scaffold: execution reports can now carry a bounded `report.processing` block, runtime preserves the original caller request separately from the processed execution request, and the new no-op `INPUT`/`OUTPUT` processing hooks establish the invariant that future `problemHash`/`runHash` are based on processed input while `outputHash` is based on final post-processed output.
- <kbd>RUNTIME</kbd> Added the first executable OpenAI governance gateway slice with a dedicated `/v1` router, backend-driven gateway token validation (`/dcdr/token/check`), an OpenAI-compatible `GET /v1/models` surface filtered by provider bindings and provider/model governance limits, and real SDK-backed passthrough proxying for `/v1/responses` and `/v1/chat/completions` on currently supported OpenAI-compatible providers (`OPEN_AI`, `GROK`, `MISTRAL`), including stable gateway-side normalization for backend/credentials/upstream failure paths.
- <kbd>RUNTIME</kbd> Extended the `/v1` governance gateway to accept runtime-configured `OPEN_AI_COMPATIBLE` upstreams through `DCDR_GATEWAY_OPENAI_COMPATIBLE_BASE_URL` plus `DCDR_GATEWAY_OPENAI_COMPATIBLE_MODEL_IDS`, and added explicit `openai-compatible/<modelId>` routing to avoid cross-provider model ambiguity without inventing a new backend token flow.

## [20260712.1] — 12:16UTC

<!--
sourceCommit: 5339a4fe8e689270c6b4b423dc3db8d720e0d656
queuedAtUtc: 
previousMirroredBuild: 20260706.1 (2026-07-06)
contractsSubmodule: 9d32bebc1a1f..8763bd03c8a2
-->

### Fixed
- <kbd>CONTRACTS</kbd> v2.5.3 — **Production-breaking bug fix**: `provider.contract.ts` defined the `IntentProvider` enum and, in the same file, re-exported (`export * from`) `provider.catalog.contract`, which imports `IntentProvider` back and uses it as an object key at module top level. Node's `require()` tolerated this self-referential cycle by textual evaluation order, but bundler CJS-interop (Rollup/Vite, esbuild, webpack) is not guaranteed to preserve that order, so production client bundles could crash at module-eval time with `Cannot read properties of undefined (reading 'DCDR')`. Fixed by moving the re-export into the root barrels only (one-directional DAG), added a dedicated `@dcdr/contracts/provider.catalog.contract` subpath export for catalog symbols, and added `tools/check-no-barrel-cycles.js` (gated on `check`/`test`/`test:ci`/`prepublishOnly`) to reject this file shape repo-wide going forward.
- <kbd>CONTRACTS</kbd> Fixed a stray-character typo in `provider.catalog.contract.ts` (accidentally introduced in the v2.5.3 fix above) that broke `tsc`/`npm run build`.
- <kbd>RUNTIME</kbd> Updated internal imports (`anthropic.provider.ts`, `gemini.provider.ts`, `openai.provider.ts`, `provider.executor.service.ts`, and related tests) that pulled catalog-only symbols (`ProviderModelRegistry`, `PROVIDER_MODEL_E2E_OVERRIDES`, etc.) through `@dcdr/contracts/provider.contract` to import them from the new `@dcdr/contracts/provider.catalog.contract` subpath instead, ahead of the contracts fix above.
- <kbd>RUNTIME</kbd> **Security fix**: `getManagedAsset`, `deleteManagedAsset`, and `getManagedAssetSignedUrl` now reject any client-supplied `assetPath` that falls outside the caller's own tenant-scoped `basePath`.
### Added
- <kbd>CONTRACTS</kbd> v2.6.0 — Added a public `provider-limits.contract` surface (`DcdrProviderLimitGate`, `DcdrProviderLimitEntry`, `DcdrProviderLimitsConfig`) so backend/runtime/UI can share one tenant-level provider/model governance contract for enablement, call windows, and budget windows.
- <kbd>CONTRACTS</kbd> Added the well-known service-token scope `gateway` plus optional `gatewayBindings` entries (`provider` + `credentialRef`) so a tenant service token can point each provider to one backend-managed credential reference for the future OpenAI-compatible proxy surface.

## [20260706.1] — 00:33UTC

<!--
sourceCommit: b27445c16f75a2223d85c9d610a2425dc28a6f9d
queuedAtUtc: 
previousMirroredBuild: 20260704.1 (2026-07-04)
contractsSubmodule: b1d38a90d440..9d32bebc1a1f
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.5.2 — Added optional `ExecutionReport.request.vars` so the original, pre-interpolation `ExecuteIntentRequest.vars` can be preserved end-to-end.
- <kbd>RUNTIME</kbd> Every execution log/event sent to the backend (success, error, retry, fallback, and eval sub-runs) now includes `request.vars` sourced directly from the original incoming request, never from rendered prompt text or derived template defaults, so backend `AICallLog.requestVars` persistence and dataset-evaluation replay use the exact logical input the caller sent. `context` behavior is unchanged and `vars` is not duplicated into `context`.

## [20260704.1] — 15:04UTC

<!--
sourceCommit: 1ce633bffbc15ff62607f3d99830b86f1afa5c0b
queuedAtUtc: 
previousMirroredBuild: 20260703.4 (2026-07-03)
contractsSubmodule: 745aa294da80..b1d38a90d440
-->

### Changed
- <kbd>CONTRACTS</kbd> Re-curated Anthropic `claude-sonnet-5` with the 1024-token baseline: it remains `SUPPORTED`, now publishes `IMAGE` and `DOCUMENT` across `INLINE`/`URL`/`ASSET`, and keeps `TEXT` out of the promoted rectangle because URL-based text still fails the canonical comprehension assertion.
- <kbd>CONTRACTS</kbd> Reclassified Anthropic `claude-fable-5` to `SUPPORTED` after rerunning `text + structured` with the 1024-token baseline, published a full `TEXT`/`IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle, and documented that very small text budgets can be consumed by thinking before any visible text is emitted.
### Added
- <kbd>CONTRACTS</kbd> Expanded the Gemini provider catalog with newly discovered `gemini-3.1-flash-lite-image`, `gemini-3.5-live-translate-preview`, and `gemini-omni-flash-preview`, classifying the image/video families as non-CHAT entries and documenting their current runtime limitations conservatively from provider E2E.
- <kbd>CONTRACTS</kbd> Expanded the Anthropic provider catalog with newly discovered `claude-sonnet-5` and `claude-fable-5` chat model IDs as uncured `IN_PROGRESS` entries, and marked the local-only compatibility alias `claude-haiku-4-5` as `LEGACY` for Anthropic provider E2E.
- <kbd>CONTRACTS</kbd> Expanded the Mistral provider catalog with newly discovered chat/code and embedding model IDs from `/v1/models`, leaving them conservatively uncured as `runtimeSupport=IN_PROGRESS` while continuing to exclude Mistral OCR/moderation families from the current runtime surface.
- <kbd>CONTRACTS</kbd> Added `IntentType.VIDEO_GENERATION` and cataloged the newly discovered xAI `grok-imagine-*` image/video generation model IDs as non-CHAT entries with conservative `runtimeSupport=IN_PROGRESS` pending adapter work and curation.

## [20260703.4] — 22:30UTC

<!--
sourceCommit: 6d37fab0234625a6cf6bf2298b8b767a311e5739
queuedAtUtc: 
previousMirroredBuild: 20260703.3 (2026-07-03)
contractsSubmodule: 69e3d070da5e..745aa294da80
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.5.0 — Added a public tracked-call rating matrix contract (`tracked-call-rating.contract`) with a versioned multimodal multiplier table, aggregate guardrails, and shared default v1 metadata so backend/UI can render and audit the same policy the runtime uses.
- <kbd>RUNTIME</kbd> Runtime now computes `ExecutionReport.trackedCallAccounting` from the shared tracked-call rating matrix instead of the old placeholder `multimodal_rating_not_applied`, including fractional multipliers, dominant bucket metadata, and aggregate non-text input-size guardrails.

## [20260703.3] — 20:07UTC

<!--
sourceCommit: 8606e96bcefd2258ddf023c5c77a80c12699a158
queuedAtUtc: 
previousMirroredBuild: 20260703.1 (2026-07-03)
contractsSubmodule: ac5cf2ac9689..69e3d070da5e
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.4.3 — Extended multimodal execution report evidence so URL-backed `inputParts` preserve `sourceKind=URL` plus the caller-provided `url`, and ASSET-backed references preserve `storageId` + `storageOwner` for QC/backend rehydration without exposing inline payload bytes.
### Added
- <kbd>RUNTIME</kbd> Execution reports now retain caller-supplied remote URLs for `inputParts` with `source.kind=URL`, and ASSET-backed references now carry `storageId` plus `storageOwner` so backend QC panels can reload evidence from system vs customer storage deterministically.
- <kbd>RUNTIME</kbd> Populate `ExecutionReport.inputParts` (as `ExecutionReportPart[]`) for every successful multimodal execution so backends can track which assets were used as input for QC and audit workflows. Each report part carries `type`, `mimeType`, `name`, `sizeBytes`, `sha256`, and the report-safe `asset` reference (`storageId`, `storageOwner`, `assetPath`) for ASSET-backed parts. Inline binary content is intentionally excluded.

## [20260703.1] — 16:56UTC

<!--
sourceCommit: e18cf3f4626919944c7c1ab4e0ef89aeb74e6494
queuedAtUtc: 
previousMirroredBuild: 20260701.1 (2026-07-01)
contractsSubmodule: cb9b46e0a40c..ac5cf2ac9689
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.5.0 — Extended `ExecutionReportPart` so URL-backed `inputParts` can preserve `sourceKind=URL` plus the caller-provided `url` in execution reports, while keeping inline payload bytes excluded.
### Added
- <kbd>RUNTIME</kbd> Execution reports now retain caller-supplied remote URLs for `inputParts` with `source.kind=URL`, alongside the source kind metadata, so backend QC/audit flows can distinguish URL-backed inputs from managed assets.

## [20260701.1] — 11:59UTC

<!--
sourceCommit: aa0855043206c050829e77b299b3e0701745eee8
queuedAtUtc: 
previousMirroredBuild: 20260630.1 (2026-06-30)
contractsSubmodule: eeca3f8a4783..cb9b46e0a40c
-->

### Added
- <kbd>RUNTIME</kbd> Populate `ExecutionReport.inputParts` (as `ExecutionReportPart[]`) for every successful multimodal execution so backends can track which assets were used as input for QC and audit workflows. Each report part carries `type`, `mimeType`, `name`, `sizeBytes`, `sha256`, and the full `asset` reference (`datasource` + `assetPath`) for ASSET-backed parts. Inline binary content is intentionally excluded.

## [20260630.1] — 19:17UTC

<!--
sourceCommit: c47c253a83de325a7517dd6a7ceb3773dc3cbcd7
queuedAtUtc: 
previousMirroredBuild: 20260629.6 (2026-06-29)
contractsSubmodule: 87e1a98b927b..eeca3f8a4783
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.4.0 — Added shared backend/runtime `storage.credentials.contract` exports for backend-managed asset-storage credential resolution, keeping `DcdrAssetStorageDescriptor` secret-free while formalizing Google Cloud today and future `S3`/`FTP`/`NAS` credential payloads through shared interfaces.
- <kbd>RUNTIME</kbd> Managed asset storage now resolves backend-managed storage credentials per tenant `storageId`/`datasource.id` with short in-memory caching, while preserving compatibility for the current shared cloud-managed storage through an explicit default `storageId`.

## [20260629.6] — 18:51UTC

<!--
sourceCommit: 62c0c85b70a4f2647745d0e5d5a9294f88663564
queuedAtUtc: 
previousMirroredBuild: 20260629.4 (2026-06-29)
contractsSubmodule: 5e097ffd48ad..87e1a98b927b
-->

### Changed
- <kbd>CONTRACTS</kbd> v2.3.1 — Re-exported asset contract surface from the root `@dcdr/contracts` barrel: `DcdrAssetScope`, `DcdrAssetStorageDescriptor`, `DcdrAssetMetadata`, `DcdrAssetMetadataAttributes`, `DcdrAssetUploadRequest/Response`, `DcdrAssetGetRequest/Response`, `DcdrAssetDeleteRequest/Response`, `ASSET_TYPE_VALUES`, `ASSET_TYPE_LABELS`. Added `types` conditions to all `exports` entries and a full `typesVersions` map for compatibility with `moduleResolution: node` and `node16`/`bundler` consumers.

## [20260629.4] — 17:00UTC

<!--
sourceCommit: 61a9bd2ce73769737d6d496e920873cdceacce05
queuedAtUtc: 
previousMirroredBuild: 20260613.2 (2026-06-13)
contractsSubmodule: c8b48151182f..5e097ffd48ad
-->

### Fixed
- <kbd>RUNTIME</kbd> Fixed managed asset lifecycle tests (`/api/assets/upload`, `/api/assets`, `DELETE /api/assets`) and signed-URL tests failing in CI with HTTP 400 / `CONFIG_ERROR` because `storage/credentials/cloud.test.credentials.json` is gitignored and not available on CI agents. Added `setManagedStorageRuntimeConfigForTests()` to `execution.asset.storage.service` so tests can inject a mock storage config directly into the cache, bypassing disk reads entirely. Production behavior is unchanged.
### Added
- <kbd>CONTRACTS</kbd> Added optional `PromptParameters.preferred_api` (`CHAT_COMPLETIONS` | `RESPONSES`) so implementations can override the upstream OpenAI-compatible API surface explicitly through `runtimeConfig`.
- <kbd>RUNTIME</kbd> Added a shared provider-side multimodal materialization path for `INLINE` / `URL` / `ASSET` inputs so Gemini, Anthropic, and OpenAI can resolve remote and managed assets through one common helper instead of per-adapter ad hoc logic.
- <kbd>CONTRACTS</kbd> Added empty-ready `runtimeSupport.outputParts` catalog metadata so provider/model curation can track verified multimodal output-part families and source kinds separately from `inputParts`.
- <kbd>CONTRACTS</kbd> Added explicit managed asset lifecycle contracts (`DcdrAssetUploadRequest/Response`, `DcdrAssetGetRequest/Response`, `DcdrAssetDeleteRequest/Response`, `DcdrAssetStorageDescriptor`) plus `DcdrRuntimeClient.uploadAsset()`, `getAsset()`, and `deleteAsset()`.
- <kbd>CONTRACTS</kbd> Added client-side asset helpers `prepareAssetUploadRequest()` and `prepareAssetInputPart()` so TypeScript callers can upload with minimal fields and build asset-backed `inputParts` without handcrafting the wire shape.
- <kbd>CONTRACTS</kbd> Added `PromptVariableType.ASSET` plus `ExecutionInputPart.variableName` so intents can declare strong asset slots and callers can bind each input part to a named prompt variable instead of relying on file names.
- <kbd>CONTRACTS</kbd> Added semantic managed asset metadata (`title`, `description`, `alt`, `tags`, string `attributes`) and a shared default `buildDcdrAssetCacheKey()` helper for tenant-global cache identity.
- <kbd>RUNTIME</kbd> Added dedicated managed asset lifecycle routes under `/api/assets` for upload/get/delete, with tenant-default storage resolution, canonical asset cache paths, CRUD logging, mocked integration coverage, and opt-in real-bucket E2E coverage.
- <kbd>RUNTIME</kbd> Added cloud-only managed storage persistence for inline non-text execution `outputParts`, resolving the target bucket from `storage/config/<NODE_ENV>.json` and `storage/credentials/cloud.<NODE_ENV>.credentials.json`, while keeping freeware/runtime mode inline-only plus an opt-in real-bucket E2E suite (`npm run test:e2e:storage`).
### Changed
- <kbd>RUNTIME</kbd> Multimodal provider smoke tests and official curators now use `max_tokens=1024` as the default cross-provider baseline instead of the older `256`-token cap, reducing avoidable empty-response false negatives during paid comprehension curation.
- <kbd>RUNTIME</kbd> Gemini, Anthropic, and OpenAI provider adapters now use the shared multimodal input materializer and must fail explicitly when `URL` or `ASSET` inputs cannot be resolved, instead of silently discarding those parts before provider submission.
- <kbd>RUNTIME</kbd> OpenAI-compatible adapters now accept `implementation.runtimeConfig.preferred_api` (`CHAT_COMPLETIONS` or `RESPONSES`) as an explicit routing override, so provider-specific surfaces like Grok multimodal can force the correct upstream API without baking more vendor policy into the generic adapter.
- <kbd>CONTRACTS</kbd> Published the first conservative Grok multimodal rectangle for `grok-build-0.1`: `DOCUMENT` now clears the comprehension-grade curator across `INLINE`, `URL`, and `ASSET`, the entry explicitly prefers `RESPONSES` for multimodal execution, and broader `IMAGE`/`TEXT`/`AUDIO`/`VIDEO` claims remain deferred until the mixed matrix is resolved.
- <kbd>CONTRACTS</kbd> Curated `grok-4.3` with the comprehension-grade Grok curator via Responses API and published an `IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle: both asset families pass all three source kinds cleanly; `TEXT` passes `URL` only and cannot be included without overstating `INLINE`/`ASSET`; `AUDIO` and `VIDEO` echo filename metadata only across all source kinds.
- <kbd>CONTRACTS</kbd> Curated `grok-4.20-0309-non-reasoning` with the comprehension-grade Grok curator via Responses API and published a `TEXT`/`IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle: all three asset families pass all three source kinds. `AUDIO` echoes filename metadata only. `VIDEO` generates plausible-but-mutually-inconsistent scene hallucinations across source kinds (city sidewalk / riverside path / industrial plant for the same fixture), confirming no genuine video processing.
- <kbd>CONTRACTS</kbd> Curated `grok-4.20-0309-reasoning` with the comprehension-grade Grok curator via Responses API and published an `IMAGE`/`DOCUMENT` x `INLINE`/`URL`/`ASSET` multimodal rectangle: both asset families pass all three source kinds. `TEXT` passes `INLINE` and `URL` but fails `ASSET` (same metadata-suppression pattern as `grok-4.3`) and cannot be included without overstating the rectangle. `AUDIO` echoes filename metadata across all source kinds. `VIDEO` consistently echoes filename metadata across all source kinds with no actual video processing.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-2.5-flash` with the canonical comprehension-grade multimodal harness and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated Gemini `gemini-3.5-flash` one model at a time with the canonical comprehension-grade multimodal harness and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated Gemini rolling alias `gemini-flash-latest` with the canonical comprehension-grade multimodal harness and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Published conservative partial Gemini multimodal rectangles for `gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-preview`, and `gemini-flash-lite-latest` based on one-model-at-a-time comprehension runs instead of treating those mixed matrices as all-or-nothing support.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for `gemini-2.5-flash-lite`: `TEXT`/`IMAGE`/`VIDEO`/`DOCUMENT` pass across `INLINE`, `URL`, and `ASSET`, while `AUDIO` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Corrected Gemini pro-family multimodal curation to stop forcing thinking off in structured entry probes: `gemini-3.1-pro-preview-customtools`, `gemini-3.1-pro-preview`, and rolling alias `gemini-pro-latest` no longer reproduce the old `TEXT/INLINE` `PARSE_FAIL`, while the earlier `gemini-3-flash-preview` upstream fetch failure also proved transient on rerun.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for rolling alias `gemini-pro-latest`: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` now pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for `gemini-3.1-pro-preview-customtools`: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>RUNTIME</kbd> Gemini text `inputParts` now lead the first user prompt turn instead of trailing the instruction text, fixing structured `PARSE_FAIL` cases where some pro-family models conflated remote text payloads with the user instruction.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-3.1-pro-preview` after the dedicated-turn text fix and expanded its conservative partial multimodal rectangle to `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`; `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Published a conservative partial Gemini multimodal rectangle for `gemini-3-flash-preview`: `TEXT`/`AUDIO`/`DOCUMENT` pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` fails the canonical image cue and `VIDEO` only clears the current comprehension threshold on `URL`.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-2.5-pro` after hardening the text-only multimodal curation user turn: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` now pass across `INLINE`, `URL`, and `ASSET`, while `IMAGE` remains outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Re-checked Gemini `gemini-3-pro-preview`, confirmed it still fails the multimodal `TEXT/INLINE` entry probe with upstream `MODEL_NOT_FOUND` (404), and marked it `LEGACY` for Gemini E2E curation so future runs stop burning probes on this account-gated ID.
- <kbd>CONTRACTS</kbd> Reframed Gemini multimodal status as conservative `IN_PROGRESS`: earlier `SUPPORTED` / `15/15` claims are treated as provisional until the model is re-curated with comprehension-grade evidence under the normalized transport contract.
- <kbd>RUNTIME</kbd> OpenAI Responses now hydrates managed asset-backed `inputParts` before provider execution and maps `TEXT` URL/asset inputs to provider-native `input_text` content, reducing mixed results that previously depended on metadata-only runtime context.
- <kbd>RUNTIME</kbd> OpenAI Responses now materializes signed Google Cloud Storage `image/document` input-part URLs inline before provider submission, while leaving ordinary public URLs remote, to avoid provider-side fetch failures on managed multimodal fixture URLs without forcing all URL inputs through local download.
- <kbd>CONTRACTS</kbd> Adjusted OpenAI mixed-matrix `runtimeSupport.inputParts` curation to publish conservative partial `SUPPORTED` rectangles through `supportedAssetTypes`/`supportedSourceKinds` instead of flattening those entries to all-or-nothing `FAILING` when only part of the matrix is verified.
- <kbd>CONTRACTS</kbd> Refreshed OpenAI multimodal `inputParts` evidence after targeted implementation investigations: `gpt-4o-2024-08-06` now completes a clean `15/15` matrix once managed-asset cache-key collisions are isolated, while `gpt-5.1-codex-max` and `o3` now publish tighter conservative rectangles based on reruns after the Responses JSON parsing hardening.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1-pro-2025-03-19` `runtimeSupport.inputParts` in a clean non-debug rerun and confirmed a full `15/15` multimodal matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>RUNTIME</kbd> Added Anthropic multimodal `inputParts` provider handling for hydrated `TEXT`/`IMAGE`/`DOCUMENT` inputs plus matching Anthropic smoke/curation E2E harnesses, while keeping `AUDIO`/`VIDEO` explicitly outside the currently supported Anthropic input-part surface.
- <kbd>CONTRACTS</kbd> Re-curated Anthropic multimodal `runtimeSupport.inputParts` with the comprehension-grade curator and published conservative per-model support rectangles instead of one shared Claude claim: `claude-opus-4-8`, `claude-opus-4-6`, `claude-opus-4-5-20251101`, `claude-opus-4-1-20250805`, `claude-haiku-4-5`, and `claude-haiku-4-5-20251001` support `TEXT`/`IMAGE`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`.
- <kbd>CONTRACTS</kbd> Published narrower Anthropic multimodal rectangles where the current comprehension contract stayed mixed: `claude-opus-4-7` and `claude-sonnet-4-6` now publish only `IMAGE`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`, while `claude-sonnet-4-5-20250929` currently publishes only `DOCUMENT`; `AUDIO`/`VIDEO` remain outside every Anthropic Messages support rectangle because the runtime path rejects them deterministically with `MODEL_UNSUPPORTED`.
- <kbd>CONTRACTS</kbd> Refreshed the public supported-models generator/docs so provider sections now expose a concise `inputParts` summary per model from the latest curated OpenAI and Anthropic catalog metadata.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-mini` `runtimeSupport.inputParts` after asset hydration plus the Responses signed-URL workaround and kept it `SUPPORTED` for text/image/audio/video/document inputs across `INLINE`, `URL`, and `ASSET` sources after a clean `15/15` multimodal matrix.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano` `runtimeSupport.inputParts` after asset hydration plus the Responses signed-URL workaround and curator fixes: document `INLINE/URL/ASSET` and image `ASSET` now pass, but the model still remains `FAILING` overall due to mixed failures in `text URL/ASSET`, `audio URL/ASSET`, and `video ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5` `runtimeSupport.inputParts` with the corrected multimodal curator and downgraded that surface to mixed support: document `INLINE/URL/ASSET` now passes consistently, but all text sources and several image/audio/video combinations still fail on the Responses path.
- <kbd>CONTRACTS</kbd> Re-ran OpenAI `gpt-5` one-model multimodal curation on 2026-06-27 with the `URL` slice completed under signed-URL fallback parity: the entry remains conservatively published as `DOCUMENT` across `INLINE`/`URL`/`ASSET`, while the updated evidence now shows `IMAGE` passing on `INLINE`/`URL`, `VIDEO` passing on `INLINE`, and `TEXT`/`AUDIO` still failing across all three source kinds with `PROVIDER_EMPTY_RESPONSE`.
- <kbd>CONTRACTS</kbd> Hardened the OpenAI curator for the `gpt-5` family after investigating empty multimodal responses under the smaller structured probe: `gpt-5` now clears `AUDIO` as well as `DOCUMENT` across `INLINE`/`URL`/`ASSET`, while `TEXT INLINE`, `IMAGE URL`, and all `VIDEO` source kinds still remain outside the published support rectangle.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-2025-08-07` with the new `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; only `TEXT URL` and `TEXT ASSET` still fail on the Responses path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-chat-latest` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Completed batch comprehension-grade curation across all remaining OpenAI models with `inputParts.status = IN_PROGRESS` using the `1024`-token multimodal baseline: Responses-path models (`gpt-5.x` family, `o1`–`o4` reasoning series including `o1`, `o1-2024-12-17`, `o3`, `o3-2025-04-16`, `o3-pro`, `o3-pro-2025-06-10`, `o4-mini`, and `o1-pro` family) confirm a clean `15/15` matrix; Chat Completions-path models (`gpt-4.1`, `gpt-4o`, `gpt-4o-mini` families) publish `TEXT`/`IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET` rectangles since audio and video fail with upstream 400 on that API surface; `o3-mini` and `o3-mini-2025-01-31` publish `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` since IMAGE consistently fails 400 on the Responses path; FAILING models (`gpt-4o-2024-05-13`, `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo` families) remain `FAILING` — those pre-JSON-mode models cannot reliably return the structured comprehension response regardless of token budget.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-codex` with the `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; `TEXT INLINE` and `VIDEO URL/ASSET` remain outside the current comprehension-grade support rectangle.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-mini` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-mini-2025-08-07` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano-2025-08-07` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro` with the `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; `TEXT` still fails across all three source kinds on the Responses path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro-2025-10-06` with the `1024`-token multimodal baseline and expanded its published rectangle to `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; `TEXT` still fails across all three source kinds on the Responses path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-2025-11-13` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-chat-latest` with the `1024`-token multimodal baseline and confirmed a clean `15/15` matrix across `TEXT`/`IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` for `INLINE`/`URL`/`ASSET`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.5` `runtimeSupport.inputParts` with the corrected multimodal curator and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources; the earlier failing note on that entry was stale copied metadata, not a real regression.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-2026-03-05` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated Anthropic `claude-opus-4-7`, `claude-sonnet-4-6`, and `claude-sonnet-4-5-20250929` multimodal rectangles with the `1024`-token baseline and confirmed the prior rectangles are accurate: `claude-opus-4-7` and `claude-sonnet-4-6` maintain `IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET`; `claude-sonnet-4-5-20250929` maintains `DOCUMENT` × `INLINE`/`URL`/`ASSET`. `TEXT` returns 200 but does not confirm `sawProvidedInput=true` on any source kind (model behavior, not token budget). Rate-limit transients observed on a few cells are non-structural.
- <kbd>CONTRACTS</kbd> Re-curated Gemini `gemini-2.5-pro` with the `1024`-token baseline and expanded its published rectangle: `IMAGE` now clears the canonical comprehension cue on `INLINE` and `ASSET`, joining `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` in the support rectangle; `URL` fixtures were unavailable this run but were confirmed passing in the prior curation.
- <kbd>CONTRACTS</kbd> Re-curated Gemini pro-family rolling aliases `gemini-3.1-pro-preview` and `gemini-pro-latest` with the `1024`-token baseline: `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` rectangles are confirmed; occasional `PARSE_FAIL` on `TEXT` for one source kind per model was treated as transient (inconsistent intra-run pattern, contradicts prior June 18 confirmation); `IMAGE` still fails the canonical cue across all source kinds.
- <kbd>CONTRACTS</kbd> Re-curated Gemini flash models `gemini-3.1-flash-lite-preview`, `gemini-3.1-flash-lite`, `gemini-flash-lite-latest`, `gemini-3-flash-preview`, and `gemini-2.5-flash-lite` with the `1024`-token baseline: all published rectangles confirmed on `INLINE`/`ASSET` (URL fixtures unavailable this run); no previously excluded modality cleared the comprehension threshold; `URL` source-kind coverage carried forward from prior June 17–18 runs.
- <kbd>CONTRACTS</kbd> Re-curated Grok `grok-4.3` and `grok-4.20-0309-reasoning` with the `1024`-token baseline: both confirm `IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET`; `TEXT` remains outside both rectangles (inconsistent `comprehensionEcho` pattern across source kinds); `AUDIO` and `VIDEO` fail canonical comprehension cues.
- <kbd>CONTRACTS</kbd> Re-curated Grok `grok-build-0.1` with the `1024`-token baseline and expanded its published rectangle: `IMAGE` now passes across `INLINE`/`URL`/`ASSET` (previously only `URL` and `ASSET` cleared), promoting the rectangle from `DOCUMENT` to `IMAGE`/`DOCUMENT` × `INLINE`/`URL`/`ASSET`; `TEXT` fails `comprehensionEcho` on all three source kinds and `AUDIO`/`VIDEO` fail canonical comprehension cues.
- <kbd>RUNTIME</kbd> Added Mistral multimodal `inputParts` provider handling: the Mistral adapter now accepts a content-array message shape (mirroring the OpenAI Chat Completions pattern) to inject `image_url` chunks alongside the standard prompt for `IMAGE` inputs, while `AUDIO`/`VIDEO`/`DOCUMENT` are silently skipped since the Mistral standard chat API does not support those modalities. Requires `NODE_OPTIONS=--experimental-vm-modules` due to `@mistralai/mistralai` v2.2.5 being ESM-only.
- <kbd>CONTRACTS</kbd> Curated Mistral multimodal `runtimeSupport.inputParts` with the comprehension-grade curator across all 10 catalog models and published conservative `IMAGE` × `INLINE`/`URL`/`ASSET` rectangles for the 7 vision-capable models: `mistral-large-latest`, `mistral-medium-latest`, `mistral-small-latest`, `ministral-14b-latest`, `ministral-8b-latest`, `ministral-3b-latest` (vision support on this edge model is not advertised but passes comprehension cues), and `mistral-vibe-cli-latest`. Text-only models `mistral-tiny-latest`, `codestral-latest`, and `mistral-code-latest` reject image input with upstream `400 PROVIDER_ERROR` and have no `inputParts` block.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro-2026-03-05` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.3-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.3-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-2025-12-11` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-pro-2025-12-11` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-mini-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-nano-2026-03-17` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.4-pro-2026-03-05` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.3-chat-latest` with the `1024`-token multimodal baseline and reconfirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET`.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.3-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-2025-12-11` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.2-chat-latest` with the `1024`-token multimodal baseline and reconfirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET`.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.2-codex` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1-2025-11-13` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-codex` with the `1024`-token multimodal baseline and promoted a conservative `SUPPORTED` rectangle for `IMAGE`/`AUDIO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; the same rerun showed `TEXT` only passing via `ASSET`, `AUDIO URL` failing with empty output, and `VIDEO` failing across all three sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/audio/video combinations still failed on the Responses path, `document INLINE/URL/ASSET` passed, `image ASSET` passed, `image INLINE` returned empty output, and `image URL` failed with `PARSE_FAIL`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-2025-08-07` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/audio/video combinations still failed on the Responses path, while `image INLINE/URL/ASSET` and `document INLINE/URL/ASSET` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5-chat-latest` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-codex` `runtimeSupport.inputParts` and kept that surface `FAILING`: audio `INLINE` returned a malformed non-JSON response, audio `ASSET` failed with empty output, video `INLINE` failed with empty output, and video `URL/ASSET` returned malformed non-JSON responses while all text/image/document combinations plus audio `URL` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5-mini-2025-08-07` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.5-pro` `runtimeSupport.inputParts` directly on the exact entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.5-pro-2026-04-23` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-nano-2025-08-07` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text combinations still failed, `image ASSET` failed with empty output, and `audio URL` failed with empty output, while `image INLINE/URL`, `audio INLINE/ASSET`, all video combinations, and all document combinations passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1-2025-04-14` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1-mini-2025-04-14` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/image/audio/video combinations failed with empty output on the Responses path, while `document INLINE/URL/ASSET` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4.1-nano-2025-04-14` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5-pro-2025-10-06` `runtimeSupport.inputParts` and kept that surface `FAILING`: all text/audio/video combinations failed with empty output, `image INLINE/URL` failed with empty output, `image ASSET` passed, and `document INLINE/URL/ASSET` passed.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4o` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4o-2024-08-06` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text/image/audio/video passed across `INLINE/URL/ASSET`, document `INLINE/URL` passed, and document `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4o-2024-11-20` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4o-mini-2024-07-18` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4o-2024-05-13` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4-turbo` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4-turbo-2024-04-09` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all image/audio/video/document combinations plus text `INLINE/URL` failed with `PARSE_FAIL`, and text `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-4-0613` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/document combinations plus video `INLINE/URL` failed with `PARSE_FAIL`, and video `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo-0125` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo-1106` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio combinations plus video `INLINE/URL/ASSET` and document `INLINE/URL` failed with `PARSE_FAIL`, and document `ASSET` failed with a provider-side missing-object error for the managed fixture path.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-3.5-turbo-16k` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/image/audio/video/document combinations failed with `PARSE_FAIL` across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o4-mini` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o4-mini-2025-04-16` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o3-pro` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `URL` passed, text `INLINE` failed with `PARSE_FAIL`, text `ASSET` failed with empty responses output, and all image/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o3-pro-2025-06-10` `runtimeSupport.inputParts` directly on the exact version-pinned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3-2025-04-16` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `INLINE` and audio `URL` failed with empty responses output, while text `URL`/`ASSET` and all image/video/document plus audio `INLINE`/`ASSET` combinations passed across the exercised sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3-mini` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources, while image `INLINE`/`URL`/`ASSET` each failed with upstream provider error `400`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o3-mini-2025-01-31` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources, while image `INLINE`/`URL`/`ASSET` each failed with upstream provider error `400`.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `INLINE`/`ASSET`, image `ASSET`, audio `ASSET`, and all document combinations passed, while text `URL`, image `INLINE`/`URL`, audio `INLINE`/`URL`, and all video `INLINE`/`URL`/`ASSET` combinations failed with empty responses output.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1-2024-12-17` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: all text and all document combinations passed; image `INLINE` passed while image `URL`/`ASSET` failed with empty responses output; audio `INLINE`/`ASSET` failed with empty responses output and audio `URL` failed with `PARSE_FAIL`; video `URL`/`ASSET` passed while video `INLINE` failed with empty responses output.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `o1-pro-2025-03-19` `runtimeSupport.inputParts` and kept that exact entry `FAILING`: text `INLINE` failed with `PARSE_FAIL`, while text `URL`/`ASSET` and all image/audio/video/document combinations passed across `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `o1-pro` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Re-curated OpenAI `gpt-5.1-codex-max` with the `1024`-token multimodal baseline and promoted a conservative `SUPPORTED` rectangle for `IMAGE`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`/`URL`/`ASSET`; the same rerun showed `TEXT` passing for `INLINE` and `ASSET` but still failing for `URL` with empty Responses output.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5.1-codex-mini` `runtimeSupport.inputParts` directly on the exact versioned entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5-mini` `runtimeSupport.inputParts` directly on the exact base entry and confirmed a clean `15/15` matrix across text/image/audio/video/document inputs for `INLINE`, `URL`, and `ASSET` sources.
- <kbd>CONTRACTS</kbd> Marked OpenAI `gpt-4.1-nano` `runtimeSupport.inputParts` as `SUPPORTED` for text/image/audio/video/document inputs across `INLINE`, `URL`, and `ASSET` sources after one-model multimodal E2E validation.
- <kbd>CONTRACTS</kbd> Marked OpenAI `gpt-4o-mini` `runtimeSupport.inputParts` as `SUPPORTED` for image/document inputs across `INLINE`, `URL`, and `ASSET` sources after real multimodal E2E validation.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.3.0` for the explicit managed-asset lifecycle surface and additive multimodal/storage contract groundwork, without treating this PR as the final multimodal multi-provider milestone.
- <kbd>RUNTIME</kbd> Managed asset uploads no longer require `intent`; tenant-global asset identity and canonical paths continue to ignore it by design, while uploads may still pass it as optional semantic context.
- <kbd>RUNTIME</kbd> Prompt interpolation now rejects asset variables in `vars`, and execution/dry-run preflight validates that multimodal `inputParts` bind only to declared `inputSchema` asset variables.
- <kbd>RUNTIME</kbd> Managed asset lifecycle is now exposed only through `/api/assets`; `/api/execution/assets` compatibility aliases are intentionally not retained so stale callers fail loudly.
- <kbd>RUNTIME</kbd> Successful execution reports now populate `trackedCallAccounting` with explicit baseline tracked-call metadata (`consumed/base/multiplier=1`) while unsupported multimodal requests continue to fail before any provider call or tracked-call consumption is recorded.
- <kbd>CONTRACTS</kbd> Re-curated Gemini CHAT runtime support after full E2E matrix runs with `@google/genai` `2.8.0`: promoted `gemini-2.5-pro` to a conservative multimodal rectangle covering `TEXT`/`AUDIO`/`VIDEO`/`DOCUMENT` across `INLINE`, `URL`, and `ASSET`, while `gemini-3-pro-preview` remains `FAILING` due to upstream model-not-found (404) on this account/endpoint.
### Fixed
- <kbd>RUNTIME</kbd> Fixed OpenAI Responses inline `input_file` handling by sending MIME-qualified Base64 file payloads and by recovering structured JSON text from `output[]` when `output_text`/`output_parsed` are absent, which unblocks the real OpenAI document-extraction E2E path.

## [20260613.2] — 23:14UTC

<!--
sourceCommit: 4da67652fb5069ca63b2f9f6cab63ec355249bcf
queuedAtUtc: 
previousMirroredBuild: 20260607.2 (2026-06-07)
contractsSubmodule: 1ee42b5364fa..c8b48151182f
-->

### Added
- <kbd>CONTRACTS</kbd> Added optional top-level execution `workflow` metadata to `ExecuteIntentRequest`/`ExecutionReport`, keeping `context` open for caller business context and `CONDITION_ON_CONTEXT` features.
- <kbd>CONTRACTS</kbd> Added optional service-token `limits[]` metadata with `FIXED`, hourly, daily, and monthly execution-call windows plus optional multi-intent `scopes` matching.
- <kbd>RUNTIME</kbd> Added optional service-token execution-limit enforcement for customer bearer tokens using shared Redis/in-memory counters, returning `429` with `RATE_LIMIT` on exhaustion while leaving `/api/auth/check` non-consuming.
### Changed
- <kbd>RUNTIME</kbd> Updated the `dcdr` CLI execution commands to accept top-level workflow correlation flags (`--workflow-id`, `--run-id`, `--node-id`, `--step-id`, `--parent-execution-id`, `--idempotency-key`) plus `--workflow-json`, with explicit flags overriding JSON fields before forwarding the formal execution request shape.
- <kbd>RUNTIME</kbd> Hardened execution HTTP request validation so `workflow` is rejected with a stable 400/`VALIDATION_ERROR` when it is not a plain object, when typed workflow fields are not strings, or when unsupported workflow fields are supplied.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.1.2`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.2.0`.
- <kbd>RUNTIME</kbd> Expanded streaming OpenAPI schemas to document typed SSE event envelopes (`meta`, `delta`, `final`, `error`) via reusable component refs instead of a single opaque string schema.
- <kbd>RUNTIME</kbd> Tightened OpenAPI execution schemas to reuse strongly typed component refs for workflow, messages, errors, status, report sections, and routing metadata instead of broad anonymous objects where the contract is already explicit.
### Fixed
- <kbd>RUNTIME</kbd> Unified tenant scope resolution across execution entrypoints and related middleware (`run`/`dry-run`/`eval`/`stream`, circuit-breaker endpoints, tenant middleware, and customer CID rate-limit keys) to remove drift between customer and internal path handling.

## [20260607.2] — 04:20UTC

<!--
sourceCommit: ac3e9a2a8baba7a0af298ccc751804458c16a759
queuedAtUtc: 
previousMirroredBuild: 20260607.1 (2026-06-07)
contractsSubmodule: 5f153edbf115..1ee42b5364fa
-->

### Fixed
- <kbd>CONTRACTS</kbd> `@dcdr/contracts` DCDR virtual model-id helpers now support GROK and MISTRAL prefixes (`grok/*`, `mistral/*`) and parse `xai/*` as GROK, restoring UI persistence for these provider cards.

## [20260607.1] — 03:36UTC

<!--
sourceCommit: df928d1ade9ab63c3b07b0e174410aa5dab5c5df
queuedAtUtc: 
previousMirroredBuild: 20260606.5 (2026-06-06)
contractsSubmodule: 9aaff9c55a6d..5f153edbf115
-->

### Added
- <kbd>RUNTIME</kbd> Added native Mistral CHAT provider execution via `@mistralai/mistralai` and enabled Grok CHAT via the OpenAI-compatible adapter path.
- <kbd>RUNTIME</kbd> Added Grok model sync tooling (`npm run grok-models:sync`) and Grok support in provider catalog diff tooling for official model curation workflows.
### Changed
- <kbd>RUNTIME</kbd> Completed a full dependency refresh wave across runtime and contracts toolchains, including runtime updates for `jest`, `ts-jest`, `mime`, `mime-types`, `@types/mime-types`, and `@types/node`, with non-E2E validation kept green.
- <kbd>CONTRACTS</kbd> Marked Anthropic `claude-opus-4-8` as `SUPPORTED` after provider E2E validation (text + structured) and documented model-specific sampling parameter constraints.
- <kbd>RUNTIME</kbd> Updated provider SDK dependency `@google/genai` to `^2.8.0` and validated Gemini provider adapter compatibility with focused provider tests.
- <kbd>CONTRACTS</kbd> Re-curated Gemini CHAT runtime support after full E2E matrix run with `@google/genai` `2.8.0`: kept `gemini-2.5-pro` as `FAILING` (requires thinking mode and structured path can return empty output) and marked `gemini-3-pro-preview` as `FAILING` due to upstream model-not-found (404) on this account/endpoint.
- <kbd>CONTRACTS</kbd> Selected new public candidate models/categories for Grok while keeping Mistral out of public DCDR categories for now.
- <kbd>CONTRACTS</kbd> Promoted Anthropic `claude-opus-4-8` as the public `BEST` candidate and backfilled pricing only when grounded by an existing priced model in the same family.
- <kbd>CONTRACTS</kbd> Normalized pricing sources to canonical public pricing pages (`docs.x.ai/developers/pricing`, `platform.claude.com/docs/en/about-claude/pricing`) and added Mistral pricing only where explicitly stated on `mistral.ai/pricing` (Mistral Large).
- <kbd>CONTRACTS</kbd> Refreshed Grok and Mistral model prices from official public API pricing pages (including xAI cached-input rate where published) without renaming backend provider identifiers.
- <kbd>CONTRACTS</kbd> Made Anthropic legacy/dated CHAT model prices explicit in raw catalog entries and corrected deprecated `claude-opus-4-1-20250805` to official Opus 4.1 pricing ($15 input / $75 output per MTok).
- <kbd>CONTRACTS</kbd> Added initial Grok CHAT model catalog entries (pricing + `runtimeSupport=IN_PROGRESS`) to start controlled E2E curation.
- <kbd>CONTRACTS</kbd> `SUPPORTED_MODELS.md` generation now includes Grok/Mistral provider sections and no longer relies on a stale 3-provider hardcoded list.
- <kbd>CONTRACTS</kbd> Curated Grok CHAT runtime support statuses from provider E2E: four models marked `SUPPORTED` and `grok-4.20-multi-agent-0309` marked `FAILING` with explicit upstream-400 reason.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.1.0` (intermediate minor for provider-surface expansion).
- <kbd>RUNTIME</kbd> Provider E2E matrices now treat GROK and MISTRAL as implemented adapters; canonical CHAT smoke set includes a Grok model and streaming suite supports Grok model overrides.
### Fixed
- <kbd>CONTRACTS</kbd> Updated contracts test toolchain dependencies (`jest-junit`, `typescript`, `jest`, `ts-jest`) and verified deterministic contracts CI stability (`npm --prefix src/contracts run test:ci`).
- <kbd>RUNTIME</kbd> Hardened customer-mode rate-limit key generation to be IPv6-safe using `express-rate-limit` v8 helpers, preventing `ERR_ERL_KEY_GEN_IPV6` validation errors and ensuring stable limiter behavior behind proxy/forwarded-IP setups.

## [20260606.5] — 23:46UTC

<!--
sourceCommit: 3cd78af9f1543faa8b71b6148ed99a448ef59de1
queuedAtUtc: 
previousMirroredBuild: 20260606.2 (2026-06-06)
contractsSubmodule: e2a7b0a539c1..9aaff9c55a6d
-->

### Fixed
- <kbd>RUNTIME</kbd> `POST /api/execution/dry-run/:intent` is now tenant-aware in customer mode (Bearer + `cid`) and resolves intents from the same tenant-scoped registry path used by `runIntent`; missing/inactive intents now surface as `404` (`NO_ACTIVE_MODEL`) instead of generic `500`.
- <kbd>RUNTIME</kbd> Consolidated duplicate onboarding asset tests into a single canonical test and fixed docker-compose registry path resolution with `${VAR:-fallback}` placeholder support for stable Linux/Ubuntu CI runs.

## [20260606.2] — 03:20UTC

<!--
sourceCommit: cb3d24cb7496a924282e41399c1bc256923a2c50
queuedAtUtc: 
previousMirroredBuild: 20260606.1 (2026-06-06)
contractsSubmodule: 77abd6dcd59b..e2a7b0a539c1
-->

(No user-facing changes since previous build.)

## [20260606.1] — 02:52UTC

<!--
sourceCommit: da0b152bbf02947224f3f8b0ea3039c2479ef5d6
queuedAtUtc: 
previousMirroredBuild: 20260606.3 (2026-06-06)
contractsSubmodule: 5f584ddf926c..77abd6dcd59b
-->

### Added
- <kbd>RUNTIME</kbd> Added 1-minute onboarding runtime-client examples with typed `ExecuteIntentRequest` scripts for nutrition, banking incident classification, support ticket classification, product format parsing, and supplier risk assessment.

## [20260606.3] — 01:45UTC

<!--
sourceCommit: 659514e9f79181dd6ab0aa49c4ccfbf8265464aa
queuedAtUtc: 
previousMirroredBuild: 20260605.1 (2026-06-05)
contractsSubmodule: 1b49cecf1c24..5f584ddf926c
-->

### Added
- <kbd>RUNTIME</kbd> Optional durable tenant-registry marker + marker lookaside (runtime-owned) to improve cross-node convergence when Pub/Sub messages are missed.
### Changed
- <kbd>CONTRACTS</kbd> Updated cache contract surface and exports for the Redis tenant-registry invalidation channel.
- <kbd>RUNTIME</kbd> Backend log sync now uses a no-drop strategy when in-memory queue reaches cap: overflow spills to a durable NDJSON disk spool (`LOGS_SPOOL_FILE_PATH`) and is retried on subsequent flush cycles.
- <kbd>RUNTIME</kbd> Tuned default log in-memory buffer cap back to `LOGS_MAX_BUFFER_SIZE=2000` now that durable disk spool overflow is enabled.
- <kbd>CONTRACTS</kbd> Updated `DcdrRuntimeClient.dryRun()` to accept `ExecuteIntentRequest` explicitly (no vars-only compatibility overload).
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.0.2`.
### Fixed
- <kbd>RUNTIME</kbd> Improved Jest test stability for Redis-related features by preventing timer/metrics open-handle leaks during test runs.

## [20260605.1] — 22:29UTC

<!--
sourceCommit: 2ab7eb7fc2aeddc6757aa449f178712b179d6e4c
queuedAtUtc: 
previousMirroredBuild: 20260604.2 (2026-06-04)
contractsSubmodule: 9914fd4a70c2..1b49cecf1c24
-->

### Added
- <kbd>RUNTIME</kbd> Optional Redis Pub/Sub tenant registry invalidation hints to reduce cross-node staleness in cluster deployments (cloud mode).
- <kbd>CONTRACTS</kbd> Exported `DCDR_TENANT_REGISTRY_INVALIDATION_CHANNEL` for cross-service Redis Pub/Sub coordination.
### Changed
- <kbd>RUNTIME</kbd> Reduced default tenant registry cache max age to 60s (from 5m) for customer-mode registry refresh.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.0.1`.

## [20260604.2] — 19:34UTC

<!--
sourceCommit: 9d63004e113bd025adf630e92e837805194e1a35
queuedAtUtc: 
previousMirroredBuild: 20260604.4 (2026-06-04)
contractsSubmodule: e978205a52c0..9914fd4a70c2
-->

(No user-facing changes since previous build.)

## [20260604.4] — 16:49UTC

<!--
sourceCommit: 5f8fa805a5d19f2ebf15b8f72947f8d30553f1c9
queuedAtUtc: 
previousMirroredBuild: 20260604.1 (2026-06-04)
contractsSubmodule: ef12b2e03847..e978205a52c0
-->

### Changed
- <kbd>RUNTIME</kbd> `POST /api/execution/eval/:intent` now uses the formal contracts request/response (`ExecuteIntentEvalRequest`/`ExecuteIntentEvalResponse`) and supports bounded parallel evaluation via `options.maxConcurrency`.
- <kbd>CONTRACTS</kbd> Clarified execution policy availability documentation (Cloud vs Cloud Pro) in `docs/EXECUTION_POLICY.md`.
- <kbd>CONTRACTS</kbd> Added formal eval execution contracts (`ExecuteIntentEvalRequest`/`ExecuteIntentEvalResponse`) and updated the TypeScript client `DcdrRuntimeClient.eval()` signature accordingly.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `2.0.0`.

## [20260604.1] — 09:20UTC

<!--
sourceCommit: a973fbd0bcc87c96a18f61bde08e814a7d779338
queuedAtUtc: 
previousMirroredBuild: 20260603.2 (2026-06-03)
contractsSubmodule: 9b2c651e38b6..ef12b2e03847
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.9`.
### Fixed
- <kbd>RUNTIME</kbd> `dcdr validate-registry` now validates conditioned-routing boolean condition trees (`AND`/`OR`/`NOT`) and fails with actionable configuration errors.

## [20260603.2] — 23:28UTC

<!--
sourceCommit: a572e64a4f3e3e1544d5a02051383d493bf83077
queuedAtUtc: 
previousMirroredBuild: 20260602.1 (2026-06-02)
contractsSubmodule: f2c873f0b756..9b2c651e38b6
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.8`.
- <kbd>CONTRACTS</kbd> Added conditioned execution policy types (`CONDITION_ON_CONTEXT`, `CONDITION_ON_INPUT`) and per-implementation routing conditions for explicit context/input-based eligibility.
- <kbd>RUNTIME</kbd> Added conditioned execution policy planning support (Cloud/Cloud Pro), failing explicitly with `NO_ELIGIBLE_IMPLEMENTATION` + `details.reason="condition_not_matched"` when no condition matches.
### Fixed
- <kbd>RUNTIME</kbd> Added integration test coverage for conditioned routing no-match (`NO_ELIGIBLE_IMPLEMENTATION` + `details.reason=condition_not_matched`) to prevent regressions.

## [20260602.1] — 13:11UTC

<!--
sourceCommit: 72333c6a4baba5b38dc88e37bfa76b7120533609
queuedAtUtc: 
previousMirroredBuild: 20260601.2 (2026-06-01)
contractsSubmodule: 752bb6ba8206..f2c873f0b756
-->

(No user-facing changes since previous build.)

## [20260601.2] — 22:38UTC

<!--
sourceCommit: 5725e6e758cb4aae03738ad0bad035aecfcc601b
queuedAtUtc: 
previousMirroredBuild: 20260601.13 (2026-06-01)
contractsSubmodule: 48c23603adbb..752bb6ba8206
-->

(No user-facing changes since previous build.)

## [20260601.13] — 22:06UTC

<!--
sourceCommit: 441a1dddea8d7e2f080238cb7eecd178ce055aa2
queuedAtUtc: 
previousMirroredBuild: 20260601.11 (2026-06-01)
contractsSubmodule: 8376d6f80e62..48c23603adbb
-->

### Added
- <kbd>RUNTIME</kbd> Added `sample_registry.json` to provide a minimal local `--registry` starting point (inline credentials placeholder).
- <kbd>CONTRACTS</kbd> Added `docs/SUPPORTED_MODELS.md` (CHAT-only) generated from `ProviderModelRegistry` (excludes DCDR virtual aliases).
### Changed
- <kbd>RUNTIME</kbd> Runtime now listens on port `8000` by default (was `5000`).
- <kbd>CONTRACTS</kbd> Contracts README version badge now tracks npm (`@dcdr/contracts`) instead of a hardcoded version.
### Fixed
- <kbd>RUNTIME</kbd> Docker image now forwards runtime CLI flags (e.g. `--demo`, `--registry`) instead of treating them as Node options.
- <kbd>CONTRACTS</kbd> Fixed docs example links/paths for `registry.hello_world*.json` so copy/paste works in the GitHub mirror.

## [20260601.11] — 18:32UTC

<!--
sourceCommit: 8467cba589b410336af31d134625c74f12cddd09
queuedAtUtc: 
previousMirroredBuild: 20260601.10 (2026-06-01)
contractsSubmodule: eb46c76c2127..8376d6f80e62
-->

### Changed
- <kbd>RUNTIME</kbd> Runtime Docker image publishing migrated to `dcdrai/runtime` on Docker Hub.
- <kbd>RUNTIME</kbd> Documentation and pipeline references updated to use `dcdrai/runtime` as the official Docker image.
- <kbd>RUNTIME</kbd> Hardened npm publish pipeline to publish `@dcdr/contracts` from `src/contracts` (prevents accidental publishing of the root `dcdr-runtime` package).

## [20260601.10] — 18:15UTC

<!--
sourceCommit: 715ea107a35e052aac9d847c78b43f481843363a
queuedAtUtc: 
previousMirroredBuild: 20260601.1 (2026-06-01)
contractsSubmodule: 7256316914ac..eb46c76c2127
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.6`.
- <kbd>RUNTIME</kbd> Runtime Docker image publishing migrated to `dcdrai/dcdr-runtime` on Docker Hub.
- <kbd>RUNTIME</kbd> Documentation and pipeline references updated to use `dcdrai/dcdr-runtime` as the official Docker image.

## [20260601.1] — 09:44UTC

<!--
sourceCommit: 8d87045540db30f4437e2aa1ea944c4a98e844db
queuedAtUtc: 
previousMirroredBuild: 20260528.1 (2026-05-28)
contractsSubmodule: ddce1349b70e..7256316914ac
-->

### Added
- <kbd>RUNTIME</kbd> Added Prometheus gauges to compare backend customers registry rollups vs internal registry loaded in memory (gap + freshness + key totals).
- <kbd>RUNTIME</kbd> Added `dcdr validate-registry <path>` CLI command to validate local registry files and report schema issues.
- <kbd>CONTRACTS</kbd> Added `ProviderModelDefinition.tokenUsageCovered` to track which models have verified token usage reporting (billing invariant).
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.1`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.2`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.3`.
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.4` (test bump).
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.5`.
- <kbd>CONTRACTS</kbd> Exported `ExecutionErrorCode` (and `isExecutionErrorCode`) and migrated runtime code to use the enum instead of hardcoded error-code string literals.
- <kbd>CONTRACTS</kbd> Made `ExecutionError.code` strictly typed as `ExecutionErrorCode` (no string literals).
### Fixed
- <kbd>RUNTIME</kbd> Structured output schema builder now treats `PromptVariable.type/itemsType` case-insensitively (prevents accidental `anyOf` schemas).
- <kbd>RUNTIME</kbd> Runtime `--registry` startup now validates intent input/output schemas and fails with an actionable issues report when invalid.
- <kbd>RUNTIME</kbd> OpenAI Responses API executions now always propagate token usage (including on parse/schema failures when usage is available).
- <kbd>RUNTIME</kbd> Gemini executions now preserve token usage on parse/schema failures when usage metadata is available.

## [20260528.1] — 14:24UTC

<!--
sourceCommit: 5b6039e7fbeef8986b92aec7d5b75c1061b814ab
queuedAtUtc: 
previousMirroredBuild: 20260525.3 (2026-05-25)
contractsSubmodule: 437ed598dd7d..ddce1349b70e
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.9.0`.
### Fixed
- <kbd>RUNTIME</kbd> Control-plane registry sync now computes `sha256` using stable JSON ordering to match backend semantic hashing.
- <kbd>RUNTIME</kbd> OpenAI Responses structured output now falls back to JSON-object + local validation when the provider rejects the generated schema (`invalid_json_schema`), avoiding hard 422 failures.
- <kbd>CONTRACTS</kbd> Added execution error code `TOKEN_BUDGET_TOO_LOW` for reasoning models that return no visible output under small token budgets (mapped to HTTP 400).
- <kbd>RUNTIME</kbd> Session intent-scope enforcement now supports `execute:*` and `execute:<INTENT>` (plus legacy intent-name scopes); forbidden responses include required scope hints.

## [20260525.3] — 17:05UTC

<!--
sourceCommit: 126bce84149a52e45c1e6d5057f259ff74d463e2
queuedAtUtc: 
previousMirroredBuild: 20260525.2 (2026-05-25)
-->

### Fixed
- <kbd>RUNTIME</kbd> Execution reports now include `outputHash` on successful executions (stable hash of normalized output).

## [20260525.2] — 16:32UTC

<!--
sourceCommit: 1f051222f4218c35477eede901e00d1978e5aaf4
queuedAtUtc: 
previousMirroredBuild: 20260525.1 (2026-05-25)
contractsSubmodule: a4a4308992a9..437ed598dd7d
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.3`.
- <kbd>CONTRACTS</kbd> Expanded managed public model curation to 3 models per category (added Gemini `gemini-3.1-pro-preview` as `BEST`, Gemini `gemini-3-flash-preview` as `FAST`, and OpenAI `gpt-5.4-nano` as `ECONOMY`).

## [20260525.1] — 07:44UTC

<!--
sourceCommit: d250b28908d7886d29497655aa4f23f666ec3809
queuedAtUtc: 
previousMirroredBuild: 20260524.2 (2026-05-24)
contractsSubmodule: 3099d7ab05f6..a4a4308992a9
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.2`.
- <kbd>CONTRACTS</kbd> Added `ProviderModelDefinition.publicForCustomers` (fail-closed), managed category metadata (`DcdrPublicModelCategory`, tiers, use cases, `publicName`/`badge`, explicit recommendation/default flags), and listing helpers (`ProviderModelRegistry.listProviderModels(..., { onlyPublicForCustomers })`, `listPublicCustomerModels*`) to support curated customer-facing model lists.

## [20260524.2] — 16:47UTC

<!--
sourceCommit: 6c9d514b54263ce3757aa3bdb6739f1124adabf8
queuedAtUtc: 
previousMirroredBuild: 20260524.1 (2026-05-24)
contractsSubmodule: 88c7b79fecba..3099d7ab05f6
-->

### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.1`.
- <kbd>CONTRACTS</kbd> Added `DcdrEntitlementsContract.dcdrVirtual` to allow backend to disable the paid DCDR virtual provider per tenant (fail-open when omitted).
- <kbd>CONTRACTS</kbd> Added execution error code `PAYMENT_REQUIRED`.
- <kbd>RUNTIME</kbd> Execution engine blocks `IntentProvider.DCDR` attempts when `entitlements.dcdrVirtual.enabled=false` (HTTP 402 + `PAYMENT_REQUIRED`) while still allowing BYOK fallbacks.

## [20260524.1] — 07:10UTC

<!--
sourceCommit: b418e7c9dd51f03c5f8467917655ea1cc750c6e0
queuedAtUtc: 
previousMirroredBuild: 20260504.3 (2026-05-04)
contractsSubmodule: 44f40761f11e..88c7b79fecba
-->

### Added
- <kbd>RUNTIME</kbd> Added cloud-only backend credential resolution via `CredentialsContract.resolution=BACKEND` (requires trusted registry signature; rejected in `--registry` mode).
- <kbd>RUNTIME</kbd> Enabled `IntentProvider.OPEN_AI_COMPATIBLE` execution via the OpenAI-compatible adapter to support customer-provided internal endpoints (e.g. vLLM-style gateways).
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.8.0`.
- <kbd>CONTRACTS</kbd> Added virtual provider `IntentProvider.DCDR` with namespaced model IDs (`provider/model`) resolving to runtime-supported models across implemented providers.
- <kbd>CONTRACTS</kbd> Refreshed OpenAI and Gemini model catalogs with newly discovered model IDs (May 2026 sync) and updated Gemini runtime support metadata for `gemini-3.1-flash-lite` and `gemini-3.5-flash`.
- <kbd>CONTRACTS</kbd> Added official OpenAI pricing metadata for `gpt-image-*`, `gpt-audio*`, and `gpt-realtime*` model families (standard pricing snapshot).
### Fixed
- <kbd>RUNTIME</kbd> OpenAI structured output schema generation no longer emits empty JSON Schema nodes that OpenAI rejects (fixes `invalid_json_schema` 400s).
- <kbd>RUNTIME</kbd> OpenAI Responses structured mode now falls back to local JSON/Zod validation when the declared output schema contains freeform JSON/object shapes that OpenAI schema validation rejects.
- <kbd>CONTRACTS</kbd> Mark OpenAI `o1-mini` as account-gated (`model_not_found`) and skip it by default in provider E2E curation.
- <kbd>RUNTIME</kbd> Gemini adapter now disables thinking by default for `gemini-3.5-flash` under small token budgets and tolerates minor structured-output formatting (code fences/prefix text), fixing empty output and JSON parse failures in provider E2E.
- <kbd>RUNTIME</kbd> Anthropic adapter now preserves stable `ExecutionError` codes for structured schema failures and empty responses (was incorrectly mapped to `UPSTREAM_5XX`).

## [20260504.3] — 23:03UTC

<!--
sourceCommit: eeb7704f53b1a0f7ee5d390d79ac24be1c632014
queuedAtUtc: 
previousMirroredBuild: 20260504.2 (2026-05-04)
-->

(No user-facing changes since previous build.)

## [20260504.2] — 18:25UTC

<!--
sourceCommit: eeb7704f53b1a0f7ee5d390d79ac24be1c632014
queuedAtUtc: 
previousMirroredBuild: 20260504.1 (2026-05-04)
contractsSubmodule: 6fab9996df38..44f40761f11e
-->

### Added
- <kbd>RUNTIME</kbd> Added Anthropic (Claude) provider adapter for CHAT intents via `@anthropic-ai/sdk`, including structured outputs with local validation and optional streaming deltas.
- <kbd>RUNTIME</kbd> Added Gemini provider adapter for CHAT intents via `@google/genai`, including structured outputs (JSON schema + local validation) and optional streaming deltas.
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.7.0`.
- <kbd>CONTRACTS</kbd> Provider model catalog now only enumerates implemented providers (OpenAI, OFFICE, Anthropic, Gemini); other provider model lists are kept empty until implemented.
- <kbd>CONTRACTS</kbd> Provider model catalog now includes a minimal Gemini CHAT starter model (`gemini-2.5-flash`) marked `SUPPORTED` after provider E2E validation.
- <kbd>CONTRACTS</kbd> Expanded Gemini model catalog to include all discovered `gemini-*` model IDs (CHAT + EMBEDDING) with initial runtime support metadata and E2E legacy overrides.
- <kbd>CONTRACTS</kbd> Curated Gemini CHAT runtime support statuses based on provider E2E (text + structured + streaming SSE).
- <kbd>CONTRACTS</kbd> Added official Gemini model token pricing metadata (per-million tokens + tiers) to the provider model catalog.
- <kbd>CONTRACTS</kbd> Versioned model IDs now inherit missing pricing from their base model (marked as `approx`) to avoid catalog pricing gaps.
- <kbd>CONTRACTS</kbd> Marked Anthropic `claude-opus-4-7` as `SUPPORTED` after provider E2E validation (run + streaming SSE).
### Fixed
- <kbd>RUNTIME</kbd> Gemini adapter now avoids sending `thinkingConfig` to models that reject it and uses a prompt-based structured fallback for models that do not support native `responseSchema`.
- <kbd>RUNTIME</kbd> Anthropic `claude-opus-4-7` calls now omit deprecated sampling parameters to avoid upstream 4xx errors.
- <kbd>RUNTIME</kbd> Gemini adapter now disables thinking by default (unless `enable_thinking=true`) to avoid empty outputs when token budgets are small.

## [20260504.1] — 09:47UTC

<!--
sourceCommit: da8690c664a8e6040c32a141461e22b80491a419
queuedAtUtc: 
previousMirroredBuild: 20260429.2 (2026-04-29)
contractsSubmodule: 1fb4b3610ba5..6fab9996df38
-->

### Added
- <kbd>RUNTIME</kbd> Added SSE streaming execution endpoint `POST /api/execution/stream/:intent` (meta/delta/final) and client helper `DcdrRuntimeClient.executeIntentStream()`.
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.5.0`.
### Fixed
- <kbd>RUNTIME</kbd> SSE streaming now aborts upstream work more reliably when the client disconnects mid-stream.

## [20260429.2] — 11:42UTC

<!--
sourceCommit: d464a739471e112dbd52b4abceea3b09ded14d3c
queuedAtUtc: 
previousMirroredBuild: 20260429.1 (2026-04-29)
contractsSubmodule: 5c9c9c48c243..1fb4b3610ba5
-->

(No user-facing changes since previous build.)

## [20260429.1] — 11:08UTC

<!--
sourceCommit: d037540f375fc38d239a6350eeba72dc307f31a7
queuedAtUtc: 
previousMirroredBuild: 20260416.14 (2026-04-16)
contractsSubmodule: 06a7faa5e861..5c9c9c48c243
-->

### Added
- <kbd>RUNTIME</kbd> Auth diagnostic endpoint `GET /api/auth/check` to validate tokens and return session + optional entitlements snapshot.
- <kbd>RUNTIME</kbd> Opt-in provider/model E2E test suite (`npm run test:e2e:providers`) gated by env/CI.
- <kbd>RUNTIME</kbd> Optional query-token protection for `GET /api/system/metrics` via `DCDR_SYSTEM_METRICS_TOKEN`.
- <kbd>RUNTIME</kbd> Tenant cache eviction uses TTL + memory-pressure purge (enabled by default) via `TENANT_CONFIG_TTL_MS` and `TENANT_ENTITLEMENTS_CACHE_TTL_MS`.
- <kbd>RUNTIME</kbd> Added memory-pressure purge for tenant caches using watermarks (defaults: purge when memory used >= 75% aiming toward 50%).
### Changed
- <kbd>CONTRACTS</kbd> Bumped `@dcdr/contracts` package version to `1.4.0`.
- <kbd>CONTRACTS</kbd> Added `DcdrRuntimeClient.authCheck()` and `DcdrRuntimeAuthCheckResponse` for runtime token validation diagnostics.
- <kbd>CONTRACTS</kbd> `DcdrRuntimeClient` now defaults `baseUrl` to `https://runtime.dcdr.ai` when omitted.
- <kbd>CONTRACTS</kbd> Added `SubscriptionStatus` / `SubscriptionStatusPolicy` and typed `DcdrEntitlementsContract.subscriptionStatus` for subscription enforcement surfaces.
- <kbd>RUNTIME</kbd> Customer entitlements enforcement now fails closed with `503` when backend entitlements are unavailable and no recent cached snapshot exists; uses cached snapshot during short backend outages.
- <kbd>RUNTIME</kbd> `GET /api/auth/check` only returns entitlements when token scopes include `entitlements:read` (or `*`).
- <kbd>RUNTIME</kbd> Added Prometheus counters for entitlements fetch and enforcement outcomes.
- <kbd>CONTRACTS</kbd> Added `SubscriptionStatus` enum and expanded `DcdrEntitlementsContract` to include optional subscription/business fields.
- <kbd>CONTRACTS</kbd> Expanded provider model catalog to include baseline OFFICE (vLLM/OpenAI-compatible) model IDs and added E2E legacy override exports.
- <kbd>RUNTIME</kbd> Graceful shutdown grace period is now configurable via `DCDR_SHUTDOWN_GRACE_MS` (default: 5000ms).
- <kbd>RUNTIME</kbd> Circuit breaker L1 now expires failure accumulation by `DCDR_CB_FAIL_WINDOW_MS` and prunes idle breaker key bookkeeping to reduce long-uptime memory growth.
- <kbd>RUNTIME</kbd> In-memory (no-Redis) usage counters now enforce per-counter TTL and are periodically pruned to prevent unbounded growth.
- <kbd>RUNTIME</kbd> Added Prometheus gauges for circuit breaker L1 footprint and in-memory usage delta entries.
- <kbd>RUNTIME</kbd> Public mirror changelog introduction text clarified to be more user-facing.
- <kbd>RUNTIME</kbd> Execution engine now respects `executionPolicy` when ordering implementation candidates (with explicit config errors on invalid policy metadata).
- <kbd>CONTRACTS</kbd> Added optional `executionPolicy.exploration` (epsilon-greedy top-K sampling) and `CapabilityKey.AI_INTENTS_EXPLORATION_POLICY` for Cloud-only exploration.
- <kbd>RUNTIME</kbd> Candidate planning supports explicit exploration after deterministic ordering (Cloud-only) and records bounded Prometheus counters for activations + chosen index bucket.
- <kbd>RUNTIME</kbd> Execution engine now falls back to the next candidate on `MODEL_UNSUPPORTED` when `allowFallback=true`.
- <kbd>RUNTIME</kbd> Execution engine supports an optional repair pass on `PARSE_FAIL`/`SCHEMA_FAIL` when `retryPolicy.repairOnParseFail=true`.
- <kbd>RUNTIME</kbd> Expanded execution reliability test coverage with real in-process integration tests for retry/fallback/policy behaviors and adapter-level error classification.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-5*` runtime support metadata (status + preferred API) to support supported-only CI runs.
- <kbd>CONTRACTS</kbd> Added per-model `parameterSupport` metadata (generic prompt parameter support + recommendations) to help adapters and UIs avoid misconfiguration.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-4*` runtime support metadata and removed deprecated legacy preview IDs to reduce catalog noise in provider E2E.
- <kbd>CONTRACTS</kbd> Curated OpenAI `gpt-3.5-turbo*` and `o*` runtime support metadata (preferred API routing) and removed non-chat / tool-required model IDs from the CHAT catalog.
- <kbd>CONTRACTS</kbd> Updated OpenAI model pricing snapshot for GPT-5.4/GPT-5.5 (and added long-context tier pricing where published).
- <kbd>CONTRACTS</kbd> Expanded `ExecutionError.code` to include `CONFIG_ERROR` and other runtime-mapped validation codes.
- <kbd>CONTRACTS</kbd> Expanded `ExecutionError.code` to include `PROVIDER_EMPTY_RESPONSE`.
### Fixed
- <kbd>RUNTIME</kbd> Enforce `entitlements.subscriptionStatus` (blocks execution when subscription is not ACTIVE/TRIAL).
- <kbd>RUNTIME</kbd> OpenAI-compatible provider adapter now extracts text from additional fields (e.g. `reasoning_content`) and rejects truly-empty completions instead of returning `output:null` with `status:OK`.
- <kbd>RUNTIME</kbd> OpenAI-compatible structured output mode now supports non-OpenAI backends by using `create` + local JSON/Zod validation instead of SDK `parse`.
- <kbd>RUNTIME</kbd> Upstream provider `model_not_found` (404) is mapped to `MODEL_NOT_FOUND` (HTTP 422) instead of `502` for clearer misconfiguration feedback.
- <kbd>RUNTIME</kbd> Upstream provider errors indicating a model does not support chat-completions are mapped to `MODEL_UNSUPPORTED` (HTTP 422) instead of `502`.
- <kbd>RUNTIME</kbd> OpenAI Responses-only reasoning models now return a clear 4xx when the token budget is too low to produce visible output.
- <kbd>RUNTIME</kbd> OpenAI provider now routes `gpt-5*` models via the Responses API by default and strips unsupported sampling params (e.g. `temperature=0`) to avoid avoidable 4xx errors.
- <kbd>RUNTIME</kbd> OpenAI SDK error payload extraction now inspects `error.error` / `response.data` so model validation errors can be classified consistently.
- <kbd>RUNTIME</kbd> OpenAI Responses structured mode now preserves `PROVIDER_EMPTY_RESPONSE` for empty outputs (was misclassified as `PARSE_FAIL`).
- <kbd>RUNTIME</kbd> Enforced customer session intent-scope checks on execution endpoints (prevents out-of-scope intent execution).
- <kbd>RUNTIME</kbd> Malformed JSON payloads to `/api/*` now return a stable 400 JSON error response (no HTML error rendering).
- <kbd>RUNTIME</kbd> Reduced error detail leakage by omitting stack traces from `INTERNAL_ERROR` responses outside development.
- <kbd>RUNTIME</kbd> Unknown `/api/*` routes now return a stable 404 JSON response.
- <kbd>RUNTIME</kbd> Malformed `/api/*` URLs now return a stable 400 JSON response.
- <kbd>RUNTIME</kbd> Hardened customer-mode rate limit enforcement by applying block escalation to both tenant `cid` and IP.
- <kbd>RUNTIME</kbd> Registry file loader now tolerates UTF-8 BOM and returns more actionable parse/validation errors (including file path) in `--registry` mode.
- <kbd>RUNTIME</kbd> Circuit breaker tenant scoping now strips control characters from `tenantCid` selectors to prevent CRLF/control-char reflection.

## [20260416.14] — 10:06UTC

<!--
sourceCommit: 833b5d9f7e1659da28bd7c127f4ba0173c639b9f
queuedAtUtc: 
previousMirroredBuild: 20260416.13 (2026-04-16)
-->

### Changed
- <kbd>RUNTIME</kbd> Public mirror changelog introduction text clarified to be more user-facing.

## [20260416.13] — 01:42UTC

<!--
sourceCommit: 833b5d9f7e1659da28bd7c127f4ba0173c639b9f
queuedAtUtc: 
previousMirroredBuild: 20260416.12 (2026-04-16)
-->

### Fixed
- <kbd>RUNTIME</kbd> Mirror changelog headings now include build time in UTC.

## [20260416.12] - 2026-04-16

<!--
sourceCommit: 48d5b7f3b2b295655c1f674dfca14ddbd13e929e
previousMirroredBuild: 20260416.11 (2026-04-16)
-->

### Changed
- <kbd>RUNTIME</kbd> Public mirror changelog hides build traceability metadata (commit/build/submodule) in an HTML comment for a cleaner user-facing view.

## [20260416.11] - 2026-04-16

Source commit: 69a82d39f9fafe8c1930910201ea73126d268e3b  
Previous source commit: e6237869a7180690c1f91ded3cb2a1e12a026025  
Previous mirrored build: 20260416.10 (2026-04-16)  

Delta basis: runtime CHANGELOG.md [Unreleased] at e6237869a7180690c1f91ded3cb2a1e12a026025 -> 69a82d39f9fafe8c1930910201ea73126d268e3b  

### Fixed
- <kbd>RUNTIME</kbd> Public mirror changelog delta computation now ignores whitespace-only changes to avoid repeating existing entries across builds.

## [20260416.10] - 2026-04-16

Source commit: e6237869a7180690c1f91ded3cb2a1e12a026025  
Previous source commit: 8e546bea0eebb37e5d20decc9982dce51d4225ab  
Previous mirrored build: 20260416.9 (2026-04-16)  

Delta basis: runtime CHANGELOG.md [Unreleased] at 8e546bea0eebb37e5d20decc9982dce51d4225ab -> e6237869a7180690c1f91ded3cb2a1e12a026025  

### Changed
- <kbd>CONTRACTS</kbd> Expanded documentation for `DcdrRuntimeClient` (auth modes, error behavior, and version diagnostics).
- <kbd>RUNTIME</kbd> Public mirror changelog now preserves historical build sections and formats build metadata with stable Markdown line breaks.

## [20260416.9] - 2026-04-16

Source commit: 8e546bea0eebb37e5d20decc9982dce51d4225ab
Previous source commit: 2d912fdd0accec2398a1f9577d0d175990786df5
Previous mirrored build: 20260416.7 (2026-04-16)
Contracts submodule: c0b65a0e293c..06a7faa5e861

Delta basis: runtime CHANGELOG.md [Unreleased] at 2d912fdd0accec2398a1f9577d0d175990786df5 -> 8e546bea0eebb37e5d20decc9982dce51d4225ab

### Changed
- <kbd>CONTRACTS</kbd> Expanded documentation for `DcdrRuntimeClient` (auth modes, error behavior, and version diagnostics). 
