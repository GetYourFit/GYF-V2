"use client";

import { useReveal } from "@/lib/useReveal";

const phases = [
  {
    num: "01",
    title: "Intelligent Stylist",
    body: "Onboarding, cold start, explained outfits, occasion-aware recommendations, basic try-on, social posts.",
    badge: "launch",
    badgeLabel: "Launching",
  },
  {
    num: "02",
    title: "Personal Taste Engine",
    body: "Wardrobe-aware styling, deeper personalisation, context-aware recommendations, badges.",
    badge: "soon",
    badgeLabel: "Coming Soon",
  },
  {
    num: "03",
    title: "Shopping Companion",
    body: "Multi-retailer recommendations, smarter buying decisions, richer commerce integrations.",
    badge: "soon",
    badgeLabel: "Roadmap",
  },
  {
    num: "04",
    title: "Visualisation Layer",
    body: "High-fidelity multi-garment on-body try-on — photo-realistic, true to your body.",
    badge: "soon",
    badgeLabel: "Roadmap",
  },
  {
    num: "05",
    title: "Ambient Stylist",
    body: "Compounding collective intelligence and a B2B data product built from the world's taste.",
    badge: "soon",
    badgeLabel: "Future",
  },
];

export default function Vision() {
  useReveal();

  return (
    <section id="vision">
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <p className="eyebrow reveal">The Arc</p>
        <h2
          className="reveal reveal-d1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4vw, 3.2rem)",
            fontWeight: 300,
            color: "var(--text)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: "480px",
            marginBottom: "3.5rem",
          }}
        >
          A stylist that compounds.
        </h2>

        <div className="vision-grid">
          {/* Phases */}
          <div>
            {phases.map(({ num, title, body, badge, badgeLabel }, i) => (
              <div key={num} className={`phase reveal reveal-d${i + 1}`}>
                <span className="phase-num">{num}</span>
                <div>
                  <div className="phase-title">{title}</div>
                  <div className="phase-body">{body}</div>
                  <span className={`phase-badge ${badge}`}>{badgeLabel}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sticky quote card */}
          <div>
            <div className="vision-quote-card reveal reveal-d2">
              <div className="vision-quote-mark">&ldquo;</div>
              <p className="vision-quote-text">
                A personal stylist has always been a luxury for the few. GYF makes that
                intelligence universal — not by simplifying style, but by learning it.
              </p>
              <div className="vision-quote-rule" />
              <p className="vision-quote-attr">GYF Vision, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
