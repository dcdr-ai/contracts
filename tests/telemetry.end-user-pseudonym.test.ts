/// <reference types="jest" />

/**
 * End-user id mode and pseudonym (3.26.0). The pseudonym is the one keyed hash the runtime computes and the
 * control plane recomputes to find a user's spans, so it is pinned three ways: wire values of the mode, reference
 * vectors reproduced with Node's `crypto`, and the key decoding rules (identical to the runtime's earlier
 * `Buffer.from(key, "base64")` + 16-byte minimum, without `Buffer`, so a browser bundle gets the same bytes).
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";

import {
  DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS,
  DCDR_TELEMETRY_HASH_KEY_MIN_BYTES,
  DcdrTelemetryServiceSnapshotEntry,
  TelemetryEndUserIdMode,
  TelemetryHmacDeps,
  TelemetryPayloadLevel,
  TelemetryServiceStatus,
  decodeTelemetryHashKey,
  telemetryEndUserPseudonym,
} from "../src/telemetry.contract";
import * as barrel from "../src/index";

/** Node's `crypto` module, typed as the injected dependency (compiles only if it satisfies it structurally). */
const NODE_HMAC: TelemetryHmacDeps = crypto;

/**
 * The runtime's decoding before 3.26.0, kept here as the reference the shared decoder must match.
 * @param base64Key key text
 * @returns key bytes, or undefined
 */
function legacyDecode(base64Key: string): Uint8Array | undefined {
  if (!base64Key || typeof base64Key !== "string") return undefined;
  const key = Buffer.from(base64Key, "base64");
  return key.length >= 16 ? new Uint8Array(key) : undefined;
}

/**
 * Deterministic pseudo-random generator (mulberry32), so the parity sweep is reproducible.
 * @param seed seed
 * @returns a function returning floats in [0, 1)
 */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("TelemetryEndUserIdMode", () => {
  it("pins the wire values", () => {
    expect(TelemetryEndUserIdMode.PSEUDONYMISED).toBe("PSEUDONYMISED");
    expect(TelemetryEndUserIdMode.AS_SENT).toBe("AS_SENT");
    expect(Object.values(TelemetryEndUserIdMode).sort()).toEqual(["AS_SENT", "PSEUDONYMISED"]);
  });

  it("is optional on the snapshot entry and survives a JSON round trip", () => {
    const legacy: DcdrTelemetryServiceSnapshotEntry = {
      id: "s1",
      serviceName: "bot",
      environment: null,
      status: TelemetryServiceStatus.ACKNOWLEDGED,
      payloadLevel: TelemetryPayloadLevel.FULL,
      applyGlobalProcessors: false,
    };
    const withMode: DcdrTelemetryServiceSnapshotEntry = { ...legacy, endUserIdMode: TelemetryEndUserIdMode.AS_SENT };
    expect(JSON.parse(JSON.stringify(legacy)).endUserIdMode).toBeUndefined();
    expect(JSON.parse(JSON.stringify(withMode)).endUserIdMode).toBe("AS_SENT");
  });
});

