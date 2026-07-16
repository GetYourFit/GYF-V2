import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, TextInput, View } from "react-native";

import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import {
  ExpandableCollectionGrid,
  type CollectionItem,
} from "@/components/grid/expandable-collection-grid";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { GyfText } from "@/components/ui/gyf-text";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createApi, type WardrobeItem } from "@/lib/api";
import {
  ALL_WARDROBE,
  resolveWardrobeFilter,
  visibleWardrobe,
  wardrobeCategories,
} from "@/lib/wardrobe-feed";
import { colors, radii, spacing, typography } from "@/theme/tokens";
import { useResponsive } from "@/theme/use-responsive";

type Status = "loading" | "ready" | "error";

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to reach your private wardrobe.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Wardrobe is temporarily unavailable. Try again shortly.";
  }
  return "GYF could not load your wardrobe. Check your connection and try again.";
}

function toCollectionItem(item: WardrobeItem): CollectionItem {
  return { id: item.id, title: item.title, brand: item.category, imageUrl: item.image_url };
}

export default function WardrobeRoute() {
  const { width, insets } = useResponsive();
  const api = useMemo(() => createApi(), []);
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>(ALL_WARDROBE);
  const [titleInput, setTitleInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setActionError(null);
    const data = await api.listWardrobe();
    setItems(data);
    setStatus("ready");
  }, [api]);

  useEffect(() => {
    let active = true;
    void load().catch(() => {
      if (active) setStatus("error");
    });
    return () => {
      active = false;
    };
  }, [load]);

  const addGarment = useCallback(async () => {
    const title = titleInput.trim();
    if (!title || adding) return;
    setAdding(true);
    setActionError(null);
    try {
      const added = await api.addWardrobeItem({ title });
      setItems((current) => [added, ...current]);
      setTitleInput("");
    } catch (error) {
      setActionError(error);
    } finally {
      setAdding(false);
    }
  }, [adding, api, titleInput]);

  const removeGarment = useCallback(
    async (item: CollectionItem) => {
      if (pending) return;
      setPending(item.id);
      setActionError(null);
      const previous = items;
      setItems((current) => current.filter((row) => row.id !== item.id));
      try {
        await api.removeWardrobeItem(item.id);
      } catch (error) {
        setItems(previous);
        setActionError(error);
      } finally {
        setPending(null);
      }
    },
    [api, items, pending],
  );

  const categories = wardrobeCategories(items);
  const activeFilter = resolveWardrobeFilter(filter, categories);
  const visible = visibleWardrobe(items, activeFilter);
  const screenPad = spacing.lg;
  const containerWidth = width - screenPad * 2;

  // All → one grid per category; a specific filter → that category alone.
  const sections =
    activeFilter === ALL_WARDROBE
      ? categories.map((category) => ({
          category,
          items: visible.filter((row) => row.category === category),
        }))
      : [{ category: activeFilter, items: visible }];

  return (
    <ScrollView
      accessibilityLabel="Your wardrobe"
      contentContainerStyle={{
        gap: spacing.lg,
        padding: screenPad,
        paddingBottom: spacing.xxl * 2 + insets.bottom,
        paddingTop: screenPad + insets.top,
      }}
      refreshControl={
        <RefreshControl
          onRefresh={async () => {
            setRefreshing(true);
            await load().catch(() => setStatus("error"));
            setRefreshing(false);
          }}
          refreshing={refreshing}
          tintColor={colors.dark.text}
        />
      }
    >
      <View style={{ gap: spacing.sm }}>
        <GyfText accessibilityRole="header" variant="display">
          Wardrobe
        </GyfText>
        <GyfText tone="muted" variant="body">
          Add what you own — GYF styles new looks around your real closet.
        </GyfText>
      </View>

      <AtelierCard>
        <GyfText variant="label">ADD A GARMENT</GyfText>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            accessibilityLabel="Garment name"
            onChangeText={setTitleInput}
            onSubmitEditing={() => void addGarment()}
            placeholder="Navy linen blazer…"
            placeholderTextColor={colors.dark.textFaint}
            returnKeyType="done"
            style={[
              typography.body,
              {
                borderColor: colors.dark.border,
                borderRadius: radii.control,
                borderWidth: 1,
                color: colors.dark.text,
                flex: 1,
                minHeight: 48,
                paddingHorizontal: spacing.md,
              },
            ]}
            value={titleInput}
          />
          <AtelierButton
            disabled={adding || !titleInput.trim()}
            label={adding ? "Adding…" : "Add"}
            onPress={() => void addGarment()}
            style={{ minWidth: 88 }}
          />
        </View>
        <GyfText tone="faint" variant="bodySmall">
          GYF classifies the piece automatically.
        </GyfText>
      </AtelierCard>

      {actionError ? (
        <GyfText accessibilityRole="alert" style={{ color: colors.dark.error }} variant="bodySmall">
          {readableError(actionError)}
        </GyfText>
      ) : null}

      {status === "ready" && categories.length > 0 ? (
        <ScrollView
          contentContainerStyle={{ gap: spacing.sm }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {[ALL_WARDROBE, ...categories].map((category) => (
            <FilterChip
              count={
                category === ALL_WARDROBE
                  ? items.length
                  : items.filter((row) => row.category === category).length
              }
              key={category}
              label={category === ALL_WARDROBE ? "All" : category}
              onPress={() => setFilter(category)}
              selected={activeFilter === category}
            />
          ))}
        </ScrollView>
      ) : null}

      {status === "loading" ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={220} />
          <Skeleton height={220} />
        </View>
      ) : status === "error" ? (
        <ErrorState
          illustration={<IllustrationLooseThread color={colors.dark.textMuted} />}
          message={readableError(actionError)}
          onRetry={() => {
            setStatus("loading");
            void load().catch(() => setStatus("error"));
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          description="Add a garment above and it joins the pieces GYF styles around."
          headline="Your wardrobe is empty"
          illustration={<IllustrationEmptyHanger color={colors.dark.textMuted} />}
        />
      ) : (
        sections.map((section) => (
          <ExpandableCollectionGrid
            containerWidth={containerWidth}
            items={section.items.map(toCollectionItem)}
            key={section.category}
            primaryAction={{
              label: () => "Remove from wardrobe",
              onPress: (item) => void removeGarment(item),
            }}
            title={section.category}
          />
        ))
      )}
    </ScrollView>
  );
}
