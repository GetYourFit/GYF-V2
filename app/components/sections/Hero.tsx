"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useReveal } from "@/lib/useReveal";

export default function Hero() {
  useReveal();
  const [emailVal, setEmailVal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Show page immediately if no splash (e.g. server render or direct nav)
  useEffect(() => {
    const page = document.getElementById("page");
    if (page && !page.classList.contains("show")) {
      // Will be shown by SplashScreen on dismiss
    }
  }, []);

  return (
    <section
      id="hero"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(6rem,12vh,9rem) clamp(1.5rem,5vw,3.5rem) clamp(4rem,8vh,6rem)",
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(26,23,20,0.035) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          pointerEvents: "none",
        }}
      />

      {/* Gold radial glow top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "320px",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(139,107,62,0.11) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "780px", width: "100%" }}>
        {/* Eyebrow */}
        <p className="eyebrow reveal">Introducing GYF</p>

        {/* Logo */}
        <div className="reveal reveal-d1" style={{ marginBottom: "2rem" }}>
          <Image
            src="/assets/logo.png"
            alt="GYF"
            width={104}
            height={104}
            priority
            onLoad={() => setLogoLoaded(true)}
            style={{
              height: "clamp(64px, 12vw, 104px)",
              width: "auto",
              opacity: logoLoaded ? 1 : 0,
              transition: "opacity 0.8s ease",
            }}
          />
        </div>

        {/* H1 */}
        <h1
          className="reveal reveal-d2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.2rem, 5.5vw, 4.8rem)",
            fontWeight: 300,
            color: "var(--text)",
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            marginBottom: "1.5rem",
          }}
        >
          Your AI-Native Personal Stylist.{" "}
          <em style={{ color: "var(--gold)", fontStyle: "italic" }}>Complete Outfits.</em>{" "}
          <em style={{ color: "var(--gold)", fontStyle: "italic" }}>Clear Reasons.</em> Yours.
        </h1>

        {/* Sub copy */}
        <p
          className="reveal reveal-d3"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "clamp(0.9rem, 1.4vw, 1rem)",
            fontWeight: 300,
            color: "var(--faint)",
            lineHeight: 1.8,
            maxWidth: "520px",
            margin: "0 auto 2.5rem",
          }}
        >
          An AI stylist that sees your clothes visually, learns your personal taste, and builds
          complete coordinated looks — with a clear reason for every choice.
        </p>

        {/* Email form */}
        <div className="reveal reveal-d4" style={{ display: "flex", justifyContent: "center" }}>
          {submitted ? (
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.4rem",
                  fontWeight: 300,
                  color: "var(--text)",
                }}
              >
                You&apos;re on the list.
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  color: "var(--faint)",
                  textTransform: "uppercase",
                  marginTop: "0.5rem",
                }}
              >
                We&apos;ll be in touch when your spot is ready.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (emailVal.trim()) setSubmitted(true);
              }}
              className="cta-form"
              style={{ margin: 0 }}
            >
              <input
                type="email"
                value={emailVal}
                onChange={(e) => setEmailVal(e.target.value)}
                placeholder="your@email.com"
                required
                className="cta-input"
              />
              <button type="submit" className="cta-btn">
                Get Early Access
              </button>
            </form>
          )}
        </div>

        {/* Note */}
        <p className="cta-note reveal reveal-d5" style={{ marginTop: "1rem" }}>
          Free to join · No spam · Leave anytime
        </p>

        {/* Stats row */}
        <div className="stats-row reveal reveal-d5">
          <div className="stat">
            <span className="stat-num">AI</span>
            <span className="stat-label">Powered styling</span>
          </div>
          <div className="stat">
            <span className="stat-num">3-in-1</span>
            <span className="stat-label">Top · Bottom · Footwear</span>
          </div>
          <div className="stat">
            <span className="stat-num">∞</span>
            <span className="stat-label">Learns with every use</span>
          </div>
        </div>
      </div>
    </section>
  );
}
