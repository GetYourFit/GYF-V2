import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Linking, Modal, Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  ZoomIn,
} from "react-native-reanimated";

import { CatalogImage } from "@/components/ui/catalog-image";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { IconClose } from "@/components/icons";
import { safeExternalShopUrl } from "@/lib/shop-links";
import { materials, motion, radii, shadows, spacing } from "@/theme/tokens";
import { useAppColorScheme, useThemeColors } from "@/theme/use-color-scheme";

export interface BoardDetailItem {
  brand?: string | null;
  buyUrl?: string | null;
  id: string;
  imageUrl?: string | null;
  price?: string | null;
  title: string;
}

/** The plate the held tile grows into, as a fraction of the viewport width. */
const PLATE_WIDTH = 0.72;

/**
 * What a two-second hold opens. The board itself carries no text at all — this
 * is the only place a price or a name appears, which is what keeps the grid
 * pure imagery the way Ref1/Ref2 are.
 *
 * The piece pops forward, the board behind it goes to blur, and the details
 * drop out from under the image rather than sliding up from the screen edge:
 * the panel belongs to the tile you held, not to the app chrome.
 */
export function BoardDetail({
  item,
  onClose,
  onError,
  width,
}: {
  item: BoardDetailItem | null;
  onClose: () => void;
  onError: (message: string) => void;
  width: number;
}) {
  const palette = useThemeColors();
  const theme = useAppColorScheme();
  const shopUrl = safeExternalShopUrl(item?.buyUrl);
  const plateWidth = Math.round(width * PLATE_WIDTH);

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={item !== null}>
      {item ? (
        <>
          {/* The board stays visible underneath, just out of focus — the piece
              is on top of where it came from, not on a new screen. */}
          <Animated.View entering={FadeIn.duration(motion.standard)} style={{ flex: 1 }}>
            <BlurView intensity={64} style={{ flex: 1 }} tint={theme === "dark" ? "dark" : "light"}>
              <Pressable
                accessibilityLabel="Close details"
                accessibilityRole="button"
                onPress={onClose}
                style={{ backgroundColor: materials.overlay, flex: 1 }}
              />
            </BlurView>
          </Animated.View>

          <View
            pointerEvents="box-none"
            style={{
              alignItems: "center",
              bottom: 0,
              justifyContent: "center",
              left: 0,
              padding: spacing.lg,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          >
            <Animated.View
              entering={ZoomIn.duration(motion.standard)
                .easing(Easing.out(Easing.cubic))
                .reduceMotion(ReduceMotion.System)}
              style={[{ width: plateWidth }, shadows.md]}
            >
              <CatalogImage
                label={item.title}
                recyclingKey={item.id}
                style={{
                  backgroundColor: palette.surfaceRaised,
                  borderRadius: radii.card,
                  height: Math.round(plateWidth * 1.25),
                  width: plateWidth,
                }}
                uri={item.imageUrl}
              />
            </Animated.View>

            {/* Drops down out of the image, 60ms behind the pop so the two
                read as one movement rather than two competing entrances. */}
            <Animated.View
              entering={FadeInDown.duration(motion.standard)
                .delay(60)
                .easing(Easing.out(Easing.cubic))
                .reduceMotion(ReduceMotion.System)}
              style={{
                backgroundColor: palette.surface,
                borderBottomLeftRadius: radii.card,
                borderBottomRightRadius: radii.card,
                gap: spacing.sm,
                padding: spacing.lg,
                width: plateWidth,
              }}
            >
              <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  {item.brand ? (
                    <GyfText tone="faint" variant="label">
                      {item.brand.toUpperCase()}
                    </GyfText>
                  ) : null}
                  <GyfText numberOfLines={2} variant="title">
                    {item.title}
                  </GyfText>
                </View>
                <PressableScale
                  accessibilityLabel="Close details"
                  accessibilityRole="button"
                  hitSlop={hitSlopFor(44)}
                  onPress={onClose}
                >
                  <IconClose color={palette.textMuted} size={20} />
                </PressableScale>
              </View>

              {item.price ? <GyfText variant="mono">{item.price}</GyfText> : null}

              {shopUrl ? (
                <>
                  <PressableScale
                    accessibilityLabel={`Buy ${item.title}`}
                    accessibilityRole="link"
                    onPress={() =>
                      void Linking.openURL(shopUrl).catch(() =>
                        onError("Could not open the retailer. Try again shortly."),
                      )
                    }
                    style={{
                      alignItems: "center",
                      backgroundColor: palette.accent,
                      borderRadius: radii.control,
                      justifyContent: "center",
                      minHeight: 48,
                    }}
                  >
                    <GyfText style={{ color: palette.accentText }} variant="button">
                      Buy
                    </GyfText>
                  </PressableScale>
                  {/* The full notice lives on /terms. This stays because a
                      commission disclosure belongs where the money decision is
                      made, but it is one tappable line, not a paragraph. */}
                  <PressableScale
                    accessibilityHint="Opens terms and disclosures"
                    accessibilityRole="link"
                    onPress={() => {
                      onClose();
                      router.push("/terms");
                    }}
                  >
                    <GyfText tone="faint" variant="bodySmall">
                      Affiliate link — how GYF makes money
                    </GyfText>
                  </PressableScale>
                </>
              ) : (
                <GyfText tone="muted" variant="bodySmall">
                  GYF has no retailer link for this piece yet.
                </GyfText>
              )}
            </Animated.View>
          </View>
        </>
      ) : null}
    </Modal>
  );
}
