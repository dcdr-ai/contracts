import { ExecutionAssetDatasourceType } from "./asset.contract";
import { AssetStorageCredentialsContract, AssetStorageCredentialsKind } from "./storage.credentials.contract";

/**
 * What an asset-storage provider needs configured, as data rather than as prose.
 *
 * Why this exists
 * - `AssetStorageCredentialsContract` says which *shapes* are possible, not which ones this platform
 *   can actually serve, nor which fields a person must fill in for a given provider. That knowledge
 *   used to live in three places at once - the runtime's normalizer, the admin editor's form, and a
 *   markdown table - and they drifted: the editor offered S3 with presets for AWS, R2, Backblaze and
 *   MinIO while the runtime could only speak Google's API, so a tenant could configure a storage,
 *   save it without a single error, and discover at the first upload that it had never been
 *   possible.
 * - So the list of implemented providers and their fields is published here, and every consumer
 *   reads it: the admin UI builds its form from `fields`, the backend validates a save with
 *   `validateAssetStorageCredentials`, and a provider absent from
 *   `ASSET_STORAGE_IMPLEMENTED_CREDENTIAL_KINDS` cannot be offered by accident.
 *
 * This module is metadata only. It never carries a secret **value**; `secret: true` on a field is a
 * statement about how a UI must render it, not about anything stored here.
 */

/** How one configuration field is entered. */
export enum AssetStorageFieldKind {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  /** Free text over several lines, such as a PEM key. */
  MULTILINE = "MULTILINE",
}

/** Whether a field must be filled in, and under what rule. */
export enum AssetStorageFieldRequirement {
  /** Absent means the provider cannot work at all. */
  REQUIRED = "REQUIRED",
  /** Absent is fine; a documented default applies. */
  OPTIONAL = "OPTIONAL",
  /**
   * At least one field of the same `oneOfGroup` must be present. Used for credentials that come in
   * alternatives, such as an SFTP password or private key.
   */
  ONE_OF = "ONE_OF",
}

/** Why a configured storage would not work. */
export enum AssetStorageValidationIssueCode {
  /** A `REQUIRED` field is empty. */
  MISSING_REQUIRED = "MISSING_REQUIRED",
  /** Every field of a `ONE_OF` group is empty. */
  MISSING_ONE_OF = "MISSING_ONE_OF",
  /** The credential kind is declared but this platform cannot serve it. */
  UNSUPPORTED_KIND = "UNSUPPORTED_KIND",
}

/**
 * One configuration field of one provider.
 *
 * `path` is a dotted path into `AssetStorageCredentialsContract` - `"endpoint"`,
 * `"s3AccessKey.accessKeyId"` - which is what lets a generic form and a generic validator work on a
 * payload they do not have to understand field by field.
 */
export interface AssetStorageField {
  /** Dotted path into `AssetStorageCredentialsContract`. */
  path: string;

  /** Input type. */
  kind: AssetStorageFieldKind;

  /** English label; a localized UI may translate it and fall back to this. */
  label: string;

  /** What the field is for, and what happens when it is left empty. */
  description: string;

  /** Whether it must be filled in. */
  requirement: AssetStorageFieldRequirement;

  /** Group name when `requirement` is `ONE_OF`. */
  oneOfGroup?: string;

  /** Render masked, and never echo a stored value back to the UI. */
  secret?: boolean;

  /** Value applied when the field is left empty, as documentation for the form. */
  defaultValue?: string | number | boolean;

  /** Example value, for a placeholder. */
  placeholder?: string;
}

/**
 * A known endpoint shape for an S3-compatible provider.
 *
 * The templates live here rather than in the admin editor because the editor needs to do two things
 * with them - build an endpoint from a choice, and recognise the choice from a stored endpoint - and
 * those two had already drifted apart once.
 */
export interface AssetStorageEndpointPreset {
  /** Stable identifier, stored with the storage so an editor reopens on the right choice. */
  id: string;

  /** English label. */
  label: string;

