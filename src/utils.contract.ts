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
  const seen = new Set<any>();

  const walk = (v: any): string => {
    if (v === null) return "null";

    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") {
      return JSON.stringify(v);
    }

    if (t === "bigint") return JSON.stringify(v.toString());

    if (t === "undefined" || t === "function" || t === "symbol") {
      // Match JSON.stringify behavior for array slots.
      return "null";
    }

    if (v && typeof v.toJSON === "function") {
      return walk(v.toJSON());
    }

    if (Array.isArray(v)) {
      if (seen.has(v)) {
        throw new Error("stableJsonStringify: circular reference");
      }
      seen.add(v);
      const out = `[${v.map((item) => walk(item)).join(",")}]`;
      seen.delete(v);
      return out;
    }

    if (t === "object") {
      if (seen.has(v)) {
        throw new Error("stableJsonStringify: circular reference");
      }
      seen.add(v);

      const keys = Object.keys(v).sort();
      const parts: string[] = [];
      for (const key of keys) {
        const next = v[key];
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
      seen.delete(v);
      return out;
    }

    return JSON.stringify(v);
  };

  return walk(value);
}
