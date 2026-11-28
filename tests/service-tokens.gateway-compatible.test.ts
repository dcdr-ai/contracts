/// <reference types="jest" />

/**
 * `OPEN_AI_COMPATIBLE` gateway bindings per token (3.28.0, #5259): `baseUrl`, `alias` and `models`.
 *
 * The validator is shared by the runtime (which ignores a binding with an alias issue) and the control plane
 * (which should refuse every issue on write), so its verdicts and wire values are pinned here.
 */
import * as contracts from "../src/index";
import { CapabilityKey } from "../src/capabilities.contract";
import { IntentType } from "../src/intent.contract";
import { formatDcdrVirtualModelId, parseDcdrVirtualModelId } from "../src/provider.catalog.contract";
import { IntentProvider } from "../src/provider.contract";
import {
  DCDR_GATEWAY_COMPATIBLE_ALIAS_PATTERN,
  DCDR_GATEWAY_RESERVED_MODEL_PREFIXES,
  DcdrGatewayCompatibleBindingIssueCode,
  DcdrServiceTokenGatewayProviderBinding,
  dcdrGatewayCompatibleModelType,
  normalizeDcdrGatewayCompatibleBaseUrl,
  validateDcdrGatewayCompatibleBinding,
} from "../src/service-tokens.contract";

/**
 * An `OPEN_AI_COMPATIBLE` binding with the given extra fields.
 *
 * @param extra Binding fields.
 * @returns The binding.
 */
function compat(extra: Partial<DcdrServiceTokenGatewayProviderBinding> = {}): DcdrServiceTokenGatewayProviderBinding {
  return { provider: IntentProvider.OPEN_AI_COMPATIBLE, credentialRef: "cred", ...extra };
}

/**
 * The issue codes the validator reports for a binding within its token.
 *
 * @param binding Binding under test.
 * @param all Every binding on the token (defaults to the binding alone).
 * @returns Issue codes.
 */
function codes(
  binding: DcdrServiceTokenGatewayProviderBinding,
  all: DcdrServiceTokenGatewayProviderBinding[] = [binding],
): DcdrGatewayCompatibleBindingIssueCode[] {
  return validateDcdrGatewayCompatibleBinding(binding, all).map((issue) => issue.code);
}

