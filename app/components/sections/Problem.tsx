"use client";

import { useReveal } from "@/lib/useReveal";

const problems = [
  {
    num: "01",
    text: "A full closet and still nothing to wear — the daily decision that drains you before the day even starts.",
  },
  {
    num: "02",
    text: "Shopping apps show items, never complete outfits. You're left to figure out how things work together alone.",
  },
  {
    num: "03",
    text: "Constant second-guessing: does this match? Is it right for the occasion? Does it actually suit me?",
  },
  {
    num: "04",
    text: "A personal stylist has always been a luxury for the few. Everyone else figures it out alone.",
  },
];

export default function Problem() {
  useReveal();

  return (
    <section id="problem" style={{ background: "var(--text)", color: "var(--bg)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <p className="eyebrow reveal" style={{ color: "var(--gold)" }}>
          The Problem
        </p>
        <h2
          className="reveal reveal-d1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
            fontWeight: 300,
            color: "var(--bg)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: "560px",
          }}
        >
          Everyone lives the same quiet friction.
        </h2>

        <div className="problem-grid">
          {problems.map(({ num, text }, i) => (
            <div key={num} className={`problem-card reveal reveal-d${i + 1}`}>
              <p className="problem-num">{num}</p>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
