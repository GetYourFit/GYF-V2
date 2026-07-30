#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";

const recordsDir = process.argv[process.argv.indexOf("--records-dir") + 1];
const output = process.argv[process.argv.indexOf("--output") + 1];
if (!recordsDir || !output)
  throw new Error("capture-render-failure-diagnostic requires --records-dir and --output");
const diagnostic = {
  schema_version: 1,
  provider: "render-static",
  captured_at: new Date().toISOString(),
  source_sha: process.env.CHECKED_OUT_SHA || null,
  workflow_run_id: process.env.SOURCE_WORKFLOW_RUN_ID || null,
  candidate_service_id: process.env.RENDER_CANDIDATE_SERVICE_ID || null,
  production_service_id: process.env.RENDER_PRODUCTION_SERVICE_ID || null,
  candidate_url: process.env.RENDER_CANDIDATE_URL || null,
  production_url: process.env.RENDER_PRODUCTION_URL || null,
  production_deploy_attempted: existsSync(`${recordsDir}/render-production-deploy.json`),
  records: [
    "render-candidate-deploy.json",
    "render-candidate-verification.json",
    "render-production-deploy.json",
    "render-production-verification.json",
    "render-previous-deploys.json",
  ].filter((name) => existsSync(`${recordsDir}/${name}`)),
  note: "Render release failed closed. The production service is not deployed unless candidate HTTP, identity, API, Cuelinks and browser-independent route checks pass first.",
};
writeFileSync(output, `${JSON.stringify(diagnostic, null, 2)}\n`, "utf8");
console.log(`capture-render-failure-diagnostic: ${output}`);
