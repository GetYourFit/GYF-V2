"use client";

// Root-layout crash boundary. Next only invokes this file when an error escapes
// every nested error.tsx (e.g. a crash in layout.tsx itself, or in a route outside
// the (app) group, which has no boundary of its own) — so it must render its own
// <html>/<body> and must not depend on anything that could itself be the cause of
// the crash (fonts, providers, global.css). Plain inline styles only.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#faf8f5", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100dvh",
            padding: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              maxWidth: "320px",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                color: "#8a6d1a",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "1rem",
              }}
            >
              Something went wrong
            </p>
            <p
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#1c1a17",
                lineHeight: 1.25,
                marginBottom: "0.75rem",
              }}
            >
              GYF hit a snag loading
            </p>
            <p style={{ fontSize: "0.875rem", color: "#5c5650", marginBottom: "2rem" }}>
              Try reloading — if it keeps happening, come back in a moment.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "48px",
                padding: "0 2rem",
                background: "#1c1a17",
                color: "#faf8f5",
                border: "none",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                borderRadius: "999px",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
