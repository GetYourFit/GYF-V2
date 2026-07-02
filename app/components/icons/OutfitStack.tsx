interface Props { size?: number; className?: string; style?: React.CSSProperties; }

export function OutfitStack({ size = 24, className, style }: Props) {
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
      {/* Top layer */}
      <rect x="4" y="4" width="16" height="5" rx="1" />
      {/* Middle layer */}
      <rect x="4" y="10.5" width="16" height="3" rx="1" />
      {/* Bottom layer */}
      <rect x="4" y="15" width="16" height="5" rx="1" />
    </svg>
  );
}
