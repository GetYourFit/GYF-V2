import { StyleSheet } from "react-native";

import { webImageStyle } from "./expo-image-web-style";

type LoadEvent = { source?: { height?: number; width?: number } };

type WebImageProps = Record<string, unknown>;

/**
 * The catalogue image contract is intentionally tiny on web. Browser image
 * caching replaces expo-image's native disk cache; keeping the native package
 * out of the web entry removes an optional 115 KB runtime while preserving the
 * product image, retry, sizing, and accessibility paths.
 */
export function Image({
  cachePolicy: _cachePolicy,
  contentFit,
  contentPosition,
  onError,
  onLoad,
  recyclingKey: _recyclingKey,
  source,
  style,
  ...rest
}: WebImageProps) {
  const uri = typeof source === "string" ? source : (source as { uri?: string } | undefined)?.uri;
  const accessibilityLabel =
    typeof rest.accessibilityLabel === "string" ? rest.accessibilityLabel : "";
  const flattenedStyle = StyleSheet.flatten(style as never) as Record<string, unknown> | undefined;

  return (
    <img
      alt={accessibilityLabel}
      draggable={false}
      onError={onError as React.ComponentProps<"img">["onError"]}
      onLoad={(event) => {
        const image = event.currentTarget;
        (onLoad as ((event: LoadEvent) => void) | undefined)?.({
          source: { height: image.naturalHeight, width: image.naturalWidth },
        });
      }}
      src={uri}
      style={webImageStyle(flattenedStyle, contentFit, contentPosition) as React.CSSProperties}
    />
  );
}
