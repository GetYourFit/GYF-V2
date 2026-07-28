#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST_DIR = join(import.meta.dirname, "..", "dist");
const cid = process.env.EXPO_PUBLIC_CUELINKS_CID?.trim() || "305057";
const loader = `var cId =  "${cid}";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());`;

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
  });
}

const failures = [];
for (const path of htmlFiles(DIST_DIR)) {
  const html = readFileSync(path, "utf8");
  const loaderMatches = html.match(/id="gyf-cuelinks-web-loader"/g) ?? [];
  const exactLoader = `<script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="${cid}">${loader}</script>`;

  if (loaderMatches.length !== 1 || !html.includes(exactLoader)) {
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
