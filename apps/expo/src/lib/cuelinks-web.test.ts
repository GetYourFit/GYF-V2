import { readFileSync } from "node:fs";

import { describe, expect, it } from "bun:test";

import {
  buildCuelinksWebLoaderScript,
  cuelinksScriptUrlForProtocol,
  readCuelinksWebConfig,
} from "./cuelinks-web";

describe("Cuelinks web loader", () => {
  it("defaults to the captain-provided public web snippet id", () => {
    expect(readCuelinksWebConfig({})).toEqual({ cid: "305057", source: "default" });
  });

  it("can be safely reconfigured without accepting secrets or script injection", () => {
    expect(readCuelinksWebConfig({ EXPO_PUBLIC_CUELINKS_CID: " 274785 " })).toEqual({
      cid: "274785",
      source: "configured",
    });
    expect(() => readCuelinksWebConfig({ EXPO_PUBLIC_CUELINKS_CID: "secret:abc" })).toThrow(
      /numeric/,
    );
  });

  it("proves the Expo web document hook loads cuelinksv2.js with the configured cId", () => {
    const script = buildCuelinksWebLoaderScript("305057");

    expect(script).toContain('var cId = "305057";');
    expect(script).toContain("cdn0.cuelinks.com/js/");
    expect(script).toContain('"cuelinksv2.js"');
    expect(script).toContain("data-gyf-cuelinks-web");
    expect(script).toContain('getElementsByTagName("body")[0].appendChild(s)');
  });

  it("keeps the protocol-specific Cuelinks CDN URL explicit and detectable", () => {
    expect(cuelinksScriptUrlForProtocol("https:")).toBe(
      "https://cdn0.cuelinks.com/js/cuelinksv2.js",
    );
    expect(cuelinksScriptUrlForProtocol("http:")).toBe("http://cdn0.cuelinks.com/js/cuelinksv2.js");
  });

  it("is wired into the Expo web document hook as a visible marker", () => {
    const htmlHook = readFileSync(new URL("../app/+html.tsx", import.meta.url), "utf8");

    expect(htmlHook).toContain("buildCuelinksWebLoaderScript");
    expect(htmlHook).toContain('id="gyf-cuelinks-web-loader"');
    expect(htmlHook).toContain('name="gyf-cuelinks-web-cid"');
    expect(htmlHook).toContain("data-cuelinks-cid={cuelinksWebConfig.cid}");
  });
});
