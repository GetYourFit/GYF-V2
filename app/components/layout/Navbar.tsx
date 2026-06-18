"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const navLinks = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Vision", href: "#vision" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <nav className={`gyf-nav${scrolled ? " scrolled" : ""}`}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.65rem", textDecoration: "none" }}>
          <Image src="/assets/logo.png" alt="GYF" width={36} height={36} priority style={{ objectFit: "contain" }} />
        </Link>

        {/* Desktop links */}
        <ul className="nav-links" style={{ display: "flex", listStyle: "none", gap: "2.5rem", margin: 0, padding: 0 }}>
          {navLinks.map(({ label, href }) => (
            <li key={label} style={{ display: "none" }} className="md-show">
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <a href="#cta" className="nav-cta" style={{ display: "none" }} id="nav-cta-desktop">
            Join Waitlist
          </a>
          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
              padding: "4px",
            }}
          >
            <span style={{ display: "block", width: "20px", height: "1px", background: "var(--text)" }} />
            <span style={{ display: "block", width: "14px", height: "1px", background: "var(--text)" }} />
          </button>
        </div>
      </nav>

      {/* Desktop nav via style injection */}
      <style>{`
        @media (min-width: 768px) {
          .md-show { display: list-item !important; }
          #nav-cta-desktop { display: inline-flex !important; }
        }
      `}</style>

      {/* Mobile drawer */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 1.5rem",
              height: "64px",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <Image src="/assets/logo.png" alt="GYF" width={32} height={32} style={{ objectFit: "contain" }} />
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--mid)",
              }}
            >
              Close
            </button>
          </div>
          <nav style={{ padding: "3rem 2rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2rem, 7vw, 3.5rem)",
                  fontWeight: 300,
                  color: "var(--text)",
                  textDecoration: "none",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid var(--rule)",
                  letterSpacing: "-0.01em",
                }}
              >
                {label}
              </a>
            ))}
            <a
              href="#cta"
              onClick={() => setMenuOpen(false)}
              className="nav-cta"
              style={{ marginTop: "2.5rem", alignSelf: "flex-start" }}
            >
              Join Waitlist
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
