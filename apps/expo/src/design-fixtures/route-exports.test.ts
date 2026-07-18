import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

test("every Expo Router route has a default export", async () => {
  const root = new URL("../app/", import.meta.url).pathname;
  const invalid: string[] = [];

  for await (const route of new Bun.Glob("**/*.tsx").scan({ cwd: root, absolute: true })) {
    if (!/export\s+(?:default\b|\{\s*default\s*\})/.test(readFileSync(route, "utf8"))) {
      invalid.push(relative(root, route));
    }
  }

  expect(invalid).toEqual([]);
});
