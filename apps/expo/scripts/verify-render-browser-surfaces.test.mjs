import assert from "node:assert/strict";
import test from "node:test";
import {
  DevToolsSession,
  invalidateClientReadiness,
  settledSurfaceState,
  verifyBrowserSurfaces,
} from "./verify-render-browser-surfaces.mjs";

class SilentWebSocket extends EventTarget {
  constructor() {
    super();
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  send() {}

  close() {
    this.dispatchEvent(new Event("close"));
  }
}

const markers = {
  "/welcome": "Your AI stylist",
  "/login": "Welcome back",
  "/terms": "Terms and privacy",
  "/contact": "Contact",
  "/grievance": "Grievance",
  "/onboarding": "Your AI stylist",
  "/explore": "Your AI stylist",
  "/": "Your AI stylist",
  "/wardrobe": "Your AI stylist",
};

function browser(markersByPath = markers) {
  return (_command, args) => {
    const url = new URL(args.at(-1));
    const marker = markersByPath[url.pathname];
    return {
      status: 0,
      stdout: `<html data-gyf-client-ready="true"><body><main>${marker ?? ""}</main></body></html>`,
      stderr: "",
    };
  };
}

test("verifies every required surface through a browser", async () => {
  const evidence = await verifyBrowserSurfaces({
    deploymentUrl: "https://candidate.example/",
    executable: "/fake/chrome",
    spawn: browser(),
  });
  assert.equal(evidence.verified, true);
  assert.deepEqual(
    evidence.surfaces.map(({ path }) => path),
    [
      "/welcome",
      "/login",
      "/terms",
      "/contact",
      "/grievance",
      "/onboarding",
      "/explore",
      "/",
      "/wardrobe",
    ],
  );
});

test("rejects a surface that did not render its browser marker", async () => {
  await assert.rejects(
    verifyBrowserSurfaces({
      deploymentUrl: "https://candidate.example/",
      executable: "/fake/chrome",
      spawn: browser({ ...markers, "/login": "" }),
    }),
    /browser surface \/login did not render marker/,
  );
});

test("rejects a prerendered shell when the client did not start", async () => {
  const spawn = (_command, args) => {
    const url = new URL(args.at(-1));
    return {
      status: 0,
      stdout: `<html><body>${markers[url.pathname]}</body></html>`,
      stderr: "",
    };
  };
  await assert.rejects(
    verifyBrowserSurfaces({
      deploymentUrl: "https://candidate.example/",
      executable: "/fake/chrome",
      spawn,
    }),
    /did not complete client startup/,
  );
});

test("rejects a browser error overlay", async () => {
  const spawn = (_command, args) => {
    const url = new URL(args.at(-1));
    return {
      status: 0,
      stdout: `<html data-gyf-client-ready="true"><body>${markers[url.pathname]}<div id="expo-error-overlay"></div></body></html>`,
      stderr: "",
    };
  };
  await assert.rejects(
    verifyBrowserSurfaces({
      deploymentUrl: "https://candidate.example/",
      executable: "/fake/chrome",
      spawn,
    }),
    /rendered an error overlay/,
  );
});

test("waits for protected routes to settle after client startup", () => {
  const surface = {
    path: "/explore",
    protectedRedirect: "/welcome",
    marker: "Your AI stylist",
    readySelector: 'a[href="/login"]',
  };
  const document = {
    documentElement: {
      dataset: { gyfClientReady: "true" },
      outerHTML: "<html><body>Checking your session</body></html>",
    },
    querySelector: () => null,
  };
  const location = { pathname: "/explore" };

  assert.equal(settledSurfaceState(document, location, surface), null);

  document.documentElement.outerHTML =
    '<html data-gyf-client-ready="true"><body>Your AI stylist<a href="/login">Sign in</a></body></html>';
  document.querySelector = (selector) => (selector === surface.readySelector ? {} : null);
  location.pathname = "/welcome";

  assert.deepEqual(settledSurfaceState(document, location, surface), {
    ready: true,
    path: "/welcome",
    dom: document.documentElement.outerHTML,
  });

  invalidateClientReadiness(document);

  assert.equal(settledSurfaceState(document, location, surface), null);
});

test("bounds CDP commands and rejects them when the connection closes", async () => {
  const timedSession = new DevToolsSession("ws://test", {
    WebSocketImpl: SilentWebSocket,
    commandTimeout: 10,
  });
  await assert.rejects(timedSession.command("Page.navigate"), /command timed out: Page.navigate/);

  const closedSession = new DevToolsSession("ws://test", {
    WebSocketImpl: SilentWebSocket,
    commandTimeout: 1_000,
  });
  const pending = closedSession.command("Runtime.evaluate");
  await closedSession.open;
  closedSession.close();
  await assert.rejects(pending, /connection closed/);
});
