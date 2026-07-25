import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const appRoot = join(import.meta.dir, "../app");
const publicRoot = join(appRoot, "(public)");

async function source(path: string) {
  return Bun.file(join(publicRoot, path)).text();
}

describe("public trust routes", () => {
  test("keeps signed-out legal, support, and grievance routes outside SessionGate", async () => {
    const layout = await source("_layout.tsx");
    expect(layout).not.toContain("SessionGate");
    expect(layout).not.toContain("Redirect");
    expect(layout).toContain('router.replace("/welcome")');

    for (const route of ["terms.tsx", "contact.tsx", "grievance.tsx"]) {
      const routeSource = await source(route);
      expect(routeSource).toContain("export default");
      expect(routeSource).not.toContain("SessionGate");
      expect(routeSource).not.toContain("Redirect");
    }
  });

  test("keeps signed-out support routes on email plus sign-in, not the authenticated submit path", async () => {
    const contact = await source("contact.tsx");
    expect(contact).toContain('Link asChild href="/login"');
    expect(contact).toContain("Sign in to message GYF");
    expect(contact).toContain('authState !== "signed-in"');

    const grievance = await source("grievance.tsx");
    expect(grievance).toContain('Link asChild href="/login"');
    expect(grievance).toContain("Sign in to submit here");
    expect(grievance).toContain('authState !== "signed-in"');
  });

  test("keeps disclosure and deletion instructions public without exposing account controls", async () => {
    const terms = await source("terms.tsx");
    expect(terms).toContain("Affiliate disclosure");
    expect(terms).toContain("Data deletion and retention");
    expect(terms).toContain("Account controls stay behind sign-in");
    expect(terms).not.toContain("deleteAccount");
    expect(terms).not.toContain("exportAccount");
  });

  test("preserves the existing signed-in deep-link paths", async () => {
    const appLayout = await Bun.file(join(appRoot, "(app)/_layout.tsx")).text();
    expect(appLayout).toContain('name="(tabs)"');
    for (const path of ["terms", "contact", "grievance"]) {
      expect(await Bun.file(join(publicRoot, `${path}.tsx`)).exists()).toBe(true);
    }
  });
});