describe("telemetryEndUserPseudonym", () => {
  it("reproduces every reference vector with Node crypto", () => {
    expect(DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS.length).toBeGreaterThanOrEqual(5);
    for (const v of DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS) {
      expect(telemetryEndUserPseudonym(NODE_HMAC, v.key, v.value)).toBe(v.expected);
      // The vectors themselves are what Node computes directly over the raw key bytes.
      expect(crypto.createHmac("sha256", Buffer.from(v.key, "base64")).update(v.value, "utf8").digest("hex")).toBe(v.expected);
    }
  });

  it("covers non-ASCII UTF-8, case sensitivity and an id longer than the 256-character cut", () => {
    const values = DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS.map((v) => v.value);
    expect(values).toContain("José@ejemplo.es");
    expect(values.some((v) => v.length > 256)).toBe(true);
    const lower = DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS.find((v) => v.value === "ada@example.com" && v.key.length > 30);
    const mixed = DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS.find((v) => v.value === "Ada@Example.com");
    expect(lower?.expected).not.toBe(mixed?.expected);
    // The full id is hashed: its 256-character prefix gives a different pseudonym.
    const long = DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS.find((v) => v.value.length > 256);
    expect(long).toBeDefined();
    expect(telemetryEndUserPseudonym(NODE_HMAC, long!.key, long!.value.slice(0, 256))).not.toBe(long!.expected);
  });

  it("returns 64 lowercase hex characters", () => {
    const [v] = DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS;
    expect(telemetryEndUserPseudonym(NODE_HMAC, v.key, "x")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns undefined for an unusable key and never calls the HMAC", () => {
    const createHmac = jest.fn();
    const deps: TelemetryHmacDeps = { createHmac };
    expect(telemetryEndUserPseudonym(deps, "", "u1")).toBeUndefined();
    expect(telemetryEndUserPseudonym(deps, "a2V5", "u1")).toBeUndefined();
    expect(telemetryEndUserPseudonym(deps, "!!!!", "u1")).toBeUndefined();
    expect(createHmac).not.toHaveBeenCalled();
  });

  it("is exported from the package barrel", () => {
    expect(barrel.TelemetryEndUserIdMode.AS_SENT).toBe("AS_SENT");
    expect(typeof barrel.telemetryEndUserPseudonym).toBe("function");
    expect(typeof barrel.decodeTelemetryHashKey).toBe("function");
    expect(barrel.DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS).toBe(DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS);
    expect(barrel.DCDR_TELEMETRY_HASH_KEY_MIN_BYTES).toBe(16);
  });

  it("keeps the vectors immutable", () => {
    expect(Object.isFrozen(DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS)).toBe(true);
    expect(DCDR_TELEMETRY_END_USER_PSEUDONYM_TEST_VECTORS.every((v) => Object.isFrozen(v))).toBe(true);
  });
});

describe("decodeTelemetryHashKey", () => {
  it("decodes a 32-byte key and rejects empty, non-base64 and short keys", () => {
    const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
    expect(Buffer.from(decodeTelemetryHashKey(key.toString("base64"))!)).toEqual(key);
    expect(DCDR_TELEMETRY_HASH_KEY_MIN_BYTES).toBe(16);
    expect(decodeTelemetryHashKey("")).toBeUndefined();
    expect(decodeTelemetryHashKey(undefined as unknown as string)).toBeUndefined();
    expect(decodeTelemetryHashKey(42 as unknown as string)).toBeUndefined();
    expect(decodeTelemetryHashKey("not base64 at all !!")).toBeUndefined();
    expect(decodeTelemetryHashKey(Buffer.alloc(15, 1).toString("base64"))).toBeUndefined();
    expect(decodeTelemetryHashKey(Buffer.alloc(16, 1).toString("base64"))?.length).toBe(16);
  });

  it("matches the runtime's earlier Buffer-based decoding on edge cases", () => {
    const k = Buffer.alloc(32, 9).toString("base64");
    const cases = [
      k,
      k.replace(/=+$/, ""),
      ` ${k.slice(0, 10)}\n${k.slice(10)} `,
      k.replace(/\+/g, "-").replace(/\//g, "_"),
      Buffer.from(Array.from({ length: 32 }, (_, i) => 250 - i)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"),
      `${k.slice(0, 8)}=${k.slice(8)}`,
      `${k.slice(0, 22)}*${k.slice(22)}`,
      `${k}${k}`,
      `${k.replace(/=+$/, "")}Q`,
      `Ł${k}`,
      `${k.slice(0, 20)}ÿ${k.slice(20)}`,
      `${k.slice(0, 20)}😀${k.slice(20)}`,
      `=${k}`,
    ];
    for (const c of cases) expect([c, decodeTelemetryHashKey(c)]).toEqual([c, legacyDecode(c)]);
  });

  it("matches the earlier decoding on a deterministic random sweep", () => {
    const rnd = prng(5125);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/-_= \n\t*.ŁÿĽ€";
    for (let n = 0; n < 3000; n++) {
      const len = Math.floor(rnd() * 64);
      let s = "";
      for (let i = 0; i < len; i++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      expect([s, decodeTelemetryHashKey(s)]).toEqual([s, legacyDecode(s)]);
    }
  });
});

describe("telemetry.contract stays web-bundle safe", () => {
  it("neither imports crypto nor touches Buffer", () => {
    // Code only: the TSDoc may name Node's API it mirrors.
    const source = fs
      .readFileSync(path.join(__dirname, "..", "src", "telemetry.contract.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(source).not.toMatch(/from\s+["'](node:)?crypto["']/);
    expect(source).not.toMatch(/require\(["'](node:)?crypto["']\)/);
    expect(source).not.toMatch(/\bBuffer\b/);
  });
});
