/** Confidence pill badge — high/moderate/low with visual weight proportional to signal. */
export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const high = pct >= 75;
  const moderate = pct >= 50 && !high;
  const label = high ? "Strong match" : moderate ? "Good match" : "Exploring";

  return (
    <div className="inline-flex items-center gap-1.5" title={`Confidence: ${pct}%`}>
      {/* Track */}
      <div
        className="h-1 w-14 overflow-hidden rounded-full bg-border"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}, ${pct}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 motion-reduce:transition-none ${
            high ? "bg-accent" : moderate ? "bg-text-mid" : "bg-border-mid"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`t-mono ${high ? "text-accent font-semibold" : "text-text-faint"}`}
      >
        {label}
      </span>
    </div>
  );
}