  /**
   * Endpoint template. `{region}` is substituted; an empty template means the provider has no
   * canonical host and the endpoint must be typed by hand.
   */
  endpointTemplate: string;

  /** Template used when no region is given, for a provider that has a region-less host. */
  endpointTemplateWithoutRegion?: string;

  /** Regular-expression source matching an endpoint of this preset; capture group 1 is the region. */
  endpointPattern?: string;

  /** Whether the template cannot be completed without a region. */
  regionRequired: boolean;

  /** What the region field is called here; Cloudflare's "region" is an account identifier. */
  regionLabel?: string;

  /** Whether path-style addressing is the right default for this provider. */
  forcePathStyle: boolean;
}

/** Everything a consumer needs to offer, configure and validate one provider. */
export interface AssetStorageProviderDescriptor {
  /** Credential kind this describes. */
  kind: AssetStorageCredentialsKind;

  /**
   * The value stored in `credentials.datasourceType` for this provider.
   *
   * It names a storage *family*, not a vendor: Google Cloud Storage is reached with the same
   * object-storage semantics as S3 and reports `S3`, while SFTP gets its own entry because it is a
   * different protocol from FTP rather than a variant of it.
   */
  datasourceType: ExecutionAssetDatasourceType;

  /** English label. */
  label: string;

  /** One line on what this provider is. */
  description: string;

  /** Whether the runtime can actually serve it today. A UI must not offer a provider that cannot. */
  implemented: boolean;

  /**
   * Whether a time-limited URL can be issued for an object.
   *
   * False for both file-transfer protocols, and not an oversight: FTP and SFTP authenticate a
   * *session*, and a link carrying its own expiring authority has no equivalent in either. Callers
   * read those assets through the assets API instead.
   */
  supportsSignedUrls: boolean;

  /** What `container` means here - a bucket, or a directory. */
  containerLabel: string;

  /** A transport caveat an editor must show where the person configuring it will read it. */
  securityNotice?: string;

  /** The fields to render and validate. */
  fields: readonly AssetStorageField[];

  /** Known endpoints, for providers that have any. */
  endpointPresets?: readonly AssetStorageEndpointPreset[];
}

/** One reason a configured storage would not work. */
export interface AssetStorageValidationIssue {
  /** What is wrong. */
  code: AssetStorageValidationIssueCode;

  /** Dotted path of the offending field, or the `oneOfGroup` name for a group. */
  path: string;

  /** Human-readable reason. */
  message: string;
}

const S3_ENDPOINT_PRESETS: readonly AssetStorageEndpointPreset[] = [
  {
    id: "AWS_S3",
    label: "Amazon S3",
    endpointTemplate: "https://s3.{region}.amazonaws.com",
    endpointTemplateWithoutRegion: "https://s3.amazonaws.com",
    endpointPattern: "^https://s3\\.([^.]+)\\.amazonaws\\.com$",
    regionRequired: false,
    forcePathStyle: false,
  },
  {
    id: "GOOGLE_CLOUD",
    label: "Google Cloud Storage (S3 interoperability)",
    endpointTemplate: "https://storage.googleapis.com",
    regionRequired: false,
    forcePathStyle: false,
  },
  {
    id: "CLOUDFLARE_R2",
    label: "Cloudflare R2",
    endpointTemplate: "https://{region}.r2.cloudflarestorage.com",
    endpointPattern: "^https://([^.]+)\\.r2\\.cloudflarestorage\\.com$",
    // R2 addresses the account, not a geography, and there is no host without it.
    regionRequired: true,
    regionLabel: "Account ID",
    forcePathStyle: true,
  },
  {
    id: "BACKBLAZE_B2",
    label: "Backblaze B2",
    endpointTemplate: "https://s3.{region}.backblazeb2.com",
    endpointPattern: "^https://s3\\.([^.]+)\\.backblazeb2\\.com$",
    regionRequired: true,
    forcePathStyle: true,
  },
  {
    id: "MINIO",
    label: "MinIO",
    // No canonical host: every deployment is somewhere else, so the endpoint is typed.
    endpointTemplate: "",
    regionRequired: false,
    forcePathStyle: true,
  },
  {
    id: "CUSTOM",
    label: "Custom S3-compatible endpoint",
    endpointTemplate: "",
    regionRequired: false,
    forcePathStyle: true,
  },
];

