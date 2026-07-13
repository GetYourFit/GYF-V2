// Shared types — single source of truth across web, BFF, and (mirrored) the API.
// Keep in lockstep with services/api/app/events.py and the DB schema.
//
// API request/response types are GENERATED from the FastAPI OpenAPI schema
// (`make types` → src/api.ts, never hand-edited). The hand-written event types
// below predate the API surface and remain the canonical client-side event shape.

export type { paths, components, operations } from "./api";
import type { components } from "./api";

/** Convenience aliases for the API models the web app consumes most. */
export type ProfileInput = components["schemas"]["ProfileInput"];
export type Profile = components["schemas"]["Profile"];
export type ProfileSummary = components["schemas"]["ProfileSummary"];
export type BudgetRange = components["schemas"]["BudgetRange"];
export type ConsentInput = components["schemas"]["ConsentInput"];
export type OutfitRecommendation = components["schemas"]["OutfitRecommendation"];
export type Outfit = components["schemas"]["Outfit"];
export type OutfitItem = components["schemas"]["OutfitItem"];
export type SearchResult = components["schemas"]["SearchResult"];
export type FeedbackRequest = components["schemas"]["FeedbackRequest"];

/** Collections (saved shortlist), wardrobe (owned garments) & social (shared looks). */
export type SaveItemRequest = components["schemas"]["SaveItemRequest"];
export type SavedItem = components["schemas"]["SavedItem"];
export type WardrobeItem = components["schemas"]["WardrobeItem"];
export type WardrobeItemInput = components["schemas"]["WardrobeItemInput"];
export type Post = components["schemas"]["Post"];
export type PostInput = components["schemas"]["PostInput"];
export type ReactionInput = components["schemas"]["ReactionInput"];
export type SavedOutfit = components["schemas"]["SavedOutfit"];
export type SavedOutfitItem = components["schemas"]["SavedOutfitItem"];
export type SaveOutfitRequest = components["schemas"]["SaveOutfitRequest"];

/** Trust surface (M8.5): what is live, experimental, degraded, or planned. */
export type SystemStatus = components["schemas"]["SystemStatus"];
export type Capability = components["schemas"]["Capability"];

/** Operator surface (M8.5): per-model lane + serve-eligibility from the registry. */
export type ModelRegistryStatus = components["schemas"]["ModelRegistryStatus"];
export type ModelStatus = components["schemas"]["ModelStatus"];

/** Virtual try-on (M9): a render on the user's photo, or an honest abstention. */
export type TryOnResponse = components["schemas"]["TryOnResponse"];

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
  "swap",
] as const;
export type InteractionAction = (typeof INTERACTION_ACTIONS)[number];

/** Things an interaction can target. */
export const INTERACTION_TARGETS = ["item", "outfit", "post", "user"] as const;
export type InteractionTarget = (typeof INTERACTION_TARGETS)[number];

/** A single behavioral event. Append-only, schema-versioned. */
export interface InteractionEvent {
  eventId: string;
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
