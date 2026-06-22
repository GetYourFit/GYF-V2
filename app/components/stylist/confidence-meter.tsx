import { cn } from "@/lib/cn";

/** Honest confidence (CLAUDE.md §7): show the real calibrated value, never round
 *  to 100%. A short label + a slim bar communicate certainty without overclaiming. */
export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const label = pct >= 75 ? "High confidence" : pct >= 50 ? "Moderate confidence" : "Exploring";
  const tone = pct >= 75 ? "bg-[var(--gold)]" : pct >= 50 ? "bg-[var(--mid)]" : "bg-[var(--faint)]";

  return (
    <div className="flex items-center gap-2.5" title={`Calibrated confidence: ${pct}%`}>
      <div
        className="h-[3px] w-16 overflow-hidden bg-[var(--rule)]"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}, ${pct}%`}
      >
        <div className={cn("h-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.15em] text-[var(--faint)]">
        {label} · {pct}%
      </span>
    </div>
  );
}
