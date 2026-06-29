/**
 * Shared utilities for `@dcdr/contracts`.
 */

/**
 * Hash dependency used by helpers that need a stable SHA-256 hex digest.
 */
export interface Sha256HexDeps {
  /** Returns the lowercase hex SHA-256 digest for the provided UTF-8 string. */
  sha256Hex: (value: string) => string;
}

/**
 * Inputs used to derive the default DCDR asset cache key.
 *
 * Notes
 * - `cid` is intentionally excluded because tenant isolation already exists in the asset path prefix.
 * - `intent` is intentionally excluded so the same tenant asset can be reused across intents.
 */
export interface DcdrAssetCacheKeyInput {
  /** Stable semantic family for the asset. */
  partType: string;

  /** Canonical lowercase hex content hash for the payload bytes. */
  sha256: string;

  /** Optional technical MIME type. */
  mimeType?: string;

  /** Optional human-friendly asset name. */
  name?: string;
}

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

/**
 * Builds the default DCDR asset cache key from stable semantic inputs.
 *
 * Notes
 * - The result is deterministic and path-safe (`sha256` hex).
 * - The same tenant asset can be reused across intents because `intent` is not part of this identity.
 * - Callers may still provide an explicit override when they intentionally want a different logical cache identity.
 */
export function buildDcdrAssetCacheKey(
  deps: Sha256HexDeps,
  input: DcdrAssetCacheKeyInput,
): string {
  const partType = normalizeAssetCacheKeyField(input.partType);
  const sha256 = normalizeAssetCacheKeyField(input.sha256);
  if (!partType) {
    throw new Error("buildDcdrAssetCacheKey: partType is required");
  }
  if (!sha256) {
    throw new Error("buildDcdrAssetCacheKey: sha256 is required");
  }

  const normalized = stableJsonStringify({
    v: 1,
    partType,
    mimeType: normalizeAssetCacheKeyField(input.mimeType) || null,
    name: normalizeAssetCacheKeyField(input.name) || null,
    sha256,
  });

  return deps.sha256Hex(normalized);
}

/**
 * Normalizes a semantic cache-key field into a stable comparison form.
 */
function normalizeAssetCacheKeyField(value: string | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
