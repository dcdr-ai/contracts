/**
 * Generic session token payload for dcdr.
 * - id: session id (e.g. missionId)
 * - aid: app id (e.g. scraperId)
 */
export interface DcdrSessionPayload {
  id: string; // session id
  aid: string; // app/client id
  cid?: string; // customer id, for multi-tenant scenarios
  iat: number; // unix milliseconds
  exp: number; // unix milliseconds
  /**
   * Allowed scopes for this session token.
   *
   * Notes
   * - Scopes are treated as opaque strings by the token format; semantics are enforced by the runtime.
   * - The runtime may require execution scopes for `/api/execution/*` endpoints.
   *
   * Common scope forms
   * - `execute:*` to allow executing any intent
   * - `execute:<INTENT>` to allow a specific intent
   * - Legacy (backward compatible): include the intent name itself (e.g. `BANKING_INCIDENT_CLASSIFIER`).
   * - `*` grants full access.
   */
  scopes: string[];
  /**
   * Id of the keyring key that signed this token (v3.13.0).
   *
   * Stamped by {@link DcdrSessionToken.signWithKeyring}. A runtime verifies customer tokens and internal
   * run grants with {@link DcdrSessionToken.verifyWithKeyring}, which requires it: it selects the one key
   * to verify with, so a verifier never tries every key in turn.
   */
  kid?: string;
}

/**
 * Tenant id an internal run grant claims: the platform's own registry (v3.13.0).
 *
 * A token claiming it is only honoured when a {@link DcdrSessionKeyring} key signed it; the customer
 * session secrets can never authorize it. Which tenant a token may claim is decided by who signed it.
 */
export const DCDR_INTERNAL_TENANT_CID = "__internal__";

/** Minimum length of a keyring key, so a placeholder or a short secret is refused at load (v3.13.0). */
export const DCDR_SESSION_KEY_MIN_LENGTH = 32;

/**
 * A set of HMAC keys identified by id, one of them active (v3.13.0).
 *
 * Signing always uses `activeKeyId`. Retired keys stay in `keys` until nothing they signed can still be
 * presented, which is why this is a ring and not an active/previous pair: a pair survives one rotation.
 */
export interface DcdrSessionKeyring {
  /** Key new tokens are signed with; must be one of `keys`. */
  activeKeyId: string;
  /** Every key still accepted, by id. Values are secrets: never log or persist them in plain text. */
  keys: Record<string, string>;
}

/**
 * Answer of the control plane's run-grant check (`GET /api/dcdr/workflow-runs/:runId/grant?intent=`,
 * v3.13.0).
 *
 * The runtime refuses an internal run grant unless every flag holds: expiry is not what revokes a grant,
 * the state of its run is.
 */
export interface WorkflowRunGrantStatusResponse {
  runId: string;
  /** `true` only while the run is `RUNNING`; `QUEUED`, `WAITING` and terminal runs are `false`. */
  active: boolean;
  /** `true` only for a run with no customer. */
  internal: boolean;
  /** `true` when the run's published definition uses the intent asked about. */
  intentAllowed: boolean;
  /** Run deadline (ISO-8601), when it has one. */
  deadlineAt: string | null;
}

/** Raw JSON shape of a keyring before validation. */
interface DcdrSessionKeyringJson {
  activeKeyId?: unknown;
  keys?: unknown;
}

/**
 * Parses and validates a keyring from its JSON form (a system setting or an environment variable).
 *
 * Fails loudly on anything a verifier could not use safely: a missing or unknown active key, a key id
 * outside `[A-Za-z0-9._-]{1,64}`, or a key shorter than {@link DCDR_SESSION_KEY_MIN_LENGTH}. Messages
 * name ids, never key material.
 *
 * @param raw JSON text.
 * @returns The keyring.
 * @throws Error `KEYRING_INVALID: ...` when the text is not a usable keyring.
 */