const GOOGLE_CLOUD_FIELDS: readonly AssetStorageField[] = [
  {
    path: "container",
    kind: AssetStorageFieldKind.STRING,
    label: "Bucket",
    description: "The bucket assets are written to.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    placeholder: "my-tenant-assets",
  },
  {
    path: "basePath",
    kind: AssetStorageFieldKind.STRING,
    label: "Base path",
    description: "Prefix every object is written under. Defaults to the tenant identifier.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
  },
  {
    path: "googleCloudServiceAccount.projectId",
    kind: AssetStorageFieldKind.STRING,
    label: "Project ID",
    description: "Google Cloud project owning the bucket.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
  },
  {
    path: "googleCloudServiceAccount.clientEmail",
    kind: AssetStorageFieldKind.STRING,
    label: "Client email",
    description: "Service-account address, from the downloaded key file.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    placeholder: "assets@project.iam.gserviceaccount.com",
  },
  {
    path: "googleCloudServiceAccount.privateKey",
    kind: AssetStorageFieldKind.MULTILINE,
    label: "Private key",
    description: "PEM private key from the service-account key file.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    secret: true,
  },
];

const S3_FIELDS: readonly AssetStorageField[] = [
  {
    path: "container",
    kind: AssetStorageFieldKind.STRING,
    label: "Bucket",
    description: "The bucket assets are written to.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    placeholder: "my-tenant-assets",
  },
  {
    path: "endpoint",
    kind: AssetStorageFieldKind.STRING,
    label: "Endpoint",
    description:
      "Service address. Leave it empty only for Amazon S3 - an empty endpoint points the client at AWS, which is why a MinIO or R2 storage configured without one fails at the first object rather than at save time.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    placeholder: "https://minio.internal:9000",
  },
  {
    path: "region",
    kind: AssetStorageFieldKind.STRING,
    label: "Region",
    description:
      "Signing region. A placeholder is fine for a self-hosted server; the client needs some value and falls back to us-east-1.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    defaultValue: "us-east-1",
  },
  {
    path: "basePath",
    kind: AssetStorageFieldKind.STRING,
    label: "Base path",
    description: "Prefix every object is written under. Defaults to the tenant identifier.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
  },
  {
    path: "s3AccessKey.accessKeyId",
    kind: AssetStorageFieldKind.STRING,
    label: "Access key ID",
    description: "Access key identifier.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
  },
  {
    path: "s3AccessKey.secretAccessKey",
    kind: AssetStorageFieldKind.STRING,
    label: "Secret access key",
    description: "Secret half of the access key.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    secret: true,
  },
  {
    path: "s3AccessKey.sessionToken",
    kind: AssetStorageFieldKind.STRING,
    label: "Session token",
    description: "Only for temporary credentials, which expire and take the storage with them when they do.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    secret: true,
  },
  {
    path: "s3AccessKey.forcePathStyle",
    kind: AssetStorageFieldKind.BOOLEAN,
    label: "Path-style addressing",
    description:
      "Address the bucket as a path rather than as a subdomain. Keep it on for anything self-hosted: virtual-host addressing resolves <bucket>.<host>, and nothing self-hosted has that DNS.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    defaultValue: true,
  },
];

