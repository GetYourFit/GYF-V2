import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function hasDefaultExport(sourceText: string, path = "route.tsx") {
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);

  return source.statements.some((statement) => {
    if (ts.isExportAssignment(statement)) {
      return !statement.isExportEquals && !ts.isLiteralExpression(statement.expression);
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause) {
      return (
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some(({ name }) => name.text === "default")
      );
    }
    return (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.DefaultKeyword)
    );
  });
}

test("recognizes executable default route exports", () => {
  expect(
    hasDefaultExport('// export default function Fake() {}\nconst value = "export default";'),
  ).toBe(false);
  expect(hasDefaultExport("export default 42")).toBe(false);
  expect(hasDefaultExport("const Screen = () => null; export { Screen as default }")).toBe(true);
});

test("every Expo Router route has a default export", async () => {
  const root = fileURLToPath(new URL("../app/", import.meta.url));
  const invalid: string[] = [];

  for await (const route of new Bun.Glob("**/*.{ts,tsx,js,jsx}").scan({
    cwd: root,
    absolute: true,
  })) {
    if (/\+(?:api|html|middleware|native-intent)\.[tj]sx?$/.test(route)) continue;
    if (!hasDefaultExport(readFileSync(route, "utf8"), route)) {
      invalid.push(relative(root, route));
    }
  }

  expect(invalid).toEqual([]);
});
