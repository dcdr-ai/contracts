import { describe, expect, it } from "@jest/globals";
import { stableJsonStringify } from "../src/utils.contract";

describe("utils.contract", () => {
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
});
