/**
 * Generic session token payload for dcdr.
 * - id: session id (e.g. missionId)
 * - aid: app id (e.g. scraperId)
 */
export interface DcdrSessionPayload {
  id: string;       // session id
  aid: string;      // app/client id
  cid?: string;     // customer id, for multi-tenant scenarios
  iat: number;      // unix milliseconds
  exp: number;      // unix milliseconds
  scopes: string[]; // allowed intents / scopes
}

/**
 * Crypto dependencies injected from Node runtimes (backend/dcdr).
 * This avoids importing "crypto" in shared libs that may be bundled for web.
 */
export interface HmacDeps {
  createHmac: (alg: "sha256", key: string) => {
    update: (data: string) => any;
    digest: (encoding: "base64") => string;
  };
  timingSafeEqual?: (a: Uint8Array, b: Uint8Array) => boolean;
}

/**
 * Token format:
 *   token = base64url(JSON(payload)) + "." + base64url(HMAC_SHA256(secret, payloadB64url))
 */
export class DcdrSessionToken {
  static sign(deps: HmacDeps, payload: DcdrSessionPayload, secret: string): string {
    this.assertValidPayload(payload);

    const payloadJson = JSON.stringify(payload);
    const payloadB64url = base64urlEncode(utf8ToBytes(payloadJson));

    const sigB64 = deps.createHmac("sha256", secret).update(payloadB64url).digest("base64");
    const sigB64url = base64ToBase64url(sigB64);

    return `${payloadB64url}.${sigB64url}`;
  }

  static verify(
    deps: HmacDeps,
    token: string,
    secrets: string[] | string,
    opts?: { clockSkewSeconds?: number; revokeBeforeIat?: number },
  ): DcdrSessionPayload {
    const secretsArr = Array.isArray(secrets) ? secrets : [secrets];
    const clockSkewMilliseconds = (opts?.clockSkewSeconds ?? 30) * 1000;

    if (!token || typeof token !== "string") throw new Error("TOKEN_MISSING");

    const parts = token.split(".");
    if (parts.length !== 2) throw new Error("TOKEN_FORMAT_INVALID");

    const [payloadB64url, sigB64url] = parts;
    if (!payloadB64url || !sigB64url) throw new Error("TOKEN_FORMAT_INVALID");

    const sigB64 = base64urlToBase64(sigB64url);

    // Verify signature against any allowed secret (rotation)
    let ok = false;
    for (const secret of secretsArr) {
      const expectedB64 = deps.createHmac("sha256", secret).update(payloadB64url).digest("base64");
      if (safeEqualBase64(deps, expectedB64, sigB64)) {
        ok = true;
        break;
      }
    }
    if (!ok) throw new Error("TOKEN_SIGNATURE_INVALID");

    // Decode payload
    const payloadJson = bytesToUtf8(base64urlDecodeToBytes(payloadB64url));
    const payload = normalizePayloadTimes(JSON.parse(payloadJson) as DcdrSessionPayload);

    this.assertValidPayload(payload);

    // Time checks (unix milliseconds)
    const now = Date.now();

    if (opts?.revokeBeforeIat && payload.iat < opts.revokeBeforeIat) {
      throw new Error("TOKEN_REVOKED");
    }

    if (payload.iat > now + clockSkewMilliseconds) {
      throw new Error("TOKEN_IAT_IN_FUTURE");
    }

    if (payload.exp < now - clockSkewMilliseconds) {
      throw new Error("TOKEN_EXPIRED");
    }

    return payload;
  }

  static decodeUnverified(token: string): DcdrSessionPayload {
    const [payloadB64url] = (token ?? "").split(".");
    if (!payloadB64url) throw new Error("TOKEN_FORMAT_INVALID");

    const payloadJson = bytesToUtf8(base64urlDecodeToBytes(payloadB64url));
    const payload = normalizePayloadTimes(JSON.parse(payloadJson) as DcdrSessionPayload);

    this.assertValidPayload(payload);
    return payload;
  }

