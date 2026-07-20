import Svg, { Circle, Path } from "react-native-svg";

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

export function IconChevronLeft({ size, color }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M14.75 5.5 8.25 12l6.5 6.5" stroke={color} {...stroke} />
    </Icon>
  );
}

export function IconChevronRight({ size, color }: IconProps) {
  return (
    <Icon size={size}>
      <Path d="M9.25 5.5 15.75 12l-6.5 6.5" stroke={color} {...stroke} />
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

/* ── Nav glyphs (Ref3 floating pill) — one mark per tab ── */

export function IconSpark({ size, color }: IconProps) {
  // Stylist — the GYF mark: a four-petal spark, Cosmos-style.
  return (
    <Icon size={size}>
      <Path
        d="M12 3c.6 3.6 1.8 4.8 5.4 5.4-3.6.6-4.8 1.8-5.4 5.4-.6-3.6-1.8-4.8-5.4-5.4C10.2 7.8 11.4 6.6 12 3Z"
        fill={color}
      />
      <Path
        d="M17.5 14.5c.35 2.1 1.05 2.8 3.15 3.15-2.1.35-2.8 1.05-3.15 3.15-.35-2.1-1.05-2.8-3.15-3.15 2.1-.35 2.8-1.05 3.15-3.15Z"
        fill={color}
      />
    </Icon>
  );
}

export function IconGlobe({ size, color }: IconProps) {
  // Explore
  return (
    <Icon size={size}>
      <Path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke={color} {...stroke} />
      <Path
        d="M3 12h18M12 3c2.5 2.4 3.75 5.4 3.75 9S14.5 18.6 12 21c-2.5-2.4-3.75-5.4-3.75-9S9.5 5.4 12 3Z"
        stroke={color}
        {...stroke}
      />
    </Icon>
  );
}

export function IconHanger({ size, color }: IconProps) {
  // Wardrobe
  return (
    <Icon size={size}>
      <Path
        d="M12 9.5V8.75c1.24 0 2.25-1 2.25-2.25S13.24 4.25 12 4.25 9.75 5.26 9.75 6.5M12 9.5 3.6 15.9a1.5 1.5 0 0 0 .9 2.7h15a1.5 1.5 0 0 0 .9-2.7L12 9.5Z"
        stroke={color}
        {...stroke}
      />
    </Icon>
  );
}

export function IconPeople({ size, color }: IconProps) {
  // Social. Deliberately NOT a person silhouette: a head-and-shoulders glyph
  // reads as Profile at tab-bar size no matter how many figures it has, which
  // is exactly the confusion this replaces. A share graph — three nodes, two
  // links — carries "connected to others" with a different outline entirely.
  return (
    <Icon size={size}>
      <Circle cx="17.5" cy="6" r="2.75" stroke={color} {...stroke} />
      <Circle cx="6" cy="12" r="2.75" stroke={color} {...stroke} />
      <Circle cx="17.5" cy="18" r="2.75" stroke={color} {...stroke} />
      <Path d="m8.5 10.7 6.6-3.4M8.5 13.3l6.6 3.4" stroke={color} {...stroke} />
    </Icon>
  );
}

export function IconPerson({ size, color }: IconProps) {
  // Profile
  return (
    <Icon size={size}>
      <Path d="M12 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" stroke={color} {...stroke} />
      <Path d="M4.75 20c.75-3.6 3.6-5.75 7.25-5.75S18.5 16.4 19.25 20" stroke={color} {...stroke} />
    </Icon>
  );
}

export function IconSearch({ size, color }: IconProps) {
  // Explore search pill (Ref4)
  return (
    <Icon size={size}>
      <Path
        d="M10.75 17.5a6.75 6.75 0 1 0 0-13.5 6.75 6.75 0 0 0 0 13.5Z"
        stroke={color}
        {...stroke}
      />
      <Path d="m15.7 15.7 4.55 4.55" stroke={color} {...stroke} />
    </Icon>
  );
}

export function IconFilter({ size, color }: IconProps) {
  // Explore filter control: three sliding rails (Ref4's control density).
  return (
    <Icon size={size}>
      <Path d="M4 7h16M4 12h16M4 17h16" stroke={color} {...stroke} />
      <Path
        d="M9 7m-1.6 0a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0M15.5 12m-1.6 0a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0M7 17m-1.6 0a1.6 1.6 0 1 0 3.2 0 1.6 1.6 0 1 0-3.2 0"
        fill="none"
        stroke={color}
        {...stroke}
      />
    </Icon>
  );
}
