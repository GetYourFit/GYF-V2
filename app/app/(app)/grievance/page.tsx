"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api-client";
import { motion, useReducedMotion } from "framer-motion";
import { PageContainer } from "@/components/layout/page-container";

const ISSUE_TYPES = [
  "Account & Login",
  "Billing & Payments",
  "App Performance",
  "Content Issue",
  "Privacy Concern",
  "Other",
] as const;

type IssueType = (typeof ISSUE_TYPES)[number];

export default function GrievancePage() {
  const [form, setForm] = useState({
    issueType: "" as IssueType | "",
    description: "",
    email: "",
    attachmentName: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "submitted" | "error">("idle");
  const reduce = useReducedMotion();
  const submitted = status === "submitted";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await browserApi().submitSupportMessage({
        kind: "grievance",
        category: form.issueType || undefined,
        message: form.attachmentName
          ? `${form.description}\n\n[attachment offered: ${form.attachmentName}]`
          : form.description,
        reply_email: form.email,
      });
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (submitted) {
    return (
      <PageContainer width="narrow">
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            marginTop: "2rem",
            padding: "2rem 1.5rem",
            background: "var(--surface)",
            borderRadius: 16,
            border: "1px solid var(--rule)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--text)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
            }}
          >
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--bg)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: "0.5rem",
            }}
          >
            Grievance Submitted
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-mid)", lineHeight: 1.6 }}>
            We&apos;ve received your report and will review it within 48 hours. You&apos;ll hear
            from us at <strong style={{ color: "var(--text)" }}>{form.email}</strong>.
          </p>
        </motion.div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow">
      {/* Header */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{ marginBottom: "2rem" }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--secondary)",
            marginBottom: "0.5rem",
          }}
        >
          Report an issue
        </p>
        <h1
          style={{
            fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text)",
            lineHeight: 1.1,
            marginBottom: "0.75rem",
          }}
        >
          Grievance
        </h1>
        <p style={{ fontSize: "0.9rem", color: "var(--text-mid)", lineHeight: 1.65 }}>
          Tell us what went wrong and we&apos;ll make it right. Every report is reviewed by our
          team.
        </p>
      </motion.div>

      <motion.form
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        {/* Issue type chips */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-mid)",
            }}
          >
            Issue Type <span style={{ color: "var(--secondary)" }}>*</span>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {ISSUE_TYPES.map((type) => {
              const active = form.issueType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, issueType: type }))}
                  style={{
                    padding: "0.375rem 0.875rem",
                    borderRadius: 999,
                    border: active ? "1.5px solid var(--text)" : "1.5px solid var(--border)",
                    background: active ? "var(--text)" : "transparent",
                    color: active ? "var(--bg)" : "var(--text-mid)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        {/* Email */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label
            htmlFor="g-email"
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-mid)",
            }}
          >
            Your Email <span style={{ color: "var(--secondary)" }}>*</span>
          </label>
          <input
            id="g-email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            style={{
              height: 46,
              padding: "0 0",
              background: "transparent",
              border: "none",
              borderBottom: "1.5px solid var(--border)",
              borderRadius: 0,
              fontSize: "0.9375rem",
              color: "var(--text)",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderBottomColor = "var(--text)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderBottomColor = "var(--border)";
            }}
          />
        </div>

        {/* Description */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <label
            htmlFor="g-desc"
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--text-mid)",
            }}
          >
            Describe the Issue <span style={{ color: "var(--secondary)" }}>*</span>
          </label>
          <textarea
            id="g-desc"
            required
            rows={5}
            placeholder="What happened? Please include any steps to reproduce the issue..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            style={{
              padding: "0.75rem 0",
              background: "transparent",
              border: "none",
              borderBottom: "1.5px solid var(--border)",
              borderRadius: 0,
              fontSize: "0.9375rem",
              color: "var(--text)",
              outline: "none",
              resize: "none",
              lineHeight: 1.6,
              transition: "border-color 0.2s",
              fontFamily: "inherit",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderBottomColor = "var(--text)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderBottomColor = "var(--border)";
            }}
          />
        </div>

        {/* Notice */}
        <p style={{ fontSize: "0.75rem", color: "var(--text-faint)", lineHeight: 1.5 }}>
          All grievances are reviewed within 48 hours. For urgent matters, email us directly at{" "}
          <a href="mailto:gyf1ltd@gmail.com" style={{ color: "var(--text)", fontWeight: 600 }}>
            gyf1ltd@gmail.com
          </a>
          .
        </p>

        {status === "error" && (
          <p role="alert" style={{ fontSize: "0.85rem", color: "var(--secondary)" }}>
            Couldn&apos;t submit your report — please try again.
          </p>
        )}
        <button
          type="submit"
          disabled={!form.issueType || !form.email || !form.description || status === "sending"}
          style={{
            height: 48,
            borderRadius: 12,
            background: "var(--text)",
            color: "var(--bg)",
            fontWeight: 700,
            fontSize: "0.875rem",
            letterSpacing: "0.04em",
            border: "none",
            cursor: "pointer",
            transition: "opacity 0.15s",
            opacity: !form.issueType || !form.email || !form.description ? 0.4 : 1,
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.opacity = "0.85";
          }}
          onMouseLeave={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.opacity = "1";
          }}
        >
          {status === "sending" ? "Submitting…" : "Submit Grievance"}
        </button>
      </motion.form>
    </PageContainer>
  );
}
