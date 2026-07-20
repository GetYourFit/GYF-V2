#!/usr/bin/env node
// Fails the deploy if the exported web bundle has no Supabase config inlined.
//
// Expo replaces EXPO_PUBLIC_* at export time. Export without those vars in the
// environment and the bundle still builds — it just ships an app whose every
// authed screen renders "Authentication unavailable". Metro's transform cache
// makes it worse: it is keyed on file contents, not env, so a re-export with
// the vars set can silently reuse modules compiled without them (hence
// --clear in the build script). This check is the backstop for both.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BUNDLE_DIR = join(import.meta.dirname, "..", "dist", "_expo", "static", "js", "web");

const files = readdirSync(BUNDLE_DIR).filter((name) => name.endsWith(".js"));
if (files.length === 0) {
  console.error("check-web-env: no JS bundle in dist — run the build first.");
  process.exit(1);
}

const bundle = files.map((name) => readFileSync(join(BUNDLE_DIR, name), "utf8")).join("");

// The literal values must appear, not just the variable names: a bundle built
// without env still contains the reads, only with empty strings substituted.
const missing = [
  ["EXPO_PUBLIC_SUPABASE_URL", /https:\/\/[a-z0-9-]+\.supabase\.co/],
  ["EXPO_PUBLIC_SUPABASE_ANON_KEY", /sb_publishable_[A-Za-z0-9_-]{8,}/],
  ["EXPO_PUBLIC_API_URL", /https?:\/\/[^"']*\/?/],
].filter(([, pattern]) => !pattern.test(bundle));

if (missing.length > 0) {
  console.error(
    `check-web-env: bundle is missing inlined config for ${missing
      .map(([name]) => name)
      .join(", ")}.\n` +
      "Export through EAS env so the values are present:\n" +
      '  npx eas-cli env:exec production "npx expo export --platform web --clear"',
  );
  process.exit(1);
}

console.log("check-web-env: Supabase and API config inlined in the web bundle.");
