interface Props { size?: number; className?: string; style?: React.CSSProperties; }

export function StyleDNA({ size = 24, className, style }: Props) {
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
      {/* Left helix strand */}
      <path d="M6 3c0 4 4 4 4 8s-4 4-4 8" />
      {/* Right helix strand */}
      <path d="M18 3c0 4-4 4-4 8s4 4 4 8" />
      {/* Cross rungs */}
      <line x1="6" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="6" y1="16" x2="18" y2="16" />
    </svg>
  );
}
