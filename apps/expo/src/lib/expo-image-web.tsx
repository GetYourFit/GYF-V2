import { Image as NativeImage, type ImageSourcePropType } from "react-native";

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
  contentPosition: _contentPosition,
  onError,
  onLoad,
  recyclingKey: _recyclingKey,
  source,
  ...rest
}: WebImageProps) {
  const nativeSource: ImageSourcePropType =
    typeof source === "string" ? { uri: source } : (source as ImageSourcePropType);
  return (
    <NativeImage
      {...(rest as React.ComponentProps<typeof NativeImage>)}
      onError={onError as React.ComponentProps<typeof NativeImage>["onError"]}
      onLoad={(event) => {
        const nativeEvent = event.nativeEvent as { source?: { height?: number; width?: number } };
        (onLoad as ((event: LoadEvent) => void) | undefined)?.({ source: nativeEvent.source });
      }}
      resizeMode={contentFit === "contain" ? "contain" : "cover"}
      source={nativeSource}
    />
  );
}
