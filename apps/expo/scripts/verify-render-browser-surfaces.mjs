#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const SURFACES = [
  { path: "/welcome", marker: "Your AI stylist" },
  { path: "/terms", marker: "Terms and privacy" },
  { path: "/contact", marker: "Contact" },
  { path: "/grievance", marker: "Grievance" },
];

function options(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || value.startsWith("--"))
      throw new Error(`Invalid option near ${key ?? "end of arguments"}`);
    result[key.slice(2)] = value;
  }
  return result;
}

function browserCommand(explicit) {
  if (explicit) return explicit;
  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = spawnSync("sh", ["-c", `command -v "${command}"`], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("No supported Chrome or Chromium executable is available");
}

export function verifyBrowserSurfaces({
  deploymentUrl,
  stage = "candidate",
  executable,
  spawn = spawnSync,
}) {
  const baseUrl = new URL(deploymentUrl);
  if (
    baseUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(baseUrl.hostname)
  )
    throw new Error(`deployment URL must use HTTPS: ${deploymentUrl}`);
  const command = browserCommand(executable);
  const surfaces = SURFACES.map(({ path, marker }) => {
    const url = new URL(path, baseUrl).toString();
    const result = spawn(
      command,
      [
        "--headless=new",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--virtual-time-budget=10000",
        "--dump-dom",
        url,
      ],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`browser failed for ${path}: ${(result.stderr ?? "").trim()}`);
    const dom = result.stdout ?? "";
    if (!/<html[\s>]/i.test(dom) || !/<body[\s>]/i.test(dom))
      throw new Error(`browser returned no document for ${path}`);
    if (!dom.includes(marker))
      throw new Error(`browser surface ${path} did not render marker ${JSON.stringify(marker)}`);
    if (!/<html\b[^>]*\bdata-gyf-client-ready=["']true["']/i.test(dom))
      throw new Error(`browser surface ${path} did not complete client startup`);
    if (/id=["'](?:expo-error-overlay|webpack-dev-server-client-overlay)["']/i.test(dom))
      throw new Error(`browser surface ${path} rendered an error overlay`);
    return { path, url, marker, rendered: true, client_ready: true };
  });
  return {
    schema_version: 1,
    provider: "render-static",
    stage,
    verified: true,
    verified_at: new Date().toISOString(),
    browser: command,
    surfaces,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = options(process.argv.slice(2));
  if (!args["deployment-url"]) throw new Error("Missing required option --deployment-url");
  const evidence = verifyBrowserSurfaces({
    deploymentUrl: args["deployment-url"],
    stage: args.stage,
    executable: args.browser,
  });
  if (args["evidence-file"])
    writeFileSync(args["evidence-file"], `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(
    `verify-render-browser-surfaces: ${evidence.stage} rendered ${evidence.surfaces.length} browser surfaces.`,
  );
}
