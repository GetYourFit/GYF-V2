import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";

import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { AppMenu } from "@/components/ui/app-menu";
import { MasonryFeed } from "@/components/ui/masonry-feed";
import { GyfText } from "@/components/ui/gyf-text";
import { ScreenBar } from "@/components/ui/screen-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createApi, type WardrobeItem } from "@/lib/api";
import {
  ALL_WARDROBE,
  mergeCorrectedItem,
  resolveWardrobeFilter,
  visibleWardrobe,
  wardrobeCategories,
} from "@/lib/wardrobe-feed";
import { materials, radii, spacing, typography } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
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

export default function WardrobeRoute() {
  const palette = useThemeColors();
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
  const [correcting, setCorrecting] = useState<WardrobeItem | null>(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

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
    async (item: { id: string }) => {
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

  const correctCategory = useCallback(async () => {
    const target = correcting;
    const category = categoryInput.trim();
    if (!target || !category || correctionBusy) return;
    setCorrectionBusy(true);
    setCorrectionError(null);
    try {
      const updated = await api.updateWardrobeItem(target.id, category);
      setItems((current) => mergeCorrectedItem(current, updated));
      setCorrecting(null);
      setCategoryInput("");
    } catch (error) {
      setCorrectionError(
        error instanceof ApiError && error.status === 422
          ? "GYF does not recognise that garment type. Try a common name like 'saree' or 'sneakers'."
          : "Could not save the correction. Your garment is unchanged; try again.",
      );
    } finally {
      setCorrectionBusy(false);
    }
  }, [api, categoryInput, correcting, correctionBusy]);

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
          tintColor={palette.text}
        />
      }
    >
      <ScreenBar
        title="Wardrobe"
        onChange={setFilter}
        tabs={
          status === "ready" && categories.length > 0
            ? [ALL_WARDROBE, ...categories].map((category) => ({
                label: category === ALL_WARDROBE ? "All" : category,
                value: category,
              }))
            : []
        }
        trailing={<AppMenu />}
        value={activeFilter}
      />

      {/* Not a card: the add field is one control, not a panel. A hairline band
          groups the label + input the same way the profile stats unboxed. */}
      <View
        style={{
          borderBottomColor: palette.border,
          borderBottomWidth: 1,
          borderTopColor: palette.border,
          borderTopWidth: 1,
          gap: spacing.md,
          paddingVertical: spacing.md,
        }}
      >
        <GyfText tone="muted" variant="label">
          ADD A GARMENT
        </GyfText>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput
            accessibilityLabel="Garment name"
            onChangeText={setTitleInput}
            onSubmitEditing={() => void addGarment()}
            placeholder="Navy linen blazer…"
            placeholderTextColor={palette.textFaint}
            returnKeyType="done"
            style={[
              typography.body,
              {
                borderColor: palette.border,
                borderRadius: radii.control,
                borderWidth: 1,
                color: palette.text,
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
      </View>

      {actionError ? (
        <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
          {readableError(actionError)}
        </GyfText>
      ) : null}

      {status === "loading" ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={220} />
          <Skeleton height={220} />
        </View>
      ) : status === "error" ? (
        <ErrorState
          illustration={<IllustrationLooseThread color={palette.textMuted} />}
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
          illustration={<IllustrationEmptyHanger color={palette.textMuted} />}
        />
      ) : (
        /* ref8: the wardrobe is imagery too. Tapping a piece opens the one
           sheet that can act on it, which is where its name and category
           belong. */
        <MasonryFeed
          items={visible.map((item) => ({
            id: item.id,
            imageUrl: item.image_url,
            label: item.title,
          }))}
          onPressItem={(tile) => {
            const row = items.find((candidate) => candidate.id === tile.id);
            if (!row) return;
            setCorrectionError(null);
            setCategoryInput(row.category === "unknown" ? "" : row.category);
            setCorrecting(row);
          }}
          width={containerWidth}
        />
      )}

      <Modal
        animationType="fade"
        onRequestClose={() => setCorrecting(null)}
        transparent
        visible={correcting !== null}
      >
        <Pressable
          accessibilityLabel="Cancel category correction"
          accessibilityRole="button"
          onPress={() => setCorrecting(null)}
          style={{ backgroundColor: materials.overlay, flex: 1, justifyContent: "center" }}
        >
          <Pressable onPress={() => undefined} style={{ marginHorizontal: spacing.lg }}>
            <AtelierCard style={{ gap: spacing.md }}>
              <GyfText accessibilityRole="header" variant="title">
                Correct the category
              </GyfText>
              <GyfText tone="muted" variant="bodySmall">
                {correcting ? `“${correcting.title}” is filed under ${correcting.category}.` : ""}{" "}
                Tell GYF what it really is — outfit logic follows your correction.
              </GyfText>
              <TextInput
                accessibilityLabel="Corrected garment category"
                autoFocus
                onChangeText={setCategoryInput}
                onSubmitEditing={() => void correctCategory()}
                placeholder="e.g. saree, kurta, sneakers…"
                placeholderTextColor={palette.textMuted}
                returnKeyType="done"
                style={[
                  typography.body,
                  {
                    borderColor: palette.border,
                    borderRadius: radii.control,
                    borderWidth: 1,
                    color: palette.text,
                    minHeight: 48,
                    paddingHorizontal: spacing.md,
                  },
                ]}
                value={categoryInput}
              />
              {correctionError ? (
                <GyfText
                  accessibilityRole="alert"
                  style={{ color: palette.error }}
                  variant="bodySmall"
                >
                  {correctionError}
                </GyfText>
              ) : null}
              {/* Destructive, so it sits apart from the save pair and never
                  under a long-press: the tiles carry no text, and a hold that
                  silently deleted a garment would be unrecoverable. */}
              <AtelierButton
                disabled={pending === correcting?.id}
                label={pending === correcting?.id ? "Removing…" : "Remove from wardrobe"}
                onPress={() => {
                  const target = correcting;
                  if (!target) return;
                  setCorrecting(null);
                  void removeGarment(target);
                }}
                variant="secondary"
              />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <AtelierButton
                  label="Cancel"
                  onPress={() => setCorrecting(null)}
                  style={{ flex: 1 }}
                  variant="secondary"
                />
                <AtelierButton
                  disabled={correctionBusy || !categoryInput.trim()}
                  label={correctionBusy ? "Saving…" : "Save correction"}
                  onPress={() => void correctCategory()}
                  style={{ flex: 1 }}
                />
              </View>
            </AtelierCard>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
