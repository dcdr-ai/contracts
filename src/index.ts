export * from "./control.contract";
export * from "./errors.contract";
export * from "./execution.contract";
export * from "./conditions.contract";
export * from "./implementations.contract";
export * from "./messages.contract";
export * from "./intent.contract";
export * from "./policies.contract";
export * from "./prompts.contract";
export * from "./processing.contract";
export * from "./session.contract";
export * from "./logs.contract";
export * from "./provider.contract";
export * from "./provider-limits.contract";
export * from "./provider.catalog.contract";
export * from "./credentials.contract";
export * from "./http.contract";
export * from "./entitlements.contract";
export * from "./service-tokens.contract";
export * from "./capabilities.contract";
export * from "./subscription.contract";
export * from "./runtime.client";
export * from "./utils.contract";
// The workflow surface is three contracts, not one: the transports and the capability catalogue were
// split out of `workflow.contract` so that adding a transport is not an edit to the definition
// contract. They are re-exported **here** rather than from `workflow.contract`, because
// `check-no-barrel-cycles` refuses an `export *` in a module that has exports of its own - it makes
// a self-referential cycle ESM interop can resolve to `undefined`.
//
// Missing these lines is not a type error anywhere: TypeScript still resolves the types through the
// package subpaths, so the whole repository compiles while `require("@dcdr/contracts")
// .WorkflowConnectionProtocol` is `undefined` for every JavaScript consumer. That is exactly how it
// was missed, and `workflow.barrel.contract.test.ts` is the net that now catches it.
export * from "./workflow.connections.contract";
export * from "./workflow.tool-rating.contract";
export * from "./workflow.capabilities.contract";
export * from "./workflow.contract";
export * from "./workflow.runner.contract";
export * from "./cache.contract";
export * from "./storage.credentials.contract";
export * from "./storage.providers.contract";
export * from "./tracked-call-rating.contract";
export * from "./prompt-variable-schema.contract";
export * from "./registry.stats.contract";

// Asset contract surface — symbols not already re-exported via execution.contract.
// AssetType, ExecutionAssetDatasource*, ExecutionAssetReference are already in
// scope through execution.contract; only the managed-asset lifecycle types and
// the canonical constants are missing from the root barrel.
export {
  ASSET_TYPE_VALUES,
  ASSET_TYPE_LABELS,
  // Missing from this list until 2026-09-11, and missing from the published package with it: the
  // runtime uses it as a value (`ExecutionAssetStorageOwner.SYSTEM`) and resolved it through the
  // package-root barrel, so nothing here ever failed while every consumer of the npm package got
  // `undefined`. Found by the export audit in `workflow.barrel.contract.test.ts`, not by a compiler.
  ExecutionAssetStorageOwner,
  DcdrAssetScope,
  DcdrAssetMetadata,
  DcdrAssetMetadataAttributes,
  DcdrAssetStorageDescriptor,
  DcdrAssetUploadRequest,
  DcdrAssetUploadResponse,
  DcdrAssetGetRequest,
  DcdrAssetGetResponse,
  DcdrAssetDeleteRequest,
  DcdrAssetDeleteResponse,
} from "./asset.contract";