describe("OPEN_AI_COMPATIBLE gateway bindings (3.28.0)", () => {
  it("pins the wire values", () => {
    expect(CapabilityKey.AI_GATEWAY_OPENAI_COMPATIBLE_BINDINGS).toBe("AI_GATEWAY_OPENAI_COMPATIBLE_BINDINGS");
    expect(Object.values(DcdrGatewayCompatibleBindingIssueCode).sort()).toEqual(
      [
        "ALIAS_DUPLICATE",
        "ALIAS_INVALID",
        "ALIAS_RESERVED",
        "BASE_URL_INVALID",
        "MODEL_DUPLICATE",
        "MODEL_INVALID",
        "UNALIASED_DUPLICATE",
      ].sort(),
    );
    expect(DCDR_GATEWAY_COMPATIBLE_ALIAS_PATTERN.source).toBe("^[a-z0-9][a-z0-9-]{0,31}$");
  });

  it("is exported from the root barrel", () => {
    expect(contracts.validateDcdrGatewayCompatibleBinding).toBe(validateDcdrGatewayCompatibleBinding);
    expect(contracts.normalizeDcdrGatewayCompatibleBaseUrl).toBe(normalizeDcdrGatewayCompatibleBaseUrl);
    expect(contracts.DCDR_GATEWAY_RESERVED_MODEL_PREFIXES).toContain("openai-compatible");
  });

  it("reserves every prefix the catalog parses as a provider, plus openai-compatible and dcdr", () => {
    const providers = Object.values(IntentProvider) as IntentProvider[];
    for (const provider of providers) {
      const prefixed = formatDcdrVirtualModelId(provider, "m");
      if (!prefixed) continue;
      expect(DCDR_GATEWAY_RESERVED_MODEL_PREFIXES).toContain(prefixed.split("/")[0]);
    }
    expect(parseDcdrVirtualModelId("xai/m")).not.toBeNull();
    expect(DCDR_GATEWAY_RESERVED_MODEL_PREFIXES).toEqual(
      expect.arrayContaining(["openai", "anthropic", "gemini", "grok", "xai", "mistral", "office", "openai-compatible", "dcdr"]),
    );
    // Every reserved prefix is itself a well-formed alias: the reservation is what refuses it.
    for (const prefix of DCDR_GATEWAY_RESERVED_MODEL_PREFIXES) {
      expect(DCDR_GATEWAY_COMPATIBLE_ALIAS_PATTERN.test(prefix)).toBe(true);
      expect(codes(compat({ alias: prefix }))).toEqual([DcdrGatewayCompatibleBindingIssueCode.ALIAS_RESERVED]);
    }
  });

  it("accepts a full binding and a bare one", () => {
    expect(
      codes(
        compat({
          alias: "lab-1",
          baseUrl: "https://models.example.com:8443/serving",
          models: [{ id: "llama-3.1-8b" }, { id: "bge-m3", type: IntentType.EMBEDDING }],
        }),
      ),
    ).toEqual([]);
    expect(codes(compat())).toEqual([]);
  });

  it.each([
    ["upper case", "Lab"],
    ["leading dash", "-lab"],
    ["slash", "lab/x"],
    ["33 characters", "a".repeat(33)],
    ["underscore", "my_lab"],
  ])("refuses an alias with %s", (_label, alias) => {
    expect(codes(compat({ alias }))).toEqual([DcdrGatewayCompatibleBindingIssueCode.ALIAS_INVALID]);
  });

  it("accepts a 32 character alias", () => {
    expect(codes(compat({ alias: "a".repeat(32) }))).toEqual([]);
  });

  it("reports duplicate aliases and a second binding without alias on every binding involved", () => {
    const a = compat({ alias: "lab" });
    const b = compat({ alias: "lab" });
    const c = compat({ alias: "other" });
    expect(codes(a, [a, b, c])).toEqual([DcdrGatewayCompatibleBindingIssueCode.ALIAS_DUPLICATE]);
    expect(codes(b, [a, b, c])).toEqual([DcdrGatewayCompatibleBindingIssueCode.ALIAS_DUPLICATE]);
    expect(codes(c, [a, b, c])).toEqual([]);

    const bare1 = compat();
    const bare2 = compat();
    expect(codes(bare1, [bare1, bare2, c])).toEqual([DcdrGatewayCompatibleBindingIssueCode.UNALIASED_DUPLICATE]);
    expect(codes(bare2, [bare1, bare2, c])).toEqual([DcdrGatewayCompatibleBindingIssueCode.UNALIASED_DUPLICATE]);
    // One binding without alias next to aliased ones is fine.
    expect(codes(bare1, [bare1, a, c])).toEqual([]);
  });

  it("ignores the fields on other providers' bindings", () => {
    const openai: DcdrServiceTokenGatewayProviderBinding = {
      provider: IntentProvider.OPEN_AI,
      credentialRef: "c",
      alias: "openai",
      baseUrl: "ftp://nope",
    };
    expect(codes(openai)).toEqual([]);
    // An OPEN_AI binding does not count as a second binding without alias either.
    const bare = compat();
    expect(codes(bare, [bare, openai])).toEqual([]);
  });

  it("refuses invalid base URLs", () => {
    for (const baseUrl of [
      "not a url",
      "ftp://models.example.com",
      "file:///etc/passwd",
      "https://user:pass@models.example.com",
      "https://models.example.com/v1?x=1",
      "https://models.example.com/v1#frag",
      "https://models.example.com/?",
    ]) {
      expect(codes(compat({ baseUrl }))).toEqual([DcdrGatewayCompatibleBindingIssueCode.BASE_URL_INVALID]);
    }
  });

  it("reads a blank alias or base URL as absent", () => {
    expect(codes(compat({ alias: "", baseUrl: "   " }))).toEqual([]);
    const blank = compat({ alias: " " });
    const bare = compat();
    expect(codes(blank, [blank, bare])).toEqual([DcdrGatewayCompatibleBindingIssueCode.UNALIASED_DUPLICATE]);
    expect(contracts.hasDcdrGatewayCompatibleField("")).toBe(false);
    expect(contracts.hasDcdrGatewayCompatibleField(null)).toBe(false);
    expect(contracts.hasDcdrGatewayCompatibleField("lab")).toBe(true);
  });

  it("normalises a base URL and appends /v1 once", () => {
    expect(normalizeDcdrGatewayCompatibleBaseUrl("https://models.example.com")).toBe("https://models.example.com/v1");
    expect(normalizeDcdrGatewayCompatibleBaseUrl("https://models.example.com/")).toBe("https://models.example.com/v1");
    expect(normalizeDcdrGatewayCompatibleBaseUrl("https://models.example.com/v1/")).toBe("https://models.example.com/v1");
    expect(normalizeDcdrGatewayCompatibleBaseUrl("http://10.0.0.5:8000/V1")).toBe("http://10.0.0.5:8000/V1");
    expect(normalizeDcdrGatewayCompatibleBaseUrl(" https://h.example.com:8443/openai ")).toBe("https://h.example.com:8443/openai/v1");
    expect(normalizeDcdrGatewayCompatibleBaseUrl("https://h.example.com/v1x")).toBe("https://h.example.com/v1x/v1");
    expect(normalizeDcdrGatewayCompatibleBaseUrl(undefined)).toBeNull();
    expect(normalizeDcdrGatewayCompatibleBaseUrl("ws://h.example.com")).toBeNull();
  });

  it("checks models: entries need an id, an id repeats only across types, [] is valid", () => {
    expect(codes(compat({ models: [] }))).toEqual([]);
    expect(codes(compat({ models: [{ id: "m" }, { id: "m", type: IntentType.EMBEDDING }] }))).toEqual([]);
    expect(codes(compat({ models: [{ id: "m" }, { id: "m", type: IntentType.CHAT }] }))).toEqual([
      DcdrGatewayCompatibleBindingIssueCode.MODEL_DUPLICATE,
    ]);
    expect(codes(compat({ models: [{ id: " " }] }))).toEqual([DcdrGatewayCompatibleBindingIssueCode.MODEL_INVALID]);
    const notAList = compat();
    (notAList as unknown as { models: string }).models = "m1,m2";
    expect(validateDcdrGatewayCompatibleBinding(notAList, [notAList])).toEqual([
      expect.objectContaining({ code: DcdrGatewayCompatibleBindingIssueCode.MODEL_INVALID, field: "models" }),
    ]);
  });

  it("serves a model as EMBEDDING only when it says so", () => {
    expect(dcdrGatewayCompatibleModelType({ type: IntentType.EMBEDDING })).toBe(IntentType.EMBEDDING);
    expect(dcdrGatewayCompatibleModelType({})).toBe(IntentType.CHAT);
    expect(dcdrGatewayCompatibleModelType({ type: "IMAGE" as IntentType })).toBe(IntentType.CHAT);
  });

  it("survives a JSON round trip on a token check", () => {
    const check: contracts.DcdrGatewayTokenCheckResponse = {
      valid: true,
      cid: "cid",
      gatewayBindings: [compat({ alias: "lab", baseUrl: "https://m.example.com", models: [{ id: "x", type: IntentType.EMBEDDING }] })],
    };
    const back = JSON.parse(JSON.stringify(check)) as contracts.DcdrGatewayTokenCheckResponse;
    expect(back.gatewayBindings?.[0]).toEqual({
      provider: "OPEN_AI_COMPATIBLE",
      credentialRef: "cred",
      alias: "lab",
      baseUrl: "https://m.example.com",
      models: [{ id: "x", type: "EMBEDDING" }],
    });
  });
});
