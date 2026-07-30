import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url);
const SHA = "221d3df5c3cf05c7a31439b9cfbfc3885882c335";

function withFixture(callback, mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), "capture-deploy-record-"));
  try {
    const records = join(root, "records");
    mkdirSync(records, { recursive: true });
    writeFileSync(
      join(records, "deploy-log.txt"),
      `Published deployment:\nhttps://get-your-fit--or1170q9ix.expo.app/\n`,
      "utf8",
    );
    writeFileSync(
      join(records, "promotion-log.txt"),
      "Promoted deployment to production.\n",
      "utf8",
    );
    const evidence = {
      schema_version: 2,
      verified_at: "2026-07-30T12:34:56.000Z",
      production_url: "https://get-your-fit.expo.app",
      expected_source_sha: SHA,
      expected_entry_bundle: "entry-deadbeef.js",
      expected_entry_hash: "deadbeef",
      live_entry_bundle: "entry-deadbeef.js",
      live_deployment_id: "or1170q9ix",
      live_deployment_url: "https://get-your-fit--or1170q9ix.expo.app/",
      expected_deployment_id: "or1170q9ix",
      expected_deployment_url: "https://get-your-fit--or1170q9ix.expo.app/",
      promoted_to_production: true,
      promotion_attempted: true,
      promotion: { confirmed: true, deployment_id: "or1170q9ix" },
      headers: { "x-frame-options": "DENY" },
      cuelinks: { export: { valid: true }, immutable: { valid: true } },
      deployment_identity: { release_sha: SHA },
      api_surface: { base_url: "https://gyf-api-va.onrender.com", release_sha: SHA },
      alias_probe: { reachable: false, error: "edge cache" },
    };
    mutate(evidence);
    writeFileSync(
      join(records, "verification-evidence.json"),
      `${JSON.stringify(evidence)}\n`,
      "utf8",
    );
    callback(root, records);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function run(root, records, env = {}) {
  return spawnSync(
    process.execPath,
    [
      "scripts/capture-deploy-record.mjs",
      "--deploy-log",
      join(records, "deploy-log.txt"),
      "--promotion-log",
      join(records, "promotion-log.txt"),
      "--verification-evidence",
      join(records, "verification-evidence.json"),
      "--artifact-output",
      join(root, "rollback-record.json"),
      "--summary-output",
      join(root, "rollback-record-summary.md"),
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        GITHUB_RUN_ID: "12345",
        GITHUB_RUN_ATTEMPT: "2",
        SOURCE_WORKFLOW_RUN_ID: "67890",
        SOURCE_WORKFLOW_HEAD_SHA: SHA,
        CHECKED_OUT_SHA: SHA,
        ...env,
      },
    },
  );
}

test("capture-deploy-record binds source/API/deployment/entry provenance and rollback", () => {
  withFixture((root, records) => {
    const result = run(root, records);
    assert.equal(result.status, 0, result.stderr.toString());
    const artifact = JSON.parse(readFileSync(join(root, "rollback-record.json"), "utf8"));
    assert.equal(artifact.commit.sha, SHA);
    assert.equal(artifact.api.release_sha, SHA);
    assert.equal(artifact.deployment.id, "or1170q9ix");
    assert.equal(artifact.bundle.entry_hash, "deadbeef");
    assert.equal(artifact.promotion.confirmed, true);
    assert.match(readFileSync(join(root, "rollback-record-summary.md"), "utf8"), /Source\/API SHA/);
  });
});

test("capture-deploy-record rejects promotion evidence without exact API identity", () => {
  withFixture(
    (root, records) => {
      const result = run(root, records);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr.toString(), /API release identity/);
    },
    (evidence) => {
      evidence.api_surface.release_sha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    },
  );
});

test("capture-deploy-record rejects a missing promotion confirmation", () => {
  withFixture((root, records) => {
    writeFileSync(join(records, "promotion-log.txt"), "deployment created only\n", "utf8");
    const result = run(root, records);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr.toString(), /does not confirm promotion/);
  });
});

test("capture-deploy-record rejects missing checked-out SHA", () => {
  withFixture((root, records) => {
    const result = run(root, records, { CHECKED_OUT_SHA: "" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr.toString(), /missing a full source or checked-out SHA/);
  });
});
