import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { AnimatedGyfMark } from "@/components/explore/animated-gyf-mark";
import { IconClose, IconFilter } from "@/components/icons";
import { AtelierButton } from "@/components/ui/atelier-button";
import { FilterChip } from "@/components/ui/filter-chip";
import { GlassSurface } from "@/components/ui/glass-surface";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale } from "@/components/ui/pressable-scale";
import type { CatalogFacets } from "@/lib/api";
import {
  activeFilterCount,
  removableFilterPills,
  withoutFilter,
  type ExploreFilters,
  type ExploreSort,
} from "@/lib/explore-feed";
import { OCCASIONS, SLOT_FILTERS, STYLE_INTENTS } from "@/lib/vocab";
import { materials, radii, spacing, typography } from "@/theme/tokens";
import { useAppColorScheme, useThemeColors } from "@/theme/use-color-scheme";

const SORT_OPTIONS: Array<{ label: string; value: ExploreSort }> = [
  { label: "Relevance", value: "relevance" },
  { label: "Price low", value: "price_asc" },
  { label: "Price high", value: "price_desc" },
];

/** One horizontal row of controlled-vocabulary chips inside the filter sheet. */
function ChipRow({
  label,
  options,
  selected,
  onSelect,
  allLabel,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string | null;
  onSelect: (value: string | null) => void;
  allLabel?: string;
}) {
  const chips = allLabel ? [{ value: "", label: allLabel }, ...options] : options;
  return (
    <View style={{ gap: spacing.sm }}>
      <GyfText variant="label">{label}</GyfText>
      <ScrollView
        accessibilityLabel={label}
        contentContainerStyle={{ gap: spacing.sm }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {chips.map((option) => (
          <FilterChip
            key={option.value || "all"}
            label={option.label}
            onPress={() => onSelect(option.value || null)}
            selected={selected === (option.value || null)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Ref3/Ref4 Explore header: one liquid-glass capsule holding the animated GYF
 * mark, the search field, and the filter control that opens the facet sheet.
 * Applied filters render beneath as removable pills.
 */
export function ExploreControlBar({
  queryInput,
  onChangeQuery,
  onSubmitQuery,
  hint,
  onPressMark,
  filters,
  onChangeFilters,
  onClearAll,
  facets,
  priceEnabled,
  maxPriceInput,
  onChangeMaxPrice,
  onSubmitMaxPrice,
}: {
  queryInput: string;
  onChangeQuery: (value: string) => void;
  onSubmitQuery: () => void;
  hint: string;
  onPressMark: () => void;
  filters: ExploreFilters;
  onChangeFilters: (next: ExploreFilters) => void;
  onClearAll: () => void;
  facets: CatalogFacets | null;
  priceEnabled: boolean;
  maxPriceInput: string;
  onChangeMaxPrice: (value: string) => void;
  onSubmitMaxPrice: () => void;
}) {
  const palette = useThemeColors();
  const theme = useAppColorScheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const pills = removableFilterPills(filters);
  const activeCount = activeFilterCount(filters);

  return (
    <View style={{ gap: spacing.md }}>
      <GlassSurface
        contentStyle={{
          alignItems: "center",
          flexDirection: "row",
          gap: spacing.sm,
          minHeight: 56,
          paddingHorizontal: spacing.md,
        }}
      >
        <PressableScale
          accessibilityLabel="Browse all collections"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onPressMark}
        >
          <AnimatedGyfMark color={palette.text} size={24} />
        </PressableScale>
        <TextInput
          accessibilityLabel="Search catalogue"
          onChangeText={onChangeQuery}
          onSubmitEditing={onSubmitQuery}
          placeholder={hint}
          placeholderTextColor={palette.textMuted}
          returnKeyType="search"
          style={[typography.body, { color: palette.text, flex: 1, minHeight: 56 }]}
          value={queryInput}
        />
        <PressableScale
          accessibilityLabel={
            activeCount > 0 ? `Filters, ${activeCount} active` : "Open catalogue filters"
          }
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setSheetOpen(true)}
        >
          <IconFilter color={activeCount > 0 ? palette.text : palette.textMuted} size={22} />
        </PressableScale>
      </GlassSurface>

      {pills.length > 0 ? (
        <ScrollView
          accessibilityLabel="Applied filters"
          contentContainerStyle={{ gap: spacing.sm }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {pills.map((pill) => (
            <FilterChip
              accessibilityLabel={`Remove filter ${pill.label}`}
              key={pill.key}
              label={`${pill.label} ✕`}
              onPress={() => onChangeFilters(withoutFilter(filters, pill.key))}
              selected
            />
          ))}
        </ScrollView>
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
        transparent
        visible={sheetOpen}
      >
        <Pressable
          accessibilityLabel="Close filters"
          accessibilityRole="button"
          onPress={() => setSheetOpen(false)}
          style={{ backgroundColor: materials.overlay, flex: 1 }}
        />
        <BlurView
          intensity={80}
          style={{
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            maxHeight: "80%",
            overflow: "hidden",
          }}
          tint={theme === "dark" ? "dark" : "light"}
        >
          <LinearGradient colors={materials.glass.sheetHighlight} style={{ height: 1.5 }} />
          <ScrollView
            accessibilityLabel="Catalogue filters"
            contentContainerStyle={{
              backgroundColor: materials.sheet[theme],
              gap: spacing.lg,
              padding: spacing.lg,
              paddingBottom: spacing.xxl,
            }}
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <GyfText accessibilityRole="header" variant="title">
                Filters
              </GyfText>
              <PressableScale
                accessibilityLabel="Close filters"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setSheetOpen(false)}
              >
                <IconClose color={palette.text} size={20} />
              </PressableScale>
            </View>
            <ChipRow
              allLabel="Everything"
              label="SHOP BY SLOT"
              onSelect={(value) => onChangeFilters({ ...filters, slot: value })}
              options={SLOT_FILTERS}
              selected={filters.slot}
            />
            <ChipRow
              allLabel="All occasions"
              label="OCCASION"
              onSelect={(value) => onChangeFilters({ ...filters, occasion: value })}
              options={OCCASIONS}
              selected={filters.occasion}
            />
            <ChipRow
              allLabel="All styles"
              label="STYLE"
              onSelect={(value) => onChangeFilters({ ...filters, style: value })}
              options={STYLE_INTENTS}
              selected={filters.style}
            />
            {/* Price and sort only over a priced catalogue: a control that cannot
                do what it says is worse than no control. */}
            {priceEnabled ? (
              <>
                <ChipRow
                  label="SORT"
                  onSelect={(value) =>
                    onChangeFilters({
                      ...filters,
                      sort: (value as ExploreSort | null) ?? "relevance",
                    })
                  }
                  options={SORT_OPTIONS}
                  selected={filters.sort}
                />
                <View style={{ gap: spacing.sm }}>
                  <GyfText variant="label">MAX PRICE</GyfText>
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <TextInput
                      accessibilityLabel="Maximum catalogue price"
                      keyboardType="decimal-pad"
                      onChangeText={onChangeMaxPrice}
                      onSubmitEditing={onSubmitMaxPrice}
                      placeholder={
                        facets?.price_max ? `Max ${Math.round(facets.price_max)}` : "Max price"
                      }
                      placeholderTextColor={palette.textMuted}
                      style={[
                        typography.body,
                        {
                          backgroundColor: palette.surface,
                          borderRadius: radii.capsule,
                          color: palette.text,
                          flex: 1,
                          minHeight: 48,
                          paddingHorizontal: spacing.md,
                        },
                      ]}
                      value={maxPriceInput}
                    />
                    <AtelierButton
                      label="Apply"
                      onPress={onSubmitMaxPrice}
                      style={{ minWidth: 88 }}
                    />
                  </View>
                </View>
              </>
            ) : null}
            {activeCount > 0 ? (
              <AtelierButton
                label={`Clear ${activeCount} ${activeCount === 1 ? "filter" : "filters"}`}
                onPress={onClearAll}
                variant="secondary"
              />
            ) : null}
            <AtelierButton label="Show results" onPress={() => setSheetOpen(false)} />
          </ScrollView>
        </BlurView>
      </Modal>
    </View>
  );
}
