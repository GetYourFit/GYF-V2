"use client";

// Dependency-free toast system on framer-motion (already a dependency). Token-styled
// to the editorial-gallery design language. Mount <ToastProvider> once near the root,
// then call useToast().toast({ ... }) from any client component.

import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, X, AlertTriangle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** ms before auto-dismiss; 0 keeps it until dismissed. Default 4000. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description" | "duration">> {
  id: number;
  description?: string;
  duration: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof Check> = {
  success: Check,
  error: AlertTriangle,
  info: Info,
};

const ACCENT: Record<ToastVariant, string> = {
  success: "text-accent",
  error: "text-error",
  info: "text-text-mid",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const schedule = useCallback(
    (id: number, duration: number) => {
      if (duration <= 0) return;
      const handle = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
    },
    [dismiss],
  );

  // Pause auto-dismiss while a toast is hovered/focused (SC 2.2.1); resume on leave.
  const pause = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const resume = useCallback(
    (id: number, duration: number) => {
      if (!timers.current.has(id)) schedule(id, duration);
    },
    [schedule],
  );

  const toast = useCallback(
    ({ title, description, variant = "info", duration = 4000 }: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);
      schedule(id, duration);
    },
    [schedule],
  );

  // Clear every outstanding timer if the provider unmounts (e.g. navigation).
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-end sm:px-6">
        {/* Errors announce assertively; success/info politely (SC 4.1.3). */}
        <span aria-live="assertive" className="sr-only">
          {toasts
            .filter((t) => t.variant === "error")
            .map((t) => t.title)
            .join(". ")}
        </span>
        <span aria-live="polite" className="sr-only">
          {toasts
            .filter((t) => t.variant !== "error")
            .map((t) => t.title)
            .join(". ")}
        </span>
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICONS[t.variant];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                role="status"
                onMouseEnter={() => pause(t.id)}
                onMouseLeave={() => resume(t.id, t.duration)}
                onFocusCapture={() => pause(t.id)}
                onBlurCapture={() => resume(t.id, t.duration)}
                className={cn(
                  "pointer-events-auto relative flex w-full max-w-sm flex-col overflow-hidden",
                  "border border-border-mid bg-surface shadow-card",
                )}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <Icon size={16} className={cn("mt-0.5 shrink-0", ACCENT[t.variant])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="t-title text-sm text-text">{t.title}</p>
                    {t.description && (
                      <p className="t-caption mt-0.5 text-text-mid">{t.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => dismiss(t.id)}
                    className="-mr-1.5 -mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center text-text-faint transition-colors hover:text-text focus-visible:text-text focus-visible:outline-none"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </div>
                {/* Progress drain bar */}
                {t.duration > 0 && (
                  <motion.div
                    className={cn("h-[2px]", t.variant === "error" ? "bg-error" : t.variant === "success" ? "bg-success" : "bg-border-hi")}
                    initial={{ scaleX: 1, originX: 0 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: t.duration / 1000, ease: "linear" }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
