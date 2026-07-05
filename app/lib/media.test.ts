import { describe, expect, it } from "vitest";

import { mediaSrcSet, mediaUrl } from "./media";

const SHOPIFY = "https://cdn.shopify.com/s/files/1/x/photo.jpg";

describe("mediaUrl", () => {
  it("appends a width param to Shopify CDN urls", () => {
    expect(mediaUrl(SHOPIFY, 400)).toBe(`${SHOPIFY}?width=400`);
    expect(mediaUrl(`${SHOPIFY}?v=1`, 400)).toBe(`${SHOPIFY}?v=1&width=400`);
  });

  it("never double-appends width", () => {
    expect(mediaUrl(`${SHOPIFY}?width=200`, 400)).toBe(`${SHOPIFY}?width=200`);
  });

  it("passes through non-Shopify absolute urls and resolves relative paths", () => {
    expect(mediaUrl("https://example.com/a.jpg", 400)).toBe("https://example.com/a.jpg");
    expect(mediaUrl("/media/a.jpg")).toMatch(/\/media\/a\.jpg$/);
    expect(mediaUrl(null)).toBeNull();
  });
});

describe("mediaSrcSet", () => {
  it("emits 1x/2x for resizable urls, undefined otherwise", () => {
    expect(mediaSrcSet(SHOPIFY, 400)).toBe(`${SHOPIFY}?width=400 1x, ${SHOPIFY}?width=800 2x`);
    expect(mediaSrcSet("https://example.com/a.jpg", 400)).toBeUndefined();
    expect(mediaSrcSet(`${SHOPIFY}?width=200`, 400)).toBeUndefined();
    expect(mediaSrcSet(null, 400)).toBeUndefined();
  });
});
