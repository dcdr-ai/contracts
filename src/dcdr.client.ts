import {
  DcdrAssetDeleteRequest,
  DcdrAssetDeleteResponse,
  DcdrAssetGetRequest,
  DcdrAssetGetResponse,
  DcdrAssetUploadResponse,
} from "./asset.contract";
import {
  ExecuteIntentEvalRequest,
  ExecuteIntentEvalResponse,
  ExecuteIntentRequest,
  ExecuteIntentResponse,
  ExecutionStreamDeltaEvent,
  ExecutionStreamErrorEvent,
  ExecutionStreamFinalEvent,
  ExecutionStreamMetaEvent,
} from "./execution.contract";
import {
  DcdrRuntimeAssetUploadInput,
  DcdrRuntimeAuthCheckResponse,
  DcdrRuntimeCircuitBreakerResetResponse,
  DcdrRuntimeCircuitBreakerStatusSnapshot,
  DcdrRuntimeClient,
  DcdrRuntimeClientConfig,
  DcdrRuntimeClientStreamOptions,
  DcdrRuntimeDryRunResponse,
  DcdrRuntimeHealthcheckResponse,
  DcdrRuntimeVersionResponse,
} from "./runtime.client";
import {
  DcdrKnowledgeAnswerStreamFinalEvent,
  DcdrKnowledgeClient,
  DcdrKnowledgeClientConfig,
  DcdrKnowledgeError,
  DcdrKnowledgeRequestOptions,
} from "./knowledge.client";
import {
  DcdrKnowledgeAnswerRequest,
  DcdrKnowledgeAnswerResponse,
  DcdrKnowledgeCollectionDetail,
  DcdrKnowledgeCollectionSummary,
  DcdrKnowledgeDocumentDetail,
  DcdrKnowledgeDocumentSummary,
  DcdrKnowledgeErrorCode,
  DcdrKnowledgeSearchRequest,
  DcdrKnowledgeSearchResponse,
  ListKnowledgeCollectionsQuery,
  ListKnowledgeDocumentsQuery,
} from "./knowledge.contract";
import { WorkflowDefinition } from "./workflow.contract";
import {
  DcdrWorkflowClient,
  DcdrWorkflowClientConfig,
  DcdrWorkflowErrorCode,
  DcdrWorkflowError,
  ListWorkflowRunsQuery,
  ListWorkflowTasksQuery,
  RunWorkflowRequest,
  RunWorkflowResponse,
  WorkflowDetail,
  WorkflowPage,
  WorkflowRun,
  WorkflowRunEvidence,
  WorkflowRunReport,
  WorkflowRunResult,
  WorkflowRunStep,
  WorkflowSummary,
  WorkflowTask,
  WorkflowValidation,
  WorkflowVersionSummary,
  WorkflowWaitOptions,
} from "./workflow.client";

/**
 * One client over the three DCDR clients: intent execution on the runtime ({@link DcdrRuntimeClient}),
 * workflows ({@link DcdrWorkflowClient}) and knowledge ({@link DcdrKnowledgeClient}, since 3.20.0) on
 * the control plane.
 *
 * The runtime and the control plane are genuinely different services - different origins, different
 * credentials - which is why each client exists and stays usable on its own. What this adds is the
 * common case: a single bearer token that reaches all of them, and one object whose methods read the
 * way the platform reads.
 *
 * ```ts
 * const dcdr = new DcdrClient({ bearerToken: process.env.DCDR_TOKEN });
 *
 * await dcdr.executeIntent("CLASSIFY", { vars: { text } });        // runtime
 * await dcdr.runWorkflowAndWait("SUPPORT_TRIAGE", { input });      // control plane
 *
 * await dcdr.answerFromKnowledge({ collections: ["product-sheets"], question }); // control plane
 *
 * dcdr.runtime;    // the DcdrRuntimeClient, if you want it raw
 * dcdr.workflows;  // the DcdrWorkflowClient
 * dcdr.knowledge;  // the DcdrKnowledgeClient (3.20.0)
 * ```
 *
 * ## Construction is lazy, on purpose
 * Each client is built on first use. An integration that only runs workflows never needs a runtime
 * URL, and one that only executes intents never needs a workflow or knowledge scope; building all of
 * them eagerly would make a missing credential fail at construction for a surface the caller was
 * never going to touch.
 *
 * ## Method names
 * Identical to the underlying clients, with no aliases: `executeIntent` here is `executeIntent`
 * there. One vocabulary, so moving a call between the wrapper and a bare client is a rename of the
 * receiver and nothing else.
 */

