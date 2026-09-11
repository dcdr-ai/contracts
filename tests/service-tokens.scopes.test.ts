/// <reference types="jest" />

/**
 * The service-token scope vocabulary is wire-level: a scope is a string that either matches exactly
 * or silently grants nothing, so every value is pinned here. A rename is a breaking change for every
 * token already issued, and these assertions are what make that visible at review time rather than
 * at a customer's next call.
 *
 * The list itself was published in 3.9.0. Before that the enum carried only `gateway` while the real
 * vocabulary lived in the backend, unreferenced from here and compared with nothing.
 */
import { DcdrAssetScope } from "../src/asset.contract";
import { DcdrServiceTokenScope, hasDcdrServiceTokenScope } from "../src/service-tokens.contract";

describe("DcdrServiceTokenScope", () => {
  it("pins every wire value", () => {
    expect(DcdrServiceTokenScope.REGISTRY_READ).toBe("registry:read");
    expect(DcdrServiceTokenScope.ENTITLEMENTS_READ).toBe("entitlements:read");
    expect(DcdrServiceTokenScope.LOGS_WRITE).toBe("logs:write");
    expect(DcdrServiceTokenScope.ASSETS_READ).toBe("assets:read");
    expect(DcdrServiceTokenScope.ASSETS_WRITE).toBe("assets:write");
    expect(DcdrServiceTokenScope.ASSETS_DELETE).toBe("assets:delete");
    expect(DcdrServiceTokenScope.EXECUTE_ALL).toBe("execute:*");
    expect(DcdrServiceTokenScope.GATEWAY).toBe("gateway");
    expect(DcdrServiceTokenScope.WORKFLOWS_READ).toBe("workflows:read");
    expect(DcdrServiceTokenScope.WORKFLOWS_RUN).toBe("workflows:run");
    expect(DcdrServiceTokenScope.WORKFLOWS_WRITE).toBe("workflows:write");
    expect(DcdrServiceTokenScope.FULL_ACCESS).toBe("*");
  });

  it("keeps the asset scopes identical to the ones asset.contract owns", () => {
    // Two enums carrying the same three strings is exactly the split this release removed; the
    // members are aliases, and this fails if anyone re-types them.
    expect(DcdrServiceTokenScope.ASSETS_READ).toBe(DcdrAssetScope.READ);
    expect(DcdrServiceTokenScope.ASSETS_WRITE).toBe(DcdrAssetScope.WRITE);
    expect(DcdrServiceTokenScope.ASSETS_DELETE).toBe(DcdrAssetScope.DELETE);
  });

  it("has no duplicate values", () => {
    const values = Object.values(DcdrServiceTokenScope);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("hasDcdrServiceTokenScope", () => {
  it("grants a scope the token carries", () => {
    expect(hasDcdrServiceTokenScope(["workflows:run"], DcdrServiceTokenScope.WORKFLOWS_RUN)).toBe(true);
  });

  it("refuses a scope the token does not carry", () => {
    expect(hasDcdrServiceTokenScope(["workflows:read"], DcdrServiceTokenScope.WORKFLOWS_RUN)).toBe(false);
  });

  it("never treats one scope as a prefix of another", () => {
    // The failure mode this function exists to prevent: a `startsWith` implementation would let a
    // read token write, because `workflows:write` starts with `workflows:`.
    expect(hasDcdrServiceTokenScope(["workflows:read"], DcdrServiceTokenScope.WORKFLOWS_WRITE)).toBe(false);
    expect(hasDcdrServiceTokenScope(["workflows:"], DcdrServiceTokenScope.WORKFLOWS_READ)).toBe(false);
    expect(hasDcdrServiceTokenScope(["assets:read"], DcdrServiceTokenScope.ASSETS_DELETE)).toBe(false);
  });

  it("honours the wildcard for every scope", () => {
    for (const scope of Object.values(DcdrServiceTokenScope)) {
      expect(hasDcdrServiceTokenScope(["*"], scope)).toBe(true);
    }
  });

  it("refuses an empty, absent or malformed scope list", () => {
    expect(hasDcdrServiceTokenScope([], DcdrServiceTokenScope.WORKFLOWS_READ)).toBe(false);
    expect(hasDcdrServiceTokenScope(undefined, DcdrServiceTokenScope.WORKFLOWS_READ)).toBe(false);
    expect(hasDcdrServiceTokenScope(null, DcdrServiceTokenScope.WORKFLOWS_READ)).toBe(false);
  });

  it("accepts a scope string the enum does not know, since the wire surface stays open", () => {
    expect(hasDcdrServiceTokenScope(["some:future:scope"], "some:future:scope")).toBe(true);
  });
});
