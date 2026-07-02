interface Props {
  size?: number;
  strokeWidth?: number;
}

/** Outfit hanger — premium nav icon for the Stylist Feed tab */
export function NavFeed({ size = 24, strokeWidth = 1.5 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Hook */}
      <path d="M12 4a2 2 0 0 1 2 2c0 .9-.6 1.7-1.4 1.9" />
      {/* Hanger arc spreading to shoulders */}
      <path d="M12 7.9 C8 8.5 4 11 4 14 h16 c0-3-4-5.5-8-6.1Z" />
      {/* Shoulder bar bottom */}
      <path d="M4 14 v1.5 a1.5 1.5 0 0 0 1.5 1.5 h13 a1.5 1.5 0 0 0 1.5-1.5 V14" />
    </svg>
  );
}
