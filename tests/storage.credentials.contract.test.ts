/// <reference types="jest" />

import {
  AssetStorageCredentialsKind,
  ResolveAssetStorageCredentialsResponse,
} from "../src/storage.credentials.contract";
import { ExecutionAssetDatasourceType } from "../src/asset.contract";

describe("Asset storage credentials contracts", () => {
  it("supports Google Cloud service-account credentials (JSON round-trip)", () => {
    const response: ResolveAssetStorageCredentialsResponse = {
      storageId: "managed-default",
      datasourceId: "managed-default-datasource",
      expiresAtMs: 1778460966000,
      credentials: {
        kind: AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT,
        datasourceType: ExecutionAssetDatasourceType.S3,
        container: "tenant-assets",
        region: "europe-west1",
        basePath: "tenants/customer-1",
        googleCloudServiceAccount: {
          projectId: "dcdr-test-project",
          clientEmail: "runtime@test.iam.gserviceaccount.com",
          privateKey:
            "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n",
        },
      },
    };

    const roundTrip = JSON.parse(
      JSON.stringify(response),
    ) as ResolveAssetStorageCredentialsResponse;

    expect(roundTrip.credentials.kind).toBe(
      AssetStorageCredentialsKind.GOOGLE_CLOUD_SERVICE_ACCOUNT,
    );
    expect(
      roundTrip.credentials.googleCloudServiceAccount?.projectId,
    ).toBe("dcdr-test-project");
  });

  it("supports S3-compatible access-key credentials (JSON round-trip)", () => {
    const response: ResolveAssetStorageCredentialsResponse = {
      storageId: "tenant-s3",
      datasourceId: "tenant-s3",
      credentials: {
        kind: AssetStorageCredentialsKind.S3_ACCESS_KEY,
        datasourceType: ExecutionAssetDatasourceType.S3,
        endpoint: "https://s3.example.invalid",
        container: "tenant-bucket",
        region: "eu-west-1",
        s3AccessKey: {
          accessKeyId: "AKIA_TEST",
          secretAccessKey: "secret-value",
          sessionToken: "session-token",
          forcePathStyle: true,
        },
      },
    };

    const roundTrip = JSON.parse(
      JSON.stringify(response),
    ) as ResolveAssetStorageCredentialsResponse;

    expect(roundTrip.credentials.kind).toBe(
      AssetStorageCredentialsKind.S3_ACCESS_KEY,
    );
    expect(roundTrip.credentials.s3AccessKey?.forcePathStyle).toBe(true);
  });

  it("supports FTP and NAS credential payloads (JSON round-trip)", () => {
    const ftpResponse: ResolveAssetStorageCredentialsResponse = {
      storageId: "tenant-ftp",
      datasourceId: "tenant-ftp",
      credentials: {
        kind: AssetStorageCredentialsKind.FTP_BASIC,
        datasourceType: ExecutionAssetDatasourceType.FTP,
        basePath: "/exports/customer-1",
        ftpBasic: {
          host: "ftp.example.invalid",
          port: 21,
          username: "ftp-user",
          password: "ftp-password",
          secure: false,
          passive: true,
        },
      },
    };

    const nasResponse: ResolveAssetStorageCredentialsResponse = {
      storageId: "tenant-nas",
      datasourceId: "tenant-nas",
      credentials: {
        kind: AssetStorageCredentialsKind.NAS_BASIC,
        datasourceType: ExecutionAssetDatasourceType.NAS,
        basePath: "customer-1/assets",
        nasBasic: {
          sharePath: "\\\\nas-01\\customers",
          username: "nas-user",
          password: "nas-password",
          domain: "ACME",
        },
      },
    };

    const ftpRoundTrip = JSON.parse(
      JSON.stringify(ftpResponse),
    ) as ResolveAssetStorageCredentialsResponse;
    const nasRoundTrip = JSON.parse(
      JSON.stringify(nasResponse),
    ) as ResolveAssetStorageCredentialsResponse;

    expect(ftpRoundTrip.credentials.kind).toBe(
      AssetStorageCredentialsKind.FTP_BASIC,
    );
    expect(ftpRoundTrip.credentials.ftpBasic?.host).toBe("ftp.example.invalid");
    expect(nasRoundTrip.credentials.kind).toBe(
      AssetStorageCredentialsKind.NAS_BASIC,
    );
    expect(nasRoundTrip.credentials.nasBasic?.sharePath).toBe(
      "\\\\nas-01\\customers",
    );
  });
});