/** Default runtime gateway origin. */
export const DCDR_DEFAULT_RUNTIME_URL = "https://runtime.dcdr.ai";

/** Default control-plane origin. */
export const DCDR_DEFAULT_CONTROL_URL = "https://dcdr.ai";

/** Configuration of {@link DcdrClient}. */
export interface DcdrClientConfig {
  /**
   * Bearer token used for both halves.
   *
   * The runtime accepts a customer session token, and the control plane accepts a managed service
   * token; when one credential is valid for both, this is the only field that has to be set.
   * Override either side through {@link DcdrClientConfig.runtime} / {@link DcdrClientConfig.workflows}.
   */
  bearerToken?: string;

  /** Runtime gateway origin. Defaults to {@link DCDR_DEFAULT_RUNTIME_URL}. */
  runtimeUrl?: string;

  /** Control-plane origin. Defaults to {@link DCDR_DEFAULT_CONTROL_URL}. */
  controlUrl?: string;

  /** Per-request timeout applied to both halves unless one overrides it. */
  timeoutMs?: number;

  /** Extra headers sent on every request of both halves. */
  extraHeaders?: Record<string, string>;

  /** Optional `fetch` implementation shared by both halves. */
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;

  /**
   * Overrides for the runtime half, merged over the shared fields.
   *
   * Use it when the runtime needs a different credential - an internal `apiToken`, say, or a session
   * bypass - or when it lives at an address the shared settings do not describe.
   */
  runtime?: Partial<DcdrRuntimeClientConfig>;

  /** Overrides for the workflow half, merged over the shared fields. */
  workflows?: Partial<DcdrWorkflowClientConfig>;

  /** Overrides for the knowledge half, merged over the shared fields. Since 3.20.0. */
  knowledge?: Partial<DcdrKnowledgeClientConfig>;
}

/**
 * Composite client over the DCDR runtime and the tenant workflow API.
 *
 * @public
 */
export class DcdrClient {
  private readonly config: DcdrClientConfig;
  private runtimeClient?: DcdrRuntimeClient;
  private workflowClient?: DcdrWorkflowClient;
  private knowledgeClient?: DcdrKnowledgeClient;

  /**
   * Creates a composite client. Neither half is built until it is used.
   *
   * @param cfg Shared settings plus optional per-half overrides.
   */
  constructor(cfg: DcdrClientConfig) {
    this.config = cfg ?? {};
  }

  /**
   * The runtime half, built on first access.
   *
   * @returns The runtime client.
   * @throws {@link Error} When the runtime half is not configurable (no credential, no `fetch`).
   */
  get runtime(): DcdrRuntimeClient {
    if (!this.runtimeClient) {
      const overrides = this.config.runtime ?? {};
      // A shared bearer is only applied when the override does not pick another auth mode:
      // `DcdrRuntimeClient` refuses a config carrying both `bearerToken` and `apiToken`, and silently
      // dropping one of them would be worse than the error.
      const usesApiToken = Boolean(overrides.apiToken);
      this.runtimeClient = new DcdrRuntimeClient({
        baseUrl: overrides.baseUrl ?? this.config.runtimeUrl ?? DCDR_DEFAULT_RUNTIME_URL,
        bearerToken: overrides.bearerToken ?? (usesApiToken ? undefined : this.config.bearerToken),
        timeoutMs: overrides.timeoutMs ?? this.config.timeoutMs,
        extraHeaders: overrides.extraHeaders ?? this.config.extraHeaders,
        fetchFn: overrides.fetchFn ?? this.config.fetchFn,
        ...overrides,
      });
    }
    return this.runtimeClient;
  }

