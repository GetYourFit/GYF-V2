"use client";

import { useState } from "react";
import Image from "next/image";
import { useReveal } from "@/lib/useReveal";

export default function CTABanner() {
  useReveal();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="cta" style={{ textAlign: "center" }}>
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        <div className="reveal" style={{ marginBottom: "1.5rem" }}>
          <Image src="/assets/logo.png" alt="GYF" width={52} height={52} style={{ objectFit: "contain" }} />
        </div>

        <h2
          className="reveal reveal-d1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.2rem, 5.5vw, 4.2rem)",
            fontWeight: 300,
            color: "var(--text)",
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            marginBottom: "1.25rem",
          }}
        >
          Stop second-guessing.{" "}
          <em style={{ color: "var(--gold)", fontStyle: "italic" }}>Start getting dressed.</em>
        </h2>

        <p
          className="reveal reveal-d2"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.9rem, 1.4vw, 1rem)",
            fontWeight: 300,
            color: "var(--faint)",
            lineHeight: 1.8,
            maxWidth: "440px",
            margin: "0 auto 0.5rem",
          }}
        >
          Join the waitlist. Be among the first to experience an AI stylist that truly knows you.
        </p>

        <div className="reveal reveal-d3">
          {submitted ? (
            <div style={{ marginTop: "2rem" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 300, color: "var(--text)" }}>
                You&apos;re on the list.
              </p>
              <p className="cta-note">We&apos;ll be in touch when your spot is ready.</p>
            </div>
          ) : (
            <>
              <form
                onSubmit={(e) => { e.preventDefault(); if (email.trim()) setSubmitted(true); }}
                className="cta-form"
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="cta-input"
                />
                <button type="submit" className="cta-btn">Join Waitlist</button>
              </form>
              <p className="cta-note">Free to join · No spam · Leave anytime</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
