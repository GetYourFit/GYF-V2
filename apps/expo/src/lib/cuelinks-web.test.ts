import { readFileSync } from "node:fs";
import { URL } from "node:url";

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

  it("emits the captain-provided EXPO snippet exactly", () => {
    expect(buildCuelinksWebLoaderScript("305057")).toBe(`var cId =  "305057";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());`);
  });

  it("loads one HTTPS SDK script when the static loader executes", () => {
    const appended: { type?: string; async?: boolean; src?: string }[] = [];
    const document = {
      location: { protocol: "https:" },
      createElement: () => ({}) as { type?: string; async?: boolean; src?: string },
      getElementsByTagName: () => [
        {
          appendChild: (script: { type?: string; async?: boolean; src?: string }) =>
            appended.push(script),
        },
      ],
    };

    new Function("document", buildCuelinksWebLoaderScript("305057"))(document);

    expect(appended).toEqual([
      {
        type: "text/javascript",
        async: true,
        src: "https://cdn0.cuelinks.com/js/cuelinksv2.js",
      },
    ]);
  });

  it("keeps the protocol-specific Cuelinks CDN URL explicit and detectable", () => {
    expect(cuelinksScriptUrlForProtocol("https:")).toBe(
      "https://cdn0.cuelinks.com/js/cuelinksv2.js",
    );
    expect(cuelinksScriptUrlForProtocol("http:")).toBe("http://cdn0.cuelinks.com/js/cuelinksv2.js");
  });

  it("is wired once into Expo's web-only document hook, not the native root layout", () => {
    const htmlHook = readFileSync(new URL("../app/+html.tsx", import.meta.url), "utf8");
    const rootLayout = readFileSync(new URL("../app/_layout.tsx", import.meta.url), "utf8");

    expect(htmlHook).toContain("buildCuelinksWebLoaderScript");
    expect(htmlHook.match(/id="gyf-cuelinks-web-loader"/g)).toHaveLength(1);
    expect(htmlHook).toContain('name="gyf-cuelinks-web-cid"');
    expect(htmlHook).toContain("data-cuelinks-cid={cuelinksWebConfig.cid}");
    expect(rootLayout).not.toContain("cuelinks-web");
  });
});
