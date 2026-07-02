interface Props { size?: number; strokeWidth?: number; }

export function NavSocial({ size = 24, strokeWidth = 1.5 }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Primary person */}
      <circle cx="12" cy="7" r="3" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
      {/* Secondary person (left) */}
      <circle cx="5" cy="8" r="2.2" />
      <path d="M1 20v-.5A4.2 4.2 0 0 1 7 16" />
      {/* Secondary person (right) */}
      <circle cx="19" cy="8" r="2.2" />
      <path d="M23 20v-.5A4.2 4.2 0 0 0 17 16" />
    </svg>
  );
}
