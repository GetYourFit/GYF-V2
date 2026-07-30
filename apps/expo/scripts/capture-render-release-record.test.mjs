import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, execFile } from "node:child_process";
import assert from "node:assert/strict";
import test from "node:test";

const SHA = "a".repeat(40);
function fixture(root, stage) {
  return {
    verified: true,
    verification_stage: stage,
    expected_source_sha: SHA,
    expected_entry_bundle: "entry-0123456789abcdef.js",
    expected_entry_hash: "0123456789abcdef",
    service_id: `${stage}-service`,
    deploy_id: `${stage}-deploy`,
    deployment_url: `https://${stage}.onrender.com`,
    static: {
      verified_at: "2026-07-30T00:00:00.000Z",
      headers: { "x-frame-options": "DENY" },
      deployment_identity: { source_sha: SHA },
      cache_freshness: { proven: true },
    },
    api: { release_sha: SHA },
    cuelinks: { static: { valid: true } },
  };
}
function writeFixture(root, name, value) {
  const path = join(root, name);
  writeFileSync(path, JSON.stringify(value));
  return path;
}
function browserFixture(stage) {
  return {
    verified: true,
    stage,
    surfaces: ["/welcome", "/terms", "/contact", "/grievance"].map((path) => ({
      path,
      rendered: true,
      client_ready: true,
    })),
  };
}

test("Render release record binds source/API/entry/header/Cuelinks and exact rollback command", () => {
  const root = mkdtempSync(join(tmpdir(), "render-release-record-"));
  const candidate = writeFixture(root, "candidate.json", fixture(root, "candidate"));
  const production = writeFixture(root, "production.json", fixture(root, "production"));
  const canonical = writeFixture(root, "canonical.json", fixture(root, "canonical"));
  const candidateDeploy = writeFixture(root, "candidate-deploy.json", { id: "candidate-deploy" });
  const productionDeploy = writeFixture(root, "production-deploy.json", {
    id: "production-deploy",
  });
  const previous = writeFixture(root, "previous.json", [{ id: "old-deploy", status: "live" }]);
  const candidateBrowser = writeFixture(
    root,
    "candidate-browser.json",
    browserFixture("candidate"),
  );
  const productionBrowser = writeFixture(
    root,
    "production-browser.json",
    browserFixture("production"),
  );
  const canonicalBrowser = writeFixture(
    root,
    "canonical-browser.json",
    browserFixture("canonical"),
  );
  const output = join(root, "record.json");
  const summary = join(root, "summary.md");
  execFileSync(
    process.execPath,
    [
      "apps/expo/scripts/capture-render-release-record.mjs",
      "--source-sha",
      SHA,
      "--workflow-run-id",
      "123",
      "--candidate-deploy",
      candidateDeploy,
      "--production-deploy",
      productionDeploy,
      "--previous-deploys",
      previous,
      "--candidate-verification",
      candidate,
      "--production-verification",
      production,
      "--canonical-verification",
      canonical,
      "--candidate-browser-verification",
      candidateBrowser,
      "--production-browser-verification",
      productionBrowser,
      "--canonical-browser-verification",
      canonicalBrowser,
      "--production-service-id",
      "prod-service",
      "--output",
      output,
      "--summary-output",
      summary,
    ],
    { cwd: new URL("../../..", import.meta.url), stdio: "pipe" },
  );
  const record = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(record.source.sha, SHA);
  assert.equal(record.candidate.entry_hash, "0123456789abcdef");
  assert.equal(record.candidate.browser_surfaces.length, 4);
  assert.equal(record.api?.release_sha, undefined);
  assert.match(record.rollback.command, /services\/prod-service\/rollback/);
  assert.match(record.rollback.command, /old-deploy/);
});

test("Render release record rejects candidate evidence that was not verified", async () => {
  const root = mkdtempSync(join(tmpdir(), "render-release-record-fail-"));
  const candidate = fixture(root, "candidate");
  candidate.verified = false;
  const production = fixture(root, "production");
  const files = [
    writeFixture(root, "candidate.json", candidate),
    writeFixture(root, "production.json", production),
    writeFixture(root, "canonical.json", fixture(root, "canonical")),
    writeFixture(root, "candidate-deploy.json", { id: "candidate-deploy" }),
    writeFixture(root, "production-deploy.json", { id: "production-deploy" }),
    writeFixture(root, "previous.json", [{ id: "old-deploy", status: "live" }]),
    writeFixture(root, "candidate-browser.json", browserFixture("candidate")),
    writeFixture(root, "production-browser.json", browserFixture("production")),
    writeFixture(root, "canonical-browser.json", browserFixture("canonical")),
  ];
  const output = join(root, "record.json");
  const script = "apps/expo/scripts/capture-render-release-record.mjs";
  const childArgs = [
    script,
    "--source-sha",
    SHA,
    "--workflow-run-id",
    "123",
    "--candidate-deploy",
    files[3],
    "--production-deploy",
    files[4],
    "--previous-deploys",
    files[5],
    "--candidate-verification",
    files[0],
    "--production-verification",
    files[1],
    "--canonical-verification",
    files[2],
    "--candidate-browser-verification",
    files[6],
    "--production-browser-verification",
    files[7],
    "--canonical-browser-verification",
    files[8],
    "--production-service-id",
    "prod-service",
    "--output",
    output,
    "--summary-output",
    join(root, "summary.md"),
  ];
  const error = await new Promise((resolve) => {
    execFile(
      process.execPath,
      childArgs,
      { cwd: new URL("../../..", import.meta.url) },
      (failure) => resolve(failure),
    );
  });
  assert.ok(error);
  assert.match(String(error.message), /pre-promotion proof/);
});
