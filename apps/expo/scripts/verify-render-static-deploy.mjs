#!/usr/bin/env node
/** Verify a Render Static candidate or production service at its real HTTP boundary. */
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";

export const REQUIRED_HEADERS = {
  "content-security-policy": "frame-ancestors 'none'",
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};
const RELEASE_SHA = /^[0-9a-f]{40}$/;
const CUELINKS_CID = "305057";
const CUELINKS_VENDOR_LOADER = `var cId =  "${CUELINKS_CID}";

(function(d, t) {
  var s = document.createElement("script");
  s.type = "text/javascript";
  s.async = true;
  s.src = (document.location.protocol == "https:" ? "https://cdn0.cuelinks.com/js/" : "http://cdn0.cuelinks.com/js/")  + "cuelinksv2.js";
  document.getElementsByTagName("body")[0].appendChild(s);
}());`;
const CUELINKS_EXACT_LOADER = `<script id="gyf-cuelinks-web-loader" type="text/javascript" data-gyf-cuelinks-web="true" data-cuelinks-cid="${CUELINKS_CID}">${CUELINKS_VENDOR_LOADER}</script>`;
const CUELINKS_SDK_PATTERN =
  /<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*cuelinksv2\.js(?:\?[^"']*)?["'])(?![^>]*\btype\s*=\s*["']application\/(?:json|ld\+json)["'])[^>]*>\s*<\/script>/gi;

function args(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    result[key.slice(2)] = value;
  }
  return result;
}

function headers(response) {
  return Object.fromEntries(
    Object.keys(REQUIRED_HEADERS).map((name) => [name, response.headers.get(name)]),
  );
}

function missingHeaders(response) {
  return Object.entries(REQUIRED_HEADERS).filter(
    ([name, value]) => response.headers.get(name) !== value,
  );
}

function cuelinks(html) {
  const exactLoaderCount = html.split(CUELINKS_EXACT_LOADER).length - 1;
  const executableSdkReferenceCount = (html.match(CUELINKS_SDK_PATTERN) ?? []).length;
  return {
    cid: CUELINKS_CID,
    exact_loader_count: exactLoaderCount,
    executable_sdk_reference_count: executableSdkReferenceCount,
    valid: exactLoaderCount === 1 && exactLoaderCount + executableSdkReferenceCount === 1,
  };
}

function requireHttps(value, label) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error(`${label} must use HTTPS: ${value}`);
  }
  return parsed;
}

async function get(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function jsonResponse(response, label) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
  return body;
}

