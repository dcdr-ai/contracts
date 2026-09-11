import { ExecutionAssetDatasourceType } from "../src/asset.contract";
import { AssetStorageCredentialsContract, AssetStorageCredentialsKind } from "../src/storage.credentials.contract";
import {
  ASSET_STORAGE_IMPLEMENTED_CREDENTIAL_KINDS,
  ASSET_STORAGE_PROVIDERS,
  AssetStorageFieldKind,
  AssetStorageFieldRequirement,
  AssetStorageValidationIssueCode,
  buildAssetStorageEndpoint,
  getAssetStorageProvider,
  isAssetStorageCredentialKindImplemented,
  listAssetStorageProviders,
  matchAssetStorageEndpointPreset,
  readAssetStorageFieldValue,
  validateAssetStorageCredentials,
} from "../src/storage.providers.contract";

/**
 * The provider descriptors, which exist so that "what we offer" and "what we can serve" cannot drift
 * apart again.
 *
 * They did drift, and the way it showed is the reason this module is published rather than kept in
 * the runtime: the admin editor offered S3 with presets for AWS, Cloudflare R2, Backblaze and MinIO
 * while the runtime spoke only Google's API. Nothing failed at save time. The first upload failed,
 * on a storage that had never been possible.
 */
describe("asset storage providers", () => {
  describe("the catalogue", () => {
    it("describes every credential kind, so a UI rendering it cannot omit one by accident", () => {
      for (const kind of Object.values(AssetStorageCredentialsKind)) {
        const provider = getAssetStorageProvider(kind);
        expect(provider?.kind).toBe(kind);
        expect(String(provider?.label ?? "").length).toBeGreaterThan(0);
        expect(provider?.fields.length).toBeGreaterThan(0);
      }
      expect(listAssetStorageProviders()).toHaveLength(Object.values(AssetStorageCredentialsKind).length);
    });

    it("names the four providers that actually work, and nothing else", () => {
      // SMB / NAS was removed rather than carried as a disabled entry: every Node client for it is
      // unmaintained, the one exception speaks SMB2 only and costs 9.7 MB of node_modules, and a
      // tenant needs a VPN to expose a NAS at all - inside which SFTP does the same job.
      expect([...ASSET_STORAGE_IMPLEMENTED_CREDENTIAL_KINDS].sort()).toEqual(
        [
          AssetStorageCredentialsKind.FTP_BASIC,
          AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT,
          AssetStorageCredentialsKind.S3_ACCESS_KEY,
          AssetStorageCredentialsKind.SFTP_KEY,
        ].sort(),
      );
      expect(isAssetStorageCredentialKindImplemented("NAS_BASIC" as AssetStorageCredentialsKind)).toBe(false);
    });

    it("refuses to promise signed URLs where the protocol has none", () => {
      // Neither file-transfer protocol has an equivalent: both authenticate a *session*, so a link
      // carrying its own expiring authority does not exist. Saying otherwise here would make a UI
      // offer a button that always fails.
      expect(ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.FTP_BASIC].supportsSignedUrls).toBe(false);
      expect(ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.SFTP_KEY].supportsSignedUrls).toBe(false);
      expect(ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.S3_ACCESS_KEY].supportsSignedUrls).toBe(true);
      expect(ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT].supportsSignedUrls).toBe(true);
    });

    it("keeps SFTP apart from FTP, because they are unrelated protocols", () => {
      // Same three letters, different everything: SFTP is an SSH subsystem with no passive mode and
      // no plaintext variant. Sharing a datasource family would make a stored storage ambiguous.
      expect(ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.FTP_BASIC].datasourceType).toBe(ExecutionAssetDatasourceType.FTP);
      expect(ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.SFTP_KEY].datasourceType).toBe(ExecutionAssetDatasourceType.SFTP);
      expect(ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.FTP_BASIC].securityNotice).toContain("unencrypted");
    });

    it("marks every credential-bearing field as secret", () => {
      // The property that matters: a field added later without this flag renders as a plain input
      // and gets echoed back to the browser, which is how a stored secret leaks.
      const looksLikeACredential = /password|secret|privatekey|passphrase|token/i;
      for (const provider of listAssetStorageProviders()) {
        for (const field of provider.fields) {
          if (!looksLikeACredential.test(field.path)) continue;
          expect({ path: field.path, secret: field.secret }).toEqual({ path: field.path, secret: true });
        }
      }
    });

    it("points every field at a path the credentials payload actually has", () => {
      // A descriptor whose path does not exist on the payload is a form that writes into nothing.
      // The nested block is named per kind, so check the root segment matches the provider.
      const nestedByKind: Record<AssetStorageCredentialsKind, string> = {
        [AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT]: "googleCloudServiceAccount",
        [AssetStorageCredentialsKind.S3_ACCESS_KEY]: "s3AccessKey",
        [AssetStorageCredentialsKind.FTP_BASIC]: "ftpBasic",
        [AssetStorageCredentialsKind.SFTP_KEY]: "sftpKey",
      };
      const shared = new Set(["endpoint", "container", "region", "basePath"]);

      for (const provider of listAssetStorageProviders()) {
        for (const field of provider.fields) {
          const [root, ...rest] = field.path.split(".");
          if (rest.length === 0) {
            expect({ path: field.path, shared: shared.has(root) }).toEqual({ path: field.path, shared: true });
            continue;
          }
          expect({ path: field.path, root }).toEqual({ path: field.path, root: nestedByKind[provider.kind] });
          expect(rest).toHaveLength(1);
        }
      }
    });

    it("declares a default for every optional boolean and number, so the form documents itself", () => {
      for (const provider of listAssetStorageProviders()) {
        for (const field of provider.fields) {
          if (field.requirement !== AssetStorageFieldRequirement.OPTIONAL) continue;
          if (field.kind !== AssetStorageFieldKind.BOOLEAN && field.kind !== AssetStorageFieldKind.NUMBER) continue;
          expect({ path: field.path, hasDefault: field.defaultValue !== undefined }).toEqual({
            path: field.path,
            hasDefault: true,
          });
        }
      }
    });
  });

  describe("readAssetStorageFieldValue", () => {
    it("reads a nested path, and answers undefined rather than throwing on a missing one", () => {
      const credentials: Partial<AssetStorageCredentialsContract> = {
        kind: AssetStorageCredentialsKind.S3_ACCESS_KEY,
        endpoint: "https://minio.internal:9000",
        s3AccessKey: { accessKeyId: "key", secretAccessKey: "secret" },
      };

      expect(readAssetStorageFieldValue(credentials, "endpoint")).toBe("https://minio.internal:9000");
      expect(readAssetStorageFieldValue(credentials, "s3AccessKey.accessKeyId")).toBe("key");
      expect(readAssetStorageFieldValue(credentials, "ftpBasic.host")).toBeUndefined();
      expect(readAssetStorageFieldValue({}, "s3AccessKey.accessKeyId.deeper")).toBeUndefined();
    });
  });

  describe("validateAssetStorageCredentials", () => {
    it("accepts a complete S3 storage", () => {
      expect(
        validateAssetStorageCredentials({
          kind: AssetStorageCredentialsKind.S3_ACCESS_KEY,
          datasourceType: ExecutionAssetDatasourceType.S3,
          container: "dcdr-tenant",
          endpoint: "https://minio.internal:9000",
          s3AccessKey: { accessKeyId: "key", secretAccessKey: "secret" },
        }),
      ).toEqual([]);
    });

    it("names the missing required fields rather than failing as a whole", () => {
      const issues = validateAssetStorageCredentials({
        kind: AssetStorageCredentialsKind.FTP_BASIC,
        datasourceType: ExecutionAssetDatasourceType.FTP,
        ftpBasic: { host: "ftp.internal", username: "", password: "" } as never,
      });

      expect(issues.map((issue) => issue.path).sort()).toEqual(["basePath", "ftpBasic.password", "ftpBasic.username"]);
      expect(issues.every((issue) => issue.code === AssetStorageValidationIssueCode.MISSING_REQUIRED)).toBe(true);
    });

    it("treats a blank string as absent, which is what an emptied input really means", () => {
      // The bug this prevents: a storage saved with `endpoint: ""` is not a storage without an
      // endpoint as far as a naive check goes - and it silently points at AWS.
      const issues = validateAssetStorageCredentials({
        kind: AssetStorageCredentialsKind.S3_ACCESS_KEY,
        datasourceType: ExecutionAssetDatasourceType.S3,
        container: "   ",
        s3AccessKey: { accessKeyId: "key", secretAccessKey: "secret" },
      });

      expect(issues).toHaveLength(1);
      expect(issues[0]?.path).toBe("container");
    });

    it("accepts either half of an alternative, and refuses when both are empty", () => {
      const base = {
        kind: AssetStorageCredentialsKind.SFTP_KEY,
        datasourceType: ExecutionAssetDatasourceType.SFTP,
        basePath: "/home/dcdr/assets",
      };

      expect(
        validateAssetStorageCredentials({ ...base, sftpKey: { host: "h", username: "u", password: "p" } }),
      ).toEqual([]);
      expect(
        validateAssetStorageCredentials({ ...base, sftpKey: { host: "h", username: "u", privateKey: "-----BEGIN...-----" } }),
      ).toEqual([]);

      const issues = validateAssetStorageCredentials({ ...base, sftpKey: { host: "h", username: "u" } });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(AssetStorageValidationIssueCode.MISSING_ONE_OF);
      expect(issues[0]?.message).toContain("Password or Private key");
    });

    it("refuses a retired provider, which is what a storage stored before its removal looks like", () => {
      // NAS storages could be stored by an older backend. They now read as a kind nothing knows,
      // and the answer has to be a clear refusal rather than a crash on an undefined descriptor.
      const issues = validateAssetStorageCredentials({
        kind: "NAS_BASIC" as AssetStorageCredentialsKind,
        nasBasic: { sharePath: "//nas.internal/assets" },
      } as never);

      expect(issues).toHaveLength(1);
      expect(issues[0]?.code).toBe(AssetStorageValidationIssueCode.UNSUPPORTED_KIND);
    });

    it("refuses a kind it has never heard of", () => {
      const issues = validateAssetStorageCredentials({ kind: "AZURE_BLOB" as AssetStorageCredentialsKind });
      expect(issues).toEqual([
        {
          code: AssetStorageValidationIssueCode.UNSUPPORTED_KIND,
          path: "kind",
          message: "Unknown asset storage credential kind: AZURE_BLOB.",
        },
      ]);
    });
  });

  describe("endpoint presets", () => {
    const presets = ASSET_STORAGE_PROVIDERS[AssetStorageCredentialsKind.S3_ACCESS_KEY].endpointPresets ?? [];

    it("builds the endpoints the providers actually use", () => {
      const byId = new Map(presets.map((preset) => [preset.id, preset]));
      expect(buildAssetStorageEndpoint(byId.get("AWS_S3")!, "eu-west-1")).toBe("https://s3.eu-west-1.amazonaws.com");
      expect(buildAssetStorageEndpoint(byId.get("AWS_S3")!, "")).toBe("https://s3.amazonaws.com");
      expect(buildAssetStorageEndpoint(byId.get("CLOUDFLARE_R2")!, "acc0unt")).toBe("https://acc0unt.r2.cloudflarestorage.com");
      expect(buildAssetStorageEndpoint(byId.get("BACKBLAZE_B2")!, "us-west-004")).toBe("https://s3.us-west-004.backblazeb2.com");
      expect(buildAssetStorageEndpoint(byId.get("GOOGLE_CLOUD")!)).toBe("https://storage.googleapis.com");
      // No canonical host, so nothing can be built and the endpoint has to be typed.
      expect(buildAssetStorageEndpoint(byId.get("MINIO")!, "anything")).toBe("");
    });

    it("recognises back every endpoint it builds, which is where build and detect used to drift", () => {
      for (const preset of presets) {
        if (!preset.endpointTemplate) continue;
        const region = preset.endpointTemplate.includes("{region}") ? "eu-west-1" : "";
        const endpoint = buildAssetStorageEndpoint(preset, region);
        const matched = matchAssetStorageEndpointPreset(endpoint);
        expect({ id: matched?.preset.id, region: matched?.region }).toEqual({ id: preset.id, region });
      }
    });

    it("answers nothing for an endpoint that belongs to no preset", () => {
      expect(matchAssetStorageEndpointPreset("https://objects.internal.example:9000")).toBeUndefined();
      expect(matchAssetStorageEndpointPreset("")).toBeUndefined();
    });

    it("requires a region exactly where the host cannot be formed without one", () => {
      for (const preset of presets) {
        const needsRegion = preset.endpointTemplate.includes("{region}") && !preset.endpointTemplateWithoutRegion;
        expect({ id: preset.id, regionRequired: preset.regionRequired }).toEqual({ id: preset.id, regionRequired: needsRegion });
      }
    });

    it("defaults self-hosted providers to path-style addressing", () => {
      // Virtual-host addressing resolves <bucket>.<host>, and nothing self-hosted has that DNS.
      const byId = new Map(presets.map((preset) => [preset.id, preset]));
      expect(byId.get("MINIO")?.forcePathStyle).toBe(true);
      expect(byId.get("CUSTOM")?.forcePathStyle).toBe(true);
      expect(byId.get("AWS_S3")?.forcePathStyle).toBe(false);
    });
  });
});
