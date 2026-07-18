import { describe, expect, test } from "bun:test";

const exploreSource = await Bun.file(
  new URL("../app/(app)/(tabs)/explore.tsx", import.meta.url),
).text();
const stylistSource = await Bun.file(
  new URL("../app/(app)/(tabs)/index.tsx", import.meta.url),
).text();
const tabBarSource = await Bun.file(
  new URL("../components/navigation/glass-tab-bar.tsx", import.meta.url),
).text();
const glassSurfaceSource = await Bun.file(
  new URL("../components/ui/glass-surface.tsx", import.meta.url),
).text();
const pressableSource = await Bun.file(
  new URL("../components/ui/pressable-scale.tsx", import.meta.url),
).text();
const productCardSource = await Bun.file(
  new URL("../components/ui/product-card.tsx", import.meta.url),
).text();
const welcomeSource = await Bun.file(new URL("../app/(auth)/welcome.tsx", import.meta.url)).text();
const errorRouteSource = await Bun.file(new URL("../app/error.tsx", import.meta.url)).text();

describe("Expo interaction boundaries", () => {
  test("decorative tab-bar gradients cannot intercept web clicks", () => {
    expect(tabBarSource).toContain("<GlassSurface");
    const gradients = glassSurfaceSource.match(/<LinearGradient[\s\S]*?\/>/g) ?? [];
    expect(gradients).toHaveLength(2);
    for (const gradient of gradients) expect(gradient).toContain('pointerEvents="none"');
  });

  test("generic presses stay silent until a semantic action confirms feedback", () => {
    expect(pressableSource).toContain('haptic = "none"');
    expect(productCardSource).not.toContain('haptic="primary"');
    expect(welcomeSource).not.toContain('haptic="primary"');
    expect(tabBarSource).toContain("select();");
  });

  test("the shared error boundary is also a valid Expo Router screen", () => {
    expect(errorRouteSource).toContain("export function ErrorBoundary");
    expect(errorRouteSource).toContain("export default function ErrorRoute");
    expect(errorRouteSource).toContain('router.replace("/")');
  });

  test("the infinite Spark animation follows system motion and cancels on cleanup", () => {
    expect(exploreSource).toContain("ReduceMotion.System");
    expect(exploreSource).toContain("cancelAnimation(spin)");
  });

  test("opening and closing the board use the complete filter reset", () => {
    expect(exploreSource).toMatch(
      /accessibilityLabel="Close collections board"[\s\S]{0,300}setExpanded\(false\);\s*clearFilters\(\);/,
    );
    expect(exploreSource).toMatch(
      /<SparkButton[\s\S]{0,300}setExpanded\(true\);\s*clearFilters\(\);/,
    );
    expect(exploreSource).toMatch(
      /const clearFilters = \(\) => \{[\s\S]{0,180}setMaxPriceInput\(""\);/,
    );
  });

  test("Stylist style choices stay interactive and scope the next request", () => {
    const styleControls = stylistSource.slice(
      stylistSource.indexOf("STYLE · OPTIONAL"),
      stylistSource.indexOf("STYLE GOAL · OPTIONAL"),
    );
    expect(styleControls).toContain("onPress={() => setStyle");
    expect(styleControls).not.toContain("disabled={loading}");
    expect(stylistSource).toMatch(/api\.recommend\(\{[\s\S]{0,180}style: style \|\| undefined/);
  });
});
