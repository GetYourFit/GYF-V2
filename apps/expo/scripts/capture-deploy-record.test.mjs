import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

function withFixture(callback) {
  const root = mkdtempSync(join(tmpdir(), "capture-deploy-record-"));
  try {
    const deployRecords = join(root, "deploy-records");
    mkdirSync(deployRecords, { recursive: true });
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
    writeFileSync(
      join(deployRecords, "verification-evidence.json"),
      JSON.stringify(
        {
          verified_at: "2026-07-28T12:34:56.000Z",
          production_url: "https://get-your-fit.expo.app",
          expected_entry_bundle: "entry-deadbeef.js",
          live_entry_bundle: "entry-deadbeef.js",
          live_deployment_id: "or1170q9ix",
          live_deployment_url: "https://get-your-fit--or1170q9ix.expo.app/",
          expected_deployment_id: "or1170q9ix",
          expected_deployment_url: "https://get-your-fit--or1170q9ix.expo.app/",
          alias_request_url: "https://get-your-fit--or1170q9ix.expo.app/__deployment?deploy-check=1",
          alias_origin: "https://get-your-fit.expo.app",
          alias_forwarded_host: "get-your-fit.expo.app",
          headers: {
            "content-security-policy": "frame-ancestors 'none'",
            "cross-origin-opener-policy": "same-origin",
            "referrer-policy": "strict-origin-when-cross-origin",
            "x-content-type-options": "nosniff",
            "x-frame-options": "DENY",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("capture-deploy-record binds rollback metadata to the exact deployment ID", () => {
  withFixture((root) => {
    const artifactOutput = join(root, "rollback-record.json");
    const summaryOutput = join(root, "rollback-record-summary.md");
    const result = spawnSync(
      process.execPath,
      [
        "scripts/capture-deploy-record.mjs",
        "--deploy-log",
        join(root, "deploy-log.txt"),
        "--verification-evidence",
        join(root, "deploy-records", "verification-evidence.json"),
        "--artifact-output",
        artifactOutput,
        "--summary-output",
        summaryOutput,
      ],
      {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          GITHUB_SHA: "221d3df5c3cf05c7a31439b9cfbfc3885882c335",
          GITHUB_RUN_ID: "12345",
          GITHUB_RUN_ATTEMPT: "2",
          SOURCE_WORKFLOW_RUN_ID: "67890",
          SOURCE_WORKFLOW_HEAD_SHA: "221d3df5c3cf05c7a31439b9cfbfc3885882c335",
        },
      },
    );

    assert.equal(result.status, 0, result.stderr.toString());

    const artifact = JSON.parse(readFileSync(artifactOutput, "utf8"));
    assert.equal(artifact.deployment.id, "or1170q9ix");
    assert.equal(
      artifact.deployment.rollback_command,
      "npm exec --yes eas-cli@latest -- deploy:alias --prod --non-interactive --id=or1170q9ix",
    );
    assert.equal(artifact.bundle.entry_hash, "deadbeef");
    assert.match(readFileSync(summaryOutput, "utf8"), /Deployment ID: `or1170q9ix`/);
  });
});

test("capture-deploy-record fails when verification evidence is not bound to the exact deployment ID", () => {
  withFixture((root) => {
    const evidencePath = join(root, "deploy-records", "verification-evidence.json");
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    evidence.expected_deployment_id = "wrong123";
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        "scripts/capture-deploy-record.mjs",
        "--deploy-log",
        join(root, "deploy-log.txt"),
        "--verification-evidence",
        evidencePath,
        "--artifact-output",
        join(root, "rollback-record.json"),
        "--summary-output",
        join(root, "rollback-record-summary.md"),
      ],
      { cwd: new URL("..", import.meta.url) },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr.toString(), /deployment ID does not match deploy output/);
  });
});

test("capture-deploy-record fails when the live alias deployment differs from the deploy output", () => {
  withFixture((root) => {
    const evidencePath = join(root, "deploy-records", "verification-evidence.json");
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    evidence.live_deployment_id = "oldprod1";
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

    const result = spawnSync(
      process.execPath,
      [
        "scripts/capture-deploy-record.mjs",
        "--deploy-log",
        join(root, "deploy-log.txt"),
        "--verification-evidence",
        evidencePath,
        "--artifact-output",
        join(root, "rollback-record.json"),
        "--summary-output",
        join(root, "rollback-record-summary.md"),
      ],
      { cwd: new URL("..", import.meta.url) },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr.toString(), /live deployment ID does not match deploy output/);
  });
});
