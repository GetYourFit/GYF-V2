interface Props { size?: number; className?: string; style?: React.CSSProperties; }

export function Fire({ size = 24, className, style }: Props) {
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
      <path d="M8.5 14c0-4 5-9 5-9s-1 4.5 2 6.5c0 0 .5-2 .5-3.5C17 9.5 19 12 19 15a7 7 0 0 1-14 0c0-2 1-3.5 2-4.5 0 1.5.5 3 1.5 3.5Z" />
    </svg>
  );
}
