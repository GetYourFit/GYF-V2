// Accessible tabs — one implementation of the WAI-ARIA tabs pattern (roving
// tabindex, Arrow/Home/End keyboard nav, animated underline indicator), so
// surfaces stop hand-rolling `role="tablist"` blocks without keyboard support.
//
// Usage:
//   <Tabs value={tab} onValueChange={setTab} label="Add a garment">
//     <TabList>
//       <Tab value="upload">Upload</Tab>
//       <Tab value="url">From URL</Tab>
//     </TabList>
//     <TabPanel value="upload">…</TabPanel>
//     <TabPanel value="url">…</TabPanel>
//   </Tabs>

"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";

interface TabsCtx {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
  layoutId: string;
}

const Ctx = createContext<TabsCtx | null>(null);

function useTabs(component: string): TabsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(`<${component}> must be used inside <Tabs>`);
  return ctx;
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const baseId = useId();
  const layoutId = `tab-indicator-${baseId}`;
  return (
    <Ctx.Provider value={{ value, setValue: onValueChange, baseId, layoutId }}>
      <div className={className}>{children}</div>
    </Ctx.Provider>
  );
}

export function TabList({
  children,
  label,
  className,
}: {
  children: ReactNode;
  /** Accessible name for the tablist (aria-label). */
  label: string;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow / Home / End move focus + selection across the visible tabs.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const current = tabs.findIndex((t) => t === document.activeElement);
    if (current === -1) return;
    e.preventDefault();
    let next = current;
    if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    tabs[next]?.focus();
    tabs[next]?.click();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 border-b border-border", className)}
    >
      {children}
    </div>
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { value: active, setValue, baseId, layoutId } = useTabs("Tab");
  const reduce = useReducedMotion();
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        "relative px-4 py-3 transition-colors duration-200",
        "t-label focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        selected ? "text-text" : "text-text-faint hover:text-text-mid",
      )}
    >
      {children}
      {selected && (
        <motion.span
          layoutId={reduce ? undefined : layoutId}
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-px bg-accent"
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </button>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const { value: active, baseId } = useTabs("TabPanel");
  if (active !== value) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      tabIndex={0}
      className="focus-visible:outline-none"
    >
      {children}
    </div>
  );
}
