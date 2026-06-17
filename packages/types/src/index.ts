// Shared types — single source of truth across web, BFF, and (mirrored) the API.
// Keep in lockstep with services/api/app/events.py and the DB schema.

/** Interaction actions captured as the behavioral event spine. */
export const INTERACTION_ACTIONS = [
  "view",
  "save",
  "cart",
  "skip",
  "react",
  "share",
  "follow",
  "tryon",
] as const;
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];

/** Things an interaction can target. */
export const INTERACTION_TARGETS = ["item", "outfit", "post", "user"] as const;
export type InteractionTarget = (typeof INTERACTION_TARGETS)[number];

/** A single behavioral event. Append-only, schema-versioned. */
export interface InteractionEvent {
  schemaVersion: 1;
  userId: string;
  targetType: InteractionTarget;
  targetId: string;
  action: InteractionAction;
  /** Optional signed weight; e.g. skip = negative. */
  weight?: number;
  /** ISO-8601 timestamp. */
  ts: string;
}

export type HealthStatus = "ok" | "degraded";
export interface HealthResponse {
  status: HealthStatus;
  service: string;
}
