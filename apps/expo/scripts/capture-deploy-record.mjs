#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
const PRODUCTION_URL = "https://get-your-fit.expo.app";
const SCHEMA_VERSION = 1;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }
    options[name] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, name) {
  const value = options[name];
  if (!value) {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function localEntryBundle(verificationEvidencePath) {
  const evidence = readJson(verificationEvidencePath);
  if (typeof evidence.expected_entry_bundle !== "string" || evidence.expected_entry_bundle.length === 0) {
    throw new Error("Verification evidence is missing expected_entry_bundle");
  }
  return evidence.expected_entry_bundle;
}

function extractEntryHash(entryBundle) {
  const match = /^entry-([a-f0-9]+)\.js$/.exec(basename(entryBundle));
  if (!match) {
    throw new Error(`Cannot derive entry hash from ${entryBundle}`);
  }
  return match[1];
}

function parseDeployment(logText) {
  const urlMatches = [...logText.matchAll(/https:\/\/[a-z0-9-]+--([a-z0-9]+)\.expo\.app\/?/gi)];
  if (urlMatches.length === 0) {
    throw new Error("Could not extract immutable EAS deployment URL from deploy output");
  }
  const deploymentUrl = urlMatches.at(-1)[0];
  const deploymentId = urlMatches.at(-1)[1];
  if (!/^[a-z0-9]+$/i.test(deploymentId)) {
    throw new Error(`Invalid deployment ID extracted from deploy output: ${deploymentId}`);
  }
  return { deploymentId, deploymentUrl };
}

function buildRollbackCommand(deploymentId) {
  return `npm exec --yes eas-cli@latest -- deploy:alias --prod --non-interactive --id=${deploymentId}`;
}

function validateVerificationEvidence(evidence, deployment) {
  if (evidence.production_url !== PRODUCTION_URL) {
    throw new Error(`Verification evidence has unexpected production URL: ${evidence.production_url}`);
  }
  if (evidence.expected_deployment_id !== deployment.deploymentId) {
    throw new Error("Verification evidence deployment ID does not match deploy output");
  }
  if (evidence.expected_deployment_url !== deployment.deploymentUrl) {
    throw new Error("Verification evidence deployment URL does not match deploy output");
  }
  if (evidence.live_entry_bundle !== evidence.expected_entry_bundle) {
    throw new Error("Verification evidence does not prove production served the exported entry bundle");
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
    "verification",
  ];
  for (const field of requiredTopLevel) {
    if (!(field in record)) {
      throw new Error(`Rollback record missing required field: ${field}`);
    }
  }
  if (record.schema_version !== SCHEMA_VERSION) {
    throw new Error(`Unexpected schema version: ${record.schema_version}`);
  }
  if (!record.verified_at) {
    throw new Error("Rollback record is missing verification timestamp");
  }
  if (!record.commit.sha || !record.commit.source_workflow_sha) {
    throw new Error("Rollback record is missing commit identity");
  }
  if (!record.workflow.run_id || !record.workflow.source_run_id) {
    throw new Error("Rollback record is missing workflow run identity");
  }
  if (record.deployment.id !== record.verification.expected_deployment_id) {
    throw new Error("Rollback record deployment ID is not bound to verification evidence");
  }
  if (record.deployment.url !== record.verification.expected_deployment_url) {
    throw new Error("Rollback record deployment URL is not bound to verification evidence");
  }
  if (record.bundle.entry_hash !== extractEntryHash(record.bundle.entry_bundle)) {
    throw new Error("Rollback record entry hash does not match entry bundle");
  }
  const rollbackCommand = buildRollbackCommand(record.deployment.id);
  if (record.deployment.rollback_command !== rollbackCommand) {
    throw new Error("Rollback command is not bound to the exact deployment ID");
  }
}

function markdownSummary(record) {
  return [
    "## Expo rollback record",
    "",
    `- Deployment ID: \`${record.deployment.id}\``,
    `- Deployment URL: ${record.deployment.url}`,
    `- Production alias: ${record.production_alias}`,
    `- Commit: \`${record.commit.sha}\``,
    `- Workflow run: \`${record.workflow.run_id}\``,
    `- Entry hash: \`${record.bundle.entry_hash}\``,
    `- Verified at: ${record.verified_at}`,
    `- Rollback command: \`${record.deployment.rollback_command}\``,
    "",
  ].join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const deployLogPath = requireOption(options, "deploy-log");
  const verificationEvidencePath = requireOption(options, "verification-evidence");
  const artifactOutputPath = requireOption(options, "artifact-output");
  const summaryOutputPath = requireOption(options, "summary-output");

  const deployment = parseDeployment(readFileSync(deployLogPath, "utf8"));
  const verification = readJson(verificationEvidencePath);
  validateVerificationEvidence(verification, deployment);

  const entryBundle = localEntryBundle(verificationEvidencePath);
  const record = {
    schema_version: SCHEMA_VERSION,
    verified_at: verification.verified_at,
    commit: {
      sha: process.env.GITHUB_SHA ?? "",
      source_workflow_sha: process.env.SOURCE_WORKFLOW_HEAD_SHA ?? "",
    },
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
      entry_bundle: entryBundle,
      entry_hash: extractEntryHash(entryBundle),
    },
    headers: verification.headers,
    verification,
  };
  validateRecord(record);
  writeFileSync(artifactOutputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  writeFileSync(summaryOutputPath, markdownSummary(record), "utf8");
}

main();
