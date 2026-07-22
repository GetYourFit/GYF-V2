import { useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { IconHeart } from "@/components/icons";
import { colors, radii, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";
import { ConfidenceBadge } from "./confidence-badge";
import { DEFAULT_RATIO } from "./catalog-frame";
import { CatalogImage } from "./catalog-image";
import { GyfText } from "./gyf-text";
import { PressableScale, hitSlopFor } from "./pressable-scale";

export interface ProductCardItem {
  id?: string;
  title: string;
  brand?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  /** 0–1 fraction or 0–100 percent; unusable values render no badge. */
  matchPercent?: number | null;
  saved?: boolean;
}

/**
 * The one product card: wardrobe (no match %), explore/saved (match % +
 * save toggle). The plate takes each catalog image's own shape, clamped so no
 * one card dwarfs its row; text sizes are capped so large Dynamic
 * Type reflows instead of clipping.
 */
export function ProductCard({
  item,
  width,
  onPress,
  onToggleSave,
  theme: themeProp,
}: {
  item: ProductCardItem;
  width: number;
  onPress?: () => void;
  onToggleSave?: (saved: boolean) => void;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
  const palette = colors[theme];
  // Every plate used to be a hard 4:3 under contentFit="cover", so anything
  // that was not 4:3 lost its edges — on a garment that is the hem or the
  // shoes. The frame now takes the shape the image actually is.
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const pop = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const toggleSave = () => {
    pop.value = withSequence(
      withTiming(1.15, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
    );
    onToggleSave?.(!item.saved);
  };

  return (
    <PressableScale
      accessibilityLabel={[item.brand, item.title].filter(Boolean).join(", ")}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      // Editorial plate, not a boxed card: the garment image IS the card and
      // the caption hangs beneath it — gallery composition, no double frame.
      style={{ gap: spacing.sm, width }}
    >
      <View>
        <CatalogImage
          label={item.title}
          recyclingKey={item.id ?? item.imageUrl ?? item.title}
          onRatio={setRatio}
          style={{
            backgroundColor: palette.surfaceRaised,
            // Ref4 plate: sharp edges, boxy tone, whole article visible.
            borderRadius: 0,
            height: Math.round(width * ratio),
            width: "100%",
          }}
          uri={item.imageUrl}
        />
        {onToggleSave ? (
          <Animated.View
            style={[{ position: "absolute", right: spacing.xs, top: spacing.xs }, heartStyle]}
          >
            <PressableScale
              accessibilityLabel={
                item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`
              }
              accessibilityRole="button"
              accessibilityState={{ selected: Boolean(item.saved) }}
              hitSlop={hitSlopFor(32)}
              onPress={toggleSave}
              style={{
                alignItems: "center",
                backgroundColor: palette.bg,
                borderRadius: radii.capsule,
                height: 32,
                justifyContent: "center",
                width: 32,
              }}
            >
              <IconHeart
                color={item.saved ? palette.error : palette.text}
                filled={item.saved}
                size={16}
              />
            </PressableScale>
          </Animated.View>
        ) : null}
      </View>
      <View style={{ gap: 2 }}>
        {item.brand ? (
          <GyfText maxFontSizeMultiplier={1.4} theme={theme} tone="faint" variant="label">
            {item.brand.toUpperCase()}
          </GyfText>
        ) : null}
        <GyfText maxFontSizeMultiplier={1.6} numberOfLines={2} theme={theme} variant="bodySmall">
          {item.title}
        </GyfText>
        <View
          style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}
        >
          {item.price ? (
            <GyfText
              maxFontSizeMultiplier={1.4}
              style={{ color: palette.accentInk }}
              theme={theme}
              variant="mono"
            >
              {item.price}
            </GyfText>
          ) : (
            <View />
          )}
          <ConfidenceBadge theme={theme} value={item.matchPercent} />
        </View>
      </View>
    </PressableScale>
  );
}