async function verifyStatic(baseUrl, expected, stage) {
  const cacheBust = `release-check=${Date.now()}`;
  const htmlResponse = await get(`${baseUrl}?${cacheBust}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!htmlResponse.ok) throw new Error(`${baseUrl} returned ${htmlResponse.status}`);
  const html = await htmlResponse.text();
  const htmlMissing = missingHeaders(htmlResponse);
  const entryBundle = html.match(/entry-[a-f0-9]+\.js/)?.[0] ?? null;
  if (entryBundle !== expected.entry_bundle)
    throw new Error(
      `HTML served ${entryBundle ?? "no entry bundle"}; expected ${expected.entry_bundle}`,
    );
  if (htmlMissing.length)
    throw new Error(`HTML is missing required security headers: ${JSON.stringify(htmlMissing)}`);
  const assetUrl = new URL(`/_expo/static/js/web/${entryBundle}`, baseUrl).toString();
  const assetResponse = await get(`${assetUrl}?${cacheBust}`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!assetResponse.ok) throw new Error(`entry asset returned ${assetResponse.status}`);
  const assetMissing = missingHeaders(assetResponse);
  if (assetMissing.length)
    throw new Error(
      `entry asset is missing required security headers: ${JSON.stringify(assetMissing)}`,
    );
  const assetHash = createHash("sha256")
    .update(Buffer.from(await assetResponse.arrayBuffer()))
    .digest("hex");
  if (expected.entry_sha256 && assetHash !== expected.entry_sha256)
    throw new Error(`entry asset SHA ${assetHash} does not match ${expected.entry_sha256}`);
  const identityUrl = new URL("/__deployment/api", baseUrl);
  const identityResponse = await get(`${identityUrl}?${cacheBust}`, {
    headers: { "cache-control": "no-cache", accept: "application/json" },
  });
  if (!identityResponse.ok)
    throw new Error(`deployment identity returned ${identityResponse.status}`);
  const identityMissing = missingHeaders(identityResponse);
  if (identityMissing.length)
    throw new Error(
      `deployment identity is missing required security headers: ${JSON.stringify(identityMissing)}`,
    );
  const identity = await jsonResponse(identityResponse, "deployment identity");
  const identityJsonResponse = await get(new URL(`/__deployment/api.json?${cacheBust}`, baseUrl), {
    headers: { "cache-control": "no-cache", accept: "application/json" },
  });
  if (!identityJsonResponse.ok)
    throw new Error(`deployment identity JSON returned ${identityJsonResponse.status}`);
  const identityJsonMissing = missingHeaders(identityJsonResponse);
  if (identityJsonMissing.length)
    throw new Error(
      `deployment identity JSON is missing required security headers: ${JSON.stringify(identityJsonMissing)}`,
    );
  const identityJson = await jsonResponse(identityJsonResponse, "deployment identity JSON");
  if (!isDeepStrictEqual(identity, identityJson))
    throw new Error("/__deployment/api does not match /__deployment/api.json");
  if (identity.source_sha !== expected.source_sha || identity.release_sha !== expected.source_sha)
    throw new Error(
      `static release identity ${identity.source_sha ?? "unknown"} does not match ${expected.source_sha}`,
    );
  if (
    identity.entry_bundle !== expected.entry_bundle ||
    identity.entry_hash !== expected.entry_hash
  )
    throw new Error("static release identity entry bundle does not match the exported candidate");
  if (!/no-store/i.test(identityResponse.headers.get("cache-control") ?? ""))
    throw new Error("deployment identity is cacheable; cache freshness cannot be proven");
  if (!/no-store/i.test(identityJsonResponse.headers.get("cache-control") ?? ""))
    throw new Error("deployment identity JSON is cacheable; cache freshness cannot be proven");
  const missingPath = new URL(`/render-verification-missing-${Date.now()}`, baseUrl);
  const errorResponse = await get(missingPath, { headers: { "cache-control": "no-cache" } });
  const errorMissing = missingHeaders(errorResponse);
  if (errorMissing.length)
    throw new Error(
      `error response is missing required security headers: ${JSON.stringify(errorMissing)}`,
    );
  if (errorResponse.status < 400)
    throw new Error(
      `missing-route probe returned ${errorResponse.status}; expected an actual error response`,
    );
  const liveCuelinks = cuelinks(html);
  if (!liveCuelinks.valid)
    throw new Error(`invalid live Cuelinks evidence: ${JSON.stringify(liveCuelinks)}`);
  return {
    stage,
    verified: true,
    verified_at: new Date().toISOString(),
    service_url: baseUrl,
    entry_bundle: entryBundle,
    entry_hash: expected.entry_hash,
    entry_sha256: assetHash,
    headers: headers(htmlResponse),
    asset_headers: headers(assetResponse),
    identity_headers: headers(identityResponse),
    identity_json_headers: headers(identityJsonResponse),
    error_headers: headers(errorResponse),
    cache_freshness: {
      identity_cache_control: identityResponse.headers.get("cache-control"),
      identity_json_cache_control: identityJsonResponse.headers.get("cache-control"),
      html_cache_control: htmlResponse.headers.get("cache-control"),
      identity_query: cacheBust,
      proven: true,
    },
    deployment_identity: identity,
    cuelinks: { export: expected.cuelinks, static: liveCuelinks },
  };
}

async function verifyApi(apiUrl, expectedSha) {
  const parsed = requireHttps(apiUrl, "API URL");
  const probes = ["/health", "/ready", "/system/status"];
  const results = {};
  for (const path of probes) {
    const response = await get(new URL(`${path}?release-check=${Date.now()}`, parsed), {
      headers: { "cache-control": "no-cache", accept: "application/json" },
    });
    if (!response.ok) throw new Error(`API ${path} returned ${response.status}`);
    const missing = missingHeaders(response);
    if (missing.length)
      throw new Error(
        `API ${path} is missing required security headers: ${JSON.stringify(missing)}`,
      );
    const body = await jsonResponse(response, `API ${path}`);
    results[path] = { status: response.status, headers: headers(response), body };
  }
  if (results["/system/status"].body.release_sha !== expectedSha)
    throw new Error(
      `API release SHA ${results["/system/status"].body.release_sha ?? "unknown"} does not match ${expectedSha}`,
    );
  return {
    base_url: parsed.origin,
    release_sha: results["/system/status"].body.release_sha,
    probes: results,
  };
}

export async function verifyRenderStatic(options) {
  const baseUrl = requireHttps(options["deployment-url"], "deployment URL").origin;
  const sourceSha = options["expected-source-sha"];
  if (!RELEASE_SHA.test(sourceSha))
    throw new Error(`Expected source SHA is malformed: ${sourceSha}`);
  const expected = {
    source_sha: sourceSha,
    entry_bundle: options["expected-entry-bundle"],
    entry_hash: options["expected-entry-hash"],
    entry_sha256: options["expected-entry-sha256"],
    cuelinks: JSON.parse(readFileSync(options["cuelinks-evidence"], "utf8")),
  };
  if (!/^entry-[a-f0-9]+\.js$/.test(expected.entry_bundle))
    throw new Error(`Expected entry bundle is malformed: ${expected.entry_bundle}`);
  if (!expected.entry_hash || !expected.cuelinks.valid || expected.cuelinks.cid !== CUELINKS_CID)
    throw new Error("Candidate export evidence is incomplete or has invalid Cuelinks evidence");
  const staticEvidence = await retry(
    () => verifyStatic(baseUrl, expected, options.stage ?? "candidate"),
    Number(options.attempts ?? 3),
    Number(options["interval-ms"] ?? 5000),
  );
  const api = await verifyApi(options["api-url"], sourceSha);
  return {
    schema_version: 1,
    provider: "render-static",
    verified: true,
    verification_stage: options.stage ?? "candidate",
    expected_source_sha: sourceSha,
    service_id: options["service-id"] ?? null,
    deploy_id: options["deploy-id"] ?? null,
    deployment_url: baseUrl,
    expected_entry_bundle: expected.entry_bundle,
    expected_entry_hash: expected.entry_hash,
    static: staticEvidence,
    api,
    cuelinks: staticEvidence.cuelinks,
    promotion_attempted: (options.stage ?? "candidate") === "production",
    promoted_to_production: (options.stage ?? "candidate") === "production",
  };
}

async function retry(fn, attempts, intervalMs) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  throw lastError;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = args(process.argv.slice(2));
  const evidence = await verifyRenderStatic(options);
  if (options["evidence-file"])
    writeFileSync(options["evidence-file"], `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(
    `verify-render-static-deploy: ${evidence.verification_stage} ${evidence.deployment_url} serves ${evidence.expected_entry_bundle}; all headers, identity, API and Cuelinks checks passed.`,
  );
}
