#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : "";
  if (!value || value.startsWith("--")) throw new Error(`Missing required option --${name}`);
  return value;
}

const output = option("output");
const recordsDir = option("records-dir");
const deployLog = `${recordsDir}/eas-deploy.log`;
const promotionLog = `${recordsDir}/eas-promotion.log`;
const verification = `${recordsDir}/verification-evidence.json`;
const deployText = existsSync(deployLog) ? readFileSync(deployLog, "utf8") : "";
const deploymentId =
  deployText.match(/https:\/\/[a-z0-9-]+--([a-z0-9]+)\.expo\.app\/?/i)?.[1] ?? null;

writeFileSync(
  output,
  `${JSON.stringify(
    {
      schema_version: 1,
      failed: true,
      source_sha: process.env.SOURCE_WORKFLOW_HEAD_SHA ?? null,
      checked_out_sha: process.env.CHECKED_OUT_SHA ?? null,
      source_workflow_run_id: process.env.SOURCE_WORKFLOW_RUN_ID ?? null,
      deployment_id: deploymentId,
      production_promotion_attempted: existsSync(promotionLog),
      artifacts: {
        deploy_log: existsSync(deployLog),
        promotion_log: existsSync(promotionLog),
        verification_evidence: existsSync(verification),
      },
      note: "Release failed closed; production alias promotion is only attempted after immutable verification succeeds.",
    },
    null,
    2,
  )}\n`,
  "utf8",
);
