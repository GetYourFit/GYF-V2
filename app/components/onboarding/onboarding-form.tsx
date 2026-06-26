"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { PhotoUpload } from "@/components/onboarding/photo-upload";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import {
  BODY_TYPES,
  CONSENT_OPTIONS,
  CURRENCIES,
  OCCASIONS,
  SKIN_TONES,
  STYLE_INTENTS,
  UNDERTONES,
} from "@/lib/vocab";
import type { Profile, ProfileInput } from "@gyf/types";

type ConsentState = Record<string, boolean>;

const EMPTY: ProfileInput = {
  skin_tone: "",
  undertone: "",
  body_type: "",
  style_intent: [],
  occasion: "",
  budget_range: { min: 0, max: null, currency: "USD" },
};

export function OnboardingForm() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [consent, setConsent] = useState<ConsentState>({ data_processing: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const api = browserApi();
    Promise.all([
      api.getProfile().catch((e: unknown) => {
        if (e instanceof ApiError && e.isNotOnboarded) return null;
        throw e;
      }),
      api.getConsent().catch(() => ({}) as ConsentState),
    ])
      .then(([profile, consentFlags]) => {
        if (profile) {
          setForm({
            skin_tone: profile.skin_tone ?? "",
            undertone: profile.undertone ?? "",
            body_type: profile.body_type ?? "",
            style_intent: profile.style_intent ?? [],
            occasion: profile.occasion ?? "",
            budget_range: profile.budget_range ?? { min: 0, max: null, currency: "USD" },
          });
        }
        setConsent({ data_processing: true, ...consentFlags });
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load your profile."),
      )
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleStyle(value: string) {
    const current = form.style_intent ?? [];
    set(
      "style_intent",
      current.includes(value) ? current.filter((s) => s !== value) : [...current, value],
    );
  }

  function applyEstimated(profile: Profile) {
    setForm((f) => ({
      ...f,
      skin_tone: profile.skin_tone ?? f.skin_tone,
      undertone: profile.undertone ?? f.undertone,
      body_type: profile.body_type ?? f.body_type,
      measurements:
        profile.measurements && Object.keys(profile.measurements).length > 0
          ? profile.measurements
          : f.measurements,
    }));
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const api = browserApi();
      await api.putProfile(form);
      await api.putConsent({ flags: consent });
      setSaved(true);
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="t-caption text-[var(--text-faint)]">Loading your profile…</p>;
  }

  const budget = form.budget_range ?? { min: 0, max: null, currency: "USD" };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <header>
        <h1 className="t-headline text-[var(--text)]">Your style profile</h1>
        <p className="mt-2 t-caption">
          Everything is optional and editable anytime — GYF sharpens as you use it.
        </p>
      </header>

      <Section title="You" hint="Helps GYF choose flattering colours and cuts.">
        <PhotoUpload onEstimated={applyEstimated} />
        <Field label="Skin tone">
          {(p) => (
            <Select
              {...p}
              options={SKIN_TONES}
              value={form.skin_tone ?? ""}
              onChange={(e) => set("skin_tone", e.target.value)}
            />
          )}
        </Field>
        <Field label="Undertone">
          {(p) => (
            <Select
              {...p}
              options={UNDERTONES}
              value={form.undertone ?? ""}
              onChange={(e) => set("undertone", e.target.value)}
            />
          )}
        </Field>
        <Field label="Body type">
          {(p) => (
            <Select
              {...p}
              options={BODY_TYPES}
              value={form.body_type ?? ""}
              onChange={(e) => set("body_type", e.target.value)}
            />
          )}
        </Field>
      </Section>

      <Section
        title="Style"
        hint="Pick any aesthetics you lean toward, and what you dress for most."
      >
        <fieldset>
          <legend className="t-label mb-3 text-[var(--text-faint)]">Style intent</legend>
          <div className="flex flex-wrap gap-2">
            {STYLE_INTENTS.map((s) => {
              const active = (form.style_intent ?? []).includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStyle(s.value)}
                  className={
                    "min-h-9 border px-3 py-1 t-label text-[10px] tracking-[0.14em] transition-all duration-[180ms] " +
                    (active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                      : "border-[var(--border-mid)] text-[var(--text-faint)] hover:border-[var(--border-hi)] hover:text-[var(--text)]")
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label="Usual occasion">
          {(p) => (
            <Select
              {...p}
              options={OCCASIONS}
              placeholder="No preference"
              value={form.occasion ?? ""}
              onChange={(e) => set("occasion", e.target.value)}
            />
          )}
        </Field>
      </Section>

      <Section title="Budget" hint="Per garment, not per outfit.">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Min">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                value={budget.min ?? 0}
                onChange={(e) => set("budget_range", { ...budget, min: Number(e.target.value) })}
              />
            )}
          </Field>
          <Field label="Max">
            {(p) => (
              <Input
                {...p}
                type="number"
                min={0}
                value={budget.max ?? ""}
                onChange={(e) =>
                  set("budget_range", {
                    ...budget,
                    max: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            )}
          </Field>
          <Field label="Currency">
            {(p) => (
              <Select
                {...p}
                options={CURRENCIES}
                placeholder="USD"
                value={budget.currency ?? "USD"}
                onChange={(e) =>
                  set("budget_range", { ...budget, currency: e.target.value || "USD" })
                }
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Privacy & consent" hint="You control your data. Change or revoke anytime.">
        <ul className="flex flex-col gap-4">
          {CONSENT_OPTIONS.map((c) => (
            <li key={c.value} className="flex items-start gap-3">
              <input
                id={`consent-${c.value}`}
                type="checkbox"
                className="mt-1 h-4 w-4 border-[var(--border-mid)] bg-[var(--surface)] accent-[var(--accent)]"
                checked={consent[c.value] ?? false}
                disabled={c.required}
                onChange={(e) => setConsent((s) => ({ ...s, [c.value]: e.target.checked }))}
              />
              <label htmlFor={`consent-${c.value}`} className="t-body text-[0.875rem]">
                <span className="font-medium text-[var(--text)]">{c.label}</span>
                {c.required && (
                  <span className="ml-2 t-mono text-[var(--text-faint)]">(required)</span>
                )}
                <span className="block t-caption mt-0.5">{c.description}</span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      {error && (
        <p role="alert" className="t-caption text-[var(--error)]">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="t-caption text-[var(--accent-warm)]">
          Saved.
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <DeleteAccount />
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving ? "Saving…" : "Save & see my outfits"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border border-[var(--border)] bg-[var(--surface)] p-6">
      <div>
        <h2 className="t-title text-[var(--text)]">{title}</h2>
        {hint && <p className="t-caption mt-1">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm("Delete your account and all your data? This cannot be undone.")) return;
    setBusy(true);
    try {
      await browserApi().deleteAccount();
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="text-[var(--error)] hover:text-[var(--error)]"
      disabled={busy}
      onClick={onDelete}
    >
      Delete account
    </Button>
  );
}
