import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const REQUIRED_HEADERS = {
  "content-security-policy": "frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};
const SOURCE_SHA = "221d3df5c3cf05c7a31439b9cfbfc3885882c335";
const DEPLOYMENT_ID = "or1170q9ix";
const SCRIPT_PATH = new URL("./verify-deploy.mjs", import.meta.url).pathname;
const execFileAsync = promisify(execFile);

function withFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "verify-deploy-"));
  const bundleDir = join(root, "dist", "client", "_expo", "static", "js", "web");
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, "entry-deadbeef.js"), "console.log('ok');\n", "utf8");
  writeFileSync(
    join(root, "cuelinks.json"),
    JSON.stringify({ cid: "305057", valid: true }),
    "utf8",
  );
  return root;
}

function writeDeployLog(root, { promoted = false } = {}) {
  writeFileSync(
    join(root, "deploy-log.txt"),
    [
      "Creating deployment",
      `Deployment URL  https://get-your-fit--${DEPLOYMENT_ID}.expo.app`,
      promoted ? "Promoted deployment to production." : "",
      "",
    ].join("\n"),
    "utf8",
  );
}

function writePromotionLog(root) {
  writeFileSync(join(root, "promotion-log.txt"), "Promoted deployment to production.\n", "utf8");
}

async function withServer(handler, callback) {
  const instance = createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const address = instance.address();
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    instance.closeAllConnections();
    instance.close();
    instance.unref();
  }
}

const loader = `<script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="305057">var cId =  "305057";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());</script>`;

function correctHandler(request, response) {
  if (request.url.startsWith("/__deployment")) {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ release_sha: SOURCE_SHA, deployment_id: DEPLOYMENT_ID }));
    return;
  }
  if (request.url.startsWith("/health")) {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ status: "ok", service: "api" }));
    return;
  }
  if (request.url.startsWith("/ready")) {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ status: "ready", checks: { database: true } }));
    return;
  }
  if (request.url.startsWith("/system/status")) {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        environment: "test",
        database: "ready",
        capabilities: {},
        event_sink: "test",
        release_sha: SOURCE_SHA,
      }),
    );
    return;
  }
  for (const [name, value] of Object.entries(REQUIRED_HEADERS)) response.setHeader(name, value);
  response.setHeader("content-type", "text/html");
  response.end(
    `<!doctype html>${loader}<script src="/_expo/static/js/web/entry-deadbeef.js"></script>`,
  );
}

function staleApiHandler(request, response) {
  if (request.url.startsWith("/system/status")) {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        environment: "test",
        database: "ready",
        capabilities: {},
        event_sink: "test",
        release_sha: "b".repeat(40),
      }),
    );
    return;
  }
  correctHandler(request, response);
}

function missingHeaderHandler(request, response) {
  for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
    if (name !== "x-frame-options") response.setHeader(name, value);
  }
  response.setHeader("content-type", "text/html");
  response.end(
    `<!doctype html>${loader}<script src="/_expo/static/js/web/entry-deadbeef.js"></script>`,
  );
}

async function run(root, serverUrl, extra = {}) {
  const args = [
    SCRIPT_PATH,
    "--deploy-log",
    join(root, "deploy-log.txt"),
    "--deployment-url",
    serverUrl,
    "--api-url",
    serverUrl,
    "--production-url",
    "http://127.0.0.1:1",
    "--expected-source-sha",
    SOURCE_SHA,
    "--cuelinks-evidence",
    join(root, "cuelinks.json"),
    "--attempts",
    "1",
    ...Object.entries(extra).flatMap(([name, value]) => [`--${name}`, value]),
  ];
  return execFileAsync(process.execPath, args, { cwd: root });
}

async function testSucceedsBeforeAndAfterPromotion() {
  await withServer(correctHandler, async (serverUrl) => {
    const root = withFixtureRoot();
    try {
      writeDeployLog(root);
      const evidenceFile = join(root, "verification-evidence.json");
      await run(root, serverUrl, { "evidence-file": evidenceFile });
      const before = JSON.parse(readFileSync(evidenceFile, "utf8"));
      assert.equal(before.promoted_to_production, false);
      assert.equal(before.verification_stage, "immutable-before-promotion");
      assert.equal(before.expected_entry_hash, "deadbeef");
      assert.equal(before.api_surface.release_sha, SOURCE_SHA);
      assert.equal(before.deployment_identity.deployment_id, DEPLOYMENT_ID);

      writePromotionLog(root);
      await run(root, serverUrl, {
        "promotion-log": join(root, "promotion-log.txt"),
        "evidence-file": evidenceFile,
      });
      const after = JSON.parse(readFileSync(evidenceFile, "utf8"));
      assert.equal(after.promoted_to_production, true);
      assert.equal(after.verification_stage, "post-promotion");
      assert.equal(after.cuelinks.immutable.valid, true);
      assert.equal(after.headers["x-frame-options"], "DENY");
      assert.equal(after.alias_probe.reachable, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

async function testFailsWhenApiIdentityIsStale() {
  await withServer(staleApiHandler, async (serverUrl) => {
    const root = withFixtureRoot();
    try {
      writeDeployLog(root);
      await assert.rejects(run(root, serverUrl), (error) => {
        assert.match(error.stderr, /API release SHA/);
        return true;
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

async function testFailsBeforePromotionWhenHeaderMissing() {
  await withServer(missingHeaderHandler, async (serverUrl) => {
    const root = withFixtureRoot();
    try {
      writeDeployLog(root);
      await assert.rejects(run(root, serverUrl), (error) => {
        assert.match(error.stderr, /required security headers/);
        assert.match(error.stderr, /x-frame-options/);
        return true;
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

async function testRejectsAlreadyPromotedDeployLog() {
  const root = withFixtureRoot();
  try {
    writeDeployLog(root, { promoted: true });
    await assert.rejects(run(root, "http://127.0.0.1:1"), (error) => {
      assert.match(error.stderr, /must run before promotion/);
      return true;
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

try {
  await testSucceedsBeforeAndAfterPromotion();
  await testFailsWhenApiIdentityIsStale();
  await testFailsBeforePromotionWhenHeaderMissing();
  await testRejectsAlreadyPromotedDeployLog();
  console.log("verify-deploy tests passed");
} catch (error) {
  console.error(error);
  process.exit(1);
}
