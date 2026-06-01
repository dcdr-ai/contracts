/**
 * Shared utilities for `@dcdr/contracts`.
 */

/**
 * Stable JSON stringify with deterministic object key ordering.
 *
 * Why
 * - Used to compute semantic hashes over JSON payloads (e.g. registries) in a
 *   way that is invariant to JavaScript object insertion order.
 * - Arrays preserve order.
 * - Object keys are sorted lexicographically (recursively).
 *
 * Semantics (intentionally mirrors JSON.stringify behavior where relevant)
 * - Object properties with values `undefined`, functions, or symbols are omitted.
 * - Array slots with `undefined`, functions, or symbols become `null`.
 * - `bigint` is serialized as a JSON string.
 * - `toJSON()` is honored.
 * - Circular references throw.
 */
export function stableJsonStringify(value: unknown): string {
  const seen = new Set<object>();

  const walk = (v: unknown): string => {
    if (v === null) return "null";

    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") {
      return JSON.stringify(v);
    }

    if (t === "bigint") return JSON.stringify((v as bigint).toString());

    if (t === "undefined" || t === "function" || t === "symbol") {
      // Match JSON.stringify behavior for array slots.
      return "null";
    }

    if (typeof v === "object") {
      const maybeToJson = (v as { toJSON?: () => unknown }).toJSON;
      if (typeof maybeToJson === "function") {
        return walk(maybeToJson.call(v));
      }
    }

    if (Array.isArray(v)) {
      if (seen.has(v)) {
        throw new Error("stableJsonStringify: circular reference");
      }
      // Arrays are objects in JS; safe to track for circular refs.
      seen.add(v);
      const out = `[${v.map((item) => walk(item)).join(",")}]`;
      seen.delete(v);
      return out;
    }

    if (t === "object") {
      if (seen.has(v as object)) {
        throw new Error("stableJsonStringify: circular reference");
      }
      seen.add(v as object);

      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts: string[] = [];
      for (const key of keys) {
        const next = obj[key];
        const nextType = typeof next;
        if (
          nextType === "undefined" ||
          nextType === "function" ||
          nextType === "symbol"
        ) {
          continue;
        }
        parts.push(`${JSON.stringify(key)}:${walk(next)}`);
      }

      const out = `{${parts.join(",")}}`;
      seen.delete(v as object);
      return out;
    }

    return JSON.stringify(v);
  };

  return walk(value);
}
