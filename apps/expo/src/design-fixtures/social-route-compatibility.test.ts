import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

test("social route avoids a static expo-media-library import", () => {
  const routePath = fileURLToPath(new URL("../app/(app)/(tabs)/social.tsx", import.meta.url));
  const source = readFileSync(routePath, "utf8");

  expect(source).not.toContain('import * as MediaLibrary from "expo-media-library"');
});
