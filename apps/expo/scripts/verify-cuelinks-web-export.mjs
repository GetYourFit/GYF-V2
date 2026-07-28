#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const DIST_DIR = process.argv[2]
  ? isAbsolute(process.argv[2])
    ? process.argv[2]
    : join(process.cwd(), process.argv[2])
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
const loader = `if (!window.__gyfCuelinksWebLoaderInstalled) {
  window.__gyfCuelinksWebLoaderInstalled = true;
  ${vendorLoader.split("\n").join("\n  ")}
}`;
const executableLoaderPattern =
  /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const executableSdkReferencePattern =
  /<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*cuelinksv2\.js(?:\?[^"']*)?["'])(?![^>]*\btype\s*=\s*["']application\/(?:json|ld\+json)["'])[^>]*>\s*<\/script>/gi;
const exactLoader = `<script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="${cid}">${loader}</script>`;

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
if (!existsSync(DIST_DIR)) {
  console.error(`verify-cuelinks-web-export: dist directory not found at ${DIST_DIR}`);
  process.exit(1);
}

for (const path of htmlFiles(DIST_DIR)) {
  const html = readFileSync(path, "utf8");
  const exactLoaderCount = html.split(exactLoader).length - 1;
  const inlineLoaderCount = countExecutableInlineLoaders(html);
  const sdkReferenceCount = (html.match(executableSdkReferencePattern) ?? []).length;
  const totalExecutableLoaderCount = inlineLoaderCount + sdkReferenceCount;

  if (exactLoaderCount !== 1 || totalExecutableLoaderCount !== 1) {
    failures.push(path);
  }
}

if (failures.length > 0) {
  console.error(`verify-cuelinks-web-export: invalid loader in ${failures.join(", ")}`);
  process.exit(1);
}

console.log(
  "verify-cuelinks-web-export: each static page has one exact executable Cuelinks loader.",
);
