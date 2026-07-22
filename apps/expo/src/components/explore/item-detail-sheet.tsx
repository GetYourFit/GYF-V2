import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";

import { IconClose } from "@/components/icons";
import { AtelierButton } from "@/components/ui/atelier-button";
import { CatalogImage } from "@/components/ui/catalog-image";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { createApi, type Outfit, type OutfitItem, type SearchResult } from "@/lib/api";
import { compatibilityReason, formatCatalogPrice } from "@/lib/explore-feed";
import { safeExternalShopUrl, SHOP_AFFILIATE_DISCLOSURE } from "@/lib/shop-links";
import { colors, materials, radii, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";

/** "Complete the look": the stylist engine composes a full outfit pinned to this
 *  item — the same personalization, explanation and confidence as the feed, not
 *  a similar-items lookup. `undefined` = still loading, `null` = none available. */
function CompleteTheLook({
  itemId,
  api,
  theme,
}: {
  itemId: string;
  api: ReturnType<typeof createApi>;
  theme: ThemeName;
}) {
  const [look, setLook] = useState<Outfit | null | undefined>(undefined);
  const [shopError, setShopError] = useState(false);

  useEffect(() => {
    let active = true;
    setLook(undefined);
    setShopError(false);
    api
      .completeLook(itemId, { k: 1 })
      .then((result) => {
        if (active) setLook(result.outfits[0] ?? null);
      })
      .catch(() => {
        // The pairing row is additive. A failure leaves the item itself fully
        // usable, so it reports "none yet" rather than breaking the sheet.
        if (active) setLook(null);
      });
    return () => {
      active = false;
    };
  }, [api, itemId]);

  const pairings = look?.items.filter((pair) => pair.item_id !== itemId) ?? [];

  return (
    <View style={{ gap: spacing.sm }}>
      <GyfText theme={theme} variant="label">
        COMPLETE THE LOOK
      </GyfText>
      {look === undefined ? (
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Skeleton height={132} theme={theme} width={100} />
          <Skeleton height={132} theme={theme} width={100} />
        </View>
      ) : pairings.length === 0 ? (
        <GyfText theme={theme} tone="muted" variant="bodySmall">
          No complete look available for this piece yet. GYF will not invent a pairing the catalogue
          cannot support.
        </GyfText>
      ) : (
        <>
          {shopError ? (
            <GyfText
              accessibilityRole="alert"
              style={{ color: colors[theme].error }}
              theme={theme}
              variant="bodySmall"
            >
              Could not open the retailer link. Nothing changed; try again.
            </GyfText>
          ) : null}
          <ScrollView
            contentContainerStyle={{ gap: spacing.sm }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {pairings.map((pair) => (
              <PairingTile
                item={pair}
                key={pair.item_id}
                onOpenError={() => setShopError(true)}
                theme={theme}
              />
            ))}
          </ScrollView>
          {/* The pairing's own confidence and reason, straight from the engine.
              Deliberately NOT the web oracle's unconditional `X% match`: that
              renders a cold-start or abstained look as a hard number, which is
              the exact claim F1b forbids. ConfidenceLabel says "not yet
              measured" when the engine did not measure. */}
          <ConfidenceLabel confidence={look?.confidence} reason={look?.explanation} theme={theme} />
        </>
      )}
    </View>
  );
}

function PairingTile({
  item,
  onOpenError,
  theme,
}: {
  item: OutfitItem;
  onOpenError: () => void;
  theme: ThemeName;
}) {
  const palette = colors[theme];
  const shopUrl = safeExternalShopUrl(item.affiliate_url);
  const price = formatCatalogPrice(item.price, item.currency);
  return (
    <PressableScale
      accessibilityLabel={shopUrl ? `Shop ${item.title}` : item.title}
      accessibilityRole={shopUrl ? "link" : undefined}
      onPress={shopUrl ? () => void Linking.openURL(shopUrl).catch(onOpenError) : undefined}
      style={{ gap: spacing.xs, width: 100 }}
    >
      <CatalogImage
        label={item.title}
        recyclingKey={item.item_id}
        style={{
          backgroundColor: palette.surfaceRaised,
          borderRadius: radii.control,
          height: 132,
          width: 100,
        }}
        uri={item.image_url}
      />
      <GyfText numberOfLines={2} theme={theme} tone="muted" variant="bodySmall">
        {item.title}
      </GyfText>
      <GyfText theme={theme} tone="faint" variant="mono">
        {item.slot.replace("_", " ").toUpperCase()}
        {item.price == null ? "" : ` · ${price}`}
      </GyfText>
    </PressableScale>
  );
}

/**
 * The Explore detail sheet: the catalogue's deep surface. Reuses the glass
 * quick-preview language from the collection grid — blur over the page, a
 * specular hairline along the top edge — so a tap never loses browsing context.
 */
export function ItemDetailSheet({
  item,
  onClose,
  theme: themeProp,
}: {
  item: SearchResult | null;
  onClose: () => void;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
  const palette = colors[theme];
  const [api] = useState(() => createApi());
  const [wardrobeState, setWardrobeState] = useState<"idle" | "busy" | "added">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  // Every open is a fresh item: never show the previous item's success state.
  useEffect(() => {
    setWardrobeState("idle");
    setActionError(null);
  }, [item?.item_id]);

  const addToWardrobe = async () => {
    if (!item || wardrobeState !== "idle") return;
    setWardrobeState("busy");
    setActionError(null);
    try {
      await api.addWardrobeItem({ item_id: item.item_id, title: item.title });
      setWardrobeState("added");
    } catch {
      setWardrobeState("idle");
      setActionError("Could not add this to your wardrobe. Nothing changed; try again.");
    }
  };

  const shopUrl = safeExternalShopUrl(item?.buy_url);
  const compatibility = compatibilityReason(item?.score);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={item !== null}>
      <Pressable
        accessibilityLabel="Close item details"
        accessibilityRole="button"
        onPress={onClose}
        style={{ backgroundColor: materials.overlay, flex: 1 }}
      />
      {item ? (
        <BlurView
          intensity={80}
          style={{
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            maxHeight: "88%",
            overflow: "hidden",
          }}
          tint={theme === "dark" ? "dark" : "light"}
        >
          <LinearGradient colors={materials.glass.sheetHighlight} style={{ height: 1.5 }} />
          <ScrollView
            accessibilityLabel={`Details for ${item.title}`}
            contentContainerStyle={{
              backgroundColor: materials.sheet[theme],
              gap: spacing.lg,
              padding: spacing.lg,
              paddingBottom: spacing.xxl,
            }}
          >
            <View style={{ alignItems: "flex-start", flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <GyfText accessibilityRole="header" theme={theme} variant="title">
                  {item.title}
                </GyfText>
                <GyfText style={{ color: palette.accentInk }} theme={theme} variant="mono">
                  {formatCatalogPrice(item.price, item.currency)}
                </GyfText>
              </View>
              <PressableScale
                accessibilityLabel="Close item details"
                accessibilityRole="button"
                hitSlop={hitSlopFor(44)}
                onPress={onClose}
                style={{ padding: spacing.xs }}
              >
                <IconClose color={palette.textMuted} size={20} />
              </PressableScale>
            </View>

            <CatalogImage
              label={item.title}
              recyclingKey={item.item_id}
              style={{
                aspectRatio: 3 / 4,
                backgroundColor: palette.surfaceRaised,
                borderRadius: radii.card,
                width: "100%",
              }}
              uri={item.image_url}
            />

            <View style={{ gap: spacing.xs }}>
              <GyfText theme={theme} variant="label">
                WHY THIS WORKS
              </GyfText>
              {item.color ? (
                <GyfText theme={theme} tone="faint" variant="mono">
                  COLOUR · {item.color.toUpperCase()}
                </GyfText>
              ) : null}
              <GyfText theme={theme} tone="muted" variant="bodySmall">
                {compatibility.reason}
              </GyfText>
            </View>

            <CompleteTheLook api={api} itemId={item.item_id} theme={theme} />

            {actionError ? (
              <GyfText
                accessibilityRole="alert"
                style={{ color: palette.error }}
                theme={theme}
                variant="bodySmall"
              >
                {actionError}
              </GyfText>
            ) : null}

            {shopUrl ? (
              <GyfText theme={theme} tone="faint" variant="bodySmall">
                {SHOP_AFFILIATE_DISCLOSURE}
              </GyfText>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <AtelierButton
                disabled={wardrobeState !== "idle"}
                label={
                  wardrobeState === "added"
                    ? "In your wardrobe"
                    : wardrobeState === "busy"
                      ? "Adding…"
                      : "Add to wardrobe"
                }
                onPress={() => void addToWardrobe()}
                style={{ flex: 1 }}
                variant="secondary"
              />
              {shopUrl ? (
                <AtelierButton
                  label="Shop now"
                  onPress={() =>
                    void Linking.openURL(shopUrl).catch(() =>
                      setActionError("Could not open the retailer link. Try again."),
                    )
                  }
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
            {shopUrl ? null : (
              <GyfText theme={theme} tone="faint" variant="bodySmall">
                No retailer link is available for this piece right now.
              </GyfText>
            )}
          </ScrollView>
        </BlurView>
      ) : null}
    </Modal>
  );
}
