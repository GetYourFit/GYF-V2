"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

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
import type { BudgetRange, Profile, ProfileInput } from "@gyf/types";

type ConsentState = Record<string, boolean>;

const EMPTY: ProfileInput = {
  skin_tone: "",
  undertone: "",
  body_type: "",
  style_intent: [],
  occasion: "",
  budget_range: { min: 0, max: null, currency: "USD" },
};

const STEPS = [
  { id: "you",     label: "You"     },
  { id: "style",   label: "Style"   },
  { id: "budget",  label: "Budget"  },
  { id: "privacy", label: "Privacy" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const lux = [0.16, 1, 0.3, 1] as const;

/** Stepped onboarding wizard — same backend contract as `OnboardingForm` but
 *  presented one section at a time with Framer Motion slide transitions. */
export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [consent, setConsent] = useState<ConsentState>({ data_processing: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const api = browserApi();
      await api.putProfile(form);
      await api.putConsent({ flags: consent });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-1 w-full bg-[var(--surface-2)]" />
        <p className="t-caption text-[var(--text-faint)]">Loading your profile…</p>
      </div>
    );
  }

  const budget = form.budget_range ?? { min: 0, max: null, currency: "USD" };
  const isLast = step === STEPS.length - 1;
  const currentStepId: StepId = STEPS[step]!.id;

  const variants = {
    enter:  (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      {/* Progress bar + step labels */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              className="group flex flex-1 flex-col gap-1.5"
              aria-current={i === step ? "step" : undefined}
            >
              <div
                className={`h-[2px] w-full transition-colors duration-300 ${
                  i <= step ? "bg-[var(--accent)]" : "bg-[var(--surface-3)]"
                }`}
              />
              <span
                className={`t-mono transition-colors duration-200 ${
                  i === step ? "text-[var(--text)]" : "text-[var(--text-faint)]"
                }`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Animated step panel */}
      <div className="relative min-h-[320px] overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStepId}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: lux }}
            className="flex flex-col gap-6"
          >
            {currentStepId === "you" && (
              <StepYou
                form={form}
                set={set}
                applyEstimated={applyEstimated}
              />
            )}
            {currentStepId === "style" && (
              <StepStyle
                form={form}
                set={set}
                toggleStyle={toggleStyle}
              />
            )}
            {currentStepId === "budget" && (
              <StepBudget budget={budget} set={set} />
            )}
            {currentStepId === "privacy" && (
              <StepPrivacy consent={consent} setConsent={setConsent} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <p role="alert" className="t-caption text-[var(--error)]">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 border-t border-[var(--rule)] pt-6">
        <div className="flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => goTo(step - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
          )}
          <DeleteAccount />
        </div>

        {isLast ? (
          <Button type="submit" disabled={saving} aria-busy={saving}>
            {saving ? "Saving…" : "Save & meet your stylist"}
            {!saving && <Check className="h-4 w-4" aria-hidden />}
          </Button>
        ) : (
          <Button type="button" onClick={() => goTo(step + 1)}>
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}

/* ─── Step panels ─────────────────────────────────────────────────────────── */

function StepYou({
  form,
  set,
  applyEstimated,
}: {
  form: ProfileInput;
  set: <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => void;
  applyEstimated: (profile: Profile) => void;
}) {
  return (
    <>
      <StepHeader
        title="About you"
        hint="Helps GYF choose flattering colours and cuts. Everything is optional."
      />
      <PhotoUpload onEstimated={applyEstimated} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>
    </>
  );
}

function StepStyle({
  form,
  set,
  toggleStyle,
}: {
  form: ProfileInput;
  set: <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => void;
  toggleStyle: (v: string) => void;
}) {
  return (
    <>
      <StepHeader
        title="Your style"
        hint="Pick the aesthetics you lean toward and the occasions you dress for most."
      />
      <fieldset>
        <legend className="t-label mb-4 text-[var(--text-faint)]">Style intent</legend>
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
    </>
  );
}

function StepBudget({
  budget,
  set,
}: {
  budget: BudgetRange;
  set: <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => void;
}) {
  return (
    <>
      <StepHeader title="Budget" hint="Per garment, not per outfit." />
      <div className="grid grid-cols-3 gap-4">
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
    </>
  );
}

function StepPrivacy({
  consent,
  setConsent,
}: {
  consent: ConsentState;
  setConsent: React.Dispatch<React.SetStateAction<ConsentState>>;
}) {
  return (
    <>
      <StepHeader
        title="Privacy & consent"
        hint="You control your data. Change or revoke anytime."
      />
      <ul className="flex flex-col gap-5">
        {CONSENT_OPTIONS.map((c) => (
          <li key={c.value} className="flex items-start gap-4">
            <input
              id={`consent-${c.value}`}
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0 border-[var(--border-mid)] bg-[var(--surface)] accent-[var(--accent)]"
              checked={consent[c.value] ?? false}
              disabled={c.required}
              onChange={(e) => setConsent((s) => ({ ...s, [c.value]: e.target.checked }))}
            />
            <label htmlFor={`consent-${c.value}`}>
              <span className="t-body font-medium text-[var(--text)]">{c.label}</span>
              {c.required && (
                <span className="ml-2 t-mono text-[var(--text-faint)]">(required)</span>
              )}
              <span className="block t-caption mt-0.5">{c.description}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function StepHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="t-title text-[var(--text)]">{title}</h2>
      {hint && <p className="mt-1 t-caption">{hint}</p>}
    </div>
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
      size="sm"
      className="text-[var(--error)] hover:text-[var(--error)]"
      disabled={busy}
      onClick={onDelete}
    >
      Delete account
    </Button>
  );
}
