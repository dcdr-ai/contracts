import fs from "fs";
import path from "path";
import { createRequire } from "node:module";

const nodeLoader = createRequire(__filename);

/**
 * Minimal shape we need from the contracts package.json.
 */
interface ExportConditions {
  types?: string;
  default?: string;
}

interface ContractsPackageJson {
  main?: string;
  exports?: Record<string, string | ExportConditions>;
}

/**
 * Load result for a dist module target.
 */
interface ModuleLoadResult {
  absolutePath: string;
  ok: boolean;
  error?: string;
}

/**
 * Resolves a package-relative path (e.g. "./dist/index.js") to an absolute path.
 * @param packageRoot Absolute path to the contracts package root.
 * @param packageRelativePath Path from package.json (usually starts with "./").
 * @returns Absolute path to the target file.
 */
function resolveFromPackageRoot(packageRoot: string, packageRelativePath: string): string {
  const normalized = packageRelativePath.startsWith("./")
    ? packageRelativePath.slice(2)
    : packageRelativePath;

  return path.resolve(packageRoot, normalized);
}

/**
 * Loads a dist module path and captures any error for assertion.
 * @param absoluteModulePath Absolute path to a .js file.
 */
function loadDistModule(absoluteModulePath: string): ModuleLoadResult {
  try {
    const mod = nodeLoader(absoluteModulePath);
    return { absolutePath: absoluteModulePath, ok: Boolean(mod) };
  } catch (e) {
    return {
      absolutePath: absoluteModulePath,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

const packageRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(packageRoot, "package.json");
const rawPackageJson = fs.readFileSync(packageJsonPath, "utf8");
const pkg = JSON.parse(rawPackageJson) as ContractsPackageJson;

const distIndex = path.join(packageRoot, "dist", "index.js");
const exportsMap = pkg.exports || {};

/**
 * Resolves the runtime (.js) path from an export entry which may be a plain
 * string or a conditions object `{ types, default }`.
 */
function resolveExportDefault(entry: string | ExportConditions): string | null {
  if (typeof entry === "string") return entry;
  return entry.default ?? null;
}

/**
 * Resolves the types (.d.ts) path from an export conditions object.
 */
function resolveExportTypes(entry: string | ExportConditions): string | null {
  if (typeof entry === "string") return null;
  return entry.types ?? null;
}

const exportEntries = Object.entries(exportsMap);
const runtimeTargets = exportEntries
  .map(([, v]) => resolveExportDefault(v))
  .filter((t): t is string => t !== null);
const typesTargets = exportEntries
  .map(([, v]) => resolveExportTypes(v))
  .filter((t): t is string => t !== null);

const loadTargets: ModuleLoadResult[] = [
  loadDistModule(distIndex),
  ...runtimeTargets.map((target) =>
    loadDistModule(resolveFromPackageRoot(packageRoot, target)),
  ),
];

describe("@dcdr/contracts dist/ exports", () => {
  it("package.json exports point to real dist/ files", () => {
    expect(pkg).toBeTruthy();
    expect(pkg.exports).toBeTruthy();

    expect(fs.existsSync(distIndex)).toBe(true);
    expect(exportEntries.length).toBeGreaterThan(0);

    for (const target of runtimeTargets) {
      expect(target.startsWith("./dist/")).toBe(true);
      const abs = resolveFromPackageRoot(packageRoot, target);
      expect(fs.existsSync(abs)).toBe(true);
    }

    for (const r of loadTargets) {
      expect(r.ok).toBe(true);
      if (!r.ok) {
        throw new Error(
          `Failed to load dist module: ${r.absolutePath}: ${r.error ?? "unknown"}`,
        );
      }
    }
  });

  it("package.json export conditions include types paths pointing to real .d.ts files", () => {
    expect(typesTargets.length).toBeGreaterThan(0);

    for (const target of typesTargets) {
      expect(target.startsWith("./dist/")).toBe(true);
      expect(target.endsWith(".d.ts")).toBe(true);
      const abs = resolveFromPackageRoot(packageRoot, target);
      expect(fs.existsSync(abs)).toBe(true);
    }
  });
});
