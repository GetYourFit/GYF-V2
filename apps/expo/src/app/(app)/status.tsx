import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import type { ModelRegistryStatus, SystemStatus } from "@gyf/types";

import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { GyfText } from "@/components/ui/gyf-text";
import { createApi } from "@/lib/api";
import { capabilityLabel, modelEligibility, stateLabel } from "@/lib/system-status";
import { colors, radii, spacing } from "@/theme/tokens";

type LoadState = "loading" | "ready" | "error";
type Capability = SystemStatus["capabilities"][string];

const STATE_COLOR: Record<Capability["status"], string> = {
  live: colors.dark.success,
  beta: colors.dark.warning,
  shadow: colors.dark.textMuted,
  degraded: colors.dark.error,
  planned: colors.dark.textFaint,
};

export default function StatusRoute() {
  const api = useMemo(() => createApi(), []);
  const requestId = useRef(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [models, setModels] = useState<ModelRegistryStatus | null>(null);

  const load = useCallback(async () => {
    const ticket = ++requestId.current;
    setLoadState("loading");
    setModels(null);
    const modelRequest = api.systemModels().catch(() => null);
    try {
      const nextStatus = await api.systemStatus();
      if (ticket !== requestId.current) return;
      setStatus(nextStatus);
      setLoadState("ready");
    } catch {
      if (ticket !== requestId.current) return;
      setStatus(null);
      setLoadState("error");
      return;
    }
    const nextModels = await modelRequest;
    if (ticket === requestId.current) setModels(nextModels);
  }, [api]);

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.dark.bg }}
    >
      <View style={{ gap: spacing.sm }}>
        <GyfText tone="faint" variant="label">
          TRUST, NOT MARKETING
        </GyfText>
        <GyfText accessibilityRole="header" variant="display">
          System status
        </GyfText>
        <GyfText tone="muted">
          What is live, experimental, degraded or not built—reported by the running GYF system.
        </GyfText>
      </View>

      {loadState === "loading" && !status ? (
        <AtelierCard style={{ alignItems: "center", gap: spacing.md }}>
          <ActivityIndicator color={colors.dark.text} />
          <GyfText accessibilityRole="alert" tone="muted" variant="bodySmall">
            Reading the live capability report…
          </GyfText>
        </AtelierCard>
      ) : null}

      {loadState === "error" ? (
        <AtelierCard style={{ gap: spacing.md }}>
          <GyfText style={{ color: colors.dark.error }} variant="title">
            The status report is unreachable
          </GyfText>
          <GyfText tone="muted" variant="bodySmall">
            That is a status of its own. No previous snapshot is presented as current.
          </GyfText>
          <AtelierButton label="Try again" onPress={() => void load()} />
        </AtelierCard>
      ) : null}

      {status ? (
        <>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <BackboneCard
              label="DATABASE"
              state={status.database === "ready" ? "READY" : "UNREACHABLE"}
              color={status.database === "ready" ? colors.dark.success : colors.dark.error}
            />
            <BackboneCard
              label="ENVIRONMENT"
              state={status.environment.toUpperCase()}
              color={colors.dark.text}
            />
          </View>

          <View style={{ gap: spacing.sm }}>
            {Object.entries(status.capabilities).map(([key, capability]) => (
              <AtelierCard key={key} style={{ gap: spacing.sm, padding: spacing.md }}>
                <View
                  style={{
                    alignItems: "center",
                    flexDirection: "row",
                    gap: spacing.sm,
                    justifyContent: "space-between",
                  }}
                >
                  <GyfText style={{ flex: 1 }} variant="title">
                    {capabilityLabel(key)}
                  </GyfText>
                  <StatusPill capability={capability} />
                </View>
                <GyfText tone="muted" variant="bodySmall">
                  {capability.detail}
                </GyfText>
                <GyfText tone="faint" variant="mono">
                  LANE {capability.lane.toUpperCase()}
                </GyfText>
              </AtelierCard>
            ))}
          </View>

          <AtelierCard style={{ gap: spacing.md }}>
            <GyfText variant="label">CATALOGUE BACKBONE</GyfText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              <Metric label="ITEMS" value={status.catalog.items} />
              <Metric label="PRICED" value={status.catalog.with_price} />
              <Metric label="IMAGES" value={status.catalog.with_image} />
              <Metric label="EMBEDDED" value={status.catalog.with_embedding} />
            </View>
          </AtelierCard>

          {models?.available ? <ModelLanes models={models.models} /> : null}

          <Pressable
            accessibilityRole="button"
            disabled={loadState === "loading"}
            onPress={() => void load()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: spacing.sm })}
          >
            <GyfText style={{ textAlign: "center" }} tone="muted" variant="bodySmall">
              {loadState === "loading" ? "Refreshing…" : "Refresh live report"}
            </GyfText>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

function BackboneCard({ label, state, color }: { label: string; state: string; color: string }) {
  return (
    <AtelierCard style={{ flex: 1, gap: spacing.xs, padding: spacing.md }}>
      <GyfText tone="faint" variant="label">
        {label}
      </GyfText>
      <GyfText style={{ color }} variant="mono">
        {state}
      </GyfText>
    </AtelierCard>
  );
}

function StatusPill({ capability }: { capability: Capability }) {
  const color = STATE_COLOR[capability.status];
  return (
    <View
      style={{
        borderColor: color,
        borderRadius: radii.capsule,
        borderWidth: 1,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <GyfText style={{ color }} variant="mono">
        {stateLabel(capability.status)}
      </GyfText>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <View style={{ minWidth: 64 }}>
      <GyfText variant="title">{value ?? "—"}</GyfText>
      <GyfText tone="faint" variant="mono">
        {label}
      </GyfText>
    </View>
  );
}

function ModelLanes({ models }: { models: ModelRegistryStatus["models"] }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ gap: spacing.xs }}>
        <GyfText variant="label">MODEL POLICY LANES</GyfText>
        <GyfText tone="muted" variant="bodySmall">
          Eligibility means policy permits a model to serve. It does not claim the model is loaded
          or handling traffic; runtime truth is listed above.
        </GyfText>
      </View>
      {models.map((model) => {
        const eligibility = modelEligibility(model);
        const eligible = eligibility.label === "ELIGIBLE";
        return (
          <AtelierCard key={model.name} style={{ gap: spacing.xs, padding: spacing.md }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: spacing.sm,
                justifyContent: "space-between",
              }}
            >
              <GyfText style={{ flex: 1 }} variant="bodySmall">
                {model.name}
              </GyfText>
              <GyfText
                style={{ color: eligible ? colors.dark.success : colors.dark.textFaint }}
                variant="mono"
              >
                {eligibility.label}
              </GyfText>
            </View>
            <GyfText tone="faint" variant="mono">
              {model.capability.toUpperCase()} · {model.lane.toUpperCase()} · {model.license}
            </GyfText>
            {eligibility.blockers.length > 0 ? (
              <GyfText tone="muted" variant="bodySmall">
                Blocked: {eligibility.blockers.join("; ")}
              </GyfText>
            ) : null}
          </AtelierCard>
        );
      })}
    </View>
  );
}
