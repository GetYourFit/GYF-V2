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

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "info", duration = 4000 }: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:items-end sm:px-6"
      >
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
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3",
                  "border border-border-mid bg-surface px-4 py-3 shadow-card",
                )}
              >
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
                  className="-mr-1 -mt-1 shrink-0 p-1 text-text-faint transition-colors hover:text-text"
                >
                  <X size={14} />
                </button>
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
