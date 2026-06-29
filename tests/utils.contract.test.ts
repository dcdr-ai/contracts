import { describe, expect, it } from "@jest/globals";
import {
  buildDcdrAssetCacheKey,
  stableJsonStringify,
} from "../src/utils.contract";

describe("utils.contract", () => {
  const fakeSha256Deps = {
    sha256Hex: (value: string): string => {
      let hash = 2166136261;
      for (const ch of value) {
        hash ^= ch.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
      }
      const out = (hash >>> 0).toString(16).padStart(8, "0");
      return out.repeat(8).slice(0, 64);
    },
  };

  describe("stableJsonStringify", () => {
    it("sorts object keys recursively (deterministic)", () => {
      const input = {
        b: 1,
        a: 2,
        nested: {
          z: true,
          y: false,
        },
      };

      expect(stableJsonStringify(input)).toBe(
        '{"a":2,"b":1,"nested":{"y":false,"z":true}}',
      );
    });

    it("preserves array order and matches JSON.stringify nulling semantics", () => {
      const input = [3, undefined, 1, () => 1, Symbol("x"), 2];
      expect(stableJsonStringify(input)).toBe("[3,null,1,null,null,2]");
    });

    it("omits undefined/function/symbol object properties", () => {
      const input: Record<string, unknown> = {
        ok: 1,
        skipU: undefined,
        skipF: () => 1,
        skipS: Symbol("x"),
      };

      expect(stableJsonStringify(input)).toBe('{"ok":1}');
    });

    it("serializes bigint as JSON string", () => {
      expect(stableJsonStringify({ n: 12n })).toBe('{"n":"12"}');
    });
  });

  describe("buildDcdrAssetCacheKey", () => {
    it("is deterministic for the same semantic asset identity", () => {
      const keyA = buildDcdrAssetCacheKey(fakeSha256Deps, {
        partType: "DOCUMENT",
        mimeType: "application/pdf",
        name: " Report.PDF ",
        sha256: "ABC123",
      });
      const keyB = buildDcdrAssetCacheKey(fakeSha256Deps, {
        partType: "document",
        mimeType: "APPLICATION/PDF",
        name: "report.pdf",
        sha256: "abc123",
      });

      expect(keyA).toBe(keyB);
      expect(keyA).toMatch(/^[a-f0-9]{64}$/);
    });

    it("does not depend on intent and therefore supports cross-intent reuse", () => {
      const keyA = buildDcdrAssetCacheKey(fakeSha256Deps, {
        partType: "document",
        mimeType: "application/pdf",
        name: "shared.pdf",
        sha256:
          "8bf1e7ad90922a656f154b8337108e3ac9ad7f3437f0f8aea7c860c33fb8837b",
      });
      const keyB = buildDcdrAssetCacheKey(fakeSha256Deps, {
        partType: "document",
        mimeType: "application/pdf",
        name: "shared.pdf",
        sha256:
          "8bf1e7ad90922a656f154b8337108e3ac9ad7f3437f0f8aea7c860c33fb8837b",
      });

      expect(keyA).toBe(keyB);
    });
  });
});
