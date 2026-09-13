import { describe, expect, it } from "@jest/globals";

import {
  canonicalizePromptVariableSchemaRecord,
  PROMPT_VARIABLE_GROUP_MAX_LENGTH,
  PromptVariableSchemaIssueCode,
  stripPromptVariablePresentationHints,
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

  it("fails array<object> when properties is an empty record", () => {
    const schema: Record<string, unknown> = {
      incidents: {
        type: "array",
        required: true,
        itemsType: "object",
        properties: {},
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

  it("validates and canonicalizes asset prompt variables", () => {
    const schema: Record<string, unknown> = {
      contractPdf: {
        type: "ASSET",
        required: true,
        assetPartTypes: [" document ", "image"],
      },
    };

    const res = canonicalizePromptVariableSchemaRecord(schema);
    expect(res.valid).toBe(true);
    expect(res.schema?.contractPdf.type).toBe(PromptVariableType.ASSET);
    expect(res.schema?.contractPdf.assetPartTypes).toEqual([
      "document",
      "image",
    ]);
  });

  describe("presentation hints: group and order (v3.12.0)", () => {
    it("accepts group/order on every type and at any depth", () => {
      const schema: Record<string, unknown> = {
        name: { type: "string", group: "Customer", order: 2 },
        tier: { type: "enum", values: ["a", "b"], group: "Customer", order: 1 },
        file: { type: "asset", group: "Attachments", order: 0 },
        tags: { type: "array", itemsType: "string", group: "Meta", order: -1.5 },
        meta: {
          type: "object",
          group: "Meta",
          properties: { channel: { type: "string", group: "Inner", order: 3 } },
        },
        cleared: { type: "string", group: null, order: null },
      };

      const res = validatePromptVariableSchemaRecord(schema, 50, {
        strictShorthandArray: true,
        strictShorthandObject: true,
      });
      expect(res).toEqual({ valid: true, issues: [] });
    });

    it("rejects a non-string or blank group, an over-long group, and a non-finite order", () => {
      const schema: Record<string, unknown> = {
        a: { type: "string", group: 5 },
        b: { type: "string", group: "   " },
        c: { type: "string", group: "x".repeat(PROMPT_VARIABLE_GROUP_MAX_LENGTH + 1) },
        d: { type: "string", order: "1" },
        e: { type: "integer", order: Number.POSITIVE_INFINITY },
        nested: { type: "object", properties: { f: { type: "boolean", order: Number.NaN } } },
      };

      const res = validatePromptVariableSchemaRecord(schema, 50);
      expect(res.valid).toBe(false);
      expect(res.issues.map((i) => `${i.path}:${i.code}`)).toEqual([
        `a.group:${PromptVariableSchemaIssueCode.GROUP_STRING}`,
        `b.group:${PromptVariableSchemaIssueCode.GROUP_LEN}`,
        `c.group:${PromptVariableSchemaIssueCode.GROUP_LEN}`,
        `d.order:${PromptVariableSchemaIssueCode.ORDER_NUMBER}`,
        `e.order:${PromptVariableSchemaIssueCode.ORDER_NUMBER}`,
        `nested.properties.f.order:${PromptVariableSchemaIssueCode.ORDER_NUMBER}`,
      ]);
    });

    it("keeps the hints through canonicalization, trimmed, on every branch", () => {
      // The loader and the structured-output path both read canonical schemas: a hint dropped here
      // is erased for every consumer downstream, silently.
      const schema: Record<string, unknown> = {
        name: { type: "STRING", group: "  Customer ", order: 2 },
        tier: { type: "enum", values: ["a"], group: "Customer", order: 1 },
        file: { type: "asset", group: "Files", order: 0 },
        tags: { type: "array", itemsType: "string", group: "Meta", order: 4 },
        meta: {
          type: "object",
          group: "Meta",
          order: 5,
          properties: { channel: { type: "string", group: "Inner", order: 3 } },
        },
      };

      const res = canonicalizePromptVariableSchemaRecord(schema);
      expect(res.valid).toBe(true);
      const out = res.schema!;
      expect([out.name.group, out.name.order]).toEqual(["Customer", 2]);
      expect([out.tier.group, out.tier.order]).toEqual(["Customer", 1]);
      expect([out.file.group, out.file.order]).toEqual(["Files", 0]);
      expect([out.tags.group, out.tags.order]).toEqual(["Meta", 4]);
      expect([out.meta.group, out.meta.order]).toEqual(["Meta", 5]);
      expect([out.meta.properties!.channel.group, out.meta.properties!.channel.order]).toEqual(["Inner", 3]);
    });

    it("serializes a schema without hints exactly as it did before they existed", () => {
      // Anything hashed or persisted from a canonical schema goes through JSON: a schema written
      // before 3.12.0 must not change bytes just because the contract grew two optional fields.
      const res = canonicalizePromptVariableSchemaRecord({ name: { type: "string", required: true } });
      expect(JSON.stringify(res.schema)).toBe('{"name":{"type":"string","required":true}}');
    });

    it("strips hints at every depth without touching the input", () => {
      const schema = {
        name: { type: PromptVariableType.STRING, required: true, description: "d", group: "G", order: 1 },
        meta: {
          type: PromptVariableType.OBJECT,
          group: "G",
          properties: { channel: { type: PromptVariableType.STRING, group: "Inner", order: 2 } },
        },
      };
      const before = JSON.stringify(schema);

      expect(stripPromptVariablePresentationHints(schema)).toEqual({
        name: { type: PromptVariableType.STRING, required: true, description: "d" },
        meta: { type: PromptVariableType.OBJECT, properties: { channel: { type: PromptVariableType.STRING } } },
      });
      expect(JSON.stringify(schema)).toBe(before);
      expect(stripPromptVariablePresentationHints(null)).toBeNull();
      expect(stripPromptVariablePresentationHints(undefined)).toBeUndefined();
    });
  });

  it("rejects disallowed fields on asset prompt variables", () => {
    const schema: Record<string, unknown> = {
      contractPdf: {
        type: "asset",
        itemsType: "string",
        min: 1,
      },
    };

    const res = validatePromptVariableSchemaRecord(schema);
    expect(res.valid).toBe(false);
    expect(
      res.issues.some(
        (i) => i.code === PromptVariableSchemaIssueCode.ASSET_FIELDS_DISALLOWED,
      ),
    ).toBe(true);
  });
});
