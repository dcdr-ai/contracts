import fs from "fs";
import path from "path";

/**
 * Minimal shape we need from the contracts package.json.
 */
interface ContractsPackageJson {
  main?: string;
  exports?: Record<string, string>;
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
 * Requires a CommonJS module path and asserts it loads.
 * @param absoluteModulePath Absolute path to a .js file.
 */
function expectRequireWorks(absoluteModulePath: string): void {
  const mod = require(absoluteModulePath);
  expect(mod).toBeTruthy();
}

describe("@dcdr/contracts dist/ exports", () => {
  it("package.json exports point to real dist/ files", () => {
    const packageRoot = path.resolve(__dirname, "..");
    const packageJsonPath = path.join(packageRoot, "package.json");

    const raw = fs.readFileSync(packageJsonPath, "utf8");
    const pkg = JSON.parse(raw) as ContractsPackageJson;

    expect(pkg).toBeTruthy();
    expect(pkg.exports).toBeTruthy();

    const distIndex = path.join(packageRoot, "dist", "index.js");
    expect(fs.existsSync(distIndex)).toBe(true);

    // Ensure the built entrypoint is require()-able.
    expectRequireWorks(distIndex);

    const exportsMap = pkg.exports || {};
    const exportTargets = Object.values(exportsMap);

    expect(exportTargets.length).toBeGreaterThan(0);

    for (const target of exportTargets) {
      expect(typeof target).toBe("string");
      expect(target.startsWith("./dist/")).toBe(true);

      const abs = resolveFromPackageRoot(packageRoot, target);
      expect(fs.existsSync(abs)).toBe(true);

      expectRequireWorks(abs);
    }
  });
});
