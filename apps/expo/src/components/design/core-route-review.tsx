import { Image, type ImageSourcePropType, View } from "react-native";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { ConfidenceLabel } from "@/components/ui/confidence-label";
import { GyfText } from "@/components/ui/gyf-text";
import type { CoreRouteFixture } from "@/design-fixtures/core-route-states";
import { colors, radii, spacing } from "@/theme/tokens";

const REVIEW_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {
  "fixture-top-01": require("../../../assets/design-review/ivory-cotton-shirt.jpg"),
  "fixture-bottom-01": require("../../../assets/design-review/charcoal-tailored-trousers.jpg"),
  "fixture-footwear-01": require("../../../assets/design-review/black-leather-loafers.jpg"),
  "fixture-catalogue-01": require("../../../assets/design-review/indigo-linen-overshirt.jpg"),
  "fixture-catalogue-02": require("../../../assets/design-review/ivory-cotton-shirt.jpg"),
  "fixture-catalogue-03": require("../../../assets/design-review/charcoal-tailored-trousers.jpg"),
  "fixture-catalogue-04": require("../../../assets/design-review/black-leather-loafers.jpg"),
};

function formatPrice(
  price: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (price == null || currency == null) return "Price unavailable";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function GarmentTile({
  color,
  itemId,
  label,
  theme,
}: {
  color: string | null | undefined;
  itemId: string;
  label: string;
  theme: CoreRouteFixture["theme"];
}) {
  const palette = colors[theme];
  return (
    <View
      style={{
        backgroundColor: palette.surfaceRaised,
        borderCurve: "continuous",
        borderRadius: radii.control,
        flex: 1,
        gap: spacing.sm,
        minHeight: 128,
        minWidth: 0,
        padding: spacing.md,
      }}
    >
      {REVIEW_IMAGES[itemId] ? (
        <View
          style={{
            borderCurve: "continuous",
            borderRadius: radii.control,
            flex: 1,
            minHeight: 96,
            overflow: "hidden",
            width: "100%",
          }}
        >
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${label}, illustrative review image`}
            resizeMode="cover"
            source={REVIEW_IMAGES[itemId]}
            style={{ height: "100%", width: "100%" }}
          />
        </View>
      ) : (
        <View
          accessibilityLabel={`${color ?? "neutral"} garment swatch`}
          style={{
            backgroundColor: color ?? palette.border,
            borderCurve: "continuous",
            borderRadius: radii.control,
            flex: 1,
            minHeight: 96,
          }}
        />
      )}
      <GyfText numberOfLines={2} theme={theme} variant="bodySmall">
        {label}
      </GyfText>
    </View>
  );
}

function StylistComposition({ fixture }: { fixture: CoreRouteFixture & { route: "stylist" } }) {
  const recommendation = fixture.data;
  const outfit = recommendation?.outfits[0];
  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <GyfText
          accessibilityRole="header"
          theme={fixture.theme}
          variant="display"
        >
          {fixture.hero}
        </GyfText>
        <GyfText theme={fixture.theme} tone="muted" variant="bodySmall">
          Built as one complete outfit—not a bag of unrelated products.
        </GyfText>
      </View>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {outfit?.items.map((item) => (
          <GarmentTile
            color={item.color}
            itemId={item.item_id}
            key={item.item_id}
            label={item.title}
            theme={fixture.theme}
          />
        ))}
      </View>
      <ConfidenceLabel
        confidence={outfit?.confidence ?? null}
        reason={outfit?.explanation ?? fixture.explanationPath}
        theme={fixture.theme}
      />
      <AtelierButton disabled label={`${fixture.primaryAction} · preview`} theme={fixture.theme} />
    </>
  );
}

function ExploreComposition({ fixture }: { fixture: CoreRouteFixture & { route: "explore" } }) {
  const results = fixture.data ?? [];
  const columns = fixture.exploreColumns ?? 2;
  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <GyfText
          accessibilityRole="header"
          theme={fixture.theme}
          variant="display"
        >
          {fixture.hero}
        </GyfText>
        <GyfText theme={fixture.theme} tone="muted" variant="bodySmall">
          Four catalogue pieces · prices shown in their source currency
        </GyfText>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {results.map((item) => (
          <View
            key={item.item_id}
            style={{ flexBasis: `${Math.floor(100 / columns) - 2}%`, flexGrow: 0, gap: spacing.xs }}
          >
            <GarmentTile
              color={item.color}
              itemId={item.item_id}
              label={item.title}
              theme={fixture.theme}
            />
            <GyfText theme={fixture.theme} tone="muted" variant="mono">
              {formatPrice(item.price, item.currency)}
            </GyfText>
          </View>
        ))}
      </View>
      <AtelierButton disabled label={`${fixture.primaryAction} · preview`} theme={fixture.theme} />
    </>
  );
}

function ItemDetailComposition({
  fixture,
}: {
  fixture: CoreRouteFixture & { route: "item-detail" };
}) {
  const { item, pairing } = fixture.data;
  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <GyfText theme={fixture.theme} tone="faint" variant="label">
          SELECTED PIECE
        </GyfText>
        <GyfText
          accessibilityRole="header"
          theme={fixture.theme}
          variant="display"
        >
          {fixture.hero}
        </GyfText>
        <GyfText theme={fixture.theme} tone="muted" variant="bodySmall">
          {formatPrice(item.price, item.currency)} · {item.color ?? "Colour unavailable"}
        </GyfText>
      </View>
      <View
        style={{
          backgroundColor: colors[fixture.theme].surfaceRaised,
          borderCurve: "continuous",
          borderRadius: radii.control,
          gap: spacing.md,
          padding: spacing.md,
        }}
      >
        <GyfText theme={fixture.theme} variant="title">
          Wear it as a complete look
        </GyfText>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {pairing?.items.map((piece) => (
            <GarmentTile
              color={piece.color}
              itemId={piece.item_id}
              key={piece.item_id}
              label={piece.title}
              theme={fixture.theme}
            />
          ))}
        </View>
        <GyfText theme={fixture.theme} tone="muted" variant="bodySmall">
          {pairing?.explanation ?? fixture.explanationPath}
        </GyfText>
      </View>
      <AtelierButton disabled label={`${fixture.primaryAction} · preview`} theme={fixture.theme} />
    </>
  );
}

function PersonalFitComposition({
  fixture,
}: {
  fixture: CoreRouteFixture & { route: "personal-fit" };
}) {
  const palette = colors[fixture.theme];
  const { data } = fixture;
  const fields = [
    ["Skin tone", data.skinTone ?? "Choose manually"],
    ["Body type", data.bodyType ?? "Choose manually"],
    ["Currency", data.currency],
    [
      "Budget",
      `${formatPrice(data.budgetMin, data.currency)}–${formatPrice(data.budgetMax, data.currency)}`,
    ],
  ] as const;
  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <GyfText accessibilityRole="header" theme={fixture.theme} variant="display">
          {fixture.hero}
        </GyfText>
        <GyfText theme={fixture.theme} tone="muted" variant="bodySmall">
          Add a photo for gated estimates, or complete every field manually.
        </GyfText>
      </View>
      <View
        accessibilityLabel="Optional photo preview"
        style={{
          alignItems: "center",
          backgroundColor: palette.surfaceRaised,
          borderColor: palette.border,
          borderRadius: radii.control,
          borderWidth: 1,
          height: 132,
          justifyContent: "center",
        }}
      >
        <GyfText theme={fixture.theme} tone="faint" variant="label">
          PHOTO OPTIONAL
        </GyfText>
      </View>
      <View style={{ gap: spacing.sm }}>
        {fields.map(([label, value]) => (
          <View
            key={label}
            style={{
              borderBottomColor: palette.border,
              borderBottomWidth: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: spacing.sm,
            }}
          >
            <GyfText theme={fixture.theme} tone="muted" variant="bodySmall">
              {label}
            </GyfText>
            <GyfText theme={fixture.theme} variant="bodySmall">
              {value}
            </GyfText>
          </View>
        ))}
      </View>
      {data.saveError ? (
        <GyfText style={{ color: palette.error }} theme={fixture.theme} variant="bodySmall">
          {data.saveError}
        </GyfText>
      ) : null}
      <AtelierButton disabled label={`${fixture.primaryAction} · preview`} theme={fixture.theme} />
    </>
  );
}

export function CoreRouteReview({ fixture }: { fixture: CoreRouteFixture }) {
  const palette = colors[fixture.theme];
  return (
    <AtelierCard
      accessibilityLabel={`${fixture.route} ${fixture.width} ${fixture.theme} design review`}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
        maxWidth: fixture.width,
        width: "100%",
      }}
      theme={fixture.theme}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <GyfText theme={fixture.theme} tone="faint" variant="mono">
          {fixture.route.toUpperCase()} · {fixture.width} · {fixture.theme.toUpperCase()}
        </GyfText>
        <GyfText theme={fixture.theme} tone="faint" variant="mono">
          REVIEW
        </GyfText>
      </View>
      {fixture.route === "stylist" ? (
        <StylistComposition fixture={fixture} />
      ) : fixture.route === "explore" ? (
        <ExploreComposition fixture={fixture} />
      ) : fixture.route === "personal-fit" ? (
        <PersonalFitComposition fixture={fixture} />
      ) : (
        <ItemDetailComposition fixture={fixture} />
      )}
      <GyfText theme={fixture.theme} tone="faint" variant="bodySmall">
        Fixture coverage: {fixture.supportNote}
      </GyfText>
      <GyfText theme={fixture.theme} tone="faint" variant="bodySmall">
        Imagery is AI-generated for direction review only; it is not catalogue or licensing
        evidence.
      </GyfText>
    </AtelierCard>
  );
}
