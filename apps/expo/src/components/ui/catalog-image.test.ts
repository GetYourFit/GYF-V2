import { describe, expect, test } from "bun:test";

import { isRemoteImage } from "./catalog-image-url";

const source = await Bun.file(new URL("./catalog-image.tsx", import.meta.url)).text();

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
});
