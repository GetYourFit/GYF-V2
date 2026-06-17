"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "What We Do", href: "#what-we-do" },
  { label: "Vision", href: "#vision" },
  { label: "The Arc", href: "#the-arc" },
  { label: "About", href: "#about" },
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
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: scrolled ? "rgba(10,10,10,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(34,34,34,0.8)" : "none",
        }}>
        <nav className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <Image src="/assets/logo.png" alt="GYF" width={28} height={28} className="logo-white object-contain" priority />
            <span className="text-text-muted hidden sm:block" style={{ fontFamily: "var(--font-mono)", fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Get Your Fit
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map(({ label, href }) => (
              <li key={label}>
                <a href={href} className="text-text-muted hover:text-text-primary transition-colors duration-200"
                  style={{ fontFamily: "var(--font-inter)", fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <a href="#early-access" className="btn-outline hidden md:inline-flex">Get Early Access</a>
            <button onClick={() => setMenuOpen(true)} className="md:hidden text-text-muted hover:text-text-primary transition-colors" aria-label="Open menu">
              <Menu size={18} />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-[200] flex flex-col"
            style={{ background: "#0a0a0a" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between px-6 h-16 border-b border-border">
              <Image src="/assets/logo.png" alt="GYF" width={26} height={26} className="logo-white object-contain" />
              <button onClick={() => setMenuOpen(false)} className="text-text-muted hover:text-text-primary transition-colors" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col p-8 flex-1 justify-center gap-2">
              {navLinks.map(({ label, href }, i) => (
                <motion.a key={label} href={href} onClick={() => setMenuOpen(false)}
                  className="text-text-muted hover:text-text-primary transition-colors py-4 border-b border-border"
                  style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,7vw,3.5rem)", fontWeight: 300, letterSpacing: "-0.02em" }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}>
                  {label}
                </motion.a>
              ))}
              <motion.a href="#early-access" onClick={() => setMenuOpen(false)} className="btn-outline mt-10 self-start"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                Get Early Access
              </motion.a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
