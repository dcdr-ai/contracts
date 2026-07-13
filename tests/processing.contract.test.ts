/// <reference types="jest" />

import {
  ConditionLogicOp,
  ConditionOp,
  ExecutionProcessingReport,
  IntentProcessingSemantics,
  PROCESSING_RULE_SCHEMAS,
  ProcessingCacheBehavior,
  ProcessingFailureMode,
  ProcessingOutputPolicyRef,
  ProcessingPolicyReasonCode,
  ProcessingReviewQueue,
  ProcessingRuleGroup,
  ProcessingProcessor,
  ProcessingRegexFlag,
  ProcessingRuleKind,
  ProcessingValidationIssueCode,
  ProcessingStage,
} from "../src/processing.contract";

describe("processing.contract", () => {
  it("sorts active processors deterministically for one stage", () => {
    const processors: ProcessingProcessor[] = [
      {
        id: "z-processor",
        version: "1",
        stage: ProcessingStage.INPUT,
        order: 20,
        rules: [{ id: "trim", kind: ProcessingRuleKind.TRIM }],
      },
      {
        id: "a-processor",
        version: "1",
        stage: ProcessingStage.INPUT,
        order: 10,
        rules: [{ id: "normalize", kind: ProcessingRuleKind.NORMALIZE_NEW_LINES }],
      },
      {
        id: "disabled",
        version: "1",
        stage: ProcessingStage.INPUT,
        enabled: false,
        rules: [{ id: "collapse", kind: ProcessingRuleKind.COLLAPSE_WHITESPACE }],
      },
    ];

    const sorted = IntentProcessingSemantics.sortProcessorsForStage(
      processors,
      ProcessingStage.INPUT,
    );

    expect(sorted.map((item) => item.id)).toEqual(["a-processor", "z-processor"]);
  });

  it("reports cache bypass when a stage contains cache-bypass-required rules", () => {
    const processors: ProcessingProcessor[] = [
      {
        id: "safe",
        version: "1",
        stage: ProcessingStage.INPUT,
        rules: [
          {
            id: "trim",
            kind: ProcessingRuleKind.TRIM,
            cacheBehavior: ProcessingCacheBehavior.CACHE_SAFE,
          },
        ],
      },
      {
        id: "unsafe",
        version: "1",
        stage: ProcessingStage.INPUT,
        rules: [
          {
            id: "secret",
            kind: ProcessingRuleKind.SECRET_DETECTION,
            cacheBehavior: ProcessingCacheBehavior.CACHE_BYPASS_REQUIRED,
          },
        ],
      },
    ];

    expect(
      IntentProcessingSemantics.isCacheSafeForStage(
        processors,
        ProcessingStage.INPUT,
      ),
    ).toBe(false);
    expect(
      IntentProcessingSemantics.isCacheBypassRequiredForStage(
        processors,
        ProcessingStage.INPUT,
      ),
    ).toBe(true);
  });

  it("builds an empty processing report with stable stage defaults", () => {
    const report: ExecutionProcessingReport =
      IntentProcessingSemantics.buildEmptyExecutionProcessingReport();

    expect(report.engineVersion).toBe("1");
    expect(report.mutated).toBe(false);
    expect(report.input.stage).toBe(ProcessingStage.INPUT);
    expect(report.output.stage).toBe(ProcessingStage.OUTPUT);
    expect(report.input.processorsConfigured).toBe(0);
    expect(report.output.rulesRun).toBe(0);
    expect(report.trail).toEqual([]);
  });

  it("exposes a static shared schema catalog for atomic built-in rules", () => {
    const schema = IntentProcessingSemantics.getRuleSchema(ProcessingRuleKind.TRIM);

    expect(Array.isArray(PROCESSING_RULE_SCHEMAS)).toBe(true);
    expect(schema).toBeTruthy();
    expect(schema?.group).toBe(ProcessingRuleGroup.TEXT_TRANSFORM);
    expect(schema?.allowedStages).toEqual([
      ProcessingStage.INPUT,
      ProcessingStage.OUTPUT,
    ]);
    expect(schema?.supportsFieldPaths).toBe(true);
    expect(schema?.defaultFailureMode).toBe(ProcessingFailureMode.FAIL_OPEN);
  });

  it("builds a schema-driven configuration map with defaults and caller overrides", () => {
    const configuration = IntentProcessingSemantics.buildRuleConfigurationWithDefaults(
      ProcessingRuleKind.REPLACE_REGEX,
      {
        pattern: "\\s+",
        replacement: " ",
      },
    );

    expect(configuration).toEqual({
      pattern: "\\s+",
      replacement: " ",
    });
  });

  it("exposes explicit enum-backed regex flags for UI authoring", () => {
    const schema = IntentProcessingSemantics.getRuleSchema(
      ProcessingRuleKind.REPLACE_REGEX,
    );
    const flagsField = schema?.configurationFields.find(
      (field) => field.key === "flags",
    );

    expect(flagsField?.type).toBe("STRING_LIST");
    expect(flagsField?.enumValues).toEqual([
      ProcessingRegexFlag.GLOBAL,
      ProcessingRegexFlag.CASE_INSENSITIVE,
      ProcessingRegexFlag.MULTILINE,
      ProcessingRegexFlag.DOT_ALL,
      ProcessingRegexFlag.UNICODE,
    ]);
  });

  it("exposes typed policy/review metadata for governance rule authoring", () => {
    const providerSchema = IntentProcessingSemantics.getRuleSchema(
      ProcessingRuleKind.PROVIDER_POLICY_CHECK,
    );
    const outputPolicySchema = IntentProcessingSemantics.getRuleSchema(
      ProcessingRuleKind.OUTPUT_POLICY_CHECK,
    );
    const reviewSchema = IntentProcessingSemantics.getRuleSchema(
      ProcessingRuleKind.REVIEW_ROUTING,
    );

    expect(
      providerSchema?.configurationFields.some(
        (field) => field.key === "allowedRegions",
      ),
    ).toBe(true);
    expect(
      providerSchema?.configurationFields.some(
        (field) => field.key === "deniedRegions",
      ),
    ).toBe(true);
    expect(
      providerSchema?.configurationFields.find(
        (field) => field.key === "allowedProviders",
      )?.enumValues?.includes("OPEN_AI"),
    ).toBe(true);
    expect(
      outputPolicySchema?.configurationFields.some(
        (field) => field.key === "policyRef",
      ),
    ).toBe(true);
    expect(
      outputPolicySchema?.configurationFields.find(
        (field) => field.key === "policyRef",
      )?.defaultValue,
    ).toBe(ProcessingOutputPolicyRef.DEFAULT_OUTPUT_POLICY);
    expect(
      reviewSchema?.configurationFields.some((field) => field.key === "queue"),
    ).toBe(true);
    expect(
      reviewSchema?.configurationFields.find((field) => field.key === "queue")
        ?.defaultValue,
    ).toBe(ProcessingReviewQueue.MANUAL_REVIEW);
    expect(ProcessingPolicyReasonCode.REVIEW_QUEUE_REQUIRED).toBe(
      "REVIEW_QUEUE_REQUIRED",
    );
  });

  it("validates configured rules against the shared schema catalog", () => {
    const result = IntentProcessingSemantics.validateRuleDefinition(
      {
        id: "replace",
        kind: ProcessingRuleKind.REPLACE_REGEX,
        condition: {
          op: ConditionLogicOp.NOT,
          conditions: [],
        },
        stopOnMatch: true,
        configuration: {
          replacement: 123,
          flags: ["BAD_FLAG"],
        },
      },
      ProcessingStage.OUTPUT,
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      ProcessingValidationIssueCode.STOP_ON_MATCH_NOT_SUPPORTED,
      ProcessingValidationIssueCode.CONDITION_INVALID,
      ProcessingValidationIssueCode.CONFIG_TYPE_INVALID,
      ProcessingValidationIssueCode.CONFIG_ENUM_INVALID,
      ProcessingValidationIssueCode.CONFIG_REQUIRED_MISSING,
    ]);
  });

  it("validates shared processing conditions explicitly", () => {
    const result = IntentProcessingSemantics.validateConditionDefinition({
      op: ConditionLogicOp.NOT,
      conditions: [],
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe(
      ProcessingValidationIssueCode.CONDITION_INVALID,
    );
    expect(result.issues[0]?.path).toBe("condition.conditions");
  });

  it("validates processors and projects nested issue paths", () => {
    const result = IntentProcessingSemantics.validateProcessorDefinition({
      id: "phi",
      version: "1",
      stage: ProcessingStage.INPUT,
      rules: [
        {
          id: "replace",
          kind: ProcessingRuleKind.REPLACE_REGEX,
          configuration: {
            replacement: "[REDACTED]",
          },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues[0]?.path).toBe("rules[0].configuration.pattern");
  });

  it("accepts valid processors", () => {
    const result = IntentProcessingSemantics.validateProcessorDefinition({
      id: "input-cleanup",
      version: "1",
      stage: ProcessingStage.INPUT,
      rules: [
        { id: "trim", kind: ProcessingRuleKind.TRIM, fieldPaths: ["vars.name"] },
        {
          id: "replace",
          kind: ProcessingRuleKind.REPLACE_REGEX,
          condition: {
            op: ConditionLogicOp.AND,
            conditions: [
              {
                path: "vars.name",
                op: ConditionOp.NOT_EMPTY,
                trim: true,
              },
            ],
          },
          fieldPaths: ["vars.name"],
          configuration: {
            pattern: "\\s+",
            replacement: " ",
            flags: [ProcessingRegexFlag.GLOBAL],
          },
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects invalid enum-driven governance configuration values", () => {
    const result = IntentProcessingSemantics.validateProcessorDefinition({
      id: "governance",
      version: "1",
      stage: ProcessingStage.OUTPUT,
      rules: [
        {
          id: "provider-policy",
          kind: ProcessingRuleKind.PROVIDER_POLICY_CHECK,
          configuration: {
            allowedProviders: ["NOT_A_PROVIDER"],
          },
        },
        {
          id: "output-policy",
          kind: ProcessingRuleKind.OUTPUT_POLICY_CHECK,
          configuration: {
            policyRef: "NOT_A_POLICY",
          },
        },
        {
          id: "review-routing",
          kind: ProcessingRuleKind.REVIEW_ROUTING,
          configuration: {
            queue: "NOT_A_QUEUE",
          },
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      ProcessingValidationIssueCode.CONFIG_ENUM_INVALID,
      ProcessingValidationIssueCode.CONFIG_ENUM_INVALID,
      ProcessingValidationIssueCode.CONFIG_ENUM_INVALID,
    ]);
  });
});
