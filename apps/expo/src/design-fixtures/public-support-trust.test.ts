import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { CONTACT_EMAIL, CONTACT_MAILTO } from "@/lib/contact";
import { SHOP_AFFILIATE_DISCLOSURE } from "@/lib/shop-links";

const appRoot = join(import.meta.dir, "../app");
const authRoot = join(appRoot, "(auth)");
const publicRoot = join(appRoot, "(public)");

async function authSource(path: string) {
  return Bun.file(join(authRoot, path)).text();
}

async function publicSource(path: string) {
  return Bun.file(join(publicRoot, path)).text();
}

describe("public support/trust reachability before login", () => {
  test("CONTACT_EMAIL is the registered gyf1ltd support address with a safe mailto", () => {
    expect(CONTACT_EMAIL).toBe("gyf1ltd@gmail.com");
    expect(CONTACT_MAILTO).toBe(`mailto:${CONTACT_EMAIL}`);
    // A mailto built from the constant must not carry query params that could
    // inject extra headers (cc/bcc) if the constant were ever templated.
    expect(CONTACT_MAILTO).not.toMatch(/[?&]/);
  });

  test("welcome, the first unauthenticated screen, links to the disclosures without requiring sign-in", async () => {
    const welcome = await authSource("welcome.tsx");
    expect(welcome).not.toContain("SessionGate");
    expect(welcome).toContain('href="/terms"');
    expect(welcome).toContain("affiliate disclosures");
  });

  test("login and signup route through the shared AuthForm with no session gate blocking them", async () => {
    for (const route of ["login.tsx", "signup.tsx"]) {
      const source = await authSource(route);
      expect(source).not.toContain("SessionGate");
    }
  });

  test("terms, reachable pre-auth, states the affiliate/commission disclosure and links to contact + grievance", async () => {
    const terms = await publicSource("terms.tsx");
    expect(terms).toContain("SHOP_AFFILIATE_DISCLOSURE");
    expect(SHOP_AFFILIATE_DISCLOSURE.toLowerCase()).toContain("commission");
    expect(terms).toContain('href="/contact"');
    expect(terms).toContain('href="/grievance"');
  });

  test("contact and grievance show the direct public email via a real mailto link before sign-in", async () => {
    for (const route of ["contact.tsx", "grievance.tsx"]) {
      const source = await publicSource(route);
      expect(source).toContain("CONTACT_EMAIL");
      expect(source).toContain("CONTACT_MAILTO");
      expect(source).toContain("Linking.openURL(CONTACT_MAILTO)");
      // The mailto path must render before any signed-in gate, not behind one.
      expect(source.indexOf("CONTACT_MAILTO")).toBeLessThan(
        source.indexOf('authState !== "signed-in"'),
      );
    }
  });

  test("authenticated contact/grievance forms only show a receipt after submitSupportMessage resolves", async () => {
    for (const route of ["contact.tsx", "grievance.tsx"]) {
      const source = await publicSource(route);
      // The success path (backend 201) sets receipt from the response id;
      // the catch path never touches receipt, so failures cannot render one.
      expect(source).toMatch(
        /const response = await api\.submitSupportMessage\(\w+Payload\(draft\)\);\s*setReceipt\(response\.id\);/,
      );
      const catchBlock = source.slice(
        source.indexOf("} catch (error) {"),
        source.indexOf("} finally {"),
      );
      expect(catchBlock).not.toContain("setReceipt");
    }
  });
});
