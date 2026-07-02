interface Props { size?: number; className?: string; style?: React.CSSProperties; }

export function Spark({ size = 24, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
      style={style}
    >
      {/* 4-point star / spark */}
      <path d="M12 2 13.5 10.5 22 12 13.5 13.5 12 22 10.5 13.5 2 12 10.5 10.5Z" />
    </svg>
  );
}
