import { afterEach, describe, expect, it } from "bun:test";

import { createEventId, createLazyEventId } from "./event-id";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const originalCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
});

describe("createEventId", () => {
  it("produces a valid v4 UUID when a secure randomUUID source is present", () => {
    expect(createEventId()).toMatch(UUID_V4_RE);
  });

  it("produces a valid v4 UUID when crypto is entirely absent", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(createEventId()).toMatch(UUID_V4_RE);
  });

  it("produces a valid v4 UUID when randomUUID is missing but getRandomValues exists", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: { getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto) },
      configurable: true,
      writable: true,
    });
    expect(createEventId()).toMatch(UUID_V4_RE);
  });

  it("produces a valid v4 UUID when randomUUID throws", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        randomUUID: () => {
          throw new Error("randomUUID unavailable in this runtime");
        },
        getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
      },
      configurable: true,
      writable: true,
    });
    expect(createEventId()).toMatch(UUID_V4_RE);
  });

  it("produces a valid v4 UUID when getRandomValues also throws", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: {
        getRandomValues: () => {
          throw new Error("getRandomValues unavailable in this runtime");
        },
      },
      configurable: true,
      writable: true,
    });
    expect(createEventId()).toMatch(UUID_V4_RE);
  });

  it("produces unique IDs across repeated calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createEventId()));
    expect(ids.size).toBe(200);
  });
});

describe("createLazyEventId", () => {
  it("does not evaluate any UUID source until the getter is first called", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    // Constructing the lazy ID (equivalent to a component mount) must never throw,
    // even with no secure UUID source installed at all.
    const getSessionId = createLazyEventId();
    Object.defineProperty(globalThis, "crypto", {
      value: originalCrypto,
      configurable: true,
      writable: true,
    });
    expect(getSessionId()).toMatch(UUID_V4_RE);
  });

  it("memoizes the same id across repeated getter calls", () => {
    const getSessionId = createLazyEventId();
    const first = getSessionId();
    const second = getSessionId();
    expect(first).toBe(second);
    expect(first).toMatch(UUID_V4_RE);
  });
});
