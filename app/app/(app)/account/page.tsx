import type { Metadata } from "next";
import { AccountManager } from "@/components/account/account-manager";

export const metadata: Metadata = { title: "Account · GYF" };

export default function AccountPage() {
  return (
    <div style={{ padding: "1.25rem 1rem 3rem", maxWidth: "480px", margin: "0 auto" }}>
      <header style={{ marginBottom: "2rem" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 500,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "#d4607a",
          display: "block", marginBottom: "0.5rem",
        }}>
          Privacy &amp; data
        </span>
        <h1 style={{
          fontFamily: "var(--font-body)", fontSize: "clamp(1.625rem,7vw,2.25rem)",
          fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em",
          color: "#1c1a17", margin: "0 0 0.5rem",
        }}>
          Account
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "#9a9490", margin: 0 }}>
          Control what GYF can use, take your data with you, or erase it entirely.
        </p>
      </header>
      <AccountManager />
    </div>
  );
}
