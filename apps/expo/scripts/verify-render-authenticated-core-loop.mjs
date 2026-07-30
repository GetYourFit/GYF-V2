#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

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

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
      } else {
        for (const listener of this.listeners) listener(message);
      }
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }
  close() {
    this.socket.close();
  }
}

async function waitFor(predicate, message, timeout = 90_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(message);
}

async function launchBrowser(command, profile) {
  const port = 9222;
  const child = spawn(command, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let diagnostic = "";
  child.stderr.on("data", (chunk) => {
    diagnostic = `${diagnostic}${chunk}`.slice(-4000);
  });
  let target;
  await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`browser exited before startup: ${diagnostic}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      target = targets.find((entry) => entry.type === "page");
      return Boolean(target?.webSocketDebuggerUrl);
    } catch {
      return false;
    }
  }, "browser debugging endpoint did not start", 15_000);
  return { child, cdp: new Cdp(target.webSocketDebuggerUrl) };
}

const browserHelpers = String.raw`
  const element = (label) => [...document.querySelectorAll("button,a,[role=button],[role=link],[role=tab],input")]
    .find((node) => node.getAttribute("aria-label") === label || node.textContent?.trim() === label);
  const click = (label) => {
    const node = element(label);
    if (!node) throw new Error("Missing browser control: " + label);
    node.click();
    return true;
  };
  const setInput = (label, value) => {
    const node = document.querySelector('[aria-label="' + label + '"]');
    if (!node) throw new Error("Missing browser input: " + label);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
`;

export async function verifyAuthenticatedCoreLoop(config) {
  const origin = new URL(config.deploymentUrl);
  if (origin.protocol !== "https:") throw new Error("deployment URL must use HTTPS");
  const profile = mkdtempSync(join(tmpdir(), "gyf-render-browser-"));
  const command = browserCommand(config.executable);
  let child;
  let cdp;
  const requests = [];
  try {
    ({ child, cdp } = await launchBrowser(command, profile));
    cdp.listeners.add(({ method, params }) => {
      if (method === "Network.responseReceived" && params.response.url.startsWith(config.apiUrl))
        requests.push({ url: params.response.url, status: params.response.status });
    });
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    const evaluate = async (expression) => {
      const result = await cdp.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
      return result.result.value;
    };
    const textIncludes = (text) =>
      evaluate(`document.body?.innerText.includes(${JSON.stringify(text)}) === true`);
    const navigate = async (path) => {
      await cdp.send("Page.navigate", { url: new URL(path, origin).toString() });
      await waitFor(() => evaluate("document.documentElement.dataset.gyfClientReady === 'true'"), `client did not start at ${path}`);
    };
    await navigate("/login");
    await evaluate(`(() => { ${browserHelpers}
      setInput("Email address", ${JSON.stringify(config.email)});
      setInput("Password", ${JSON.stringify(config.password)});
      click("Continue");
    })()`);
    await waitFor(() => evaluate(`location.origin === ${JSON.stringify(origin.origin)} && !location.pathname.includes("login")`), "browser authentication did not complete");

    await navigate("/onboarding");
    await waitFor(() => textIncludes("Tell GYF about your style"), "manual onboarding did not render");
    await evaluate(`(() => { ${browserHelpers}
      click("Womenswear");
      click("INR");
      setInput("Maximum price per garment", "5000");
      click("Save profile");
    })()`);
    await waitFor(() => textIncludes("Set up your personal fit"), "personal-fit onboarding did not render");
    await evaluate(`(() => { ${browserHelpers}
      click("Medium");
      click("Rectangle");
      click("INR");
      setInput("Maximum price per garment", "5000");
      click("Save your personal fit");
    })()`);
    await waitFor(() => textIncludes("Stylist"), "Stylist did not render after onboarding");
    await waitFor(() => textIncludes("LOOK 01"), "Stylist returned no rendered outfit");

    const shopLabel = await evaluate(`[...document.querySelectorAll('[aria-label^="Shop "]')][0]?.getAttribute("aria-label") ?? null`);
    let shop = "not_applicable";
    if (shopLabel) {
      await evaluate(`(() => { ${browserHelpers} click(${JSON.stringify(shopLabel)}); })()`);
      await waitFor(() => requests.some(({ url, status }) => url.endsWith("/feedback") && status === 202), "shop feedback was not accepted");
      shop = "verified";
    }
    const feedbackCount = requests.filter(({ url, status }) => url.endsWith("/feedback") && status === 202).length;
    await evaluate(`(() => { ${browserHelpers} click("Save look"); })()`);
    await waitFor(
      () => evaluate(`document.querySelector('[aria-label="Feedback recorded"]')?.textContent.includes("Saved.") === true`),
      "save feedback was not rendered",
    );
    await waitFor(() => requests.filter(({ url, status }) => url.endsWith("/feedback") && status === 202).length > feedbackCount, "save feedback was not accepted");

    await evaluate(`(() => { ${browserHelpers} click("Explore"); })()`);
    await waitFor(() => evaluate("location.pathname.includes('explore')"), "Explore navigation did not complete");
    await waitFor(() => requests.some(({ url, status }) => url.includes("/items/browse") && status === 200), "Explore browse request did not succeed");
    await waitFor(() => textIncludes("catalogue pieces"), "Explore catalogue did not render");
    return {
      schema_version: 2,
      provider: "render-static",
      stage: config.stage,
      deployment_url: origin.toString().replace(/\/$/, ""),
      verified: true,
      verified_at: new Date().toISOString(),
      browser: basename(command),
      checks: {
        authenticated_session: true,
        manual_onboarding: true,
        stylist: true,
        explore: true,
        save_feedback: true,
        shop,
      },
    };
  } finally {
    cdp?.close();
    child?.kill("SIGTERM");
    rmSync(profile, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = options(process.argv.slice(2));
  for (const name of ["deployment-url", "api-url", "stage", "evidence-file"])
    if (!args[name]) throw new Error(`Missing required option --${name}`);
  for (const name of ["GYF_E2E_EMAIL", "GYF_E2E_PASSWORD"])
    if (!process.env[name]) throw new Error(`${name} is not configured`);
  const evidence = await verifyAuthenticatedCoreLoop({
    deploymentUrl: args["deployment-url"],
    apiUrl: args["api-url"],
    email: process.env.GYF_E2E_EMAIL,
    password: process.env.GYF_E2E_PASSWORD,
    stage: args.stage,
    executable: args.browser,
  });
  writeFileSync(args["evidence-file"], `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`verify-render-authenticated-core-loop: ${evidence.stage} passed.`);
}
