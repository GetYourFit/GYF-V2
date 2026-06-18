import Image from "next/image";

const navLinks = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Vision", href: "#vision" },
  { label: "Join Waitlist", href: "#cta" },
];

const socials = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/getyourfit.gyf",
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/get-your-fit-g-y-f/",
    svg: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="gyf-footer">
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3rem", justifyContent: "space-between", marginBottom: "3rem" }}>
          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Image src="/assets/logo.png" alt="GYF" width={36} height={36} style={{ objectFit: "contain" }} />
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.82rem",
              color: "var(--faint)",
              lineHeight: 1.7,
              maxWidth: "220px",
            }}>
              An AI-native personal stylist that learns what looks good on you.
            </p>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10.5px",
                  fontWeight: 400,
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                  color: "var(--mid)",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Socials */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
            {socials.map(({ label, href, svg }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--mid)", transition: "color 0.2s", textDecoration: "none" }}
              >
                {svg}
              </a>
            ))}
          </div>
        </div>

        <div style={{
          borderTop: "1px solid var(--rule)",
          paddingTop: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "1rem",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--faint)", letterSpacing: "0.1em" }}>
            © 2026 Get Your Fit Ltd
          </p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {["Privacy Policy", "Terms"].map((t) => (
              <a
                key={t}
                href="#"
                style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--faint)", letterSpacing: "0.1em", textDecoration: "none" }}
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
