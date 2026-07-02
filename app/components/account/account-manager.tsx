"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/api-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const CONSENT_FLAGS: Array<{ key: string; title: string; description: string }> = [
  {
    key: "data_processing",
    title: "Personalized styling",
    description:
      "Let GYF process your photos and preferences to deduce body type, skin tone, and the looks that suit you. Required for photo-based onboarding.",
  },
  {
    key: "behavioral_learning",
    title: "Learn from my activity",
    description:
      "Use your saves, skips, and views to sharpen recommendations over time. Turning this off keeps styling on your stated preferences only.",
  },
  {
    key: "marketing",
    title: "Product updates",
    description: "Occasional email about new features and styling drops. Never shared.",
  },
];

type Status = "loading" | "ready" | "error";

export function AccountManager() {
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState<Status>("loading");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const flags = await browserApi().getConsent();
      if (!mounted.current) return;
      setSaved(flags); setDraft(flags); setStatus("ready");
    } catch {
      if (mounted.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    browserApi().getConsent()
      .then((flags) => { if (!mounted.current) return; setSaved(flags); setDraft(flags); setStatus("ready"); })
      .catch(() => mounted.current && setStatus("error"));
  }, []);

  const confirmInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (confirming) confirmInputRef.current?.focus();
  }, [confirming]);

  const dirty = CONSENT_FLAGS.some((f) => Boolean(draft[f.key]) !== Boolean(saved[f.key]));

  const saveConsent = useCallback(async () => {
    setSaving(true);
    const flags = Object.fromEntries(CONSENT_FLAGS.map((f) => [f.key, Boolean(draft[f.key])]));
    try {
      const merged = await browserApi().putConsent({ flags });
      setSaved(merged); setDraft(merged);
      toast({ variant: "success", title: "Preferences saved", description: "Your choices are in effect." });
    } catch {
      toast({ variant: "error", title: "Couldn't save", description: "Please try again." });
    } finally {
      setSaving(false);
    }
  }, [draft, toast]);

  const exportData = useCallback(async () => {
    setExporting(true);
    try {
      const api = browserApi();
      const [profile, savedItems, savedOutfits, wardrobe, summary, consent] = await Promise.all([
        api.getProfile().catch(() => null),
        api.listSaved().catch(() => []),
        api.listSavedOutfits().catch(() => []),
        api.listWardrobe().catch(() => []),
        api.getProfileSummary().catch(() => null),
        api.getConsent().catch(() => ({})),
      ]);
      const bundle = {
        exported_at: new Date().toISOString(),
        format: "gyf-data-export/v1",
        profile, consent, summary,
        saved_items: savedItems, saved_outfits: savedOutfits, wardrobe,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gyf-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast({ variant: "success", title: "Export ready", description: "Your data is downloading." });
    } catch {
      toast({ variant: "error", title: "Export failed", description: "Please try again." });
    } finally {
      setExporting(false);
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    try {
      await createSupabaseBrowserClient().auth.signOut();
      router.push("/login"); router.refresh();
    } catch {
      toast({ variant: "error", title: "Couldn't sign out", description: "Please try again." });
    }
  }, [router, toast]);

  const deleteAccount = useCallback(async () => {
    setDeleting(true);
    try {
      await browserApi().deleteAccount();
      await createSupabaseBrowserClient().auth.signOut();
      toast({ variant: "success", title: "Account deleted", description: "Your data has been erased." });
      router.push("/login"); router.refresh();
    } catch {
      setDeleting(false);
      toast({ variant: "error", title: "Deletion failed", description: "Please try again." });
    }
  }, [router, toast]);

  if (status === "loading") return <AccountSkeleton />;
  if (status === "error") return <ErrorState onRetry={load} />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      style={{ display: "flex", flexDirection: "column", gap: "3rem" }}
    >
      {/* ── Privacy controls ── */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 500,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9490",
            marginBottom: "0.5rem",
          }}>
            Privacy controls
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#9a9490", lineHeight: 1.55 }}>
            You decide what GYF can use. Changes take effect the moment you save.
          </p>
        </div>
        <ul
          role="list"
          style={{
            listStyle: "none", margin: 0, padding: 0,
            border: "1px solid rgba(0,0,0,0.10)", background: "#faf8f5",
          }}
        >
          {CONSENT_FLAGS.map((flag, i) => (
            <ConsentRow
              key={flag.key}
              title={flag.title}
              description={flag.description}
              checked={Boolean(draft[flag.key])}
              first={i === 0}
              onChange={(next) => setDraft((d) => ({ ...d, [flag.key]: next }))}
            />
          ))}
        </ul>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            onClick={saveConsent}
            disabled={!dirty || saving}
            aria-busy={saving}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minHeight: "44px", padding: "0 1.5rem",
              background: !dirty || saving ? "rgba(0,0,0,0.08)" : "#ffffff",
              color: !dirty || saving ? "#9a9490" : "#faf8f5",
              border: "none", borderRadius: "999px", cursor: !dirty || saving ? "not-allowed" : "pointer",
              fontFamily: "var(--font-mono)", fontSize: "0.6rem",
              fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
              transition: "all 0.2s",
            }}
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
          {dirty && (
            <span role="status" style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "#d4607a", letterSpacing: "0.06em" }}>
              Unsaved changes
            </span>
          )}
        </div>
      </section>

      {/* ── Data portability ── */}
      <section style={{
        display: "flex", flexDirection: "column", gap: "1rem",
        borderTop: "1px solid rgba(0,0,0,0.10)", paddingTop: "2rem",
      }}>
        <div>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 500,
            letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9490",
            marginBottom: "0.5rem",
          }}>
            Your data
          </p>
          <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#9a9490", lineHeight: 1.55, maxWidth: "320px" }}>
            Download everything GYF holds about you — your profile, saved looks, wardrobe, and preferences — as a single JSON file.
          </p>
        </div>
        <button
          type="button"
          onClick={exportData}
          disabled={exporting}
          aria-busy={exporting}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minHeight: "44px", padding: "0 1.5rem", alignSelf: "flex-start",
            border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
            color: "#1c1a17", cursor: exporting ? "not-allowed" : "pointer",
            fontFamily: "var(--font-mono)", fontSize: "0.6rem",
            fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
            opacity: exporting ? 0.5 : 1, borderRadius: "999px",
          }}
        >
          {exporting ? "Preparing…" : "Download my data"}
        </button>
      </section>

      {/* ── Account / danger zone ── */}
      <section style={{
        display: "flex", flexDirection: "column", gap: "1rem",
        borderTop: "1px solid rgba(0,0,0,0.10)", paddingTop: "2rem",
      }}>
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: "0.55rem", fontWeight: 500,
          letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a9490",
        }}>
          Account
        </p>

        {!confirming ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={signOut}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minHeight: "44px", padding: "0 1.5rem",
                border: "1px solid rgba(255,255,255,0.2)", background: "transparent",
                color: "#1c1a17", cursor: "pointer", borderRadius: "999px",
                fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
              }}
            >
              Sign out
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minHeight: "44px", padding: "0 1.5rem",
                border: "1px solid rgba(255,180,171,0.3)", background: "transparent",
                color: "#c0392b", cursor: "pointer", borderRadius: "999px",
                fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
              }}
            >
              Delete my account
            </button>
          </div>
        ) : (
          <div
            role="alert"
            style={{
              display: "flex", flexDirection: "column", gap: "1rem",
              border: "1px solid rgba(255,180,171,0.25)",
              background: "rgba(255,180,171,0.04)", padding: "1.25rem",
              borderRadius: "999px",
            }}
          >
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "#5c5650", lineHeight: 1.6, margin: 0 }}>
              This permanently erases your profile, saved looks, wardrobe, and posts. It can&apos;t be undone.
              Type <span style={{ fontFamily: "var(--font-mono)", color: "#c0392b" }}>DELETE</span> to confirm.
            </p>
            <input
              ref={confirmInputRef}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm account deletion"
              autoComplete="off"
              style={{
                maxWidth: "200px", minHeight: "44px",
                background: "transparent",
                border: "none", borderBottom: "1px solid rgba(255,180,171,0.4)",
                color: "#c0392b", outline: "none", padding: "0.5rem 0",
                fontFamily: "var(--font-mono)", fontSize: "0.875rem",
                letterSpacing: "0.06em",
              }}
            />
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={deleting || confirmText !== "DELETE"}
                aria-busy={deleting}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  minHeight: "44px", padding: "0 1.5rem",
                  background: confirmText === "DELETE" && !deleting ? "#c0392b" : "rgba(255,180,171,0.12)",
                  color: confirmText === "DELETE" && !deleting ? "#faf8f5" : "#c0392b",
                  border: "none", borderRadius: "999px",
                  cursor: deleting || confirmText !== "DELETE" ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                  fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                  opacity: deleting ? 0.6 : 1, transition: "all 0.2s",
                }}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setConfirming(false); setConfirmText(""); }}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-mono)", fontSize: "0.6rem",
                  color: "#9a9490", letterSpacing: "0.06em", textTransform: "uppercase",
                  minHeight: "44px", padding: "0 0.75rem",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", color: "#9a9490", maxWidth: "320px", lineHeight: 1.5 }}>
          Your data is yours — we remove it on request, immediately.
        </p>
      </section>
    </motion.div>
  );
}

