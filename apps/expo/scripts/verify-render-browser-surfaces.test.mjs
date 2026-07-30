import assert from "node:assert/strict";
import test from "node:test";
import { verifyBrowserSurfaces } from "./verify-render-browser-surfaces.mjs";

const markers = {
  "/welcome": "Your AI stylist",
  "/terms": "Terms and privacy",
  "/contact": "Contact",
  "/grievance": "Grievance",
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

test("verifies every required surface through a browser", () => {
  const evidence = verifyBrowserSurfaces({
    deploymentUrl: "https://candidate.example/",
    executable: "/fake/chrome",
    spawn: browser(),
  });
  assert.equal(evidence.verified, true);
  assert.deepEqual(
    evidence.surfaces.map(({ path }) => path),
    ["/welcome", "/terms", "/contact", "/grievance"],
  );
});

test("rejects a surface that did not render its browser marker", () => {
  assert.throws(
    () =>
      verifyBrowserSurfaces({
        deploymentUrl: "https://candidate.example/",
        executable: "/fake/chrome",
        spawn: browser({ ...markers, "/terms": "" }),
      }),
    /browser surface \/terms did not render marker/,
  );
});

test("rejects a prerendered shell when the client did not start", () => {
  const spawn = (_command, args) => {
    const url = new URL(args.at(-1));
    return {
      status: 0,
      stdout: `<html><body>${markers[url.pathname]}</body></html>`,
      stderr: "",
    };
  };
  assert.throws(
    () =>
      verifyBrowserSurfaces({
        deploymentUrl: "https://candidate.example/",
        executable: "/fake/chrome",
        spawn,
      }),
    /did not complete client startup/,
  );
});

test("rejects a browser error overlay", () => {
  const spawn = (_command, args) => {
    const url = new URL(args.at(-1));
    return {
      status: 0,
      stdout: `<html data-gyf-client-ready="true"><body>${markers[url.pathname]}<div id="expo-error-overlay"></div></body></html>`,
      stderr: "",
    };
  };
  assert.throws(
    () =>
      verifyBrowserSurfaces({
        deploymentUrl: "https://candidate.example/",
        executable: "/fake/chrome",
        spawn,
      }),
    /rendered an error overlay/,
  );
});
