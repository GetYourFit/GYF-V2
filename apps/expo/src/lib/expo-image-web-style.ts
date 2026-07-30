export function webImageStyle(
  style: Record<string, unknown> | undefined,
  contentFit: unknown,
  contentPosition: unknown,
): Record<string, unknown> {
  return {
    ...style,
    display: "block",
    objectFit: contentFit === "contain" ? "contain" : "cover",
    objectPosition: typeof contentPosition === "string" ? contentPosition : "center",
  };
}
