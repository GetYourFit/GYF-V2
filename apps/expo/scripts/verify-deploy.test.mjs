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

async function withFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), "verify-deploy-"));
  try {
    const bundleDir = join(root, "dist", "client", "_expo", "static", "js", "web");
    mkdirSync(bundleDir, { recursive: true });
    writeFileSync(join(bundleDir, "entry-deadbeef.js"), "console.log('ok');\n", "utf8");
    writeFileSync(
      join(root, "deploy-log.txt"),
      [
        "Published deployment:",
        "https://get-your-fit--or1170q9ix.expo.app/",
        "Promoted deployment to production.",
        "",
      ].join("\n"),
      "utf8",
    );
    await callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function runScenario(deploymentId, expectSuccess) {
  const server = await new Promise((resolve) => {
    const instance = createServer((request, response) => {
      for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
        response.setHeader(name, value);
      }
      if (request.url.startsWith("/__deployment")) {
        response.setHeader("content-type", "application/json");
        response.end(
          JSON.stringify({
            requestUrl: `https://get-your-fit--${deploymentId}.expo.app/__deployment`,
            origin: "https://get-your-fit.expo.app",
            forwardedHost: "get-your-fit.expo.app",
            environment: null,
          }),
        );
        return;
      }
      response.setHeader("content-type", "text/html");
      response.end("<!doctype html><script src=\"/_expo/static/js/web/entry-deadbeef.js\"></script>");
    });
    instance.listen(0, "127.0.0.1", () => {
      const address = instance.address();
      resolve({
        close: async () => {
          instance.closeAllConnections();
          instance.close();
          instance.unref();
        },
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });

  try {
    await withFixture(async (root) => {
      const evidenceFile = join(root, "verification-evidence.json");
      const args = [
          SCRIPT_PATH,
          "--production-url",
          server.url,
          "--deploy-log",
          join(root, "deploy-log.txt"),
          "--attempts",
          "1",
          "--evidence-file",
          evidenceFile,
        ];

      if (!expectSuccess) {
        await assert.rejects(
          execFileAsync(process.execPath, args, { cwd: root }),
          (error) => {
            assert.match(error.stderr, /wanted ID: or1170q9ix/);
            assert.match(error.stderr, new RegExp(`live ID:\\s+${deploymentId}`));
            return true;
          },
        );
        return;
      }

      await execFileAsync(process.execPath, args, { cwd: root });
      const evidence = JSON.parse(readFileSync(evidenceFile, "utf8"));
      assert.equal(evidence.live_deployment_id, deploymentId);
      assert.equal(evidence.live_deployment_url, `https://get-your-fit--${deploymentId}.expo.app/`);
      assert.equal(evidence.expected_entry_bundle, "entry-deadbeef.js");
    });
  } finally {
    await server.close();
  }
}

try {
  await runScenario("oldprod1", false);
  await runScenario("or1170q9ix", true);
  console.log("verify-deploy tests passed");
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
