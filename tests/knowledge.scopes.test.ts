/// <reference types="jest" />

/**
 * Knowledge access (3.20.0): action scope AND collection grant.
 *
 * The literals are pinned because the control plane coded against them before this package existed
 * (KN-2 / KN-3 in the handoff thread): a renamed scope would silently grant nothing to every token
 * already issued.
 */
import {
  DCDR_KNOWLEDGE_ALL_COLLECTIONS,
  DCDR_KNOWLEDGE_COLLECTION_SCOPE_PREFIX,
  DcdrKnowledgeAccessAction,
  DcdrServiceTokenScope,
  grantedDcdrKnowledgeCollections,
  hasDcdrKnowledgeAccess,
  hasDcdrServiceTokenScope,
  knowledgeCollectionScope,
} from "../src/service-tokens.contract";

describe("knowledge scopes", () => {
  it("pins the agreed literals", () => {
    expect(DcdrServiceTokenScope.KNOWLEDGE_READ).toBe("knowledge:read");
    expect(DcdrServiceTokenScope.KNOWLEDGE_RUN).toBe("knowledge:run");
    expect(DcdrServiceTokenScope.KNOWLEDGE_WRITE).toBe("knowledge:write");
    expect(DcdrServiceTokenScope.KNOWLEDGE_COLLECTIONS_ALL).toBe("knowledge:collections:*");
    expect(DCDR_KNOWLEDGE_COLLECTION_SCOPE_PREFIX).toBe("knowledge:collection:");
    expect(DCDR_KNOWLEDGE_ALL_COLLECTIONS).toBe("ALL");
    expect([DcdrKnowledgeAccessAction.READ, DcdrKnowledgeAccessAction.RUN, DcdrKnowledgeAccessAction.WRITE]).toEqual(["read", "run", "write"]);
  });

  describe("knowledgeCollectionScope", () => {
    it("builds the per-collection grant from the key, kept as written", () => {
      expect(knowledgeCollectionScope("product-sheets")).toBe("knowledge:collection:product-sheets");
      // Keys are compared exactly: case and hyphens survive, surrounding whitespace does not.
      expect(knowledgeCollectionScope("  Rice-Literature ")).toBe("knowledge:collection:Rice-Literature");
    });

    it("refuses a blank key instead of building a grant that names nothing", () => {
      expect(() => knowledgeCollectionScope("")).toThrow(/non-empty collection key/);
      expect(() => knowledgeCollectionScope("   ")).toThrow(/non-empty collection key/);
    });
  });

  describe("hasDcdrKnowledgeAccess", () => {
    it("needs the action scope AND a collection grant", () => {
      expect(hasDcdrKnowledgeAccess(["knowledge:read", "knowledge:collection:product-sheets"], "read", "product-sheets")).toBe(true);
      expect(hasDcdrKnowledgeAccess(["knowledge:run", "knowledge:collections:*"], DcdrKnowledgeAccessAction.RUN, "anything")).toBe(true);
    });

    it("grants nothing with the action scope alone", () => {
      expect(hasDcdrKnowledgeAccess(["knowledge:read", "knowledge:run"], "read", "product-sheets")).toBe(false);
    });

    it("grants nothing with the collection grant alone", () => {
      expect(hasDcdrKnowledgeAccess(["knowledge:collections:*"], "read", "product-sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(["knowledge:collection:product-sheets"], "run", "product-sheets")).toBe(false);
    });

    it("keeps the actions apart: read does not run, run does not read", () => {
      const reader = ["knowledge:read", "knowledge:collections:*"];
      expect(hasDcdrKnowledgeAccess(reader, "run", "product-sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(["knowledge:run", "knowledge:collections:*"], "read", "product-sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(reader, "write", "product-sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(["knowledge:write", "knowledge:collections:*"], "write", "product-sheets")).toBe(true);
    });

    it("limits a per-key grant to that key, compared exactly", () => {
      const scopes = ["knowledge:run", "knowledge:collection:product-sheets"];
      expect(hasDcdrKnowledgeAccess(scopes, "run", "product-sheets")).toBe(true);
      expect(hasDcdrKnowledgeAccess(scopes, "run", "product-sheets-2024")).toBe(false);
      expect(hasDcdrKnowledgeAccess(scopes, "run", "Product-Sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(scopes, "run", "product")).toBe(false);
    });

    it("does not read knowledge:collection:* as a wildcard", () => {
      expect(hasDcdrKnowledgeAccess(["knowledge:read", "knowledge:collection:*"], "read", "product-sheets")).toBe(false);
    });

    it("honours * for both halves", () => {
      for (const action of ["read", "run", "write"] as const) {
        expect(hasDcdrKnowledgeAccess(["*"], action, "product-sheets")).toBe(true);
      }
    });

    it("refuses nothing granted, a blank key and an unknown action", () => {
      expect(hasDcdrKnowledgeAccess([], "read", "product-sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(undefined, "read", "product-sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(null, "read", "product-sheets")).toBe(false);
      expect(hasDcdrKnowledgeAccess(["*"], "read", "  ")).toBe(false);
      expect(hasDcdrKnowledgeAccess(["knowledge:read", "knowledge:collections:*"], "delete" as DcdrKnowledgeAccessAction, "product-sheets")).toBe(false);
    });

    it("leaves hasDcdrServiceTokenScope's exact matching untouched", () => {
      // The generic check still knows nothing about the AND rule; that is the helper's job.
      expect(hasDcdrServiceTokenScope(["knowledge:read"], DcdrServiceTokenScope.KNOWLEDGE_RUN)).toBe(false);
      expect(hasDcdrServiceTokenScope(["knowledge:collections:*"], "knowledge:collection:product-sheets")).toBe(false);
    });
  });

  describe("grantedDcdrKnowledgeCollections", () => {
    it("answers ALL for knowledge:collections:* and for *", () => {
      expect(grantedDcdrKnowledgeCollections(["knowledge:read", "knowledge:collections:*"])).toBe("ALL");
      expect(grantedDcdrKnowledgeCollections(["*"])).toBe("ALL");
    });

    it("lists per-key grants in order, without duplicates", () => {
      expect(
        grantedDcdrKnowledgeCollections([
          "knowledge:read",
          "knowledge:collection:product-sheets",
          "execute:CLASSIFY",
          "knowledge:collection:rice-literature",
          "knowledge:collection:product-sheets",
          "knowledge:collection:",
        ]),
      ).toEqual(["product-sheets", "rice-literature"]);
    });

    it("answers an empty list when nothing is granted", () => {
      expect(grantedDcdrKnowledgeCollections(["knowledge:read", "knowledge:run"])).toEqual([]);
      expect(grantedDcdrKnowledgeCollections([])).toEqual([]);
      expect(grantedDcdrKnowledgeCollections(undefined)).toEqual([]);
      expect(grantedDcdrKnowledgeCollections(null)).toEqual([]);
    });
  });
});
