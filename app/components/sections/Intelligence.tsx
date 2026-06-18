"use client";

import { useReveal } from "@/lib/useReveal";

const pillars = [
  {
    num: "01",
    title: "Visual Style Intelligence",
    body: "Sees clothing like a stylist — reading vibe, colour harmony, silhouette, and texture directly from images. Not tags. Not labels.",
  },
  {
    num: "02",
    title: "Deep Personal Taste Modelling",
    body: "Builds a living model of your preferences from every save, skip, and reaction. Anticipates what you'll love before you see it.",
  },
  {
    num: "03",
    title: "Collective Intelligence",
    body: "Patterns discovered across thousands of users, privacy-preserved and distilled into recommendations that are entirely personal to you.",
  },
  {
    num: "04",
    title: "Trust as a Feature",
    body: "Every outfit comes with a clear reason. GYF is transparent about what it knows, what it's still learning, and how confident it is.",
  },
];

export default function Intelligence() {
  useReveal();

  return (
    <section id="intelligence" style={{ background: "var(--text)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <p className="eyebrow reveal" style={{ color: "var(--gold)" }}>
          The Intelligence
        </p>
        <h2
          className="reveal reveal-d1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4vw, 3.2rem)",
            fontWeight: 300,
            color: "var(--bg)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: "520px",
          }}
        >
          Four pillars of AI that earns{" "}
          <em style={{ color: "var(--gold)", fontStyle: "italic" }}>trust.</em>
        </h2>

        <div className="intel-grid">
          {pillars.map(({ num, title, body }, i) => (
            <div key={num} className={`reveal reveal-d${i + 1}`}>
              <div className="intel-num">{num}</div>
              <div className="intel-title">{title}</div>
              <div className="intel-body">{body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
