import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

const ROOT = new URL("..", import.meta.url);

test("first Render failure writes a diagnostic when records directory does not exist", () => {
  const root = mkdtempSync(join(tmpdir(), "render-failure-diagnostic-"));
  try {
    const recordsDir = join(root, "first-failure", "records");
    const output = join(recordsDir, "render-failed-deployment-diagnostic.json");
    execFileSync(
      process.execPath,
      [
        "scripts/capture-render-failure-diagnostic.mjs",
        "--records-dir",
        recordsDir,
        "--output",
        output,
      ],
      { cwd: ROOT, env: { ...process.env, CHECKED_OUT_SHA: "a".repeat(40) }, stdio: "pipe" },
    );

    assert.equal(existsSync(recordsDir), true);
    const diagnostic = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(diagnostic.failed ?? true, true);
    assert.equal(diagnostic.production_deploy_attempted, false);
    assert.deepEqual(diagnostic.records, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
