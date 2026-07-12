/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

/**
 * Guards against the "barrel + definitions" anti-pattern that caused a production incident:
 * a module (e.g. provider.contract.ts) defined value-level exports (an enum) AND also did
 * `export * from "./other.contract"`, where `other.contract.ts` imported that same enum and
 * used it as an object key at module top level.
 *
 * Node's CommonJS `require()` "gets away with it" because the assignment to `exports.X` happens
 * (textually) before the `require("./other.contract")` call in the compiled output of the same
 * file. Bundlers with ESM interop (Rollup/Vite, esbuild, webpack) are not guaranteed to preserve
 * that order for cyclic module graphs, and can hand back `undefined` for the symbol at the
 * partner module's top level (e.g. `Cannot read properties of undefined (reading 'DCDR')`).
 *
 * The fix for that incident was to keep `export * from "..."` exclusively in pure barrel files
 * (index.ts) that define nothing of their own. This script enforces that split repo-wide:
 * a file may either (a) define exports, or (b) re-export other modules via `export * from`,
 * but not both.
 */

const SRC_DIR = path.resolve(__dirname, "..", "src");

/**
 * Recursively collects `.ts` source files (excluding `.d.ts`).
 */
function listTsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Checks one source file for the barrel+definitions anti-pattern.
 * @returns {{ filePath: string, wildcardTargets: string[] } | null}
 */
function checkFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let hasWildcardReExport = false;
  let hasOtherExport = false;
  const wildcardTargets = [];

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      const isWildcard = !clause || ts.isNamespaceExport(clause);

      if (statement.moduleSpecifier) {
        // Forwarding from another module (`export * from "./y"` or
        // `export { X, Y } from "./y"`) never defines anything locally. Only the
        // wildcard form is the dangerous shape this check guards against; a named
        // re-export list is an explicit, reviewable forwarding declaration.
        if (isWildcard) {
          hasWildcardReExport = true;
          if (ts.isStringLiteral(statement.moduleSpecifier)) {
            wildcardTargets.push(statement.moduleSpecifier.text);
          }
        }
      } else {
        // Bare `export { X, Y };` re-exports names already declared locally in this file.
        hasOtherExport = true;
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      hasOtherExport = true;
      continue;
    }

    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    if (modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      hasOtherExport = true;
    }
  }

  if (hasWildcardReExport && hasOtherExport) {
    return { filePath, wildcardTargets };
  }
  return null;
}

/**
 * Scans a directory tree and returns every barrel+definitions violation found.
 */
function findViolations(dir) {
  return listTsFiles(dir).map(checkFile).filter(Boolean);
}

function main() {
  const files = listTsFiles(SRC_DIR);
  const violations = files.map(checkFile).filter(Boolean);

  if (violations.length > 0) {
    console.error(
      "\nFound file(s) mixing `export * from \"...\"` with their own exported declarations " +
        "(barrel + definitions anti-pattern):\n",
    );
    for (const violation of violations) {
      const relativePath = path.relative(process.cwd(), violation.filePath);
      console.error(`  - ${relativePath} -> export * from ${violation.wildcardTargets.join(", ")}`);
    }
    console.error(
      "\nThis shape creates a self-referential import cycle: the re-exported module typically " +
        "imports a symbol defined in *this* file, while this file re-exports that module. " +
        "CommonJS/Node's require() can \"get away with it\" via textual evaluation order, but " +
        "bundlers with ESM interop (Rollup/Vite, esbuild, webpack) are not guaranteed to preserve " +
        "that order and can hand back `undefined` for the symbol at the target module's top level.\n\n" +
        "Fix: move the `export * from \"...\";` line out of this file and into a pure barrel " +
        "(e.g. index.ts) that has no exports of its own. See the provider.contract.ts / " +
        "provider.catalog.contract.ts split for a worked example.\n",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[check-no-barrel-cycles] Checked ${files.length} file(s); no violations found.`);
}

module.exports = { SRC_DIR, listTsFiles, checkFile, findViolations };

if (require.main === module) {
  main();
}
