import { describe, expect, test } from "bun:test";

import { webImageStyle } from "../../lib/expo-image-web-style";
import { isRemoteImage } from "./catalog-image-url";

const source = await Bun.file(new URL("./catalog-image.tsx", import.meta.url)).text();
const masonrySource = await Bun.file(new URL("./masonry-feed.tsx", import.meta.url)).text();
const webAdapterSource = await Bun.file(
  new URL("../../lib/expo-image-web.tsx", import.meta.url),
).text();

describe("CatalogImage", () => {
  test("accepts only HTTPS catalogue images", () => {
    expect(isRemoteImage("https://cdn.example.com/item.jpg")).toBe(true);
    expect(isRemoteImage("http://cdn.example.com/item.jpg")).toBe(false);
    expect(isRemoteImage("file:///private/photo.jpg")).toBe(false);
    expect(isRemoteImage(null)).toBe(false);
  });

  test("uses the shared Expo image cache and exposes retry after failure", () => {
    expect(source).toContain('from "expo-image"');
    expect(source).toContain('cachePolicy="disk"');
    expect(source).toContain("recyclingKey={recyclingKey}");
    expect(source).toContain("onError={() => setFailed(true)}");
    expect(source).toContain("Retry image");
  });

  test("preserves the requested crop position in the web adapter", () => {
    expect(source).toContain('contentPosition="top center"');
    expect(webAdapterSource).toContain("<img");
    expect(webImageStyle({ borderRadius: 12 }, "cover", "top center")).toEqual({
      borderRadius: 12,
      display: "block",
      objectFit: "cover",
      objectPosition: "top center",
    });
  });

  test("lets nested pressable tiles opt out of retry buttons on web", () => {
    expect(source).toContain("retryable = true");
    expect(source).toContain("return failed && retryable ? (");
    expect(masonrySource).toContain("retryable={false}");
  });
});
