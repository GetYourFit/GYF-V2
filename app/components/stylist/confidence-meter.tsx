/** Honest confidence indicator — thin bar + mono label. Calibrated value only;
 *  never rounds to 100% so the user always sees a real signal. */
export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const label = pct >= 75 ? "High" : pct >= 50 ? "Moderate" : "Exploring";
  const barColor =
    pct >= 75 ? "bg-text" : pct >= 50 ? "bg-text-mid" : "bg-text-faint";

  return (
    <div className="flex items-center gap-3" title={`Confidence: ${pct}%`}>
      <div
        className="h-[2px] w-20 overflow-hidden bg-surface-3"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} confidence, ${pct}%`}
      >
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="t-mono text-text-faint">
        {label} · {pct}%
      </span>
    </div>
  );
}