const FTP_FIELDS: readonly AssetStorageField[] = [
  {
    path: "ftpBasic.host",
    kind: AssetStorageFieldKind.STRING,
    label: "Host",
    description: "Server address.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
  },
  {
    path: "ftpBasic.port",
    kind: AssetStorageFieldKind.NUMBER,
    label: "Port",
    description: "Control port.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    defaultValue: 21,
  },
  {
    path: "ftpBasic.username",
    kind: AssetStorageFieldKind.STRING,
    label: "Username",
    description: "Account used for every transfer.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
  },
  {
    path: "ftpBasic.password",
    kind: AssetStorageFieldKind.STRING,
    label: "Password",
    description: "Account password.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    secret: true,
  },
  {
    path: "ftpBasic.secure",
    kind: AssetStorageFieldKind.BOOLEAN,
    label: "Use FTPS",
    description: "Upgrade the control connection with TLS. Off means this password crosses the network in clear.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    defaultValue: false,
  },
  {
    path: "ftpBasic.passive",
    kind: AssetStorageFieldKind.BOOLEAN,
    label: "Passive mode",
    description:
      "What a client behind a firewall needs, and therefore the default. FTP negotiates a second port for the data itself, so a server whose passive range is unreachable accepts the login and then hangs on the first byte - a failure that reads like wrong credentials and is not.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    defaultValue: true,
  },
  {
    path: "basePath",
    kind: AssetStorageFieldKind.STRING,
    label: "Directory",
    description: "Directory everything is written under. There are no buckets here, so this is where the assets live.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    placeholder: "/assets",
  },
];

const SFTP_FIELDS: readonly AssetStorageField[] = [
  {
    path: "sftpKey.host",
    kind: AssetStorageFieldKind.STRING,
    label: "Host",
    description: "Server address.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
  },
  {
    path: "sftpKey.port",
    kind: AssetStorageFieldKind.NUMBER,
    label: "Port",
    description: "SSH port.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    defaultValue: 22,
  },
  {
    path: "sftpKey.username",
    kind: AssetStorageFieldKind.STRING,
    label: "Username",
    description: "SSH account used for every transfer.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
  },
  {
    path: "sftpKey.password",
    kind: AssetStorageFieldKind.STRING,
    label: "Password",
    description: "Password authentication. Supply this or a private key.",
    requirement: AssetStorageFieldRequirement.ONE_OF,
    oneOfGroup: "sftpAuth",
    secret: true,
  },
  {
    path: "sftpKey.privateKey",
    kind: AssetStorageFieldKind.MULTILINE,
    label: "Private key",
    description: "PEM private key. Used in preference to a password when both are stored, being the stronger credential.",
    requirement: AssetStorageFieldRequirement.ONE_OF,
    oneOfGroup: "sftpAuth",
    secret: true,
  },
  {
    path: "sftpKey.passphrase",
    kind: AssetStorageFieldKind.STRING,
    label: "Key passphrase",
    description: "Only for a private key that has one.",
    requirement: AssetStorageFieldRequirement.OPTIONAL,
    secret: true,
  },
  {
    path: "basePath",
    kind: AssetStorageFieldKind.STRING,
    label: "Directory",
    description: "Directory everything is written under.",
    requirement: AssetStorageFieldRequirement.REQUIRED,
    placeholder: "/home/dcdr/assets",
  },
];

/**
 * Every provider this platform knows about.
 *
 * All of them work today. The `implemented` flag stays on the descriptor rather than being dropped
 * as redundant, because it is what a UI checks before offering a provider and what keeps a future
 * entry honest while its adapter is being written - the alternative is the state this module exists
 * to prevent, where a storage can be configured months before anything can serve it.
 *
 * SMB / NAS was removed rather than kept as a disabled entry. The Node ecosystem for it is dead -
 * `@marsaud/smb2`, `smb2` and `v9u-smb2` were last published in 2022, and the only maintained
 * client, `node-smb2`, speaks SMB2 only (a NAS configured SMB3-only will not answer it) and drags
 * `moment` plus `moment-timezone` for 9.7 MB of node_modules. Over a WAN a tenant needs a VPN to
 * reach a NAS at all, and inside that VPN SFTP does the same job with a client that is alive.
 */
