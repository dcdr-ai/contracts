import fs from "fs";
import os from "os";
import path from "path";

interface BarrelCyclesViolation {
  filePath: string;
  wildcardTargets: string[];
}

interface BarrelCyclesModule {
  SRC_DIR: string;
  findViolations(dir: string): BarrelCyclesViolation[];
}

const { SRC_DIR, findViolations } = require("../tools/check-no-barrel-cycles.js") as BarrelCyclesModule;

/**
 * Regression guard for the incident where `provider.contract.ts` both defined `IntentProvider`
 * and did `export * from "./provider.catalog.contract"`, which imported `IntentProvider` back
 * and used it as an object key at module top level. Node's require() tolerated the cycle by
 * textual evaluation order; Rollup/Vite's CJS-interop did not, and threw
 * `Cannot read properties of undefined (reading 'DCDR')` in the production bundle.
 *
 * See tools/check-no-barrel-cycles.js for the enforced rule.
 */
describe("check-no-barrel-cycles", () => {
  it("finds no barrel+definitions violations in the real package source", () => {
    const violations = findViolations(SRC_DIR);

    expect(violations).toEqual([]);
  });

  it("flags a file that both defines an export and re-exports its own consumer via `export *`", () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-barrel-cycles-"));
    try {
      fs.writeFileSync(
        path.join(fixtureDir, "a.ts"),
        'export enum Foo {\n  BAR = "BAR",\n}\n\nexport * from "./b";\n',
      );
      fs.writeFileSync(
        path.join(fixtureDir, "b.ts"),
        'import { Foo } from "./a";\n\nexport const MAP = {\n  [Foo.BAR]: 1,\n};\n',
      );

      const violations = findViolations(fixtureDir);

      expect(violations).toHaveLength(1);
      expect(path.basename(violations[0].filePath)).toBe("a.ts");
      expect(violations[0].wildcardTargets).toEqual(["./b"]);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it("does not flag a pure barrel that mixes `export *` with a named re-export list", () => {
    const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "no-barrel-cycles-"));
    try {
      fs.writeFileSync(
        path.join(fixtureDir, "index.ts"),
        'export * from "./a";\nexport { Named } from "./b";\n',
      );
      fs.writeFileSync(path.join(fixtureDir, "a.ts"), "export const A = 1;\n");
      fs.writeFileSync(path.join(fixtureDir, "b.ts"), "export const Named = 2;\n");

      const violations = findViolations(fixtureDir);

      expect(violations).toEqual([]);
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
