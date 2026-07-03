/// <reference types="jest" />

import {
  ExecutionPartSourceKind,
  ExecutionPartType,
  ExecutionReportPart,
} from "../src/execution.contract";
import { ExecutionAssetStorageOwner } from "../src/asset.contract";

describe("Execution report contracts", () => {
  it("supports URL-backed report parts (JSON round-trip)", () => {
    const reportPart: ExecutionReportPart = {
      type: ExecutionPartType.IMAGE,
      sourceKind: ExecutionPartSourceKind.URL,
      mimeType: "image/webp",
      name: "uk-id-card.webp",
      url: "https://example.invalid/assets/uk-id-card.webp",
      sizeBytes: 12345,
    };

    const roundTrip = JSON.parse(
      JSON.stringify(reportPart),
    ) as ExecutionReportPart;

    expect(roundTrip.type).toBe(ExecutionPartType.IMAGE);
    expect(roundTrip.sourceKind).toBe(ExecutionPartSourceKind.URL);
    expect(roundTrip.url).toBe(
      "https://example.invalid/assets/uk-id-card.webp",
    );
  });

  it("supports asset-backed report parts with storage owner metadata", () => {
    const reportPart: ExecutionReportPart = {
      type: ExecutionPartType.IMAGE,
      sourceKind: ExecutionPartSourceKind.ASSET,
      asset: {
        storageId: "tenant-default-storage",
        storageOwner: ExecutionAssetStorageOwner.CUSTOMER,
        assetPath: "tenant-a/image/ab/abcd/id-card-front.png",
      },
    };

    const roundTrip = JSON.parse(
      JSON.stringify(reportPart),
    ) as ExecutionReportPart;

    expect(roundTrip.asset?.storageId).toBe("tenant-default-storage");
    expect(roundTrip.asset?.storageOwner).toBe(
      ExecutionAssetStorageOwner.CUSTOMER,
    );
  });
});
