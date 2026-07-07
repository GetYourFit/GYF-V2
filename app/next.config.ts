import type { NextConfig } from "next";

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
  images: {
    // Every real image source in the app, and nothing else (next/image refuses
    // any host not listed here): merchant product photos all come through
    // Shopify's shared CDN (confirmed: every catalog item across all ~22
    // merchants resolves to cdn.shopify.com — one host, not a per-merchant
    // allowlist that goes stale as merchants are added), user-uploaded media
    // lives in the Supabase storage bucket, and the local API serves /media
    // in dev.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
