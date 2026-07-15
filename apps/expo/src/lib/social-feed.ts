import type { Post, SavedItem } from "./api";

export const SOCIAL_PAGE_SIZE = 20;
export type FeedScope = "all" | "following";

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
