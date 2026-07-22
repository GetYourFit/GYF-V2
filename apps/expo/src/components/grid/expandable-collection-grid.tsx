import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { AccessibilityInfo, Modal, Pressable, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { IconChevronDown, IconClose } from "@/components/icons";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { GyfText } from "@/components/ui/gyf-text";
import { ProductCard, type ProductCardItem } from "@/components/ui/product-card";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { useResponsive } from "@/theme/use-responsive";
import { colors, motion, radii, shadows, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";
import { cardWidthFor, columnsForWidth } from "./column-count";
import { collectionView } from "./collection-state";
import { PanZoomCanvas } from "./pan-zoom-canvas";

/**
 * Collapsed, the preview flows inline in the page. Expanded, the collection
 * moves to its own full-screen surface: the page below scrolls vertically, and
 * a pan gesture nested inside it loses every vertical drag to the ScrollView —
 * so the canvas has to own the whole screen for "drag any direction" to work
 * at all. Escaping the page also removes the scroll clamp on how far it pans.
 */
function Explorable({
  children,
  enabled,
  onClose,
  title,
  height,
  width,
}: {
  children: React.ReactNode;
  enabled: boolean;
  onClose: () => void;
  title: string;
  height: number;
  width: number;
}) {
  const palette = colors[useTheme()];
  if (!enabled) return <>{children}</>;
  return (
    <Modal animationType="fade" onRequestClose={onClose} visible>
      <View style={{ backgroundColor: palette.bg, flex: 1 }}>
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          <GyfText style={{ flex: 1 }} variant="title">
            {title}
          </GyfText>
          <PressableScale
            accessibilityLabel="Close explorer"
            accessibilityRole="button"
            hitSlop={hitSlopFor(44)}
            onPress={onClose}
          >
            <IconClose color={palette.textMuted} size={22} />
          </PressableScale>
        </View>
        <PanZoomCanvas height={height} width={width}>
          {children}
        </PanZoomCanvas>
      </View>
    </Modal>
  );
}

export type CollectionStatus = "loaded" | "loading";

/** Extra quick-preview action (e.g. "Remove from wardrobe", "Buy"). Return null to hide for an item. */
export interface CollectionAction {
  label: (item: CollectionItem) => string | null;
  onPress: (item: CollectionItem) => void;
}

export interface CollectionItem extends ProductCardItem {
  id: string;
  /** Why the stylist chose it — shown in the quick preview. */
  aiReason?: string | null;
}

const STAGGER_MS = 45;

/**
 * GYF's signature in-place collection: expands inside the page (never
 * navigates), preserving browsing context. Choreography ported from the
 * Flutter original — height first, then a 45ms staggered card reveal,
 * decisive easing, no bounce. The header is the screen's one deliberately
 * sharp element.
 */
export function ExpandableCollectionGrid({
  title,
  subtitle,
  items,
  status = "loaded",
  previewCount = 4,
  containerWidth,
  onToggleSave,
  primaryAction,
  secondaryAction,
  theme: themeProp,
}: {
  title: string;
  subtitle?: string | null;
  items: CollectionItem[];
  status?: CollectionStatus;
  previewCount?: number;
  /** Width available to the grid (screen width minus screen padding). */
  containerWidth: number;
  onToggleSave?: (item: CollectionItem, saved: boolean) => void;
  primaryAction?: CollectionAction;
  secondaryAction?: CollectionAction;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
  const palette = colors[theme];
  const { height: screenHeight, width: screenWidth } = useResponsive();
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<CollectionItem | null>(null);
  const chevron = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevron.value * 180}deg` }],
  }));

  const columns = columnsForWidth(containerWidth);
  const gap = spacing.md;
  const cardWidth = cardWidthFor(containerWidth - spacing.md * 2, columns, gap);
  const view = collectionView(items, expanded, previewCount);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    chevron.value = withTiming(next ? 1 : 0, {
      duration: motion.standard,
      easing: Easing.out(Easing.cubic),
    });
    AccessibilityInfo.announceForAccessibility(
      next ? `${title} expanded. Showing ${items.length} items.` : `${title} collapsed.`,
    );
  };

  return (
    <Animated.View
      layout={LinearTransition.duration(motion.calm)
        .easing(Easing.out(Easing.cubic))
        .reduceMotion(ReduceMotion.System)}
      style={[
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderCurve: "continuous",
          borderRadius: radii.card,
          borderWidth: 1,
          overflow: "hidden",
        },
        expanded ? shadows.md : null,
      ]}
    >
      {/* Sharp header — the one deliberately un-rounded element. */}
      <Pressable
        accessibilityLabel={`${title}, ${items.length} looks, ${expanded ? "expanded" : "collapsed"}`}
        accessibilityRole="button"
        disabled={items.length === 0}
        onPress={toggle}
        style={{
          alignItems: "center",
          borderBottomColor: palette.border,
          borderBottomWidth: 1,
          flexDirection: "row",
          gap: spacing.sm,
          padding: spacing.md,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <GyfText theme={theme} variant="title">
            {title}
          </GyfText>
          {subtitle ? (
            <GyfText theme={theme} tone="muted" variant="bodySmall">
              {subtitle}
            </GyfText>
          ) : null}
          <GyfText theme={theme} tone="faint" variant="mono">
            {items.length} LOOKS
          </GyfText>
        </View>
        {items.length > 0 ? (
          <Animated.View style={chevronStyle}>
            <IconChevronDown color={palette.textMuted} size={20} />
          </Animated.View>
        ) : null}
      </Pressable>

      <View style={{ padding: spacing.md }}>
        {status === "loading" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {Array.from({ length: Math.min(previewCount, columns * 2) }, (_, i) => (
              <Skeleton height={cardWidth * (4 / 3) + 72} key={i} theme={theme} width={cardWidth} />
            ))}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <Explorable
              enabled={expanded}
              height={screenHeight - 120}
              onClose={toggle}
              title={title}
              width={screenWidth}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
                {view.visible.map((item, i) => {
                  const staggerIndex = view.revealFrom >= 0 ? i - view.revealFrom : -1;
                  const card = (
                    <ProductCard
                      item={item}
                      onPress={() => setPreview(item)}
                      onToggleSave={onToggleSave ? (saved) => onToggleSave(item, saved) : undefined}
                      theme={theme}
                      width={cardWidth}
                    />
                  );
                  return staggerIndex >= 0 ? (
                    <Animated.View
                      entering={FadeInDown.duration(motion.standard)
                        .delay(staggerIndex * STAGGER_MS)
                        .easing(Easing.out(Easing.cubic))
                        .reduceMotion(ReduceMotion.System)}
                      key={item.id}
                    >
                      {card}
                    </Animated.View>
                  ) : (
                    <View key={item.id}>{card}</View>
                  );
                })}
              </View>
            </Explorable>
            {view.hiddenCount > 0 || expanded ? (
              <PressableScale
                accessibilityRole="button"
                hitSlop={hitSlopFor(36)}
                onPress={toggle}
                style={{ alignItems: "center", minHeight: 36, justifyContent: "center" }}
              >
                <GyfText theme={theme} tone="muted" variant="label">
                  {expanded ? "COLLAPSE" : `+${view.hiddenCount} MORE`}
                </GyfText>
              </PressableScale>
            ) : null}
          </View>
        )}
      </View>

      <QuickPreview
        item={preview}
        onClose={() => setPreview(null)}
        onToggleSave={onToggleSave}
        primaryAction={primaryAction}
        secondaryAction={secondaryAction}
        theme={theme}
      />
    </Animated.View>
  );
}

/**
 * Quick-preview glass sheet — the user never loses collection context.
 * The first real Liquid Glass surface: blur over the page, specular
 * hairline along the top edge.
 */
function QuickPreview({
  item,
  onClose,
  onToggleSave,
  primaryAction,
  secondaryAction,
  theme,
}: {
  item: CollectionItem | null;
  onClose: () => void;
  onToggleSave?: (item: CollectionItem, saved: boolean) => void;
  primaryAction?: CollectionAction;
  secondaryAction?: CollectionAction;
  theme: ThemeName;
}) {
  const palette = colors[theme];
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={item !== null}>
      <Pressable
        accessibilityLabel="Close preview"
        accessibilityRole="button"
        onPress={onClose}
        style={{ backgroundColor: "rgba(0,0,0,0.45)", flex: 1 }}
      />
      {item ? (
        <BlurView
          intensity={80}
          style={{
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            overflow: "hidden",
          }}
          tint={theme === "dark" ? "dark" : "light"}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
            style={{ height: 1.5 }}
          />
          <View
            style={{
              backgroundColor: theme === "dark" ? "rgba(20,20,20,0.72)" : "rgba(255,255,255,0.72)",
              gap: spacing.md,
              padding: spacing.lg,
              paddingBottom: spacing.xl,
            }}
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                {item.brand ? (
                  <GyfText theme={theme} tone="faint" variant="label">
                    {item.brand.toUpperCase()}
                  </GyfText>
                ) : null}
                <GyfText theme={theme} variant="title">
                  {item.title}
                </GyfText>
              </View>
              <PressableScale
                accessibilityLabel="Close preview"
                accessibilityRole="button"
                hitSlop={hitSlopFor(32)}
                onPress={onClose}
                style={{ padding: spacing.xs }}
              >
                <IconClose color={palette.textMuted} size={20} />
              </PressableScale>
            </View>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              {item.price ? (
                <GyfText theme={theme} variant="mono">
                  {item.price}
                </GyfText>
              ) : (
                <View />
              )}
              <ConfidenceBadge theme={theme} value={item.matchPercent} />
            </View>
            {item.aiReason ? (
              <GyfText theme={theme} tone="muted" variant="bodySmall">
                {item.aiReason}
              </GyfText>
            ) : null}
            {primaryAction?.label(item) ? (
              <PressableScale
                accessibilityRole="button"
                onPress={() => {
                  primaryAction.onPress(item);
                  onClose();
                }}
                style={{
                  alignItems: "center",
                  backgroundColor: palette.text,
                  borderRadius: radii.control,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <GyfText style={{ color: palette.textInverse }} theme={theme} variant="button">
                  {primaryAction.label(item)}
                </GyfText>
              </PressableScale>
            ) : null}
            {secondaryAction?.label(item) ? (
              <PressableScale
                accessibilityRole="button"
                onPress={() => {
                  secondaryAction.onPress(item);
                  onClose();
                }}
                style={{
                  alignItems: "center",
                  borderColor: palette.border,
                  borderRadius: radii.control,
                  borderWidth: 1,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <GyfText theme={theme} variant="button">
                  {secondaryAction.label(item)}
                </GyfText>
              </PressableScale>
            ) : null}
            {onToggleSave ? (
              <PressableScale
                accessibilityRole="button"
                onPress={() => {
                  onToggleSave(item, !item.saved);
                  onClose();
                }}
                style={{
                  alignItems: "center",
                  backgroundColor: palette.text,
                  borderRadius: radii.control,
                  minHeight: 48,
                  justifyContent: "center",
                }}
              >
                <GyfText style={{ color: palette.textInverse }} theme={theme} variant="button">
                  {item.saved ? "Remove from saved" : "Save this look"}
                </GyfText>
              </PressableScale>
            ) : null}
          </View>
        </BlurView>
      ) : null}
    </Modal>
  );
}