function ConsentRow({
  title, description, checked, first, onChange,
}: {
  title: string; description: string; checked: boolean; first: boolean; onChange: (next: boolean) => void;
}) {
  const labelId = useId();
  const descId = useId();
  return (
    <li style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: "1.25rem", padding: "1.25rem",
      borderTop: first ? "none" : "1px solid rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <span id={labelId} style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", fontWeight: 600, color: "#1c1a17" }}>
          {title}
        </span>
        <span id={descId} style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#9a9490", lineHeight: 1.55, maxWidth: "280px" }}>
          {description}
        </span>
      </div>
      {/* Inline switch — ochre when on */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descId}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0, marginTop: "2px",
          position: "relative", display: "inline-flex",
          width: "44px", height: "24px", alignItems: "center",
          border: `1px solid ${checked ? "#d4607a" : "rgba(255,255,255,0.2)"}`,
          background: checked ? "rgba(240,189,143,0.15)" : "transparent",
          cursor: "pointer", transition: "all 0.2s", borderRadius: "999px",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: checked ? "calc(100% - 18px)" : "2px",
            width: "14px", height: "14px",
            background: checked ? "#d4607a" : "#9a9490",
            transition: "left 0.2s, background 0.2s",
          }}
        />
      </button>
    </li>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "5rem 1rem" }}>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "1.125rem", fontWeight: 700, color: "#1c1a17", marginBottom: "0.75rem" }}>
        Couldn&apos;t load your settings
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#9a9490", marginBottom: "2rem" }}>
        Something went wrong reaching GYF. Your data is safe — try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minHeight: "44px", padding: "0 1.5rem",
          border: "1px solid rgba(255,255,255,0.2)", background: "transparent",
          color: "#1c1a17", cursor: "pointer", borderRadius: "999px",
          fontFamily: "var(--font-mono)", fontSize: "0.6rem",
          fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
        }}
      >
        Retry
      </button>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }} aria-hidden>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ height: "12px", width: "160px", background: "rgba(0,0,0,0.06)", borderRadius: "999px" }} />
        <div style={{ border: "1px solid rgba(0,0,0,0.10)" }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`row-${i}`} style={{
              height: "96px", background: "rgba(0,0,0,0.04)",
              borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)",
            }} />
          ))}
        </div>
      </div>
      <div style={{ height: "112px", background: "rgba(0,0,0,0.04)", borderRadius: "999px" }} />
    </div>
  );
}
