"use client";

import { useReveal } from "@/lib/useReveal";

const features = [
  {
    title: "Complete Outfit Generation",
    body: "Top, bottom, and footwear coordinated as one complete look — never single items in isolation.",
    tag: "Core",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    title: "Visual Style Intelligence",
    body: "Reads vibe, color harmony, silhouette, and texture directly from images — not just tags and labels.",
    tag: "AI Vision",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      </svg>
    ),
  },
  {
    title: "Deep Taste Modelling",
    body: "Builds a living model of your preferences from every interaction. Gets more personal the more you use it.",
    tag: "Personalisation",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    title: "See It On You",
    body: "Select a full outfit and see it rendered photo-realistically on your own body — before you commit.",
    tag: "Try-On",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    title: "Inspiration & Social",
    body: "Follow someone's style and have it re-rendered for your own skin tone and preferences — never blindly copied.",
    tag: "Social",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: "Shop the Look",
    body: "Every outfit links directly to the retailer product page. Affiliate-powered, with no markups or hidden costs.",
    tag: "Commerce",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
  },
];

export default function WhatWeDo() {
  useReveal();

  return (
    <section id="features" style={{ background: "var(--surface)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <p className="eyebrow reveal">Features</p>
        <h2
          className="reveal reveal-d1"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 4vw, 3.2rem)",
            fontWeight: 300,
            color: "var(--text)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: "520px",
          }}
        >
          Everything you need to get dressed with{" "}
          <em style={{ color: "var(--gold)", fontStyle: "italic" }}>confidence.</em>
        </h2>

        <div className="feat-grid">
          {features.map(({ title, body, tag, icon }, i) => (
            <div key={title} className={`feat-card reveal reveal-d${(i % 3) + 1}`}>
              <div className="feat-icon">{icon}</div>
              <div className="feat-title">{title}</div>
              <div className="feat-body">{body}</div>
              <div className="feat-tag">{tag}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
