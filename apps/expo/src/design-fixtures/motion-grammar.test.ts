import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Motion and haptic grammar (EXPO-19-FINAL), enforced at the source level:
 * every infinite loop must honor system reduced motion and cancel itself on
 * unmount, and the one haptic vocabulary in lib/haptics.ts must stay the only
 * doorway to expo-haptics.
 */
const srcRoot = fileURLToPath(new URL("..", import.meta.url));

async function sourcesMatching(needle: string): Promise<Array<[string, string]>> {
  const hits: Array<[string, string]> = [];
  for await (const file of new Glob("**/*.{ts,tsx}").scan(srcRoot)) {
    if (file.includes(".test.")) continue;
    const text = await Bun.file(join(srcRoot, file)).text();
    if (text.includes(needle)) hits.push([file, text]);
  }
  return hits;
}

describe("Expo motion grammar", () => {
  test("every repeating animation honors system reduced motion", async () => {
    const looping = await sourcesMatching("withRepeat(");
    expect(looping.length).toBeGreaterThan(0);
    for (const [file, text] of looping) {
      expect(`${file}: ${text.includes("ReduceMotion.System")}`).toBe(`${file}: true`);
    }
  });

  test("every repeating animation cancels itself on unmount", async () => {
    for (const [file, text] of await sourcesMatching("withRepeat(")) {
      expect(`${file}: ${text.includes("cancelAnimation")}`).toBe(`${file}: true`);
    }
  });

  test("lib/haptics.ts is the only doorway to expo-haptics", async () => {
    const files = (await sourcesMatching("expo-haptics")).map(([file]) => file);
    expect(files).toEqual(["lib/haptics.ts"]);
  });
});
