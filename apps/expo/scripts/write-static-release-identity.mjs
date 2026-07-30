#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
  return value;
}

const dist = resolve(option("dist", join(import.meta.dirname, "..", "dist")));
const output = resolve(option("output", join(dist, "__deployment", "api.json")));
const sourceSha = process.env.EXPO_PUBLIC_RELEASE_SHA || process.env.RENDER_GIT_COMMIT || "";
if (!/^[0-9a-f]{40}$/.test(sourceSha)) {
  throw new Error(
    "write-static-release-identity: EXPO_PUBLIC_RELEASE_SHA or RENDER_GIT_COMMIT must be a 40-character SHA",
  );
}

const bundleDirectories = [
  join(dist, "client", "_expo", "static", "js", "web"),
  join(dist, "_expo", "static", "js", "web"),
];
const bundleDirectory = bundleDirectories.find((candidate) => existsSync(candidate));
if (!bundleDirectory)
  throw new Error("write-static-release-identity: no exported web bundle found");
const entry = readdirSync(bundleDirectory).find((file) => /^entry-[a-f0-9]+\.js$/.test(file));
if (!entry) throw new Error("write-static-release-identity: no entry bundle found");
const entryBytes = readFileSync(join(bundleDirectory, entry));
const indexPath = join(dist, "index.html");
if (!existsSync(indexPath))
  throw new Error("write-static-release-identity: dist/index.html is missing");
const indexBytes = readFileSync(indexPath);
const entryHash = /^entry-([a-f0-9]+)\.js$/.exec(entry)?.[1];
const identity = {
  schema_version: 1,
  provider: "render-static",
  source_sha: sourceSha,
  release_sha: sourceSha,
  entry_bundle: entry,
  entry_hash: entryHash,
  entry_sha256: createHash("sha256").update(entryBytes).digest("hex"),
  index_sha256: createHash("sha256").update(indexBytes).digest("hex"),
  service_id: process.env.RENDER_SERVICE_ID || null,
  built_at: new Date().toISOString(),
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(identity, null, 2)}\n`, "utf8");
console.log(`write-static-release-identity: ${output} -> ${entry} (${sourceSha})`);
