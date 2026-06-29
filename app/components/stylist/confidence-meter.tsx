/** Honest confidence indicator — thin bar + mono label. Calibrated value only;
 *  never rounds to 100% so the user always sees a real signal. Gold (accent-warm)
 *  is the editorial callout reserved for a genuinely high-confidence look. */
export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const high = pct >= 75;
  const moderate = pct >= 50 && !high;
  const label = high ? "High" : moderate ? "Moderate" : "Exploring";
  const barColor = high ? "bg-accent-warm" : moderate ? "bg-text-mid" : "bg-text-faint";

  return (
    <div className="flex items-center gap-3" title={`Confidence: ${pct}%`}>
      <div
        className="h-0.5 w-20 overflow-hidden bg-surface-3"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} confidence, ${pct}%`}
      >
        <div
          className={`h-full transition-all duration-500 motion-reduce:transition-none ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`t-mono ${high ? "text-accent-warm" : "text-text-faint"}`}>
        {label} · {pct}%
      </span>
    </div>
  );
}