  /**
   * The workflow half, built on first access.
   *
   * @returns The workflow client.
   * @throws {@link DcdrWorkflowError} `CONFIGURATION` when no bearer token was configured.
   */
  get workflows(): DcdrWorkflowClient {
    if (!this.workflowClient) {
      const overrides = this.config.workflows ?? {};
      const bearerToken = overrides.bearerToken ?? this.config.bearerToken ?? "";
      if (!String(bearerToken).trim()) {
        throw new DcdrWorkflowError({
          code: DcdrWorkflowErrorCode.CONFIGURATION,
          message: "DcdrClient needs a bearerToken (shared, or under `workflows`) before the workflow API can be used.",
          method: "-",
          path: "-",
        });
      }
      this.workflowClient = new DcdrWorkflowClient({
        baseUrl: overrides.baseUrl ?? this.config.controlUrl ?? DCDR_DEFAULT_CONTROL_URL,
        bearerToken,
        timeoutMs: overrides.timeoutMs ?? this.config.timeoutMs,
        extraHeaders: overrides.extraHeaders ?? this.config.extraHeaders,
        fetchFn: overrides.fetchFn ?? this.config.fetchFn,
      });
    }
    return this.workflowClient;
  }

  /**
   * The knowledge half, built on first access. It talks to the control plane, like the workflow half.
   *
   * @returns The knowledge client.
   * @throws {@link DcdrKnowledgeError} `CONFIGURATION` when no bearer token was configured.
   * @since 3.20.0
   */
  get knowledge(): DcdrKnowledgeClient {
    if (!this.knowledgeClient) {
      const overrides = this.config.knowledge ?? {};
      const bearerToken = overrides.bearerToken ?? this.config.bearerToken ?? "";
      if (!String(bearerToken).trim()) {
        throw new DcdrKnowledgeError({
          code: DcdrKnowledgeErrorCode.CONFIGURATION,
          message: "DcdrClient needs a bearerToken (shared, or under `knowledge`) before the knowledge API can be used.",
          method: "-",
          path: "-",
        });
      }
      this.knowledgeClient = new DcdrKnowledgeClient({
        baseUrl: overrides.baseUrl ?? this.config.controlUrl ?? DCDR_DEFAULT_CONTROL_URL,
        bearerToken,
        timeoutMs: overrides.timeoutMs ?? this.config.timeoutMs,
        answerTimeoutMs: overrides.answerTimeoutMs,
        extraHeaders: overrides.extraHeaders ?? this.config.extraHeaders,
        fetchFn: overrides.fetchFn ?? this.config.fetchFn,
      });
    }
    return this.knowledgeClient;
  }

  // ------------------------------------------------------------------ runtime

  /** @see DcdrRuntimeClient.executeIntent */
  async executeIntent(intent: string, request: ExecuteIntentRequest): Promise<ExecuteIntentResponse> {
    return this.runtime.executeIntent(intent, request);
  }

  /**
   * Streams an intent over SSE: `meta`, zero or more `delta`, then `final` (or `error`).
   *
   * For a structured intent (`meta.data.structured`), each delta is decoded text of one string field
   * with its `path`; every delta names its `attempt`. Act on `final`; deltas are for display.
   *
   * @see DcdrRuntimeClient.executeIntentStream
   */
  executeIntentStream(
    intent: string,
    request: ExecuteIntentRequest,
    opts?: DcdrRuntimeClientStreamOptions,
  ): AsyncGenerator<ExecutionStreamMetaEvent | ExecutionStreamDeltaEvent | ExecutionStreamFinalEvent | ExecutionStreamErrorEvent, void, void> {
    return this.runtime.executeIntentStream(intent, request, opts);
  }

  /** @see DcdrRuntimeClient.dryRun */
  async dryRun(intent: string, request: ExecuteIntentRequest): Promise<DcdrRuntimeDryRunResponse> {
    return this.runtime.dryRun(intent, request);
  }

  /** @see DcdrRuntimeClient.eval */
  async eval(intent: string, request: ExecuteIntentEvalRequest): Promise<ExecuteIntentEvalResponse> {
    return this.runtime.eval(intent, request);
  }

  /** @see DcdrRuntimeClient.demo */
  async demo(intent: string, request: ExecuteIntentRequest): Promise<ExecuteIntentResponse> {
    return this.runtime.demo(intent, request);
  }

  /** @see DcdrRuntimeClient.healthcheck */
  async healthcheck(): Promise<DcdrRuntimeHealthcheckResponse> {
    return this.runtime.healthcheck();
  }

