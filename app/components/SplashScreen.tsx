"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // 3D mouse tracking
    const onMouseMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rx = ((e.clientY - cy) / rect.height) * -12;
      const ry = ((e.clientX - cx) / rect.width) * 12;
      stage.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    };
    const onMouseLeave = () => {
      stage.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);

    // Animate gold line
    if (lineRef.current) {
      lineRef.current.style.transition = "width 2.4s cubic-bezier(0.16,1,0.3,1)";
      requestAnimationFrame(() => {
        if (lineRef.current) lineRef.current.style.width = "100%";
      });
    }

    const dismiss = () => {
      const el = document.getElementById("gyf-splash");
      if (!el) return;
      el.style.transition = "opacity 0.65s ease";
      el.style.opacity = "0";
      setTimeout(() => {
        setVisible(false);
        const page = document.getElementById("page");
        if (page) page.classList.add("show");
      }, 680);
    };

    const timer = setTimeout(dismiss, 2800);
    const onKey = () => { clearTimeout(timer); dismiss(); };
    const onClick = () => { clearTimeout(timer); dismiss(); };

    document.addEventListener("keydown", onKey, { once: true });
    document.getElementById("gyf-splash")?.addEventListener("click", onClick, { once: true });

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      id="gyf-splash"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(460px circle at 50% 44%, rgba(139,107,62,.18), transparent 62%), radial-gradient(circle at 50% 42%, #201C18 0%, #0E0C0A 74%)",
        cursor: "pointer",
      }}
    >
      {/* Stage with 3D tilt */}
      <div
        ref={stageRef}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          transformStyle: "preserve-3d",
          transition: "transform 0.1s ease",
        }}
      >
        <Image
          src="/assets/logo.png"
          alt="GYF"
          width={88}
          height={88}
          style={{ filter: "brightness(0) invert(1)" }}
          priority
        />
        <p
          style={{
            fontFamily: "var(--font-body), sans-serif",
            fontWeight: 300,
            fontSize: "0.6rem",
            textTransform: "uppercase",
            letterSpacing: "0.48em",
            color: "rgba(240,236,226,0.45)",
          }}
        >
          Get Your Fit
        </p>
      </div>

      {/* Skip text */}
      <p
        style={{
          position: "absolute",
          bottom: "3.5rem",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "9px",
          letterSpacing: "0.25em",
          color: "rgba(240,236,226,0.2)",
          textTransform: "uppercase",
        }}
      >
        Click to enter
      </p>

      {/* Gold bottom line */}
      <div
        ref={lineRef}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: "1px",
          width: "0%",
          background: "var(--gold)",
        }}
      />
    </div>
  );
}
