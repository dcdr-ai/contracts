/// <reference types="jest" />

import {
  ExecutionPartSourceKind,
  ExecutionPartType,
  ExecutionReportPart,
} from "../src/execution.contract";

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
});
