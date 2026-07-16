import { View } from "react-native";

import { colors, spacing, type ThemeName } from "@/theme/tokens";
import { useTheme } from "@/theme/use-color-scheme";
import { AtelierButton } from "./atelier-button";
import { GyfText } from "./gyf-text";

/** Headline + description + one action, with an illustration slot. */
export function EmptyState({
  headline,
  description,
  actionLabel,
  onAction,
  illustration,
  theme: themeProp,
}: {
  headline: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: React.ReactNode;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
  return (
    <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}>
      {illustration}
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <GyfText accessibilityRole="header" theme={theme} variant="title">
          {headline}
        </GyfText>
        <GyfText
          style={{ maxWidth: 300, textAlign: "center" }}
          theme={theme}
          tone="muted"
          variant="bodySmall"
        >
          {description}
        </GyfText>
      </View>
      {actionLabel && onAction ? (
        <AtelierButton label={actionLabel} onPress={onAction} theme={theme} />
      ) : null}
    </View>
  );
}

/** EmptyState's error twin — same layout, alert semantics, retry action. */
export function ErrorState({
  message,
  onRetry,
  illustration,
  theme: themeProp,
}: {
  message: string;
  onRetry?: () => void;
  illustration?: React.ReactNode;
  theme?: ThemeName;
}) {
  const theme = useTheme(themeProp);
  return (
    <View
      accessibilityRole="alert"
      style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}
    >
      {illustration}
      <GyfText
        style={{ color: colors[theme].error, maxWidth: 300, textAlign: "center" }}
        theme={theme}
        variant="bodySmall"
      >
        {message}
      </GyfText>
      {onRetry ? <AtelierButton label="Try again" onPress={onRetry} theme={theme} /> : null}
    </View>
  );
}
