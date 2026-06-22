"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

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
import type { ProfileInput } from "@gyf/types";

type ConsentState = Record<string, boolean>;

const EMPTY: ProfileInput = {
  skin_tone: "",
  undertone: "",
  body_type: "",
  style_intent: [],
  occasion: "",
  budget_range: { min: 0, max: null, currency: "USD" },
};

/** Manual onboarding (P1-B Cycle 1 path): every field optional, pre-filled when a
 *  profile exists (always-editable), persisted via PUT /profile + PUT /consent. */
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
        if (e instanceof ApiError && e.isNotOnboarded) return null; // first-time user
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
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function toggleStyle(value: string) {
    const current = form.style_intent ?? [];
    set("style_intent", current.includes(value) ? current.filter((s) => s !== value) : [...current, value]);
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
    return <p className="text-neutral-500">Loading your profile…</p>;
  }

  const budget = form.budget_range ?? { min: 0, max: null, currency: "USD" };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-neutral-900">Your style profile</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Everything is optional and editable anytime — GYF sharpens as you use it.
        </p>
      </header>

      <Section title="You" hint="Helps GYF choose flattering colours and cuts.">
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
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
          📷 Photo onboarding (auto-detect tone & body type) — experimental, coming soon.
        </p>
      </Section>

      <Section title="Style" hint="Pick any aesthetics you lean toward, and what you dress for most.">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-neutral-800">Style intent</legend>
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
                    "min-h-9 rounded-full border px-3 py-1 text-sm transition-colors " +
                    (active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50")
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
                onChange={(e) => set("budget_range", { ...budget, currency: e.target.value || "USD" })}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Privacy & consent" hint="You control your data. Change or revoke anytime.">
        <ul className="flex flex-col gap-3">
          {CONSENT_OPTIONS.map((c) => (
            <li key={c.value} className="flex items-start gap-3">
              <input
                id={`consent-${c.value}`}
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-neutral-300"
                checked={consent[c.value] ?? false}
                disabled={c.required}
                onChange={(e) => setConsent((s) => ({ ...s, [c.value]: e.target.checked }))}
              />
              <label htmlFor={`consent-${c.value}`} className="text-sm">
                <span className="font-medium text-neutral-800">{c.label}</span>
                {c.required && <span className="ml-2 text-xs text-neutral-500">(required)</span>}
                <span className="block text-xs text-neutral-500">{c.description}</span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm font-medium text-green-700">
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

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6">
      <div>
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Right-to-erasure: tombstones the account, then returns to the marketing site. */
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
    <Button type="button" variant="ghost" className="text-red-600" disabled={busy} onClick={onDelete}>
      Delete account
    </Button>
  );
}
