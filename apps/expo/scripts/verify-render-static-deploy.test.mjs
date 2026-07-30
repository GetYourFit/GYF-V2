import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { verifyRenderStatic, REQUIRED_HEADERS } from "./verify-render-static-deploy.mjs";

const SHA = "a".repeat(40);
const ENTRY = "entry-0123456789abcdef.js";
const ENTRY_BYTES = Buffer.from("candidate entry bundle");
const LOADER = `<script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="305057">var cId =  "305057";\n\n(function(d, t) {\n  var s = document.createElement("script");\n  s.type = "text/javascript";\n  s.async = true;\n  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";\n  document.getElementsByTagName("body")[0].appendChild(s);\n}());</script>`;
const headers = {
  ...Object.fromEntries(Object.entries(REQUIRED_HEADERS).map(([name, value]) => [name, value])),
};
const identity = {
  schema_version: 1,
  provider: "render-static",
  source_sha: SHA,
  release_sha: SHA,
  entry_bundle: ENTRY,
  entry_hash: "0123456789abcdef",
};

function fixtureServer({ missingHeader, wrongApiSha, cacheIdentity = "no-store" } = {}) {
  return createServer((request, response) => {
    const path = new URL(request.url, "http://localhost").pathname;
    const outputHeaders = { ...headers };
    if (missingHeader) delete outputHeaders[missingHeader];
    Object.assign(outputHeaders, {
      "cache-control":
        path === "/__deployment/api" || path === "/__deployment/api.json"
          ? cacheIdentity
          : "no-cache",
    });
    for (const [name, value] of Object.entries(outputHeaders)) response.setHeader(name, value);
    if (path === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(
        `<html><body>${LOADER}<script src="/_expo/static/js/web/${ENTRY}"></script></body></html>`,
      );
    } else if (path === `/_expo/static/js/web/${ENTRY}`) {
      response.writeHead(200, { "content-type": "application/javascript" });
      response.end(ENTRY_BYTES);
    } else if (path === "/__deployment/api" || path === "/__deployment/api.json") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(identity));
    } else if (path === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok", service: "api" }));
    } else if (path === "/ready") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ready", checks: { database: true } }));
    } else if (path === "/system/status") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          environment: "production",
          database: "ready",
          capabilities: {},
          event_sink: "postgres",
          release_sha: wrongApiSha ?? SHA,
        }),
      );
    } else {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("missing");
    }
  });
}

async function withServer(options, fn) {
  const server = fixtureServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const records = mkdtempSync(join(tmpdir(), "render-static-verifier-"));
  const cuelinks = join(records, "cuelinks.json");
  writeFileSync(cuelinks, JSON.stringify({ cid: "305057", valid: true }));
  try {
    return await fn(url, cuelinks);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function options(url, cuelinks, extra = {}) {
  return {
    "deployment-url": url,
    "api-url": url,
    "expected-source-sha": SHA,
    "expected-entry-bundle": ENTRY,
    "expected-entry-hash": identity.entry_hash,
    "expected-entry-sha256": createHash("sha256").update(ENTRY_BYTES).digest("hex"),
    "cuelinks-evidence": cuelinks,
    attempts: 1,
    "interval-ms": 1,
    ...extra,
  };
}

test("Render verifier proves candidate HTTP boundary, identity, API, Cuelinks, errors and cache freshness", async () => {
  await withServer({}, async (url, cuelinks) => {
    const evidence = await verifyRenderStatic(options(url, cuelinks));
    assert.equal(evidence.verified, true);
    assert.equal(evidence.verification_stage, "candidate");
    assert.equal(evidence.api.release_sha, SHA);
    assert.equal(evidence.static.cuelinks.static.valid, true);
    assert.equal(evidence.static.cache_freshness.proven, true);
    assert.equal(evidence.static.error_headers["x-frame-options"], "DENY");
    assert.equal(evidence.static.identity_json_headers["x-content-type-options"], "nosniff");
  });
});

test("Render verifier rejects a missing security header on the actual static response", async () => {
  await withServer({ missingHeader: "x-frame-options" }, async (url, cuelinks) => {
    await assert.rejects(
      verifyRenderStatic(options(url, cuelinks)),
      /missing required security headers/,
    );
  });
});

test("Render verifier rejects stale identity, API SHA, and cacheable release identity", async () => {
  await withServer({ wrongApiSha: "b".repeat(40) }, async (url, cuelinks) => {
    await assert.rejects(verifyRenderStatic(options(url, cuelinks)), /API release SHA/);
  });
  await withServer({ cacheIdentity: "public, max-age=3600" }, async (url, cuelinks) => {
    await assert.rejects(verifyRenderStatic(options(url, cuelinks)), /cacheable/);
  });
});

test("Render CLI installation is noninteractive and isolated from the repository root", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/cd.yml", import.meta.url),
    "utf8",
  );
  const installStart = workflow.indexOf("- name: Install Render CLI 2.7.0");
  const installEnd = workflow.indexOf("- name: Configure Render Static headers", installStart);
  assert.ok(installStart >= 0 && installEnd > installStart);
  const installStep = workflow.slice(installStart, installEnd);
  assert.match(installStep, /render_cli_tmp=\$\(mktemp -d\)/);
  assert.match(installStep, /unzip -q "\$render_cli_tmp\/render-cli\.zip" -d "\$render_cli_tmp"/);
  assert.doesNotMatch(installStep, /unzip -q render-cli\.zip/);
  assert.match(
    installStep,
    /sudo install -m 755 "\$render_cli_tmp\/cli_v2\.7\.0" \/usr\/local\/bin\/render/,
  );
});

test("CD orders candidate verification before the Render production deploy and retains rollback evidence", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/cd.yml", import.meta.url),
    "utf8",
  );
  const candidateVerify = workflow.indexOf("Verify candidate before any production deploy");
  const productionDeploy = workflow.indexOf(
    'render deploys create "$RENDER_PRODUCTION_SERVICE_ID"',
  );
  const capture = workflow.indexOf("Capture Render provenance and rollback contract");
  assert.ok(candidateVerify >= 0 && candidateVerify < productionDeploy);
  assert.ok(productionDeploy < capture);
  assert.match(workflow, /render-static-failed-release/);
  const recordScript = readFileSync(
    new URL("./capture-render-release-record.mjs", import.meta.url),
    "utf8",
  );
  assert.match(recordScript, /services\/\$\{serviceId\}\/rollback/);
});
