import type { Metadata } from "next";
import { AccountManager } from "@/components/account/account-manager";

export const metadata: Metadata = { title: "Account · GYF" };

export default function AccountPage() {
  return (
    <div style={{ padding: "1.25rem 1rem 3rem", maxWidth: "480px", margin: "0 auto" }}>
      <header style={{ marginBottom: "2rem" }}>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-mid)",
            display: "block",
            marginBottom: "0.5rem",
          }}
        >
          Privacy &amp; data
        </span>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.25rem, 9vw, 3rem)",
            fontWeight: 600,
            fontStyle: "italic",
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            margin: "0 0 0.5rem",
          }}
        >
          Account
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            color: "var(--text-faint)",
            margin: 0,
          }}
        >
          Control what GYF can use, take your data with you, or erase it entirely.
        </p>
      </header>
      <AccountManager />
    </div>
  );
}
