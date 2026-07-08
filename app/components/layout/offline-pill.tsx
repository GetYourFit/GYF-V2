"use client";

import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/** Honest connectivity signal (§7.2): a quiet pill instead of dead white pages. */
export function OfflinePill() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "fixed",
            bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            background: "var(--text)",
            color: "var(--bg)",
            borderRadius: "999px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          }}
        >
          <WifiOff size={12} aria-hidden />
          You&apos;re offline — reconnect to sync
        </motion.div>
      )}
    </AnimatePresence>
  );
}
