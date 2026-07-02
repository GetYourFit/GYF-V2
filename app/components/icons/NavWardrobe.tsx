interface Props { size?: number; strokeWidth?: number; }

export function NavWardrobe({ size = 24, strokeWidth = 1.5 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Cabinet body */}
      <rect x="3" y="3" width="18" height="18" rx="2" />
      {/* Centre divider */}
      <line x1="12" y1="3" x2="12" y2="21" />
      {/* Left handle */}
      <circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none" />
      {/* Right handle */}
      <circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
