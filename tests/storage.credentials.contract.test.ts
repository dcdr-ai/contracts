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

  it("supports FTP and SFTP credential payloads (JSON round-trip)", () => {
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

    const sftpResponse: ResolveAssetStorageCredentialsResponse = {
      storageId: "tenant-sftp",
      datasourceId: "tenant-sftp",
      credentials: {
        kind: AssetStorageCredentialsKind.SFTP_KEY,
        datasourceType: ExecutionAssetDatasourceType.SFTP,
        basePath: "/home/dcdr/customer-1",
        sftpKey: {
          host: "sftp.example.invalid",
          port: 22,
          username: "sftp-user",
          privateKey: ["-----BEGIN OPENSSH PRIVATE KEY-----", "key", "-----END OPENSSH PRIVATE KEY-----", ""].join("\n"),
          passphrase: "sftp-passphrase",
        },
      },
    };

    const ftpRoundTrip = JSON.parse(
      JSON.stringify(ftpResponse),
    ) as ResolveAssetStorageCredentialsResponse;
    const sftpRoundTrip = JSON.parse(
      JSON.stringify(sftpResponse),
    ) as ResolveAssetStorageCredentialsResponse;

    expect(ftpRoundTrip.credentials.kind).toBe(
      AssetStorageCredentialsKind.FTP_BASIC,
    );
    expect(ftpRoundTrip.credentials.ftpBasic?.host).toBe("ftp.example.invalid");
    expect(sftpRoundTrip.credentials.kind).toBe(
      AssetStorageCredentialsKind.SFTP_KEY,
    );
    // The PEM survives the round trip with its newlines intact, which is the one thing that breaks
    // a key credential in transit and stays invisible until the handshake fails.
    expect(sftpRoundTrip.credentials.sftpKey?.privateKey?.split("\n")).toHaveLength(4);
    expect(sftpRoundTrip.credentials.sftpKey?.host).toBe("sftp.example.invalid");
  });
});
