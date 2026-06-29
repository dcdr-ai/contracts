import { Intent } from "./intent.contract";

/**
 * Stable semantic part families for managed assets and multimodal execution payloads.
 */
export enum AssetType {
  TEXT = "text",
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
  DOCUMENT = "document",
}

/**
 * Canonical list of supported asset type values.
 */
export const ASSET_TYPE_VALUES: readonly AssetType[] = [
  AssetType.TEXT,
  AssetType.IMAGE,
  AssetType.AUDIO,
  AssetType.VIDEO,
  AssetType.DOCUMENT,
];

/**
 * Stable human-readable labels for semantic asset families.
 */
export const ASSET_TYPE_LABELS: Readonly<Record<AssetType, string>> = {
  [AssetType.TEXT]: "text",
  [AssetType.IMAGE]: "image",
  [AssetType.AUDIO]: "audio",
  [AssetType.VIDEO]: "video",
  [AssetType.DOCUMENT]: "document",
};

/**
 * Storage datasource families for asset-backed multimodal content.
 */
export enum ExecutionAssetDatasourceType {
  S3 = "S3",
  FTP = "FTP",
  NAS = "NAS",
}

/**
 * How a storage datasource is resolved.
 */
export enum ExecutionAssetDatasourceResolutionMode {
  EXPLICIT = "EXPLICIT",
  BACKEND = "BACKEND",
}

/**
 * Reference to a storage datasource used by asset-backed execution parts.
 */
export interface ExecutionAssetDatasourceReference {
  /** Datasource family. */
  type: ExecutionAssetDatasourceType;

  /** Resolution mode for this datasource. */
  resolution: ExecutionAssetDatasourceResolutionMode;

  /** Stable backend-managed datasource identifier when resolution is shared/implicit. */
  id?: string;

  /** Optional S3-compatible endpoint or equivalent base address for explicit mode. */
  endpoint?: string;

  /** Optional bucket/share/container name for explicit mode. */
  container?: string;

  /** Optional region hint for explicit object storage. */
  region?: string;

  /** Optional tenant/path prefix within the datasource. */
  basePath?: string;
}

/**
 * Stable reference to an asset stored outside the execution payload itself.
 */
export interface ExecutionAssetReference {
  /** Optional datasource used to resolve this asset. */
  datasource?: ExecutionAssetDatasourceReference;

  /** Stable datasource-relative asset path resolved by runtime. */
  assetPath?: string;

  /** Optional known content hash. */
  sha256?: string;

  /** Optional known size in bytes. */
  sizeBytes?: number;
}

/**
 * Stable asset-management scopes that customer service tokens can expose.
 */
export enum DcdrAssetScope {
  READ = "assets:read",
  WRITE = "assets:write",
  DELETE = "assets:delete",
}

/**
 * Optional semantic metadata associated with a managed asset.
 */
export interface DcdrAssetMetadata {
  /** Optional display title for the asset. */
  title?: string;

  /** Optional longer human-readable description. */
  description?: string;

  /** Optional alternative text, primarily for images and accessibility. */
  alt?: string;

  /** Optional free-form discovery tags. */
  tags?: string[];

  /** Optional string attributes for domain-specific indexing. */
  attributes?: DcdrAssetMetadataAttributes;
}

/**
 * Optional string attribute bag for semantic asset metadata.
 */
export interface DcdrAssetMetadataAttributes {
  [key: string]: string;
}

/**
 * Tenant storage descriptor used by backend entitlements and runtime resolution.
 *
 * Notes
 * - Runtime should normally select the single `isDefault=true` storage when callers omit `storageId`.
 * - `datasource` remains backend-managed in cloud mode; runtime/freeware mode does not expose managed asset storage.
 */
export interface DcdrAssetStorageDescriptor {
  /** Stable tenant-visible storage identifier. */
  id: string;

  /** Backend-managed datasource details used to resolve the physical storage target. */
  datasource: ExecutionAssetDatasourceReference;

  /** Marks the default storage used when API calls omit `storageId`. */
  isDefault?: boolean;

  /** Optional soft disable flag for maintenance or entitlement gating. */
  enabled?: boolean;

  /** Optional maximum size enforced by runtime for uploads to this storage. */
  maxAssetSizeBytes?: number;

  /** Optional backend-issued credentials expiry hint (unix ms). */
  credentialsExpiresAtMs?: number;
}

/**
 * Upload request for creating or reusing a managed asset in tenant storage.
 */
export interface DcdrAssetUploadRequest {
  /** Optional semantic intent context for logging or future business metadata. */
  intent?: Intent;

  /** Semantic part family represented by the uploaded asset. */
  partType: AssetType;

  /** Technical MIME type of the payload being uploaded. */
  mimeType: string;

  /** Base64-encoded binary payload. */
  dataBase64: string;

  /** Optional human-friendly original filename. */
  name?: string;

  /** Optional semantic metadata stored alongside the asset. */
  metadata?: DcdrAssetMetadata;

  /** Optional storage override. When omitted, runtime uses the tenant default storage. */
  storageId?: string;

  /**
   * Optional caller-provided logical cache key override.
   *
   * Notes
   * - When omitted, runtime computes the default value with `buildDcdrAssetCacheKey()`.
   * - This key is tenant-global by design and can therefore support reuse across intents.
   */
  assetCacheKey?: string;
}

/**
 * Runtime response for a successful asset upload.
 */
export interface DcdrAssetUploadResponse {
  ok: boolean;
  storageId: string;
  created: boolean;
  mimeType: string;
  name?: string;
  metadata?: DcdrAssetMetadata;
  asset: ExecutionAssetReference;
}

/**
 * Request for fetching a managed asset through runtime.
 */
export interface DcdrAssetGetRequest {
  /** Datasource-relative asset path returned by a previous upload or execution result. */
  assetPath: string;

  /** Optional storage override. When omitted, runtime uses the tenant default storage. */
  storageId?: string;
}

/**
 * Runtime response for a managed asset fetch.
 */
export interface DcdrAssetGetResponse {
  ok: boolean;
  storageId: string;
  mimeType?: string;
  name?: string;
  metadata?: DcdrAssetMetadata;
  dataBase64: string;
  asset: ExecutionAssetReference;
}

/**
 * Request for deleting a managed asset through runtime.
 */
export interface DcdrAssetDeleteRequest {
  /** Datasource-relative asset path returned by a previous upload or execution result. */
  assetPath: string;

  /** Optional storage override. When omitted, runtime uses the tenant default storage. */
  storageId?: string;
}

/**
 * Runtime response for a managed asset deletion.
 */
export interface DcdrAssetDeleteResponse {
  ok: boolean;
  storageId: string;
  assetPath: string;
  deleted: boolean;
}
