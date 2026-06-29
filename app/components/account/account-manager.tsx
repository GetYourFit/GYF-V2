"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { browserApi } from "@/lib/api-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const lux = [0.16, 1, 0.3, 1] as const;

/** The consent flags the product surfaces, in display order. The backend stores
 *  an open map and merges on write, so listing them here is the single source of
 *  truth for what a user can grant/revoke — and `data_processing` is the one the
 *  API enforces before any photo module runs. */
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

  // Guards every async setState against a unmounted/navigated-away component, so
  // both the mount load and the retry handler are race-safe (no state writes
  // after teardown, even under Strict Mode double-invocation).
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const flags = await browserApi().getConsent();
      if (!mounted.current) return;
      setSaved(flags);
      setDraft(flags);
      setStatus("ready");
    } catch {
      if (mounted.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    browserApi()
      .getConsent()
      .then((flags) => {
        if (!mounted.current) return;
        setSaved(flags);
        setDraft(flags);
        setStatus("ready");
      })
      .catch(() => mounted.current && setStatus("error"));
  }, []);

  // Move focus into the confirmation region when it reveals, so keyboard /
  // switch-access users land on the type-to-confirm input instead of dropping to
  // <body> (the confirm button starts disabled until "DELETE" is typed).
  const confirmInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (confirming) confirmInputRef.current?.focus();
  }, [confirming]);

  const dirty = CONSENT_FLAGS.some((f) => Boolean(draft[f.key]) !== Boolean(saved[f.key]));

  const saveConsent = useCallback(async () => {
    setSaving(true);
    // Send the full known set so an explicit "off" is recorded, not just grants.
    const flags = Object.fromEntries(CONSENT_FLAGS.map((f) => [f.key, Boolean(draft[f.key])]));
    try {
      const merged = await browserApi().putConsent({ flags });
      setSaved(merged);
      setDraft(merged);
      toast({
        variant: "success",
        title: "Preferences saved",
        description: "Your choices are in effect.",
      });
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
        profile,
        consent,
        summary,
        saved_items: savedItems,
        saved_outfits: savedOutfits,
        wardrobe,
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gyf-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        variant: "success",
        title: "Export ready",
        description: "Your data is downloading.",
      });
    } catch {
      toast({ variant: "error", title: "Export failed", description: "Please try again." });
    } finally {
      setExporting(false);
    }
  }, [toast]);

  const signOut = useCallback(async () => {
    try {
      await createSupabaseBrowserClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      toast({ variant: "error", title: "Couldn't sign out", description: "Please try again." });
    }
  }, [router, toast]);

  const deleteAccount = useCallback(async () => {
    setDeleting(true);
    try {
      await browserApi().deleteAccount();
      await createSupabaseBrowserClient().auth.signOut();
      toast({
        variant: "success",
        title: "Account deleted",
        description: "Your data has been erased.",
      });
      router.push("/login");
      router.refresh();
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
      transition={{ duration: 0.35, ease: lux }}
      className="flex flex-col gap-12"
    >
      {/* Consent */}
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="t-label text-text-faint">Privacy controls</h2>
          <p className="t-caption max-w-prose">
            You decide what GYF can use. Changes take effect the moment you save.
          </p>
        </div>
        <ul role="list" className="flex flex-col border border-border bg-surface">
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
        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={saveConsent}
            disabled={!dirty || saving}
            aria-busy={saving}
          >
            {saving ? "Saving…" : "Save preferences"}
          </Button>
          <span role="status" className="t-caption text-text-faint">
            {dirty ? "Unsaved changes" : ""}
          </span>
        </div>
      </section>

      {/* Data portability */}
      <section className="flex flex-col gap-4 border-t border-border pt-10">
        <div className="flex flex-col gap-1">
          <h2 className="t-label text-text-faint">Your data</h2>
          <p className="t-caption max-w-prose">
            Download everything GYF holds about you — your profile, saved looks, wardrobe, and
            preferences — as a single JSON file.
          </p>
        </div>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={exportData}
            disabled={exporting}
            aria-busy={exporting}
          >
            {exporting ? "Preparing…" : "Download my data"}
          </Button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="flex flex-col gap-4 border-t border-border pt-10">
        <h2 className="t-label text-text-faint">Account</h2>
        {!confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={signOut}>
              Sign out
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="text-error hover:text-error"
              onClick={() => setConfirming(true)}
            >
              Delete my account
            </Button>
          </div>
        ) : (
          <div role="alert" className="flex flex-col gap-4 border border-error/40 bg-error/5 p-5">
            <p className="t-caption text-text">
              This permanently erases your profile, saved looks, wardrobe, and posts. It can&apos;t
              be undone. Type <span className="t-mono text-text">DELETE</span> to confirm.
            </p>
            <Input
              ref={confirmInputRef}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm account deletion"
              autoComplete="off"
              className="max-w-[200px]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="danger"
                onClick={deleteAccount}
                disabled={deleting || confirmText !== "DELETE"}
                aria-busy={deleting}
              >
                {deleting ? "Deleting…" : "Permanently delete"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        <p className="t-caption text-text-faint max-w-prose">
          Your data is yours — we remove it on request, immediately.
        </p>
      </section>
    </motion.div>
  );
}

function ConsentRow({
  title,
  description,
  checked,
  first,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  first: boolean;
  onChange: (next: boolean) => void;
}) {
  const labelId = useId();
  const descId = useId();
  return (
    <li
      className={`flex items-start justify-between gap-5 p-5 ${first ? "" : "border-t border-rule"}`}
    >
      <div className="flex flex-col gap-1.5">
        <span id={labelId} className="t-title text-text">
          {title}
        </span>
        <span id={descId} className="t-caption max-w-prose">
          {description}
        </span>
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        aria-labelledby={labelId}
        aria-describedby={descId}
        className="mt-1"
      />
    </li>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <p className="t-headline text-text">Couldn&apos;t load your settings</p>
      <p className="mt-3 t-caption mx-auto max-w-xs">
        Something went wrong reaching GYF. Your data is safe — try again.
      </p>
      <Button type="button" variant="secondary" onClick={onRetry} className="mt-8">
        Retry
      </Button>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-12" aria-hidden>
      <div className="flex flex-col gap-5">
        <div className="h-4 w-40 skeleton" />
        <div className="border border-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`row-${i}`} className="h-24 skeleton border-t border-rule first:border-t-0" />
          ))}
        </div>
      </div>
      <div className="h-28 skeleton" />
    </div>
  );
}
