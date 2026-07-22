import { useState } from "react";
import { View } from "react-native";

import { IconHeart } from "@/components/icons";
import { CatalogImage } from "@/components/ui/catalog-image";
import { PressableScale } from "@/components/ui/pressable-scale";
import { DEFAULT_RATIO } from "@/components/ui/catalog-frame";
import { splitColumns } from "@/components/ui/masonry-columns";
import { radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";

export interface MasonryItem {
  id: string;
  imageUrl?: string | null;
  /** Screen-reader name. Never drawn — the reference tiles carry no text. */
  label: string;
}

/** ref8 runs a tight gutter; the imagery, not the ground, carries the screen. */
export const MASONRY_GAP = spacing.xs;

function Tile({
  item,
  onLongPress,
  onPress,
  saved,
  width,
}: {
  item: MasonryItem;
  onLongPress?: (item: MasonryItem) => void;
  onPress?: (item: MasonryItem) => void;
  saved: boolean;
  width: number;
}) {
  const palette = useThemeColors();
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  return (
    <PressableScale
      accessibilityLabel={item.label}
      accessibilityRole={onPress ? "button" : undefined}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      onPress={onPress ? () => onPress(item) : undefined}
    >
      <CatalogImage
        label={item.label}
        onRatio={setRatio}
        recyclingKey={item.id}
        style={{
          backgroundColor: palette.surfaceRaised,
          borderRadius: radii.control,
          height: Math.round(width * ratio),
          width,
        }}
        uri={item.imageUrl}
      />
      {/* Only ever drawn once a piece IS saved, so an untouched feed stays the
          reference's pure imagery. Ref4 teaches the gesture with a "Hold
          elements to save" toast; the badge is how you read the result back. */}
      {saved ? (
        <View
          style={{
            backgroundColor: palette.bg,
            borderRadius: radii.capsule,
            padding: spacing.xs,
            position: "absolute",
            right: spacing.xs,
            top: spacing.xs,
          }}
        >
          <IconHeart color={palette.text} filled size={14} />
        </View>
      ) : null}
    </PressableScale>
  );
}

/**
 * The reference feed (Ref3, Ref4, ref8): two staggered columns of imagery with
 * nothing written on any tile — no title, no price, no badge. Every caption
 * GYF used to draw under a card is the thing that made its grid read as a
 * catalogue rather than as these screens. The name survives for screen
 * readers, where it is the only way to know what a tile is.
 */
export function MasonryFeed({
  columns = 2,
  items,
  onLongPressItem,
  onPressItem,
  savedIds,
  width,
}: {
  columns?: number;
  items: readonly MasonryItem[];
  /** Ref4's "Hold elements to save" — the gesture the reference itself teaches. */
  onLongPressItem?: (item: MasonryItem) => void;
  onPressItem?: (item: MasonryItem) => void;
  savedIds?: ReadonlySet<string>;
  /** Width available to the whole feed, gutters included. */
  width: number;
}) {
  const count = Math.max(1, columns);
  const columnWidth = Math.floor((width - MASONRY_GAP * (count - 1)) / count);
  return (
    <View style={{ flexDirection: "row", gap: MASONRY_GAP }}>
      {splitColumns(items, count).map((column, index) => (
        <View key={index} style={{ gap: MASONRY_GAP }}>
          {column.map((item) => (
            <Tile
              item={item}
              key={item.id}
              onLongPress={onLongPressItem}
              onPress={onPressItem}
              saved={savedIds?.has(item.id) ?? false}
              width={columnWidth}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
