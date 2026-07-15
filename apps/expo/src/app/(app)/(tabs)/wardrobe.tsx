import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { ApiError, createApi, type WardrobeItem } from "@/lib/api";
import {
  ALL_WARDROBE,
  resolveWardrobeFilter,
  visibleWardrobe,
  wardrobeCategories,
} from "@/lib/wardrobe-feed";
import { colors, radii, spacing, typography } from "@/theme/tokens";

type Status = "loading" | "ready" | "error";

function isRemoteImage(url: string | null | undefined): url is string {
  return Boolean(url && /^https:\/\//i.test(url));
}

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to reach your private wardrobe.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "Wardrobe is temporarily unavailable. Try again shortly.";
  }
  return "GYF could not load your wardrobe. Check your connection and try again.";
}

function FilterChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.dark.text : colors.dark.surfaceRaised,
        borderColor: selected ? colors.dark.text : colors.dark.border,
        borderRadius: radii.capsule,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <GyfText
        style={selected ? { color: colors.dark.textInverse } : undefined}
        variant="bodySmall"
      >
        {label} · {count}
      </GyfText>
    </Pressable>
  );
}

function GarmentCard({
  item,
  width,
  pending,
  onRemove,
}: {
  item: WardrobeItem;
  width: number;
  pending: boolean;
  onRemove: () => void;
}) {
  return (
    <AtelierCard style={{ gap: spacing.sm, padding: spacing.sm, width }}>
      {isRemoteImage(item.image_url) ? (
        <Image
          accessibilityLabel={item.title}
          source={{ uri: item.image_url }}
          style={{
            backgroundColor: colors.dark.surfaceRaised,
            borderRadius: radii.control,
            height: width * 1.28,
            width: "100%",
          }}
        />
      ) : (
        <View
          accessibilityLabel={`${item.title}; no image`}
          style={{
            alignItems: "center",
            backgroundColor: colors.dark.surfaceRaised,
            borderRadius: radii.control,
            height: width * 1.28,
            justifyContent: "center",
            padding: spacing.sm,
          }}
        >
          <GyfText tone="faint" variant="mono">
            {item.category.toUpperCase()}
          </GyfText>
        </View>
      )}
      <GyfText numberOfLines={2} variant="bodySmall">
        {item.title}
      </GyfText>
      <AtelierButton
        accessibilityLabel={`Remove ${item.title} from wardrobe`}
        disabled={pending}
        label={pending ? "…" : "Remove"}
        onPress={onRemove}
        style={{ minHeight: 42, paddingHorizontal: spacing.sm }}
      />
    </AtelierCard>
  );
}

export default function WardrobeRoute() {
  const { width } = useWindowDimensions();
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
    async (item: WardrobeItem) => {
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
  const cardWidth = Math.max(140, (width - spacing.lg * 2 - spacing.md) / 2);

  return (
    <FlatList
      accessibilityLabel="Your wardrobe"
      columnWrapperStyle={{ gap: spacing.md }}
      contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl }}
      data={visible}
      keyExtractor={(item) => item.id}
      numColumns={2}
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
      renderItem={({ item }) => (
        <GarmentCard
          item={item}
          onRemove={() => void removeGarment(item)}
          pending={pending === item.id}
          width={cardWidth}
        />
      )}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
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
            <GyfText
              accessibilityRole="alert"
              style={{ color: colors.dark.error }}
              variant="bodySmall"
            >
              {readableError(actionError)}
            </GyfText>
          ) : null}

          {status === "ready" && categories.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <GyfText variant="label">FILTER</GyfText>
              <FlatList
                contentContainerStyle={{ gap: spacing.sm }}
                data={[ALL_WARDROBE, ...categories]}
                horizontal
                keyExtractor={(category) => category}
                renderItem={({ item: category }) => (
                  <FilterChip
                    count={
                      category === ALL_WARDROBE
                        ? items.length
                        : items.filter((row) => row.category === category).length
                    }
                    label={category === ALL_WARDROBE ? "All" : category}
                    onPress={() => setFilter(category)}
                    selected={activeFilter === category}
                  />
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        status === "loading" ? (
          <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl }}>
            <ActivityIndicator color={colors.dark.text} />
            <GyfText tone="muted">Loading your wardrobe…</GyfText>
          </View>
        ) : status === "error" ? (
          <AtelierCard>
            <GyfText accessibilityRole="alert" style={{ color: colors.dark.error }}>
              {readableError(actionError)}
            </GyfText>
            <AtelierButton
              label="Try again"
              onPress={() => {
                setStatus("loading");
                void load().catch(() => setStatus("error"));
              }}
            />
          </AtelierCard>
        ) : (
          <AtelierCard>
            <GyfText variant="title">
              {items.length === 0 ? "Your wardrobe is empty" : `No ${activeFilter} yet`}
            </GyfText>
            <GyfText tone="muted" variant="bodySmall">
              Add a garment above and it joins the pieces GYF styles around.
            </GyfText>
          </AtelierCard>
        )
      }
    />
  );
}
