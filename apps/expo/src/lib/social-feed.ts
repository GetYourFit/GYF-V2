import type { Outfit, Post, PostInput, SavedItem } from "./api";

export const SOCIAL_PAGE_SIZE = 20;
export const SOCIAL_CAPTION_MAX = 1_000;
export type FeedScope = "all" | "following";

/** Build a post only from a server-returned outfit; empty looks cannot be published. */
export function postInputForOutfit(
  outfit: Outfit | undefined,
  recommendationId: string,
  occasion?: string,
  caption?: string,
): PostInput | null {
  if (!outfit) return null;
  const itemIds = outfit.items.map((item) => item.item_id).filter(Boolean);
  if (itemIds.length === 0) return null;
  const trimmed = caption?.trim().slice(0, SOCIAL_CAPTION_MAX);
  return {
    item_ids: itemIds,
    recommendation_id: recommendationId,
    occasion: occasion || undefined,
    caption: trimmed || undefined,
  };
}

/** First `max` items that actually carry a remote image — a look's preview strip. */
export function postCoverImages(items: SavedItem[], max = 3): string[] {
  const images: string[] = [];
  for (const item of items) {
    if (item.image_url && /^https:\/\//i.test(item.image_url)) {
      images.push(item.image_url);
      if (images.length >= max) break;
    }
  }
  return images;
}

/** Optimistic reaction update: flip `reacted` and move the count by exactly one, never below zero. */
export function applyReaction(post: Post, reacted: boolean): Post {
  if (post.reacted === reacted) return post;
  const delta = reacted ? 1 : -1;
  return { ...post, reacted, reaction_count: Math.max(0, post.reaction_count + delta) };
}

/** Immutable add/remove of an id in a Set — used for optimistic follow toggles. */
export function toggleId(ids: ReadonlySet<string>, id: string, present: boolean): Set<string> {
  const next = new Set(ids);
  if (present) next.add(id);
  else next.delete(id);
  return next;
}

/** Keep pagination stable if the API repeats a post at a page boundary. */
export function appendUniquePosts(current: Post[], next: Post[]): Post[] {
  const seen = new Set(current.map((post) => post.id));
  return [...current, ...next.filter((post) => !seen.has(post.id))];
}
