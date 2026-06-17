import Image from "next/image";

const navLinks = [
  { label: "What We Do", href: "#what-we-do" },
  { label: "Vision", href: "#vision" },
  { label: "The Arc", href: "#the-arc" },
  { label: "About", href: "#about" },
  { label: "Early Access", href: "#early-access" },
];

const socials = [
  { label: "Instagram", href: "#", svg: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/></svg> },
  { label: "X", href: "#", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { label: "LinkedIn", href: "#", svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
        <div className="flex flex-col md:flex-row md:justify-between gap-10">
          <div className="flex flex-col gap-3">
            <Image src="/assets/logo.png" alt="GYF" width={26} height={26} className="logo-white object-contain" />
            <span className="text-text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>Get Your Fit</span>
            <p className="text-text-muted max-w-xs mt-1" style={{ fontFamily: "var(--font-inter)", fontSize: "0.78rem", lineHeight: 1.75 }}>
              An AI-native personal stylist that learns what looks good on you.
            </p>
          </div>
          <nav className="flex flex-col gap-3">
            {navLinks.map(({ label, href }) => (
              <a key={label} href={href} className="text-text-muted hover:text-text-primary transition-colors"
                style={{ fontFamily: "var(--font-inter)", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex gap-4 items-start">
            {socials.map(({ svg, href, label }) => (
              <a key={label} href={href} aria-label={label} className="text-text-muted hover:text-text-primary transition-colors">{svg}</a>
            ))}
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row sm:justify-between gap-3">
          <p className="text-text-muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.1em" }}>© 2026 Get Your Fit</p>
          <div className="flex gap-6">
            {["Privacy Policy", "Terms"].map((t) => (
              <a key={t} href="#" className="text-text-muted hover:text-text-primary transition-colors"
                style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", letterSpacing: "0.1em" }}>{t}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
