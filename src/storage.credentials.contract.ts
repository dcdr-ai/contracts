import { ExecutionAssetDatasourceType } from "./asset.contract";

/**
 * Concrete credential payload kinds used by backend-managed asset storages.
 *
 * Notes
 * - This is intentionally separate from `ExecutionAssetDatasourceType`.
 * - `datasourceType` describes the storage family (`S3`, `FTP`, `SFTP`).
 * - `kind` describes the exact credential material returned to runtime.
 */
export enum AssetStorageCredentialsKind {
  GOOGLE_CLOUD_SERVICE_ACCOUNT = "GOOGLE_CLOUD_SERVICE_ACCOUNT",
  S3_ACCESS_KEY = "S3_ACCESS_KEY",
  FTP_BASIC = "FTP_BASIC",
  SFTP_KEY = "SFTP_KEY",
}

/**
 * Google Cloud service-account credentials used by the current managed-bucket runtime slice.
 */
export interface AssetStorageGoogleCloudServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

/**
 * S3-compatible access-key credentials for future object-storage backends.
 */
export interface AssetStorageS3AccessKeyCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  forcePathStyle?: boolean;
}

/**
 * FTP credentials for future file-transfer-backed asset storages.
 */
export interface AssetStorageFtpBasicCredentials {
  host: string;
  port?: number;
  username: string;
  password: string;
  secure?: boolean;
  passive?: boolean;
}

/**
 * SFTP credentials for SSH-backed asset storages.
 *
 * Notes
 * - **Not the same protocol as FTP**, despite the name: SFTP is a subsystem of SSH, with no passive
 *   mode and no plaintext variant. `AssetStorageFtpBasicCredentials` carries `passive`, which exists
 *   only in FTP, so the two cannot share one credential shape without lying about one of them.
 * - `password` and `privateKey` are alternatives; a storage carrying both is one mid-rotation, and
 *   the key wins because it is the stronger credential.
 */
export interface AssetStorageSftpKeyCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

/**
 * Backend-resolved credential payload for a managed asset storage datasource.
 *
 * Notes
 * - Keep this additive and secret-bearing: backend/runtime only, never UI-facing.
 * - Optional transport/location hints allow backend to remain source-of-truth for
 *   container, endpoint, region, or base-path overrides when they are not fully
 *   represented in tenant entitlements.
 */
export interface AssetStorageCredentialsContract {
  kind: AssetStorageCredentialsKind;
  datasourceType: ExecutionAssetDatasourceType;
  endpoint?: string;
  container?: string;
  region?: string;
  basePath?: string;
  googleCloudServiceAccount?: AssetStorageGoogleCloudServiceAccountCredentials;
  s3AccessKey?: AssetStorageS3AccessKeyCredentials;
  ftpBasic?: AssetStorageFtpBasicCredentials;
  sftpKey?: AssetStorageSftpKeyCredentials;
}

/**
 * Request sent by runtime to backend to resolve one tenant-visible storage/datasource.
 */
export interface ResolveAssetStorageCredentialsRequest {
  storageId?: string;
  datasourceId?: string;
}

/**
 * Backend response containing the concrete credentials for one tenant storage datasource.
 */
export interface ResolveAssetStorageCredentialsResponse {
  storageId: string;
  datasourceId: string;
  credentials: AssetStorageCredentialsContract;
  expiresAtMs?: number;
}
