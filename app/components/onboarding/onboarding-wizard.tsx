"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Check, Zap } from "lucide-react";

import { PhotoUpload } from "@/components/onboarding/photo-upload";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import { mergeEstimated } from "@/lib/estimate";
import {
  BODY_TYPES,
  CONSENT_OPTIONS,
  CURRENCIES,
  GENDERS,
  OCCASIONS,
  SKIN_TONES,
  STYLE_INTENTS,
  UNDERTONES,
} from "@/lib/vocab";
import type { BudgetRange, Profile, ProfileInput } from "@gyf/types";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type ConsentState = Record<string, boolean>;
type EstimatedKey = "skin_tone" | "undertone" | "body_type";
const ESTIMATED_KEYS: EstimatedKey[] = ["skin_tone", "undertone", "body_type"];

const EMPTY: ProfileInput = {
  skin_tone: "",
  undertone: "",
  body_type: "",
  gender: "",
  style_intent: [],
  occasion: "",
  budget_range: { min: 0, max: null, currency: "USD" },
};

const STEPS = [
  { id: "you", label: "You" },
  { id: "style", label: "Style" },
  { id: "budget", label: "Budget" },
  { id: "privacy", label: "Privacy" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/* ── Dark field primitives ── */

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: "0.6rem",
      fontWeight: 500,
      letterSpacing: "0.1em",
      textTransform: "uppercase" as const,
      color: "#8a8a95",
      display: "block",
      marginBottom: "0.5rem",
    }}>
      {children}
    </span>
  );
}

function DarkSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Prefer not to say",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${focused ? "#ffffff" : "#444748"}`,
        borderRadius: 0,
        padding: "0.625rem 0",
        fontFamily: "var(--font-body)",
        fontSize: "0.9375rem",
        color: value ? "#e2e2e9" : "#8a8a95",
        outline: "none",
        appearance: "none",
        WebkitAppearance: "none",
        cursor: "pointer",
        transition: "border-color 0.2s",
        minHeight: "44px",
      }}
    >
      <option value="" style={{ background: "#0f0f12", color: "#8a8a95" }}>{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#0f0f12", color: "#e2e2e9" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function DarkInput({
  id,
  type = "text",
  value,
  onChange,
  min,
  placeholder,
}: {
  id?: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  min?: number;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      min={min}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: `1px solid ${focused ? "#ffffff" : "#444748"}`,
        borderRadius: 0,
        padding: "0.625rem 0",
        fontFamily: "var(--font-body)",
        fontSize: "0.9375rem",
        color: "#e2e2e9",
        outline: "none",
        transition: "border-color 0.2s",
        minHeight: "44px",
      }}
    />
  );
}

function FieldWrap({ label, badge, children }: { label: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
        <MonoLabel>{label}</MonoLabel>
        {badge}
      </div>
      {children}
    </div>
  );
}

/* ── Wizard ── */

