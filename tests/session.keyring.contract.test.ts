import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import {
  DCDR_INTERNAL_TENANT_CID,
  DCDR_SESSION_KEY_MIN_LENGTH,
  DcdrSessionPayload,
  DcdrSessionToken,
  HmacDeps,
  parseDcdrSessionKeyring,
} from "../src/session.contract";

/** Node HMAC implementation, as the backend and the runtime inject it. */
const deps: HmacDeps = {
  createHmac: (alg, key) => createHmac(alg, key),
  timingSafeEqual: (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b)),
};

/**
 * Throwaway key for tests: never a real one.
 *
 * @returns 64 hex characters.
 */
function testKey(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Claims of an internal run grant for one intent.
 *
 * @param overrides Claims to change.
 * @returns Payload.
 */
function grantClaims(overrides: Partial<DcdrSessionPayload> = {}): DcdrSessionPayload {
  const now = Date.now();
  return { id: "run-1", aid: "workflow_ONBOARDING", cid: DCDR_INTERNAL_TENANT_CID, iat: now, exp: now + 3_600_000, scopes: ["execute:WORKFLOW_AGENT_PLANNER"], ...overrides };
}

describe("session.contract keyring (v3.13.0)", () => {
  const k1 = testKey();
  const k2 = testKey();
  const keyring = parseDcdrSessionKeyring(JSON.stringify({ activeKeyId: "k2", keys: { k1, k2 } }));

  it("signs with the active key, stamps its kid, and verifies with that key only", () => {
    const token = DcdrSessionToken.signWithKeyring(deps, grantClaims({ kid: "forged" }), keyring);
    const payload = DcdrSessionToken.verifyWithKeyring(deps, token, keyring);

    expect(payload.kid).toBe("k2");
    expect(payload.cid).toBe(DCDR_INTERNAL_TENANT_CID);
    expect(payload.scopes).toEqual(["execute:WORKFLOW_AGENT_PLANNER"]);
    // The same token is not valid for any other key.
    expect(() => DcdrSessionToken.verify(deps, token, k1)).toThrow("TOKEN_SIGNATURE_INVALID");
  });

  it("keeps verifying a token signed by a retired key while the ring still holds it", () => {
    const signedBeforeRotation = DcdrSessionToken.signWithKeyring(deps, grantClaims(), { activeKeyId: "k1", keys: { k1 } });
    expect(DcdrSessionToken.verifyWithKeyring(deps, signedBeforeRotation, keyring).kid).toBe("k1");

    const k3 = testKey();
    const afterRetirement = { activeKeyId: "k3", keys: { k3 } };
    expect(() => DcdrSessionToken.verifyWithKeyring(deps, signedBeforeRotation, afterRetirement)).toThrow("TOKEN_KID_UNKNOWN");
  });

  it("refuses a token without a kid, so a customer token can never pass as a grant", () => {
    const customerStyle = DcdrSessionToken.sign(deps, grantClaims(), k2);
    expect(() => DcdrSessionToken.verifyWithKeyring(deps, customerStyle, keyring)).toThrow("TOKEN_KID_MISSING");
  });

  it("refuses a kid that names a key it was not signed with, and ids that are not own keys", () => {
    // Signed with k1 but claiming k2: the key the kid selects does not match the signature.
    const lying = DcdrSessionToken.sign(deps, grantClaims({ kid: "k2" }), k1);
    expect(() => DcdrSessionToken.verifyWithKeyring(deps, lying, keyring)).toThrow("TOKEN_SIGNATURE_INVALID");

    for (const kid of ["__proto__", "toString", "constructor"]) {
      const token = DcdrSessionToken.sign(deps, grantClaims({ kid }), k1);
      expect(() => DcdrSessionToken.verifyWithKeyring(deps, token, keyring)).toThrow("TOKEN_KID_UNKNOWN");
    }
  });

  it("refuses a tampered payload, an expired grant and garbage", () => {
    const token = DcdrSessionToken.signWithKeyring(deps, grantClaims(), keyring);
    const [payloadB64, signature] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")), scopes: ["*"] })).toString("base64url");
    expect(() => DcdrSessionToken.verifyWithKeyring(deps, `${tampered}.${signature}`, keyring)).toThrow("TOKEN_SIGNATURE_INVALID");

    const expired = DcdrSessionToken.signWithKeyring(deps, grantClaims({ iat: Date.now() - 7_200_000, exp: Date.now() - 3_600_000 }), keyring);
    expect(() => DcdrSessionToken.verifyWithKeyring(deps, expired, keyring)).toThrow("TOKEN_EXPIRED");

    expect(() => DcdrSessionToken.verifyWithKeyring(deps, "not-a-token", keyring)).toThrow("TOKEN_FORMAT_INVALID");
  });

  it("parses a keyring and refuses the ones a verifier could not use safely, without echoing keys", () => {
    expect(parseDcdrSessionKeyring(JSON.stringify({ activeKeyId: "k1", keys: { k1 } }))).toEqual({ activeKeyId: "k1", keys: { k1 } });

    const invalid: Array<[string, string]> = [
      ["not json", "not JSON"],
      [JSON.stringify([]), "not an object"],
      [JSON.stringify({ activeKeyId: "k1" }), "keys must be"],
      [JSON.stringify({ activeKeyId: "k1", keys: {} }), "no keys"],
      [JSON.stringify({ activeKeyId: "k9", keys: { k1 } }), "activeKeyId must name one of keys"],
      [JSON.stringify({ activeKeyId: "k1", keys: { k1: "short" } }), `at least ${DCDR_SESSION_KEY_MIN_LENGTH}`],
      [JSON.stringify({ activeKeyId: "k 1", keys: { "k 1": k1 } }), "must match"],
    ];
    for (const [raw, message] of invalid) {
      let error: Error | undefined;
      try {
        parseDcdrSessionKeyring(raw);
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).toContain("KEYRING_INVALID");
      expect(error?.message).toContain(message);
      expect(error?.message).not.toContain(k1);
    }
  });
});
