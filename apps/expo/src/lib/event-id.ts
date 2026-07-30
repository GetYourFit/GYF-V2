/**
 * Single owned boundary for event/session IDs. Uses the platform secure UUID
 * source when present, and a valid UUID v4 compatibility fallback when it is
 * not (older WebViews, some browsers evaluating a page over non-secure
 * context). Callers must invoke this lazily, at event/session creation time,
 * never during render/mount, since the secure source is not guaranteed.
 */
export function createEventId(): string {
  const secureRandomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  if (secureRandomUUID) {
    try {
      return secureRandomUUID();
    } catch {
      // Fall through to the compatibility source below.
    }
  }
  return fallbackUuidV4();
}

function fallbackUuidV4(): string {
  const bytes = randomBytes(16);
  // Per RFC 4122 §4.4: set version (4) and variant (10) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

/**
 * A session/event ID that must exist for the lifetime of a component but must
 * never be computed at construction time. Call the returned getter lazily, at
 * first use (e.g. the first commerce click); it computes once and memoizes.
 */
export function createLazyEventId(): () => string {
  let cached: string | null = null;
  return () => {
    if (!cached) cached = createEventId();
    return cached;
  };
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const secureRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (secureRandomValues) {
    try {
      return secureRandomValues(bytes);
    } catch {
      // Fall through to Math.random below.
    }
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}
