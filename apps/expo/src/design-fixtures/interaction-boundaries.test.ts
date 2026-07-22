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
const itemDetailSource = await Bun.file(
  new URL("../components/explore/item-detail-sheet.tsx", import.meta.url),
).text();
const pressableSource = await Bun.file(
  new URL("../components/ui/pressable-scale.tsx", import.meta.url),
).text();
const productCardSource = await Bun.file(
  new URL("../components/ui/product-card.tsx", import.meta.url),
).text();
const welcomeSource = await Bun.file(new URL("../app/(auth)/welcome.tsx", import.meta.url)).text();
const errorRouteSource = await Bun.file(new URL("../app/error.tsx", import.meta.url)).text();
const gyfMarkSource = await Bun.file(
  new URL("../components/explore/animated-gyf-mark.tsx", import.meta.url),
).text();
const rootLayoutSource = await Bun.file(new URL("../app/_layout.tsx", import.meta.url)).text();

describe("Expo interaction boundaries", () => {
  test("decorative tab-bar gradients cannot intercept web clicks", () => {
    expect(tabBarSource).toContain("<GlassSurface");
    const gradients = glassSurfaceSource.match(/<LinearGradient[\s\S]*?\/>/g) ?? [];
    expect(gradients).toHaveLength(2);
    for (const gradient of gradients) expect(gradient).toContain('pointerEvents="none"');
  });

  test("shared material recipes do not scatter colour literals", () => {
    expect(glassSurfaceSource).not.toContain("rgba(");
    expect(itemDetailSource).not.toContain("rgba(");
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

  test("the root layout re-exports the shared error boundary so a crash never renders blank", () => {
    // Expo Router only catches a segment's render errors when that segment's own file
    // exports `ErrorBoundary` — a boundary that lives solely in app/error.tsx (its own
    // routed screen) never wraps the root layout. Without this, any uncaught render
    // exception in RootLayout or its children unmounts the whole tree to nothing.
    expect(rootLayoutSource).toMatch(/export\s*\{\s*ErrorBoundary\s*\}\s*from\s*["']\.\/error["']/);
  });

  test("the GYF mark turns continuously, honors system motion, and cancels on cleanup", () => {
    // The mark is the app's one piece of ambient motion, by owner decision: it
    // turns wherever it appears rather than signalling that work is in flight.
    expect(gyfMarkSource).toContain("withRepeat");
    expect(gyfMarkSource).not.toContain("active");
    // Ambient does not mean unconditional — a viewer who asks the OS for less
    // motion still gets a still mark, and the loop must not outlive the view.
    expect(gyfMarkSource).toContain("ReduceMotion.System");
    expect(gyfMarkSource).toContain("cancelAnimation(spin)");
  });

  test("the mark's dots are not rotationally symmetric, or the spin is invisible", () => {
    // Six identical dots at 60° spacing reproduce themselves exactly under a
    // 60° turn, so a perfectly working animation renders pixel-identical to a
    // still image. The mark looked frozen for exactly this reason. Whatever
    // varies around the ring, something must.
    expect(gyfMarkSource).toMatch(/opacity: 1 - \(i \/ 6\)|fillOpacity=\{dot\.opacity\}/);
    expect(gyfMarkSource).toContain("fillOpacity");
  });

  test("opening and closing the board use the complete filter reset", () => {
    expect(exploreSource).toMatch(
      /accessibilityLabel="Close collections board"[\s\S]{0,300}setExpanded\(false\);\s*clearFilters\(\);/,
    );
    expect(exploreSource).toMatch(
      /onPressMark=\{\(\) => \{\s*setExpanded\(true\);\s*clearFilters\(\);/,
    );
    expect(exploreSource).toMatch(
      /const clearFilters = \(\) => \{[\s\S]{0,180}setMaxPriceInput\(""\);/,
    );
  });

  test("Stylist style choices stay interactive and scope the next request", () => {
    // Anchored on the filter rows themselves, not on visible label copy — the
    // uppercase headings they used to bracket are gone from the design.
    const styleControls = stylistSource.slice(
      stylistSource.indexOf('label="Style, optional"'),
      stylistSource.indexOf('accessibilityLabel="Styling goal'),
    );
    expect(styleControls.length).toBeGreaterThan(0);
    expect(styleControls).toContain("onPress={() => setStyle");
    expect(styleControls).not.toContain("disabled={loading}");
    expect(stylistSource).toMatch(/api\.recommend\(\{[\s\S]{0,180}style: style \|\| undefined/);
  });
});
