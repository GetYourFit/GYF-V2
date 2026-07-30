#!/usr/bin/env node
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("Usage: eas-deployment-id.mjs <eas-deploy.log>");
const log = readFileSync(path, "utf8");
if (/promoted deployment to production/i.test(log)) {
  throw new Error("Cannot extract a promotable deployment from a log that already promoted it");
}
const matches = [...log.matchAll(/https:\/\/[a-z0-9-]+--([a-z0-9]+)\.expo\.app\/?/gi)];
if (matches.length === 0) throw new Error("EAS deploy log has no immutable deployment URL");
process.stdout.write(`${matches.at(-1)[1]}\n`);
