import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("rejects env overrides that diverge from the fixed public web snippet id", () => {
    expect(readCuelinksWebConfig({ EXPO_PUBLIC_CUELINKS_CID: " 305057 " })).toEqual({
      cid: "305057",
      source: "default",
    });
    expect(() => readCuelinksWebConfig({ EXPO_PUBLIC_CUELINKS_CID: "274785" })).toThrow(
      /fixed to 305057/,
    );
  });

  it("keeps the captain-provided EXPO snippet literal inside the idempotent wrapper", () => {
    expect(buildCuelinksWebLoaderScript("305057")).toBe(
      `if (!window.__gyfCuelinksWebLoaderInstalled) {
  window.__gyfCuelinksWebLoaderInstalled = true;
  var cId =  "305057";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());
}`,
    );
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

  it("stays idempotent across repeated execution at hydration or navigation boundaries", () => {
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
    const runtime = { document } as { document: typeof document; window?: unknown };
    runtime.window = runtime;
    const execute = new Function("window", "document", buildCuelinksWebLoaderScript("305057"));

    execute(runtime, document);
    execute(runtime, document);

    expect(appended).toHaveLength(1);
    expect(appended[0]?.src).toBe("https://cdn0.cuelinks.com/js/cuelinksv2.js");
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

  it("rejects unmarked duplicate executable loaders in export verification", async () => {
    const distDir = mkdtempSync(join(tmpdir(), "gyf-cuelinks-export-"));
    const nestedDir = join(distDir, "nested");
    const verifierPath = new URL("../../scripts/verify-cuelinks-web-export.mjs", import.meta.url);
    const loader = buildCuelinksWebLoaderScript("305057");

    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(
      join(distDir, "index.html"),
      `<html><body><script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="305057">${loader}</script><script>var cId =  "305057";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());</script></body></html>`,
    );
    writeFileSync(
      join(nestedDir, "page.html"),
      `<html><body><script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="305057">${loader}</script></body></html>`,
    );

    const result = Bun.spawnSync(["node", verifierPath.pathname, distDir], {
      cwd: join(new URL("../..", import.meta.url).pathname),
      env: process.env,
      stderr: "pipe",
      stdout: "pipe",
    });

    rmSync(distDir, { recursive: true, force: true });

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("invalid loader");
  });
});
