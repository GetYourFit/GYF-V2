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
const SCRIPT_PATH = new URL("./verify-deploy.mjs", import.meta.url).pathname;
const execFileAsync = promisify(execFile);

function withFixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), "verify-deploy-"));
  const bundleDir = join(root, "dist", "client", "_expo", "static", "js", "web");
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, "entry-deadbeef.js"), "console.log('ok');\n", "utf8");
  return root;
}

function writeDeployLog(root, { deploymentId = "or1170q9ix", promoted = true } = {}) {
  writeFileSync(
    join(root, "deploy-log.txt"),
    [
      "Creating deployment",
      `Deployment URL  https://get-your-fit--${deploymentId}.expo.app`,
      "Production URL  https://get-your-fit.expo.app",
      promoted ? "Promoted deployment to production." : "",
      "",
    ].join("\n"),
    "utf8",
  );
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

function correctHandler(request, response) {
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
      }),
    );
    return;
  }
  for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
    response.setHeader(name, value);
  }
  response.setHeader("content-type", "text/html");
  response.end('<!doctype html><script src="/_expo/static/js/web/entry-deadbeef.js"></script>');
}

function notReadyHandler(request, response) {
  if (request.url.startsWith("/ready")) {
    response.statusCode = 503;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ status: "not_ready", checks: { database: false } }));
    return;
  }
  correctHandler(request, response);
}

function missingHeaderHandler(request, response) {
  // Simulates the real failure mode: an edge-cached response from before
  // security headers were configured - x-frame-options is absent.
  for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
    if (name === "x-frame-options") continue;
    response.setHeader(name, value);
  }
  response.setHeader("content-type", "text/html");
  response.end('<!doctype html><script src="/_expo/static/js/web/entry-deadbeef.js"></script>');
}

// The immutable deployment URL, correctly configured and freshly created
// (no cache to go stale), must verify successfully on the first attempt.
async function testSucceedsOnImmutableDeploymentUrl() {
  await withServer(correctHandler, async (serverUrl) => {
    const root = withFixtureRoot();
    try {
      writeDeployLog(root, { deploymentId: "or1170q9ix" });
      const evidenceFile = join(root, "verification-evidence.json");
      await execFileAsync(
        process.execPath,
        [
          SCRIPT_PATH,
          "--deploy-log",
          join(root, "deploy-log.txt"),
          "--deployment-url",
          serverUrl,
          "--api-url",
          serverUrl,
          "--production-url",
          "http://127.0.0.1:1",
          "--attempts",
          "1",
          "--evidence-file",
          evidenceFile,
        ],
        { cwd: root },
      );
      const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"));
      assert.equal(evidence.live_deployment_id, "or1170q9ix");
      assert.equal(evidence.expected_entry_bundle, "entry-deadbeef.js");
      assert.equal(evidence.live_entry_bundle, "entry-deadbeef.js");
      assert.equal(evidence.headers["x-frame-options"], "DENY");
      assert.equal(evidence.promoted_to_production, true);
      assert.equal(evidence.api_surface.base_url, new URL(serverUrl).origin);
      assert.equal(evidence.api_surface.probes["/ready"].content.checks.database, true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

async function testFailsWhenApiIsNotReady() {
  await withServer(notReadyHandler, async (serverUrl) => {
    const root = withFixtureRoot();
    try {
      writeDeployLog(root, { deploymentId: "or1170q9ix" });
      await assert.rejects(
        execFileAsync(
          process.execPath,
          [
            SCRIPT_PATH,
            "--deploy-log",
            join(root, "deploy-log.txt"),
            "--deployment-url",
            serverUrl,
            "--api-url",
            serverUrl,
            "--production-url",
            "http://127.0.0.1:1",
            "--attempts",
            "1",
          ],
          { cwd: root },
        ),
        (error) => {
          assert.match(error.stderr, /API \/ready returned 503/);
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

// If the immutable deployment URL is genuinely missing a required security
// header, verification must still fail - this proves the check has teeth,
// not just that it stopped fetching the flaky cached alias.
async function testFailsWhenHeaderTrulyMissing() {
  await withServer(missingHeaderHandler, async (serverUrl) => {
    const root = withFixtureRoot();
    try {
      writeDeployLog(root, { deploymentId: "or1170q9ix" });
      await assert.rejects(
        execFileAsync(
          process.execPath,
          [
            SCRIPT_PATH,
            "--deploy-log",
            join(root, "deploy-log.txt"),
            "--deployment-url",
            serverUrl,
            "--production-url",
            "http://127.0.0.1:1",
            "--attempts",
            "1",
            "--evidence-file",
            join(root, "verification-evidence.json"),
          ],
          { cwd: root },
        ),
        (error) => {
          assert.match(error.stderr, /missing required security headers/);
          assert.match(error.stderr, /x-frame-options/);
          return true;
        },
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

// A deploy log that never confirms promotion must fail fast, without ever
// depending on network access to an alias that might be edge-cached stale.
async function testFailsWhenLogDoesNotConfirmPromotion() {
  const root = withFixtureRoot();
  try {
    writeDeployLog(root, { deploymentId: "or1170q9ix", promoted: false });
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          SCRIPT_PATH,
          "--deploy-log",
          join(root, "deploy-log.txt"),
          "--attempts",
          "1",
          "--evidence-file",
          join(root, "verification-evidence.json"),
        ],
        { cwd: root },
      ),
      (error) => {
        assert.match(error.stderr, /does not confirm the deployment was promoted to production/);
        return true;
      },
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

try {
  await testSucceedsOnImmutableDeploymentUrl();
  await testFailsWhenApiIsNotReady();
  await testFailsWhenHeaderTrulyMissing();
  await testFailsWhenLogDoesNotConfirmPromotion();
  console.log("verify-deploy tests passed");
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
