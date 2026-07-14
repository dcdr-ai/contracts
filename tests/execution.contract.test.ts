/// <reference types="jest" />

import {
  ExecutionPartSourceKind,
  ExecutionPartType,
  ExecutionReport,
  ExecutionReportPart,
} from "../src/execution.contract";
import { ExecutionAssetStorageOwner } from "../src/asset.contract";
import {
  ExecutionProcessingReport,
  IntentProcessingSemantics,
  ProcessingAction,
  ProcessingEvidenceKind,
  ProcessingScope,
  ProcessingRuleKind,
  ProcessingStage,
} from "../src/processing.contract";

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

  it("supports bounded processing report evidence entries", () => {
    const processing: ExecutionProcessingReport =
      IntentProcessingSemantics.buildEmptyExecutionProcessingReport();
    processing.mutated = true;
    processing.input.mutated = true;
    processing.input.mutations = 1;
    processing.trail = [
      {
        sequence: 1,
        stage: ProcessingStage.INPUT,
        scope: ProcessingScope.INTENT,
        processorId: "phi-input",
        processorVersion: "1",
        ruleId: "normalize-1",
        ruleKind: ProcessingRuleKind.TRIM,
        evidenceKind: ProcessingEvidenceKind.RULE_MUTATED,
        action: ProcessingAction.ANNOTATE,
        matched: true,
        changed: true,
        fieldPath: "vars.customerName",
        reason: "whitespace_normalized",
      },
    ];

    const roundTrip = JSON.parse(JSON.stringify(processing)) as ExecutionProcessingReport;

    expect(roundTrip.mutated).toBe(true);
    expect(roundTrip.input.mutations).toBe(1);
    expect(roundTrip.trail?.[0]?.ruleId).toBe("normalize-1");
    expect(roundTrip.trail?.[0]?.stage).toBe(ProcessingStage.INPUT);
    expect(roundTrip.trail?.[0]?.scope).toBe(ProcessingScope.INTENT);
  });

  it("preserves optional serviceTokenId on execution reports", () => {
    const report: ExecutionReport = {
      sessionId: "session-1",
      appId: "app-1",
      serviceTokenId: "svc-123",
      gatewayRequestId: "gw-1",
      intent: "MY_INTENT" as never,
      prompt: { id: "p1", version: "v1", sha256: "sha-1" },
      finalImplementation: {
        provider: "RULES" as never,
        model: "builtin",
        implementationId: "impl-1",
        latencyMs: 1,
      },
      attempts: [],
      timing: {
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: "2026-01-01T00:00:00.001Z",
        latencyMs: 1,
      },
      cached: false,
    };

    const roundTrip = JSON.parse(JSON.stringify(report)) as ExecutionReport;

    expect(roundTrip.serviceTokenId).toBe("svc-123");
  });
});
