"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PageContainer } from "@/components/layout/page-container";
import { browserApi } from "@/lib/api-client";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const reduce = useReducedMotion();
  const sent = status === "sent";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      await browserApi().submitSupportMessage({
        kind: "contact",
        message: `From ${form.name}: ${form.message}`,
        reply_email: form.email,
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
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
          Get in touch
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
          Contact Us
        </h1>
        <p style={{ fontSize: "0.9rem", color: "var(--text-mid)", lineHeight: 1.65 }}>
          We&apos;d love to hear from you. Reach out and we&apos;ll get back to you within 24 hours.
        </p>
      </motion.div>

      {/* Contact cards */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2rem" }}
      >
        {[
          {
            icon: (
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            ),
            label: "Email",
            value: "gyf1ltd@gmail.com",
          },
        ].map(({ icon, label, value }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.875rem",
              padding: "1rem",
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-mid)",
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
            <div>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                  marginBottom: 2,
                }}
              >
                {label}
              </p>
              <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text)" }}>{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Form */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
      >
        {sent ? (
          <div
            style={{
              padding: "1.5rem",
              background: "var(--surface)",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
            <p style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Message sent!</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-mid)" }}>
              We&apos;ll get back to you within 24 hours.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {(["name", "email"] as const).map((field) => (
              <div key={field} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label
                  htmlFor={field}
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-mid)",
                  }}
                >
                  {field === "name" ? "Your Name" : "Email Address"}
                </label>
                <input
                  id={field}
                  type={field === "email" ? "email" : "text"}
                  required
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  style={{
                    height: 46,
                    padding: "0 0.875rem",
                    background: "transparent",
                    border: "none",
                    borderBottom: "1.5px solid rgba(255,255,255,0.18)",
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
                    e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.18)";
                  }}
                />
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label
                htmlFor="message"
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-mid)",
                }}
              >
                Message
              </label>
              <textarea
                id="message"
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                style={{
                  padding: "0.75rem 0",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1.5px solid rgba(255,255,255,0.18)",
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
                  e.currentTarget.style.borderBottomColor = "rgba(255,255,255,0.18)";
                }}
              />
            </div>
            {status === "error" && (
              <p role="alert" style={{ fontSize: "0.85rem", color: "var(--secondary)" }}>
                Couldn&apos;t send your message — please try again.
              </p>
            )}
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                opacity: status === "sending" ? 0.6 : 1,
                marginTop: "0.5rem",
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.85";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              {status === "sending" ? "Sending…" : "Send Message"}
            </button>
          </form>
        )}
      </motion.div>
    </PageContainer>
  );
}