export const ASSET_STORAGE_PROVIDERS: Readonly<Record<AssetStorageCredentialsKind, AssetStorageProviderDescriptor>> = {
  [AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT]: {
    kind: AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT,
    datasourceType: ExecutionAssetDatasourceType.S3,
    label: "Google Cloud Storage",
    description: "Google's own API, authenticated with a service account.",
    implemented: true,
    supportsSignedUrls: true,
    containerLabel: "Bucket",
    fields: GOOGLE_CLOUD_FIELDS,
  },
  [AssetStorageCredentialsKind.S3_ACCESS_KEY]: {
    kind: AssetStorageCredentialsKind.S3_ACCESS_KEY,
    datasourceType: ExecutionAssetDatasourceType.S3,
    label: "S3-compatible storage",
    description: "Amazon S3 and anything that speaks its API: MinIO, Cloudflare R2, Backblaze B2, a private gateway.",
    implemented: true,
    supportsSignedUrls: true,
    containerLabel: "Bucket",
    fields: S3_FIELDS,
    endpointPresets: S3_ENDPOINT_PRESETS,
  },
  [AssetStorageCredentialsKind.FTP_BASIC]: {
    kind: AssetStorageCredentialsKind.FTP_BASIC,
    datasourceType: ExecutionAssetDatasourceType.FTP,
    label: "FTP / FTPS",
    description: "A file-transfer server, with optional TLS on the control connection.",
    implemented: true,
    supportsSignedUrls: false,
    containerLabel: "Directory",
    securityNotice: "Without FTPS the password and the files cross the network unencrypted. Prefer SFTP, or enable FTPS.",
    fields: FTP_FIELDS,
  },
  [AssetStorageCredentialsKind.SFTP_KEY]: {
    kind: AssetStorageCredentialsKind.SFTP_KEY,
    datasourceType: ExecutionAssetDatasourceType.SFTP,
    label: "SFTP",
    description: "File transfer over SSH. Unrelated to FTP despite the name: it is an SSH subsystem, and always encrypted.",
    implemented: true,
    supportsSignedUrls: false,
    containerLabel: "Directory",
    fields: SFTP_FIELDS,
  },
};

/**
 * The providers the runtime can actually serve.
 *
 * A UI offering anything outside this list is offering something that fails at the first object, and
 * that is not hypothetical - it is exactly what shipped for S3 before the client existed.
 */
export const ASSET_STORAGE_IMPLEMENTED_CREDENTIAL_KINDS: readonly AssetStorageCredentialsKind[] = Object.values(
  ASSET_STORAGE_PROVIDERS,
)
  .filter((provider) => provider.implemented)
  .map((provider) => provider.kind);

/**
 * Returns the descriptor for one credential kind.
 *
 * @param kind Credential kind.
 * @returns The descriptor, or undefined when the kind is not one this platform knows.
 */
export function getAssetStorageProvider(kind: AssetStorageCredentialsKind): AssetStorageProviderDescriptor | undefined {
  return ASSET_STORAGE_PROVIDERS[kind];
}

/**
 * Lists every known provider, in a stable order.
 *
 * @returns All descriptors.
 */
export function listAssetStorageProviders(): readonly AssetStorageProviderDescriptor[] {
  return Object.values(ASSET_STORAGE_PROVIDERS);
}

/**
 * Whether the runtime can serve a storage of this kind.
 *
 * @param kind Credential kind.
 * @returns True when an adapter exists.
 */
export function isAssetStorageCredentialKindImplemented(kind: AssetStorageCredentialsKind): boolean {
  return ASSET_STORAGE_PROVIDERS[kind]?.implemented === true;
}

/**
 * Reads one dotted field path out of a credentials payload.
 *
 * @param credentials Credentials payload.
 * @param path Dotted path, such as `s3AccessKey.accessKeyId`.
 * @returns The value, or undefined when any step of the path is absent.
 */
