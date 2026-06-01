import { describe, expect, it } from "@jest/globals";

import {
  canonicalizePromptVariableSchemaRecord,
  PromptVariableSchemaIssueCode,
  validatePromptVariableSchemaRecord,
} from "../src/prompt-variable-schema.contract";

import { PromptVariableType } from "../src/prompts.contract";

describe("prompt-variable-schema.contract", () => {
  it("strict mode rejects shorthand array/object", () => {
    const schema: Record<string, unknown> = {
      arr: "array",
      obj: "object",
    };

    const res = validatePromptVariableSchemaRecord(schema, 25, {
      strictShorthandArray: true,
      strictShorthandObject: true,
    });
    expect(res.valid).toBe(false);

    expect(
      res.issues.some(
        (i) =>
          i.code === PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_REQUIRED &&
          i.path === "arr.itemsType",
      ),
    ).toBe(true);

    expect(
      res.issues.some(
        (i) =>
          i.code === PromptVariableSchemaIssueCode.OBJECT_REQUIRES_FULL &&
          i.path === "obj",
      ),
    ).toBe(true);
  });

  it("validates nested object properties", () => {
    const schema: Record<string, unknown> = {
      meta: {
        type: "object",
        required: true,
        properties: {
          channel: { type: "string", required: false },
          tags: { type: "array", required: false, itemsType: "string" },
          nested: {
            type: "object",
            required: false,
            properties: {
              urgency: {
                type: "enum",
                required: true,
                values: ["low", "medium", "high", "critical"],
              },
            },
          },
        },
      },
    };

    const res = validatePromptVariableSchemaRecord(schema);
    expect(res.valid).toBe(true);
    expect(res.issues).toHaveLength(0);
  });

  it("catches common invalid definitions (type, key name, enum values, array itemsType)", () => {
    const schema: Record<string, unknown> = {
      "bad-name": { type: "string", required: true },
      ok: { type: "strng", required: true },
      e: { type: "enum", required: true, values: [] },
      arrMissing: { type: "array", required: true },
      arrArr: { type: "array", required: true, itemsType: "array" },
    };

    const res = validatePromptVariableSchemaRecord(schema, 50, {
      strictShorthandArray: true,
      strictShorthandObject: true,
    });
    expect(res.valid).toBe(false);

    expect(
      res.issues.some(
        (i) => i.code === PromptVariableSchemaIssueCode.KEY_NAME_INVALID,
      ),
    ).toBe(true);
    expect(
      res.issues.some(
        (i) => i.code === PromptVariableSchemaIssueCode.TYPE_INVALID,
      ),
    ).toBe(true);
    expect(
      res.issues.some(
        (i) => i.code === PromptVariableSchemaIssueCode.ENUM_VALUES_REQUIRED,
      ),
    ).toBe(true);
    expect(
      res.issues.some(
        (i) =>
          i.code === PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_REQUIRED,
      ),
    ).toBe(true);
    expect(
      res.issues.some(
        (i) =>
          i.code === PromptVariableSchemaIssueCode.ARRAY_ITEMS_TYPE_NO_ARRAY,
      ),
    ).toBe(true);
  });

  it("validates array<enum> with values and rejects duplicates after trim", () => {
    const okSchema: Record<string, unknown> = {
      xs: {
        type: "array",
        required: true,
        itemsType: "enum",
        values: ["A", "B"],
      },
    };
    expect(
      validatePromptVariableSchemaRecord(okSchema, 50, {
        strictShorthandArray: true,
        strictShorthandObject: true,
      }).valid,
    ).toBe(true);

    const badSchema: Record<string, unknown> = {
      xs: {
        type: "array",
        required: true,
        itemsType: "enum",
        values: [" A ", "A"],
      },
    };
    const bad = validatePromptVariableSchemaRecord(badSchema, 50, {
      strictShorthandArray: true,
      strictShorthandObject: true,
    });
    expect(bad.valid).toBe(false);
    expect(
      bad.issues.some(
        (i) => i.code === PromptVariableSchemaIssueCode.ENUM_VALUES_UNIQUE,
      ),
    ).toBe(true);
  });

  it("validates array<object> with properties (nested objects allowed)", () => {
    const schema: Record<string, unknown> = {
      incidents: {
        type: "array",
        required: true,
        itemsType: "object",
        properties: {
          id: { type: "string", required: true },
          signals: { type: "array", required: true, itemsType: "string" },
          details: {
            type: "object",
            required: false,
            properties: {
              score: { type: "float", required: false, min: 0, max: 1 },
            },
          },
        },
      },
    };

    const res = validatePromptVariableSchemaRecord(schema);
    expect(res.valid).toBe(true);
    expect(res.issues).toHaveLength(0);
  });

  it("fails array<object> when properties missing", () => {
    const schema: Record<string, unknown> = {
      incidents: {
        type: "array",
        required: true,
        itemsType: "object",
      },
    };

    const res = validatePromptVariableSchemaRecord(schema);
    expect(res.valid).toBe(false);
    expect(
      res.issues.some(
        (i) =>
          i.code ===
          PromptVariableSchemaIssueCode.ARRAY_OBJECT_PROPERTIES_REQUIRED,
      ),
    ).toBe(true);
  });

  it("canonicalizes casing and trims enum values", () => {
    const schema: Record<string, unknown> = {
      urgency: {
        type: "ENUM",
        required: true,
        values: [" low ", "medium", "high", "critical"],
      },
      riskSignals: {
        type: "ARRAY",
        required: true,
        itemsType: "STRING",
      },
    };

    const res = canonicalizePromptVariableSchemaRecord(schema);
    expect(res.valid).toBe(true);
    expect(res.schema).toBeTruthy();

    const out = res.schema!;
    expect(out.urgency.type).toBe(PromptVariableType.ENUM);
    expect(out.urgency.values).toEqual(["low", "medium", "high", "critical"]);

    expect(out.riskSignals.type).toBe(PromptVariableType.ARRAY);
    expect(out.riskSignals.itemsType).toBe(PromptVariableType.STRING);
  });
});
