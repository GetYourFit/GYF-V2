"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PageContainer } from "@/components/layout/page-container";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const reduce = useReducedMotion();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
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
        <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#d4607a", marginBottom: "0.5rem" }}>
          Get in touch
        </p>
        <h1 style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.03em", color: "#1c1a17", lineHeight: 1.1, marginBottom: "0.75rem" }}>
          Contact Us
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#5c5650", lineHeight: 1.65 }}>
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
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
              background: "#f4f1ec",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#5c5650",
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
            <div>
              <p style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9a9490", marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "#1c1a17" }}>{value}</p>
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
              background: "#f4f1ec",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.06)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✓</div>
            <p style={{ fontWeight: 700, color: "#1c1a17", marginBottom: 4 }}>Message sent!</p>
            <p style={{ fontSize: "0.85rem", color: "#5c5650" }}>We&apos;ll get back to you within 24 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {(["name", "email"] as const).map((field) => (
              <div key={field} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label
                  htmlFor={field}
                  style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5c5650" }}
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
                    borderBottom: "1.5px solid rgba(0,0,0,0.18)",
                    borderRadius: 0,
                    fontSize: "0.9375rem",
                    color: "#1c1a17",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderBottomColor = "#1c1a17"; }}
                  onBlur={(e) => { e.currentTarget.style.borderBottomColor = "rgba(0,0,0,0.18)"; }}
                />
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <label
                htmlFor="message"
                style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5c5650" }}
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
                  borderBottom: "1.5px solid rgba(0,0,0,0.18)",
                  borderRadius: 0,
                  fontSize: "0.9375rem",
                  color: "#1c1a17",
                  outline: "none",
                  resize: "none",
                  lineHeight: 1.6,
                  transition: "border-color 0.2s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => { e.currentTarget.style.borderBottomColor = "#1c1a17"; }}
                onBlur={(e) => { e.currentTarget.style.borderBottomColor = "rgba(0,0,0,0.18)"; }}
              />
            </div>
            <button
              type="submit"
              style={{
                marginTop: "0.5rem",
                height: 48,
                borderRadius: 12,
                background: "#1c1a17",
                color: "#faf8f5",
                fontWeight: 700,
                fontSize: "0.875rem",
                letterSpacing: "0.04em",
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Send Message
            </button>
          </form>
        )}
      </motion.div>
    </PageContainer>
  );
}
