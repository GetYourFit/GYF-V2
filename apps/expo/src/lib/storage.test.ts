import { describe, expect, it } from "bun:test";

import { createAuthStorage } from "./storage";

describe("createAuthStorage", () => {
  it("uses SecureStore on native and clears sessions", async () => {
    const values = new Map<string, string>();
    const storage = createAuthStorage({
      platform: "native",
      secure: {
        getItemAsync: async (key) => values.get(key) ?? null,
        setItemAsync: async (key, value) => void values.set(key, value),
        deleteItemAsync: async (key) => void values.delete(key),
      },
    });
    await storage.setItem("session", "token");
    expect(await storage.getItem("session")).toBe("token");
    await storage.removeItem("session");
    expect(await storage.getItem("session")).toBeNull();
  });

  it("uses injected web storage without requiring window", async () => {
    const values = new Map<string, string>();
    const web = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
      clear: () => values.clear(),
      key: () => null,
      length: 0,
    } as Storage;
    const storage = createAuthStorage({ platform: "web", web });
    await storage.setItem("session", "web-token");
    expect(await storage.getItem("session")).toBe("web-token");
  });
});
