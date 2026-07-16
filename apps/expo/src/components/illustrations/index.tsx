import Svg, { Circle, Path } from "react-native-svg";

/**
 * Empty/error state illustrations — custom single-stroke line drawings in
 * the icon set's voice, not stock clipart. One per state, added as screens
 * need them.
 */
export interface IllustrationProps {
  size?: number;
  color: string;
  accentColor?: string;
}

/** A bare hanger — nothing on the rail yet. */
export function IllustrationEmptyHanger({ size = 96, color }: IllustrationProps) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 120 120" width={size}>
      <Path
        d="M60 30c0-5 4-9 9-9s9 4 9 9-4 8-9 10v8"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={2.5}
        transform="translate(-9 0)"
      />
      <Path
        d="M60 48 18 76c-2.6 1.7-1.4 5.8 1.7 5.8h80.6c3.1 0 4.3-4.1 1.7-5.8L60 48Z"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
      />
      <Path d="M34 93h52" stroke={color} strokeLinecap="round" strokeWidth={2.5} opacity={0.35} />
    </Svg>
  );
}

/** A stitch come loose — something needs mending. */
export function IllustrationLooseThread({ size = 96, color }: IllustrationProps) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 120 120" width={size}>
      <Path
        d="M22 78c10-2 14-10 12-18s4-16 14-16 14 8 12 16 2 16 12 16 16-6 16-14"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={2.5}
      />
      <Path
        d="M88 62c0-8-6-14-6-14"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={2.5}
        opacity={0.35}
      />
      <Circle cx={22} cy={78} r={4} stroke={color} strokeWidth={2.5} />
      <Path d="M92 40l8-8M96 44l8-8" stroke={color} strokeLinecap="round" strokeWidth={2.5} />
    </Svg>
  );
}
