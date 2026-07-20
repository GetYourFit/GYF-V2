import { Image, type ImageStyle } from "expo-image";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { spacing } from "@/theme/tokens";
import { isRemoteImage } from "./catalog-image-url";
import { GyfText } from "./gyf-text";

export { isRemoteImage } from "./catalog-image-url";

export function CatalogImage({
  label,
  recyclingKey,
  style,
  uri,
}: {
  label: string;
  recyclingKey: string;
  style: StyleProp<ImageStyle>;
  uri?: string | null;
}) {
  const valid = isRemoteImage(uri);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    setAttempt(0);
  }, [uri]);

  if (!valid || failed) {
    const fallbackStyle = StyleSheet.flatten(style) as ViewStyle;
    return failed ? (
      <Pressable
        accessibilityLabel={`Retry image for ${label}`}
        accessibilityRole="button"
        onPress={() => {
          setFailed(false);
          setAttempt((current) => current + 1);
        }}
        style={[
          fallbackStyle,
          { alignItems: "center", justifyContent: "center", padding: spacing.sm },
        ]}
      >
        <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
          Image unavailable · Retry image
        </GyfText>
      </Pressable>
    ) : (
      <View
        accessibilityLabel={`${label}; image unavailable`}
        style={[
          fallbackStyle,
          { alignItems: "center", justifyContent: "center", padding: spacing.sm },
        ]}
      >
        <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
          Image unavailable
        </GyfText>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={label}
      cachePolicy="disk"
      // The image IS the frame — fill the plate edge to edge, never letterbox.
      contentFit="cover"
      contentPosition="top center"
      key={`${recyclingKey}:${attempt}`}
      onError={() => setFailed(true)}
      recyclingKey={recyclingKey}
      source={uri}
      style={style}
    />
  );
}