export function parseDcdrSessionKeyring(raw: string): DcdrSessionKeyring {
  let parsed: DcdrSessionKeyringJson;
  try {
    parsed = JSON.parse(String(raw ?? "")) as DcdrSessionKeyringJson;
  } catch {
    throw new Error("KEYRING_INVALID: not JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("KEYRING_INVALID: not an object");
  }
  const keysRaw = parsed.keys;
  if (!keysRaw || typeof keysRaw !== "object" || Array.isArray(keysRaw)) {
    throw new Error("KEYRING_INVALID: keys must be an object of id -> key");
  }
  const keys: Record<string, string> = {};
  for (const [id, value] of Object.entries(keysRaw as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) {
      throw new Error(`KEYRING_INVALID: key id '${id.slice(0, 64)}' must match [A-Za-z0-9._-]{1,64}`);
    }
    if (typeof value !== "string" || value.length < DCDR_SESSION_KEY_MIN_LENGTH) {
      throw new Error(`KEYRING_INVALID: key '${id}' must be a string of at least ${DCDR_SESSION_KEY_MIN_LENGTH} characters`);
    }
    keys[id] = value;
  }
  if (Object.keys(keys).length === 0) {
    throw new Error("KEYRING_INVALID: no keys");
  }
  const activeKeyId = typeof parsed.activeKeyId === "string" ? parsed.activeKeyId : "";
  if (!activeKeyId || !Object.prototype.hasOwnProperty.call(keys, activeKeyId)) {
    throw new Error("KEYRING_INVALID: activeKeyId must name one of keys");
  }
  return { activeKeyId, keys };
}

/**
 * Crypto dependencies injected from Node runtimes (backend/dcdr).
 * This avoids importing "crypto" in shared libs that may be bundled for web.
 */
export interface HmacDeps {
  createHmac: (
    alg: "sha256",
    key: string,
  ) => {
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
  static sign(
    deps: HmacDeps,
    payload: DcdrSessionPayload,
    secret: string,
  ): string {
    this.assertValidPayload(payload);

    const payloadJson = JSON.stringify(payload);
    const payloadB64url = base64urlEncode(utf8ToBytes(payloadJson));

    const sigB64 = deps
      .createHmac("sha256", secret)
      .update(payloadB64url)
      .digest("base64");
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
      const expectedB64 = deps
        .createHmac("sha256", secret)
        .update(payloadB64url)
        .digest("base64");
      if (safeEqualBase64(deps, expectedB64, sigB64)) {
        ok = true;
        break;
      }
    }
    if (!ok) throw new Error("TOKEN_SIGNATURE_INVALID");

    // Decode payload
    const payloadJson = bytesToUtf8(base64urlDecodeToBytes(payloadB64url));
    const payload = normalizePayloadTimes(
      JSON.parse(payloadJson) as DcdrSessionPayload,
    );

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

  /**
   * Signs a payload with the keyring's active key and stamps its id as `kid` (v3.13.0).
   *
   * @param deps HMAC implementation.
   * @param payload Claims; any `kid` given is replaced by the active key id.
   * @param keyring Keyring (see {@link parseDcdrSessionKeyring}).
   * @returns The token.
   * @throws Error `KEYRING_ACTIVE_KEY_MISSING` when the active key is not in the ring.
   */
  static signWithKeyring(
    deps: HmacDeps,
    payload: DcdrSessionPayload,
    keyring: DcdrSessionKeyring,
  ): string {
    const key = keyringKey(keyring, keyring?.activeKeyId);
    if (key === undefined) throw new Error("KEYRING_ACTIVE_KEY_MISSING");
    return this.sign(deps, { ...payload, kid: keyring.activeKeyId }, key);
  }

  /**
   * Verifies a keyring-signed token with exactly the key its `kid` names (v3.13.0).
   *
   * The `kid` is read from the still-unverified payload only to select the key; nothing else in the
   * payload is trusted before the signature checks, and no other key is tried. A token without a `kid`,
   * or naming a key the ring does not hold, is refused - a retired key keeps verifying for as long as it
   * stays in the ring.
   *
   * @param deps HMAC implementation.
   * @param token Token.
   * @param keyring Keyring holding every key still accepted.
   * @param opts Clock skew and global revocation, as {@link DcdrSessionToken.verify}.
   * @returns The verified payload.
   * @throws Error `TOKEN_KID_MISSING`, `TOKEN_KID_UNKNOWN`, or any error of {@link DcdrSessionToken.verify}.
   */
  static verifyWithKeyring(
    deps: HmacDeps,
    token: string,
    keyring: DcdrSessionKeyring,
    opts?: { clockSkewSeconds?: number; revokeBeforeIat?: number },
  ): DcdrSessionPayload {
    let kid: string | undefined;
    try {
      kid = this.decodeUnverified(token).kid;
    } catch {
      throw new Error("TOKEN_FORMAT_INVALID");
    }
    if (typeof kid !== "string" || !kid) throw new Error("TOKEN_KID_MISSING");
    const key = keyringKey(keyring, kid);
    if (key === undefined) throw new Error("TOKEN_KID_UNKNOWN");
    const payload = this.verify(deps, token, key, opts);
    if (payload.kid !== kid) throw new Error("TOKEN_KID_UNKNOWN");
    return payload;
  }

  static decodeUnverified(token: string): DcdrSessionPayload {
    const [payloadB64url] = (token ?? "").split(".");
    if (!payloadB64url) throw new Error("TOKEN_FORMAT_INVALID");

    const payloadJson = bytesToUtf8(base64urlDecodeToBytes(payloadB64url));
    const payload = normalizePayloadTimes(
      JSON.parse(payloadJson) as DcdrSessionPayload,
    );

    this.assertValidPayload(payload);
    return payload;
  }

  private static assertValidPayload(p: DcdrSessionPayload): void {
    if (!p || typeof p !== "object") throw new Error("PAYLOAD_INVALID");

    if (!p.id || typeof p.id !== "string")
      throw new Error("PAYLOAD_ID_INVALID");
    if (!p.aid || typeof p.aid !== "string")
      throw new Error("PAYLOAD_AID_INVALID");

    if (typeof p.iat !== "number" || !Number.isFinite(p.iat))
      throw new Error("PAYLOAD_IAT_INVALID");
    if (typeof p.exp !== "number" || !Number.isFinite(p.exp))
      throw new Error("PAYLOAD_EXP_INVALID");

    if (
      !Array.isArray(p.scopes) ||
      p.scopes.some((s) => typeof s !== "string" || !s)
    ) {
      throw new Error("PAYLOAD_SCOPES_INVALID");
    }

    if (p.kid !== undefined && (typeof p.kid !== "string" || !p.kid)) {
      throw new Error("PAYLOAD_KID_INVALID");
    }
  }
}

/**
 * Looks a key up by id as an own property only, so an id such as `__proto__` or `toString` can never
 * resolve to something that is not a key of the ring.
 *
 * @param keyring Keyring.
 * @param id Key id.
 * @returns The key, or `undefined`.
 */
function keyringKey(keyring: DcdrSessionKeyring | undefined, id: string | undefined): string | undefined {
  if (!keyring || !keyring.keys || typeof id !== "string") return undefined;
  if (!Object.prototype.hasOwnProperty.call(keyring.keys, id)) return undefined;
  const key = keyring.keys[id];
  return typeof key === "string" && key.length > 0 ? key : undefined;
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
  if (typeof TextDecoder !== "undefined")
    return new TextDecoder("utf-8").decode(bytes);

  // Node fallback without referencing Buffer symbol directly
  const g: any = globalThis as any;
  if (g.Buffer && typeof g.Buffer.from === "function") {
    return g.Buffer.from(bytes).toString("utf8");
  }

  throw new Error("UTF8_DECODER_UNAVAILABLE");
}
