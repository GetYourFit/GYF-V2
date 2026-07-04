"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function AppError({
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60dvh",
        padding: "2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: "300px",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            color: "var(--secondary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          Something went wrong
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#1c1a17",
            lineHeight: 1.25,
            marginBottom: "0.75rem",
          }}
        >
          This page hit a snag
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            color: "var(--text-faint)",
            marginBottom: "2rem",
          }}
        >
          The rest of GYF is fine — try this page again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            minHeight: "48px",
            padding: "0 2rem",
            background: "#1c1a17",
            color: "#faf8f5",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderRadius: "999px",
          }}
        >
          <RefreshCw size={14} aria-hidden />
          Try again
        </button>
      </div>
    </div>
  );
}