  /** @see DcdrRuntimeClient.version */
  async version(): Promise<DcdrRuntimeVersionResponse> {
    return this.runtime.version();
  }

  /** @see DcdrRuntimeClient.authCheck */
  async authCheck(): Promise<DcdrRuntimeAuthCheckResponse> {
    return this.runtime.authCheck();
  }

  /** @see DcdrRuntimeClient.metrics */
  async metrics(token?: string): Promise<string> {
    return this.runtime.metrics(token);
  }

  /** @see DcdrRuntimeClient.uploadAsset */
  async uploadAsset(request: DcdrRuntimeAssetUploadInput): Promise<DcdrAssetUploadResponse> {
    return this.runtime.uploadAsset(request);
  }

  /** @see DcdrRuntimeClient.getAsset */
  async getAsset(request: DcdrAssetGetRequest): Promise<DcdrAssetGetResponse> {
    return this.runtime.getAsset(request);
  }

  /** @see DcdrRuntimeClient.deleteAsset */
  async deleteAsset(request: DcdrAssetDeleteRequest): Promise<DcdrAssetDeleteResponse> {
    return this.runtime.deleteAsset(request);
  }

  /** @see DcdrRuntimeClient.circuitBreakerStatus */
  async circuitBreakerStatus(provider: string, model?: string, tenantCid?: string): Promise<DcdrRuntimeCircuitBreakerStatusSnapshot> {
    return this.runtime.circuitBreakerStatus(provider, model, tenantCid);
  }

  /** @see DcdrRuntimeClient.resetCircuitBreaker */
  async resetCircuitBreaker(provider: string, model?: string, tenantCid?: string): Promise<DcdrRuntimeCircuitBreakerResetResponse> {
    return this.runtime.resetCircuitBreaker(provider, model, tenantCid);
  }

  // ------------------------------------------------------------------ workflows

  /** @see DcdrWorkflowClient.listWorkflows */
  async listWorkflows(options?: { limit?: number }): Promise<WorkflowPage<WorkflowSummary>> {
    return this.workflows.listWorkflows(options);
  }

  /** @see DcdrWorkflowClient.getWorkflow */
  async getWorkflow(key: string): Promise<WorkflowDetail> {
    return this.workflows.getWorkflow(key);
  }

  /** @see DcdrWorkflowClient.listWorkflowVersions */
  async listWorkflowVersions(key: string, options?: { limit?: number }): Promise<WorkflowPage<WorkflowVersionSummary>> {
    return this.workflows.listWorkflowVersions(key, options);
  }

  /** @see DcdrWorkflowClient.validateWorkflow */
  async validateWorkflow(definition: WorkflowDefinition): Promise<WorkflowValidation> {
    return this.workflows.validateWorkflow(definition);
  }

  /** @see DcdrWorkflowClient.runWorkflow */
  async runWorkflow(
    key: string,
    request?: RunWorkflowRequest,
    options?: { idempotencyKey?: string; signal?: AbortSignal },
  ): Promise<RunWorkflowResponse> {
    return this.workflows.runWorkflow(key, request, options);
  }

  /** @see DcdrWorkflowClient.runWorkflowAndWait */
  async runWorkflowAndWait(key: string, request?: RunWorkflowRequest, options?: WorkflowWaitOptions): Promise<WorkflowRunResult> {
    return this.workflows.runWorkflowAndWait(key, request, options);
  }

  /** @see DcdrWorkflowClient.waitForWorkflowRun */
  async waitForWorkflowRun(runId: string, options?: WorkflowWaitOptions): Promise<WorkflowRunResult> {
    return this.workflows.waitForWorkflowRun(runId, options);
  }

  /** @see DcdrWorkflowClient.listWorkflowRuns */
  async listWorkflowRuns(query?: ListWorkflowRunsQuery): Promise<WorkflowPage<WorkflowRun>> {
    return this.workflows.listWorkflowRuns(query);
  }

  /** @see DcdrWorkflowClient.getWorkflowRun */
  async getWorkflowRun(runId: string): Promise<WorkflowRun> {
    return this.workflows.getWorkflowRun(runId);
  }