  private static assertValidPayload(p: DcdrSessionPayload): void {
    if (!p || typeof p !== "object") throw new Error("PAYLOAD_INVALID");

    if (!p.id || typeof p.id !== "string") throw new Error("PAYLOAD_ID_INVALID");
    if (!p.aid || typeof p.aid !== "string") throw new Error("PAYLOAD_AID_INVALID");

    if (typeof p.iat !== "number" || !Number.isFinite(p.iat)) throw new Error("PAYLOAD_IAT_INVALID");
    if (typeof p.exp !== "number" || !Number.isFinite(p.exp)) throw new Error("PAYLOAD_EXP_INVALID");

    if (!Array.isArray(p.scopes) || p.scopes.some((s) => typeof s !== "string" || !s)) {
      throw new Error("PAYLOAD_SCOPES_INVALID");
    }
  }
}

function normalizePayloadTimes(p: DcdrSessionPayload): DcdrSessionPayload {
  // Accept legacy unix seconds timestamps: heuristic based on magnitude.
  // - unix seconds in 2026 ~ 1.7e9
  // - unix milliseconds in 2026 ~ 1.7e12
  const normalize = (n: number): number => {
    if (!Number.isFinite(n)) return n;
    if (n < 100_000_000_000) return Math.floor(n * 1000); // likely seconds
    return Math.floor(n); // milliseconds
  };

  if (p && typeof p === "object") {
    (p as any).iat = normalize((p as any).iat);
    (p as any).exp = normalize((p as any).exp);
  }
  return p;
}

// -------------------------------------------------------------------------------------
// Internal helpers (no direct "crypto" import)
// -------------------------------------------------------------------------------------

function safeEqualBase64(deps: HmacDeps, aB64: string, bB64: string): boolean {
  if (aB64.length !== bB64.length) return false;

  if (deps.timingSafeEqual) {
    const a = base64DecodeToBytes(aB64);
    const b = base64DecodeToBytes(bB64);
    if (a.length !== b.length) return false;
    return deps.timingSafeEqual(a, b);
  }

  // Fallback: normal compare (OK for internal usage)
  return aB64 === bB64;
}

function base64ToBase64url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlToBase64(b64url: string): string {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (b64.length % 4)) % 4;
  return b64 + "=".repeat(pad);
}

function base64urlEncode(bytes: Uint8Array): string {
  return base64ToBase64url(base64Encode(bytes));
}

function base64urlDecodeToBytes(b64url: string): Uint8Array {
  return base64DecodeToBytes(base64urlToBase64(b64url));
}

function base64Encode(bytes: Uint8Array): string {
  // Node runtime (dynamic access avoids bundler static detection)
  const g: any = globalThis as any;
  if (g.Buffer && typeof g.Buffer.from === "function") {
    return g.Buffer.from(bytes).toString("base64");
  }

  // Browser fallback
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // eslint-disable-next-line no-undef
  return btoa(bin);
}

function base64DecodeToBytes(b64: string): Uint8Array {
  // Node runtime (dynamic access avoids bundler static detection)
  const g: any = globalThis as any;
  if (g.Buffer && typeof g.Buffer.from === "function") {
    return new Uint8Array(g.Buffer.from(b64, "base64"));
  }

  // Browser fallback
  // eslint-disable-next-line no-undef
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8ToBytes(s: string): Uint8Array {
  // Prefer standard API first (works in modern Node and browsers)
  // eslint-disable-next-line no-undef
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);

  // Node fallback without referencing Buffer symbol directly
  const g: any = globalThis as any;
  if (g.Buffer && typeof g.Buffer.from === "function") {
    return new Uint8Array(g.Buffer.from(s, "utf8"));
  }

  throw new Error("UTF8_ENCODER_UNAVAILABLE");
}

function bytesToUtf8(bytes: Uint8Array): string {
  // Prefer standard API first (works in modern Node and browsers)
  // eslint-disable-next-line no-undef
  if (typeof TextDecoder !== "undefined") return new TextDecoder("utf-8").decode(bytes);

  // Node fallback without referencing Buffer symbol directly
  const g: any = globalThis as any;
  if (g.Buffer && typeof g.Buffer.from === "function") {
    return g.Buffer.from(bytes).toString("utf8");
  }

  throw new Error("UTF8_DECODER_UNAVAILABLE");
}


