#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) throw new Error(`Missing required option --${name}`);
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
  return value;
}
function json(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function deployId(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(deployId).find(Boolean) ?? null;
  if (typeof value !== "object") return null;
  return value.id ?? value.deployId ?? value.deploy_id ?? value.deploy?.id ?? null;
}
function successfulDeploys(value) {
  const values = Array.isArray(value) ? value : (value?.deploys ?? value?.data ?? []);
  return values.filter((deploy) =>
    ["live", "success", "succeeded"].includes(
      String(deploy.status ?? deploy.state ?? "").toLowerCase(),
    ),
  );
}
function rollbackCommand(serviceId, deploy) {
  return `curl --fail --request POST "https://api.render.com/v1/services/${serviceId}/rollback" --header "Authorization: Bearer $RENDER_API_KEY" --header "Content-Type: application/json" --data '${JSON.stringify({ deployId: deploy })}'`;
}

const sourceSha = option("source-sha");
if (!/^[0-9a-f]{40}$/.test(sourceSha))
  throw new Error("Source SHA must be a 40-character hexadecimal commit");
const candidate = json(option("candidate-verification"));
const production = json(option("production-verification"));
const candidateDeploy = json(option("candidate-deploy"));
const productionDeploy = json(option("production-deploy"));
const previousDeploys = json(option("previous-deploys"));
const productionServiceId = option("production-service-id");
if (candidate.verified !== true || candidate.verification_stage !== "candidate")
  throw new Error("Candidate verification is not a successful pre-promotion proof");
if (production.verified !== true || production.verification_stage !== "production")
  throw new Error("Production verification is not a successful post-promotion proof");
if (candidate.expected_source_sha !== sourceSha || production.expected_source_sha !== sourceSha)
  throw new Error("Verification evidence does not bind the source SHA");
if (candidate.api.release_sha !== sourceSha || production.api.release_sha !== sourceSha)
  throw new Error("Verification evidence does not bind the API release SHA");
if (candidate.expected_entry_hash !== production.expected_entry_hash)
  throw new Error("Candidate and production entry hashes differ");
if (!candidate.cuelinks?.static?.valid || !production.cuelinks?.static?.valid)
  throw new Error("Cuelinks proof is missing from candidate or production evidence");
const candidateDeployId = deployId(candidateDeploy) ?? candidate.deploy_id;
const productionDeployId = deployId(productionDeploy) ?? production.deploy_id;
if (!candidateDeployId || !productionDeployId)
  throw new Error("Render deploy responses are missing deploy IDs");
const previous = successfulDeploys(previousDeploys)
  .map(deployId)
  .find((id) => id && id !== productionDeployId);
if (!previous)
  throw new Error("No retained successful production deploy was captured for rollback");
const now = new Date().toISOString();
const record = {
  schema_version: 1,
  provider: "render-static",
  recorded_at: now,
  source: { sha: sourceSha, workflow_run_id: option("workflow-run-id") },
  candidate: {
    service_id: candidate.service_id,
    deploy_id: candidateDeployId,
    url: candidate.deployment_url,
    verified_at: candidate.static.verified_at,
    entry_bundle: candidate.expected_entry_bundle,
    entry_hash: candidate.expected_entry_hash,
    headers: candidate.static.headers,
    identity: candidate.static.deployment_identity,
    api_release_sha: candidate.api.release_sha,
    cuelinks: candidate.cuelinks,
  },
  production: {
    service_id: production.service_id,
    deploy_id: productionDeployId,
    url: production.deployment_url,
    verified_at: production.static.verified_at,
    entry_bundle: production.expected_entry_bundle,
    entry_hash: production.expected_entry_hash,
    headers: production.static.headers,
    identity: production.static.deployment_identity,
    api_release_sha: production.api.release_sha,
    cuelinks: production.cuelinks,
  },
  promotion: {
    method: "Render production-service deploy after candidate proof",
    candidate_verified_before_production_deploy: true,
    production_deploy_id: productionDeployId,
  },
  rollback: {
    retained_previous_deploy_id: previous,
    command: rollbackCommand(productionServiceId, previous),
    limitation:
      "Render has no immutable per-deploy public URL for static sites. The isolated candidate service URL and deploy ID are retained; production rollback reuses the retained build artifact through the Render API.",
  },
  cache_freshness: {
    candidate: candidate.static.cache_freshness,
    production: production.static.cache_freshness,
  },
};
writeFileSync(option("output"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
const summary = option("summary-output");
writeFileSync(
  summary,
  `# Render Static release\n\n- Source/API SHA: \`${sourceSha}\`\n- Candidate service/deploy: \`${candidate.service_id}/${candidateDeployId}\`\n- Production service/deploy: \`${production.service_id}/${productionDeployId}\`\n- Entry bundle/hash: \`${record.production.entry_bundle}\` / \`${record.production.entry_hash}\`\n- Candidate verified before production deploy: **yes**\n- Required response headers: **verified on HTML, entry asset, identity, API and error probes**\n- Cuelinks: **verified in export and live HTML**\n- Rollback command: ${record.rollback.command}\n- Render limitation: ${record.rollback.limitation}\n- Recorded: ${now}\n`,
  "utf8",
);
console.log(`capture-render-release-record: recorded ${sourceSha}; rollback target ${previous}`);