  /** @see DcdrWorkflowClient.cancelWorkflowRun */
  async cancelWorkflowRun(runId: string): Promise<WorkflowRun> {
    return this.workflows.cancelWorkflowRun(runId);
  }

  /** @see DcdrWorkflowClient.resumeWorkflowRun */
  async resumeWorkflowRun(runId: string, answer: { payload: unknown; frameId?: string } | unknown): Promise<WorkflowRun> {
    return this.workflows.resumeWorkflowRun(runId, answer);
  }

  /** @see DcdrWorkflowClient.listWorkflowRunSteps */
  async listWorkflowRunSteps(runId: string): Promise<WorkflowPage<WorkflowRunStep>> {
    return this.workflows.listWorkflowRunSteps(runId);
  }

  /** @see DcdrWorkflowClient.listWorkflowRunEvidence */
  async listWorkflowRunEvidence(runId: string): Promise<WorkflowPage<WorkflowRunEvidence>> {
    return this.workflows.listWorkflowRunEvidence(runId);
  }

  /** @see DcdrWorkflowClient.getWorkflowRunReport */
  async getWorkflowRunReport(runId: string): Promise<WorkflowRunReport> {
    return this.workflows.getWorkflowRunReport(runId);
  }

  /** @see DcdrWorkflowClient.listWorkflowTasks */
  async listWorkflowTasks(query?: ListWorkflowTasksQuery): Promise<WorkflowPage<WorkflowTask>> {
    return this.workflows.listWorkflowTasks(query);
  }

  // ------------------------------------------------------------------ knowledge

  /** @see DcdrKnowledgeClient.listKnowledgeCollections */
  async listKnowledgeCollections(query?: ListKnowledgeCollectionsQuery): Promise<WorkflowPage<DcdrKnowledgeCollectionSummary>> {
    return this.knowledge.listKnowledgeCollections(query);
  }

  /** @see DcdrKnowledgeClient.getKnowledgeCollection */
  async getKnowledgeCollection(idOrKey: string): Promise<DcdrKnowledgeCollectionDetail> {
    return this.knowledge.getKnowledgeCollection(idOrKey);
  }

  /** @see DcdrKnowledgeClient.listKnowledgeDocuments */
  async listKnowledgeDocuments(idOrKey: string, query?: ListKnowledgeDocumentsQuery): Promise<WorkflowPage<DcdrKnowledgeDocumentSummary>> {
    return this.knowledge.listKnowledgeDocuments(idOrKey, query);
  }

  /** @see DcdrKnowledgeClient.getKnowledgeDocument */
  async getKnowledgeDocument(idOrKey: string, documentId: string): Promise<DcdrKnowledgeDocumentDetail> {
    return this.knowledge.getKnowledgeDocument(idOrKey, documentId);
  }

  /** @see DcdrKnowledgeClient.searchKnowledge */
  async searchKnowledge(request: DcdrKnowledgeSearchRequest, options?: DcdrKnowledgeRequestOptions): Promise<DcdrKnowledgeSearchResponse> {
    return this.knowledge.searchKnowledge(request, options);
  }

  /** @see DcdrKnowledgeClient.answerFromKnowledge */
  async answerFromKnowledge(request: DcdrKnowledgeAnswerRequest, options?: DcdrKnowledgeRequestOptions): Promise<DcdrKnowledgeAnswerResponse> {
    return this.knowledge.answerFromKnowledge(request, options);
  }

  /**
   * Streams a grounded answer over SSE: `meta`, zero or more `delta`, then `final` (or `error`).
   *
   * `final` is authoritative: a refusal may arrive after deltas have streamed, and then the painted
   * text must be discarded (`final.data.response.refusal !== null`, `text === ""`).
   *
   * @see DcdrKnowledgeClient.answerFromKnowledgeStream
   */
  answerFromKnowledgeStream(
    request: DcdrKnowledgeAnswerRequest,
    options?: DcdrKnowledgeRequestOptions,
  ): AsyncGenerator<ExecutionStreamMetaEvent | ExecutionStreamDeltaEvent | DcdrKnowledgeAnswerStreamFinalEvent | ExecutionStreamErrorEvent, void, void> {
    return this.knowledge.answerFromKnowledgeStream(request, options);
  }
}
