interface Props { size?: number; className?: string; style?: React.CSSProperties; }

export function Hanger({ size = 24, className, style }: Props) {
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
      {/* Hook at top */}
      <path d="M12 3a2 2 0 0 1 2 2c0 .8-.5 1.5-1.2 1.8" />
      {/* Hanger bar spreading out */}
      <path d="M12 6.8 3 15h18L12 6.8Z" />
      {/* Hanger bottom rail */}
      <path d="M5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
