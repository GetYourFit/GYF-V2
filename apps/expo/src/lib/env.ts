const DEFAULT_API_URL = "http://localhost:8000";

export type PublicEnv = {
  apiUrl: string;
  source: "configured" | "local-default";
};

export function readPublicEnv(values: Record<string, string | undefined>): PublicEnv {
  const raw = values.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return { apiUrl: DEFAULT_API_URL, source: "local-default" };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("EXPO_PUBLIC_API_URL must be a complete http(s) URL");
  }
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" && isLoopback(parsed.hostname))
  ) {
    throw new Error("EXPO_PUBLIC_API_URL must use https, except for local loopback development");
  }
  return { apiUrl: parsed.toString().replace(/\/$/, ""), source: "configured" };
}

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export const publicEnv = readPublicEnv({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL });
