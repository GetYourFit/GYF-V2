import Svg, { Path } from "react-native-svg";

/**
 * GYF's custom icon set — hand-drawn 24-grid line marks, 1.75 stroke,
 * round caps. No stock glyph libraries; new marks are added only when a
 * screen needs one.
 */
export interface IconProps {
  size?: number;
  color: string;
}

function Icon({ size = 20, children }: { size?: number; children: React.ReactNode }) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </Svg>
  );
}

const stroke = { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.75 } as const;

export function IconHeart({ size, color, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Icon size={size}>
      <Path
        d="M12 20.2S4.6 15.6 2.9 11.2C1.6 7.8 3.9 4.4 7.3 4.4c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.7 3.4 4.4 6.8-1.7 4.4-9.1 9-9.1 9Z"
        fill={filled ? color : "none"}
        stroke={color}
        {...stroke}
      />
    </Icon>
  );
}

export function IconChevronDown({ size, color }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M5.5 9.25 12 15.75l6.5-6.5" stroke={color} {...stroke} />
    </Icon>
  );
}

export function IconClose({ size, color }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke={color} {...stroke} />
    </Icon>
  );
}

export function IconRetry({ size, color }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5" stroke={color} {...stroke} />
    </Icon>
  );
}
