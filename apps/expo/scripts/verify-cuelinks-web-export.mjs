#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

const args = process.argv.slice(2);
const evidenceIndex = args.indexOf("--evidence-file");
const evidenceFile = evidenceIndex >= 0 ? args[evidenceIndex + 1] : null;
if (evidenceIndex >= 0 && (!evidenceFile || evidenceFile.startsWith("--"))) {
  console.error("verify-cuelinks-web-export: missing value for --evidence-file");
  process.exit(1);
}
const positional =
  evidenceIndex >= 0
    ? args.filter((_, index) => index !== evidenceIndex && index !== evidenceIndex + 1)
    : args;
const DIST_DIR = positional[0]
  ? isAbsolute(positional[0])
    ? positional[0]
    : join(process.cwd(), positional[0])
  : join(import.meta.dirname, "..", "dist");
const cid = "305057";
const vendorLoader = `var cId =  "${cid}";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());`;
const executableLoaderPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const executableSdkReferencePattern =
  /<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*cuelinksv2\.js(?:\?[^"']*)?["'])(?![^>]*\btype\s*=\s*["']application\/(?:json|ld\+json)["'])[^>]*>\s*<\/script>/gi;
const exactLoader = `<script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="${cid}">${vendorLoader}</script>`;

function countExecutableInlineLoaders(html) {
  let count = 0;
  for (const match of html.matchAll(executableLoaderPattern)) {
    const [fullMatch, body] = match;
    if (/type\s*=\s*["']application\/(?:json|ld\+json)["']/i.test(fullMatch)) continue;
    if (body.includes(vendorLoader)) count += 1;
  }
  return count;
}

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  });
}

const failures = [];
const files = [];
if (!existsSync(DIST_DIR)) {
  console.error(`verify-cuelinks-web-export: dist directory not found at ${DIST_DIR}`);
  process.exit(1);
}

for (const path of htmlFiles(DIST_DIR)) {
  const html = readFileSync(path, "utf8");
  const exactLoaderCount = html.split(exactLoader).length - 1;
  const inlineLoaderCount = countExecutableInlineLoaders(html);
  const sdkReferenceCount = (html.match(executableSdkReferencePattern) ?? []).length;
  const valid = exactLoaderCount === 1 && inlineLoaderCount + sdkReferenceCount === 1;
  files.push({
    path: relative(DIST_DIR, path),
    sha256: createHash("sha256").update(html).digest("hex"),
    exact_loader_count: exactLoaderCount,
    executable_loader_count: inlineLoaderCount + sdkReferenceCount,
    valid,
  });
  if (!valid) failures.push(path);
}

if (files.length === 0) {
  console.error(`verify-cuelinks-web-export: no HTML files found in ${DIST_DIR}`);
  process.exit(1);
}

if (failures.length > 0) {
  console.error(`verify-cuelinks-web-export: invalid loader in ${failures.join(", ")}`);
  process.exit(1);
}

if (evidenceFile) {
  writeFileSync(
    evidenceFile,
    `${JSON.stringify(
      {
        schema_version: 1,
        verified_at: new Date().toISOString(),
        cid,
        loader_sha256: createHash("sha256").update(exactLoader).digest("hex"),
        valid: true,
        files,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

console.log(
  "verify-cuelinks-web-export: each static page has one exact executable Cuelinks loader.",
);
