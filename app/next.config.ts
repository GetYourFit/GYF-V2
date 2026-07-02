import type { NextConfig } from "next";
import path from "path";

// Security headers (W6 / M-2). Applied to every route by Next at the edge so the
// browser enforces them regardless of the page. We deliberately avoid a strict
// Content-Security-Policy here: the app loads its own bundles plus Supabase
// (auth/storage) and the API origin, and a mis-scoped CSP silently breaks auth —
// CSP is tracked as a follow-up once the exact source allowlist is pinned. The
// headers below are the high-value, zero-risk subset.
const securityHeaders = [
  // Force HTTPS for two years incl. subdomains; eligible for browser preload.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Never let the browser MIME-sniff a response into an executable type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Disallow framing entirely (clickjacking) — the app is never embedded.
  { key: "X-Frame-Options", value: "DENY" },
  // Send only the origin on cross-origin navigation; full URL same-origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features the app doesn't use; camera is needed for photo
  // onboarding via file upload (not getUserMedia), so it stays denied too.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Isolate this origin's browsing context group (Spectre-class side channels).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