export function OnboardingWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [consent, setConsent] = useState<ConsentState>({ data_processing: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimated, setEstimated] = useState<Set<EstimatedKey>>(new Set());

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
            gender: profile.gender ?? "",
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
    setEstimated((prev) => {
      if (!prev.has(key as EstimatedKey)) return prev;
      const next = new Set(prev);
      next.delete(key as EstimatedKey);
      return next;
    });
  }

  function toggleStyle(value: string) {
    const current = form.style_intent ?? [];
    set("style_intent", current.includes(value) ? current.filter((s) => s !== value) : [...current, value]);
  }

  function applyEstimated(profile: Profile): string[] {
    const { patch, applied } = mergeEstimated(profile);
    setForm((f) => ({ ...f, ...patch }));
    const filled = ESTIMATED_KEYS.filter((k) => patch[k] != null);
    setEstimated(new Set(filled));
    return applied;
  }

  function goTo(next: number) {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    panelRef.current?.focus();
  }, [step]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const api = browserApi();
      await api.putProfile(form);
      await api.putConsent({ flags: consent });
      toast({ variant: "success", title: "Profile saved", description: "Your stylist is composing looks for you." });
      router.push("/");
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not save your profile.";
      setError(message);
      toast({ variant: "error", title: "Couldn't save your profile", description: message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "2rem 0" }}>
        {[80, 60, 100].map((w, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.4, delay: i * 0.15, repeat: Infinity }}
            style={{ height: "12px", width: `${w}%`, background: "rgba(255,255,255,0.06)", borderRadius: "999px" }}
          />
        ))}
      </div>
    );
  }

  const budget = form.budget_range ?? { min: 0, max: null, currency: "USD" };
  const isLast = step === STEPS.length - 1;
  const currentStepId: StepId = STEPS[step]!.id;
  const offset = reduceMotion ? 0 : 32;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? offset : -offset, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -offset : offset, opacity: 0 }),
  };

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Step indicator ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#d4a96a",
        }}>
          Step {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
        </span>

        <ol aria-label="Onboarding progress" style={{ display: "flex", gap: "0.375rem", listStyle: "none", margin: 0, padding: 0 }}>
          {STEPS.map((s, i) => {
            const state = i === step ? "current" : i < step ? "done" : "upcoming";
            return (
              <li key={s.id} style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${s.label}${state === "done" ? " (completed)" : state === "current" ? " (current)" : ""}`}
                  style={{
                    position: "relative",
                    height: "2px",
                    width: "100%",
                    background: "#0f0f12",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  <motion.span
                    initial={false}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: EASE }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "#d4a96a",
                      display: "block",
                    }}
                  />
                </button>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.55rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: state === "current" ? "#e2e2e9" : "#444748",
                  transition: "color 0.2s",
                }}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── Animated step panel ── */}
      <div style={{ position: "relative", minHeight: "320px", overflow: "hidden" }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStepId}
            ref={panelRef}
            tabIndex={-1}
            role="group"
            aria-label={`${STEPS[step]!.label} — step ${step + 1} of ${STEPS.length}`}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0.15 : 0.28, ease: EASE }}
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem", outline: "none" }}
          >
            {currentStepId === "you" && <StepYou form={form} set={set} applyEstimated={applyEstimated} estimated={estimated} />}
            {currentStepId === "style" && <StepStyle form={form} toggleStyle={toggleStyle} set={set} />}
            {currentStepId === "budget" && <StepBudget budget={budget} set={set} />}
            {currentStepId === "privacy" && <StepPrivacy consent={consent} setConsent={setConsent} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "#ffb4ab", margin: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Navigation ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: "1.5rem",
      }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                minHeight: "44px",
                padding: "0 1rem",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "999px",
                color: "#8e9192",
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <ChevronLeft size={14} aria-hidden />
              Back
            </button>
          )}
          <DeleteAccount />
        </div>

        {isLast ? (
          <motion.button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            whileTap={saving ? undefined : { scale: 0.97 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minHeight: "44px",
              padding: "0 1.5rem",
              background: saving ? "rgba(255,255,255,0.1)" : "#ffffff",
              color: saving ? "#8a8a95" : "#0f0f12",
              border: "none",
              borderRadius: "999px",
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: saving ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {saving ? (
              <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                Saving…
              </motion.span>
            ) : (
              <>
                Save & meet your stylist
                <Check size={14} aria-hidden />
              </>
            )}
          </motion.button>
        ) : (
          <motion.button
            type="button"
            onClick={() => goTo(step + 1)}
            whileTap={{ scale: 0.97 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              minHeight: "44px",
              padding: "0 1.5rem",
              background: "#ffffff",
              color: "#0f0f12",
              border: "none",
              borderRadius: "999px",
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Next
            <ChevronRight size={14} aria-hidden />
          </motion.button>
        )}
      </div>
    </form>
  );
}

/* ─── Step panels ─────────────────────────────────────────────────────────── */

function EstimatedBadge() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: EASE }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        border: "1px solid rgba(240,189,143,0.4)",
        padding: "0.125rem 0.5rem",
        fontFamily: "var(--font-mono)",
        fontSize: "0.5rem",
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
        color: "#d4a96a",
        flexShrink: 0,
      }}
    >
      <Zap size={10} aria-hidden />
      AI Est.
    </motion.span>
  );
}

function StepHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <h2 style={{
        fontFamily: "var(--font-body)",
        fontSize: "1.375rem",
        fontWeight: 700,
        color: "#e8e4dc",
        margin: 0,
        letterSpacing: "-0.02em",
      }}>
        {title}
      </h2>
      {hint && (
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.8125rem",
          color: "#8a8a95",
          marginTop: "0.375rem",
        }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function StepYou({
  form,
  set,
  applyEstimated,
  estimated,
}: {
  form: ProfileInput;
  set: <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => void;
  applyEstimated: (profile: Profile) => string[];
  estimated: Set<EstimatedKey>;
}) {
  return (
    <>
      <StepHeader title="About you" hint="Helps GYF choose flattering colours and cuts. Everything is optional." />
      <PhotoUpload onEstimated={applyEstimated} />
      <FieldWrap label="I'm shopping for">
        <DarkSelect
          options={GENDERS}
          placeholder="No preference"
          value={form.gender ?? ""}
          onChange={(v) => set("gender", v)}
        />
      </FieldWrap>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>
        <FieldWrap label="Skin tone" badge={estimated.has("skin_tone") ? <EstimatedBadge /> : null}>
          <DarkSelect options={SKIN_TONES} value={form.skin_tone ?? ""} onChange={(v) => set("skin_tone", v)} />
        </FieldWrap>
        <FieldWrap label="Undertone" badge={estimated.has("undertone") ? <EstimatedBadge /> : null}>
          <DarkSelect options={UNDERTONES} value={form.undertone ?? ""} onChange={(v) => set("undertone", v)} />
        </FieldWrap>
        <FieldWrap label="Body type" badge={estimated.has("body_type") ? <EstimatedBadge /> : null}>
          <DarkSelect options={BODY_TYPES} value={form.body_type ?? ""} onChange={(v) => set("body_type", v)} />
        </FieldWrap>
      </div>
    </>
  );
}

function StepStyle({
  form,
  toggleStyle,
  set,
}: {
  form: ProfileInput;
  toggleStyle: (v: string) => void;
  set: <K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) => void;
}) {
  return (
    <>
      <StepHeader title="Your style" hint="Pick the aesthetics you lean toward and occasions you dress for." />
      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <MonoLabel>Style intent</MonoLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {STYLE_INTENTS.map((s) => {
            const active = (form.style_intent ?? []).includes(s.value);
            return (
              <motion.button
                key={s.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStyle(s.value)}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                style={{
                  minHeight: "36px",
                  padding: "0 0.875rem",
                  border: `1px solid ${active ? "#d4a96a" : "rgba(255,255,255,0.08)"}`,
                  background: active ? "rgba(240,189,143,0.08)" : "transparent",
                  color: active ? "#d4a96a" : "#8a8a95",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  borderRadius: "999px",
                  cursor: "pointer",
                  transition: "all 0.18s",
                }}
              >
                {s.label}
              </motion.button>
            );
          })}
        </div>
      </fieldset>
      <FieldWrap label="Usual occasion">
        <DarkSelect
          options={OCCASIONS}
          placeholder="No preference"
          value={form.occasion ?? ""}
          onChange={(v) => set("occasion", v)}
        />
      </FieldWrap>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem" }}>
        <FieldWrap label="Min">
          <DarkInput
            type="number"
            min={0}
            value={budget.min ?? 0}
            onChange={(v) => set("budget_range", { ...budget, min: Number(v) })}
          />
        </FieldWrap>
        <FieldWrap label="Max">
          <DarkInput
            type="number"
            min={0}
            value={budget.max ?? ""}
            placeholder="No limit"
            onChange={(v) => set("budget_range", { ...budget, max: v === "" ? null : Number(v) })}
          />
        </FieldWrap>
        <FieldWrap label="Currency">
          <DarkSelect
            options={CURRENCIES}
            placeholder="USD"
            value={budget.currency ?? "USD"}
            onChange={(v) => set("budget_range", { ...budget, currency: v || "USD" })}
          />
        </FieldWrap>
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
      <StepHeader title="Privacy & consent" hint="You control your data. Change or revoke anytime." />
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {CONSENT_OPTIONS.map((c) => (
          <li key={c.value} style={{ display: "flex", alignItems: "flex-start", gap: "0.875rem" }}>
            <input
              id={`consent-${c.value}`}
              type="checkbox"
              checked={consent[c.value] ?? false}
              disabled={c.required}
              onChange={(e) => setConsent((s) => ({ ...s, [c.value]: e.target.checked }))}
              style={{
                marginTop: "2px",
                width: "16px",
                height: "16px",
                flexShrink: 0,
                accentColor: "#d4a96a",
                cursor: c.required ? "not-allowed" : "pointer",
              }}
            />
            <label htmlFor={`consent-${c.value}`} style={{ cursor: c.required ? "default" : "pointer" }}>
              <span style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#e2e2e9",
                display: "block",
              }}>
                {c.label}
                {c.required && (
                  <span style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.55rem",
                    color: "#8a8a95",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginLeft: "0.5rem",
                  }}>
                    required
                  </span>
                )}
              </span>
              <span style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "#8a8a95",
                display: "block",
                marginTop: "0.25rem",
              }}>
                {c.description}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
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
    <button
      type="button"
      disabled={busy}
      onClick={onDelete}
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: "44px",
        padding: "0 0.5rem",
        background: "transparent",
        border: "none",
        color: busy ? "#444748" : "#8a8a95",
        fontFamily: "var(--font-mono)",
        fontSize: "0.55rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        cursor: busy ? "not-allowed" : "pointer",
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLButtonElement).style.color = "#ffb4ab"; }}
      onMouseLeave={(e) => { if (!busy) (e.currentTarget as HTMLButtonElement).style.color = "#8a8a95"; }}
    >
      Delete account
    </button>
  );
}
