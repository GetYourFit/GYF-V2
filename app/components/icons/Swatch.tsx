interface Props { size?: number; className?: string; style?: React.CSSProperties; }

export function Swatch({ size = 24, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={style}
    >
      {/* Large swatch card */}
      <rect x="3" y="3" width="12" height="16" rx="1.5" />
      {/* Small swatch overlapping */}
      <rect x="10" y="6" width="11" height="15" rx="1.5" />
      {/* Colour dot on large card */}
      <circle cx="9" cy="9" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}
