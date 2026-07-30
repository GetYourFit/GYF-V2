#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const PRODUCTION_URL = "https://get-your-fit.expo.app";
const EAS_CLI_VERSION = "21.4.0";
const SCHEMA_VERSION = 2;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, name) {
  if (!options[name]) throw new Error(`Missing required option --${name}`);
  return options[name];
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function extractEntryHash(entryBundle) {
  const match = /^entry-([a-f0-9]+)\.js$/.exec(basename(entryBundle));
  if (!match) throw new Error(`Cannot derive entry hash from ${entryBundle}`);
  return match[1];
}

function parseDeployment(logText) {
  if (/promoted deployment to production/i.test(logText)) {
    throw new Error("The immutable deployment log must not contain a production promotion");
  }
  const urlMatches = [...logText.matchAll(/https:\/\/[a-z0-9-]+--([a-z0-9]+)\.expo\.app\/?/gi)];
  if (urlMatches.length === 0) {
    throw new Error("Could not extract immutable EAS deployment URL from deploy output");
  }
  const match = urlMatches.at(-1);
  return { deploymentId: match[1], deploymentUrl: match[0] };
}

function requirePromotion(logText, deploymentId) {
  if (!/promoted deployment to production/i.test(logText)) {
    throw new Error("Promotion output does not confirm promotion to production");
  }
  return {
    confirmed: true,
    deployment_id: deploymentId,
    output_sha256: createHash("sha256").update(logText).digest("hex"),
  };
}

function buildRollbackCommand(deploymentId) {
  return `npm exec --yes eas-cli@${EAS_CLI_VERSION} -- deploy:alias --prod --non-interactive --id=${deploymentId}`;
}

function validateVerificationEvidence(evidence, deployment, sourceSha) {
  if (evidence.production_url !== PRODUCTION_URL) {
    throw new Error(
      `Verification evidence has unexpected production URL: ${evidence.production_url}`,
    );
  }
  if (evidence.expected_source_sha !== sourceSha) {
    throw new Error("Verification evidence source SHA does not match the checked-out source");
  }
  if (
    evidence.expected_deployment_id !== deployment.deploymentId ||
    evidence.live_deployment_id !== deployment.deploymentId
  ) {
    throw new Error("Verification evidence deployment ID does not match deploy output");
  }
  if (
    evidence.expected_deployment_url !== deployment.deploymentUrl ||
    evidence.live_deployment_url !== deployment.deploymentUrl
  ) {
    throw new Error("Verification evidence deployment URL does not match deploy output");
  }
  if (evidence.live_entry_bundle !== evidence.expected_entry_bundle) {
    throw new Error(
      "Verification evidence does not prove the immutable deployment served the exported entry bundle",
    );
  }
  if (evidence.expected_entry_hash !== extractEntryHash(evidence.expected_entry_bundle)) {
    throw new Error("Verification evidence entry hash does not match the exported entry bundle");
  }
  if (evidence.promoted_to_production !== true || evidence.promotion_attempted !== true) {
    throw new Error(
      "Successful rollback record requires post-verification production promotion evidence",
    );
  }
  if (evidence.api_surface?.release_sha !== sourceSha) {
    throw new Error("Verification evidence API release identity does not match the source SHA");
  }
  if (evidence.deployment_identity?.release_sha !== sourceSha) {
    throw new Error(
      "Verification evidence immutable deployment identity does not match the source SHA",
    );
  }
  if (evidence.cuelinks?.export?.valid !== true || evidence.cuelinks?.immutable?.valid !== true) {
    throw new Error(
      "Verification evidence is missing exact Cuelinks export and immutable deployment proof",
    );
  }
}

function validateRecord(record) {
  const requiredTopLevel = [
    "schema_version",
    "verified_at",
    "commit",
    "workflow",
    "deployment",
    "production_alias",
    "bundle",
    "headers",
    "api",
    "promotion",
    "verification",
  ];
  for (const field of requiredTopLevel) {
    if (!(field in record)) throw new Error(`Rollback record missing required field: ${field}`);
  }
  if (record.schema_version !== SCHEMA_VERSION)
    throw new Error(`Unexpected schema version: ${record.schema_version}`);
  if (!record.verified_at) throw new Error("Rollback record is missing verification timestamp");
  if (
    !SHA_PATTERN.test(record.commit.sha) ||
    !SHA_PATTERN.test(record.commit.source_workflow_sha)
  ) {
    throw new Error("Rollback record commit identity is not a full SHA");
  }
  if (record.commit.sha !== record.commit.source_workflow_sha) {
    throw new Error("Rollback record commit does not match the source workflow SHA");
  }
  if (!record.workflow.run_id || !record.workflow.source_run_id) {
    throw new Error("Rollback record is missing workflow run identity");
  }
  if (
    record.deployment.id !== record.verification.expected_deployment_id ||
    record.deployment.id !== record.verification.live_deployment_id
  ) {
    throw new Error("Rollback record deployment ID is not bound to verified immutable evidence");
  }
  if (
    record.deployment.url !== record.verification.expected_deployment_url ||
    record.deployment.url !== record.verification.live_deployment_url
  ) {
    throw new Error("Rollback record deployment URL is not bound to verified immutable evidence");
  }
  if (record.bundle.entry_hash !== extractEntryHash(record.bundle.entry_bundle)) {
    throw new Error("Rollback record entry hash does not match entry bundle");
  }
  if (record.api.release_sha !== record.commit.sha)
    throw new Error("Rollback record API release SHA is not the source SHA");
  if (
    record.promotion.deployment_id !== record.deployment.id ||
    record.promotion.confirmed !== true
  ) {
    throw new Error("Rollback record promotion is not bound to the exact deployment ID");
  }
  if (record.deployment.rollback_command !== buildRollbackCommand(record.deployment.id)) {
    throw new Error("Rollback command is not bound to the exact deployment ID");
  }
}

function markdownSummary(record) {
  return [
    "## Expo verified release record",
    "",
    `- Deployment ID: \`${record.deployment.id}\``,
    `- Deployment URL: ${record.deployment.url}`,
    `- Production alias: ${record.production_alias}`,
    `- Source/API SHA: \`${record.commit.sha}\``,
    `- Workflow run: \`${record.workflow.run_id}\` (source run ${record.workflow.source_run_id})`,
    `- Entry hash: \`${record.bundle.entry_hash}\``,
    `- Verified at: ${record.verified_at}`,
    `- Alias probe: ${record.verification.alias_probe?.reachable ? `reachable (${record.verification.alias_probe.entryBundle ?? "unknown"})` : "inconclusive (best effort)"}`,
    `- Rollback command: \`${record.deployment.rollback_command}\``,
    "",
  ].join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const deployLogPath = requireOption(options, "deploy-log");
  const promotionLogPath = requireOption(options, "promotion-log");
  const verificationEvidencePath = requireOption(options, "verification-evidence");
  const artifactOutputPath = requireOption(options, "artifact-output");
  const summaryOutputPath = requireOption(options, "summary-output");
  const deployment = parseDeployment(readFileSync(deployLogPath, "utf8"));
  const sourceWorkflowSha = process.env.SOURCE_WORKFLOW_HEAD_SHA ?? "";
  const checkedOutSha = process.env.CHECKED_OUT_SHA ?? "";
  if (!SHA_PATTERN.test(sourceWorkflowSha) || !SHA_PATTERN.test(checkedOutSha)) {
    throw new Error("Deployment provenance is missing a full source or checked-out SHA");
  }
  if (sourceWorkflowSha !== checkedOutSha)
    throw new Error("Checked-out commit does not match the source workflow SHA");
  const verification = readJson(verificationEvidencePath);
  validateVerificationEvidence(verification, deployment, checkedOutSha);
  const promotion = requirePromotion(
    readFileSync(promotionLogPath, "utf8"),
    deployment.deploymentId,
  );
  const record = {
    schema_version: SCHEMA_VERSION,
    verified_at: verification.verified_at,
    commit: { sha: checkedOutSha, source_workflow_sha: sourceWorkflowSha },
    workflow: {
      run_id: process.env.GITHUB_RUN_ID ?? "",
      run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
      source_run_id: process.env.SOURCE_WORKFLOW_RUN_ID ?? "",
    },
    deployment: {
      id: deployment.deploymentId,
      url: deployment.deploymentUrl,
      rollback_command: buildRollbackCommand(deployment.deploymentId),
    },
    production_alias: PRODUCTION_URL,
    bundle: {
      entry_bundle: verification.expected_entry_bundle,
      entry_hash: extractEntryHash(verification.expected_entry_bundle),
    },
    headers: verification.headers,
    api: {
      base_url: verification.api_surface.base_url,
      release_sha: verification.api_surface.release_sha,
    },
    promotion,
    verification,
  };
  validateRecord(record);
  writeFileSync(artifactOutputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  writeFileSync(summaryOutputPath, markdownSummary(record), "utf8");
}

main();
