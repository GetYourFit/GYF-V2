export type ReviewSurfaceRuntime = Readonly<{
  nodeEnv: string | undefined;
  dev: boolean;
  optIn: string | undefined;
}>;

/** Review fixtures are a local development surface, never a release capability. */
export function isReviewSurfaceEnabled(runtime: ReviewSurfaceRuntime): boolean {
  if (runtime.nodeEnv === "production") return false;
  return runtime.dev || runtime.optIn === "true";
}

export const reviewSurfaceEnabled = isReviewSurfaceEnabled({
  nodeEnv: process.env.NODE_ENV,
  // eslint-disable-next-line no-undef
  dev: typeof __DEV__ !== "undefined" && __DEV__,
  optIn: process.env.EXPO_PUBLIC_ENABLE_REVIEW_SURFACES,
});