export function readAssetStorageFieldValue(credentials: Partial<AssetStorageCredentialsContract>, path: string): unknown {
  let current: unknown = credentials;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Whether a field value counts as supplied.
 *
 * A blank string does not: an empty text input and an absent field are the same intent, and treating
 * them differently is how a storage gets saved with an endpoint of `""` and then points at AWS.
 *
 * @param value Field value.
 * @returns True when the value is present.
 */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

/**
 * Checks one configured storage against its provider's fields.
 *
 * Meant to run at save time, in the backend and in the UI alike, so that a storage which cannot work
 * is refused by the form rather than discovered at the first upload.
 *
 * @param credentials The credentials payload as configured.
 * @returns Every reason it would not work; empty when it is complete.
 */
export function validateAssetStorageCredentials(
  credentials: Partial<AssetStorageCredentialsContract>,
): AssetStorageValidationIssue[] {
  const kind = credentials.kind as AssetStorageCredentialsKind | undefined;
  const provider = kind ? ASSET_STORAGE_PROVIDERS[kind] : undefined;
  if (!provider) {
    return [
      {
        code: AssetStorageValidationIssueCode.UNSUPPORTED_KIND,
        path: "kind",
        message: `Unknown asset storage credential kind: ${String(kind ?? "")}.`,
      },
    ];
  }

  const issues: AssetStorageValidationIssue[] = [];
  if (!provider.implemented) {
    issues.push({
      code: AssetStorageValidationIssueCode.UNSUPPORTED_KIND,
      path: "kind",
      message: `${provider.label} storages cannot be served by this platform yet.`,
    });
  }

  const declaredGroups = new Set<string>();
  const satisfiedGroups = new Set<string>();
  for (const field of provider.fields) {
    const value = readAssetStorageFieldValue(credentials, field.path);
    if (field.requirement === AssetStorageFieldRequirement.REQUIRED && !hasValue(value)) {
      issues.push({
        code: AssetStorageValidationIssueCode.MISSING_REQUIRED,
        path: field.path,
        message: `${field.label} is required for ${provider.label}.`,
      });
      continue;
    }
    if (field.requirement === AssetStorageFieldRequirement.ONE_OF && field.oneOfGroup) {
      declaredGroups.add(field.oneOfGroup);
      if (hasValue(value)) satisfiedGroups.add(field.oneOfGroup);
    }
  }

  for (const group of declaredGroups) {
    if (satisfiedGroups.has(group)) continue;
    const alternatives = provider.fields
      .filter((field) => field.oneOfGroup === group)
      .map((field) => field.label)
      .join(" or ");
    issues.push({
      code: AssetStorageValidationIssueCode.MISSING_ONE_OF,
      path: group,
      message: `${provider.label} needs ${alternatives}.`,
    });
  }

  return issues;
}

/**
 * Builds the endpoint one preset describes.
 *
 * @param preset Endpoint preset.
 * @param region Region, or the account identifier where the provider calls it that.
 * @returns The endpoint, or an empty string when the preset has no canonical host or lacks its region.
 */
export function buildAssetStorageEndpoint(preset: AssetStorageEndpointPreset, region?: string): string {
  const normalizedRegion = String(region ?? "").trim();
  if (!preset.endpointTemplate) return "";
  if (!preset.endpointTemplate.includes("{region}")) return preset.endpointTemplate;
  if (!normalizedRegion) return preset.endpointTemplateWithoutRegion ?? "";
  return preset.endpointTemplate.replace("{region}", normalizedRegion);
}

/**
 * Recognises which preset a stored endpoint came from.
 *
 * The counterpart of `buildAssetStorageEndpoint`, so that an editor reopens on the choice the person
 * made rather than on whichever option happens to be first.
 *
 * @param endpoint Stored endpoint.
 * @returns The preset and the region it encodes, or undefined when nothing matches.
 */
export function matchAssetStorageEndpointPreset(
  endpoint: string,
): { preset: AssetStorageEndpointPreset; region: string } | undefined {
  const normalized = String(endpoint ?? "").trim();
  if (!normalized) return undefined;

  for (const preset of S3_ENDPOINT_PRESETS) {
    if (preset.endpointPattern) {
      const match = new RegExp(preset.endpointPattern, "i").exec(normalized);
      if (match) return { preset, region: String(match[1] ?? "").trim() };
    }

    const exact = [preset.endpointTemplate, preset.endpointTemplateWithoutRegion ?? ""].filter(
      (template) => template && !template.includes("{region}"),
    );
    if (exact.some((template) => template.toLowerCase() === normalized.toLowerCase())) {
      return { preset, region: "" };
    }
  }

  return undefined;
}
