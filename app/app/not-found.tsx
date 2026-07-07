import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70dvh",
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
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            color: "var(--secondary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "1rem",
          }}
        >
          404
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
          Nothing here
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            color: "var(--text-faint)",
            marginBottom: "2rem",
          }}
        >
          That page doesn&rsquo;t exist, or it moved.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "48px",
            padding: "0 2rem",
            background: "#1c1a17",
            color: "#faf8f5",
            textDecoration: "none",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderRadius: "999px",
          }}
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
