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
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("EXPO_PUBLIC_API_URL must use http or https");
  }
  return { apiUrl: parsed.toString().replace(/\/$/, ""), source: "configured" };
}

export const publicEnv = readPublicEnv({ EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL });
