#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { writeFileSync } from "node:fs";

const SURFACES = [
  {
    name: "welcome",
    path: "/welcome",
    marker: "Your AI stylist",
    readySelector: 'a[href="/login"]',
    interaction: `(() => { const target = document.querySelector('a[href="/login"]'); if (!target) return { ok: false, reason: "login navigation link missing" }; target.click(); return { ok: true, expected_path: "/login" }; })()`,
    expectedPath: "/login",
  },
  {
    name: "login",
    path: "/login",
    marker: "Welcome back",
    readySelector: 'input[aria-label="Email address"]',
    interaction: `(() => { const target = document.querySelector('input[aria-label="Email address"]'); if (!target) return { ok: false, reason: "email input missing" }; target.focus(); return { ok: document.activeElement === target }; })()`,
  },
  {
    name: "terms",
    path: "/terms",
    marker: "Terms and privacy",
    readySelector: 'a[href="/contact"]',
    interaction: `(() => { const target = document.querySelector('a[href="/contact"]'); if (!target) return { ok: false, reason: "contact support link missing" }; target.click(); return { ok: true, expected_path: "/contact" }; })()`,
    expectedPath: "/contact",
  },
  ...["contact", "grievance"].map((name) => ({
    name,
    path: `/${name}`,
    marker: name === "contact" ? "Contact" : "Grievance",
    readySelector: 'a[href="/login"]',
    interaction: `(() => { const target = document.querySelector('a[href="/login"]'); if (!target) return { ok: false, reason: "anonymous sign-in link missing" }; target.click(); return { ok: true, expected_path: "/login" }; })()`,
    expectedPath: "/login",
  })),
  ...["onboarding", "explore", "stylist", "wardrobe"].map((name) => ({
    name,
    path: name === "stylist" ? "/" : `/${name}`,
    marker: "Your AI stylist",
    protectedRedirect: "/welcome",
    readySelector: 'a[href="/login"]',
    interaction: `(() => { const target = document.querySelector('a[href="/login"]'); if (!target) return { ok: false, reason: "anonymous fallback login link missing" }; target.click(); return { ok: true, expected_path: "/login" }; })()`,
    expectedPath: "/login",
  })),
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
  for (const command of [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]) {
    const found = spawnSync("sh", ["-c", `command -v "${command}"`], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw new Error("No supported Chrome or Chromium executable is available");
}

function assertDocument(dom, surface) {
  if (!/<html[\s>]/i.test(dom) || !/<body[\s>]/i.test(dom))
    throw new Error(`browser returned no document for ${surface.path}`);
  if (!dom.includes(surface.marker))
    throw new Error(
      `browser surface ${surface.path} did not render marker ${JSON.stringify(surface.marker)}`,
    );
  if (!/<html\b[^>]*\bdata-gyf-client-ready=["']true["']/i.test(dom))
    throw new Error(`browser surface ${surface.path} did not complete client startup`);
  if (/id=["'](?:expo-error-overlay|webpack-dev-server-client-overlay)["']/i.test(dom))
    throw new Error(`browser surface ${surface.path} rendered an error overlay`);
}

function verifyWithDumpDom({ deploymentUrl, stage, command, spawn: run }) {
  const surfaces = SURFACES.map((surface) => {
    const url = new URL(surface.path, deploymentUrl).toString();
    const result = run(
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
      throw new Error(`browser failed for ${surface.path}: ${(result.stderr ?? "").trim()}`);
    const dom = result.stdout ?? "";
    assertDocument(dom, surface);
    return {
      name: surface.name,
      path: surface.path,
      url,
      marker: surface.marker,
      rendered: true,
      client_ready: true,
      interaction: "controls-present-in-browser-shell",
    };
  });
  return {
    schema_version: 1,
    provider: "render-static",
    stage,
    verified: true,
    browser: command,
    surfaces,
  };
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForDebugger(port, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const pages = await response.json();
        const page = pages.find(
          ({ type, webSocketDebuggerUrl }) =>
            type === "page" && typeof webSocketDebuggerUrl === "string",
        );
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome DevTools page endpoint did not become ready");
}

export class DevToolsSession {
  constructor(url, { WebSocketImpl = WebSocket, commandTimeout = 15_000 } = {}) {
    this.socket = new WebSocketImpl(url);
    this.commandTimeout = commandTimeout;
    this.nextId = 0;
    this.pending = new Map();
    this.events = [];
    this.errors = [];
    this.open = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener(
        "error",
        () => reject(new Error("Chrome DevTools connection failed")),
        { once: true },
      );
      this.socket.addEventListener(
        "close",
        () => reject(new Error("Chrome DevTools connection closed before opening")),
        { once: true },
      );
    });
    this.socket.addEventListener("error", () =>
      this.rejectPending(new Error("Chrome DevTools connection failed")),
    );
    this.socket.addEventListener("close", () =>
      this.rejectPending(new Error("Chrome DevTools connection closed")),
    );
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timeout);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      } else {
        this.events.push(message);
        if (message.method === "Runtime.exceptionThrown") {
          this.errors.push(
            message.params?.exceptionDetails?.exception?.description ?? "page exception",
          );
        }
        if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
          this.errors.push("console.error");
        }
        if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
          this.errors.push(message.params.entry.text ?? "browser log error");
        }
      }
    });
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  async command(method, params = {}) {
    await this.open;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome DevTools command timed out: ${method}`));
      }, this.commandTimeout);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitFor(session, predicate, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  let lastValue;
  while (Date.now() < deadline) {
    const value = await session.command("Runtime.evaluate", {
      expression: typeof predicate === "string" ? `(${predicate})()` : `(${predicate})()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (value.exceptionDetails) {
      throw new Error(`browser evaluation failed: ${JSON.stringify(value.exceptionDetails)}`);
    }
    lastValue = value.result?.value;
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(
    `browser surface did not become ready before timeout (${JSON.stringify(lastValue)})`,
  );
}

export function settledSurfaceState(document, location, surface) {
  if (document.documentElement?.dataset?.gyfClientReady !== "true") return null;
  const allowedPaths = [surface.path, surface.protectedRedirect].filter(Boolean);
  if (!allowedPaths.includes(location.pathname)) return null;
  const dom = document.documentElement?.outerHTML ?? "";
  if (!dom.includes(surface.marker) || !document.querySelector(surface.readySelector)) return null;
  return { ready: true, path: location.pathname, dom };
}

export function invalidateClientReadiness(document) {
  delete document.documentElement?.dataset?.gyfClientReady;
}

async function verifyWithDevTools({ deploymentUrl, stage, command }) {
  const port = await freePort();
  const profile = mkdtempSync(`${tmpdir()}/gyf-render-browser-`);
  const child = spawn(
    command,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let session;
  const surfaces = [];
  try {
    const debuggerUrl = await waitForDebugger(port, child);
    session = new DevToolsSession(debuggerUrl);
    await session.command("Page.enable");
    await session.command("Runtime.enable");
    await session.command("Log.enable");
    for (const surface of SURFACES) {
      const url = new URL(surface.path, deploymentUrl).toString();
      session.errors.length = 0;
      const invalidated = await session.command("Runtime.evaluate", {
        expression: `(${invalidateClientReadiness.toString()})(document)`,
        returnByValue: true,
      });
      if (invalidated.exceptionDetails)
        throw new Error(
          `could not invalidate browser readiness: ${JSON.stringify(invalidated.exceptionDetails)}`,
        );
      await session.command("Page.navigate", { url });
      const readinessSurface = {
        path: surface.path,
        protectedRedirect: surface.protectedRedirect,
        marker: surface.marker,
        readySelector: surface.readySelector,
      };
      const state = await waitFor(
        session,
        `() => (${settledSurfaceState.toString()})(document, window.location, ${JSON.stringify(readinessSurface)})`,
      );
      assertDocument(state.dom, surface);
      const allowedPaths = [surface.path, surface.protectedRedirect].filter(Boolean);
      if (!allowedPaths.includes(state.path))
        throw new Error(`direct route ${surface.path} loaded as ${state.path}`);
      const interaction = await session.command("Runtime.evaluate", {
        expression: surface.interaction,
        returnByValue: true,
        awaitPromise: true,
      });
      const interactionResult = interaction.result?.value;
      if (!interactionResult?.ok)
        throw new Error(
          `browser interaction failed for ${surface.path}: ${interactionResult?.reason ?? "unknown"}`,
        );
      if (surface.expectedPath) {
        const navigated = await waitFor(
          session,
          `() => window.location.pathname === ${JSON.stringify(surface.expectedPath)}`,
        );
        if (!navigated)
          throw new Error(
            `interaction on ${surface.path} did not navigate to ${surface.expectedPath}`,
          );
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (session.errors.length > 0)
        throw new Error(
          `browser page/console errors for ${surface.path}: ${session.errors.join("; ")}`,
        );
      surfaces.push({
        name: surface.name,
        path: surface.path,
        url,
        loaded_path: state.path,
        marker: surface.marker,
        rendered: true,
        client_ready: true,
        interaction: interactionResult,
        navigation_asserted: surface.expectedPath ?? surface.path,
      });
    }
  } finally {
    session?.close();
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(resolve, 2_000);
    });
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  return {
    schema_version: 1,
    provider: "render-static",
    stage,
    verified: true,
    browser: command,
    surfaces,
  };
}

export async function verifyBrowserSurfaces({
  deploymentUrl,
  stage = "candidate",
  executable,
  spawn: run = spawnSync,
}) {
  const baseUrl = new URL(deploymentUrl);
  if (baseUrl.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(baseUrl.hostname))
    throw new Error(`deployment URL must use HTTPS: ${deploymentUrl}`);
  const command = browserCommand(executable);
  return run === spawnSync
    ? verifyWithDevTools({ deploymentUrl: baseUrl.toString(), stage, command })
    : verifyWithDumpDom({ deploymentUrl: baseUrl.toString(), stage, command, spawn: run });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = options(process.argv.slice(2));
  if (!args["deployment-url"]) throw new Error("Missing required option --deployment-url");
  const evidence = await verifyBrowserSurfaces({
    deploymentUrl: args["deployment-url"],
    stage: args.stage,
    executable: args.browser,
  });
  if (args["evidence-file"])
    writeFileSync(args["evidence-file"], `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(
    `verify-render-browser-surfaces: ${evidence.stage} rendered ${evidence.surfaces.length} browser surfaces with hydrated interaction assertions.`,
  );
}
