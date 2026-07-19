import type { ProfileSummary } from "./api";

/** "January 2026" from a YYYY-MM-DD member-since date, or null if absent/unparseable. */
export function formatMemberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The only avatar URLs GYF will render: absolute https. Anything else → null (SVG/initials fallback). */
export function avatarImageUrl(url: string | null | undefined): string | null {
  return url && /^https:\/\//i.test(url.trim()) ? url.trim() : null;
}

/** Initials for the avatar fallback, e.g. "Aria Vance" → "AV". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GYF";
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** The six stat cells, in the fixed 3×2 grid order the profile shows. */
export function statCells(summary: ProfileSummary): Array<{ label: string; value: number }> {
  return [
    { label: "Outfits", value: summary.outfits_made },
    { label: "Saved", value: summary.items_saved },
    { label: "Wardrobe", value: summary.wardrobe_size },
    { label: "Posts", value: summary.posts },
    { label: "Reactions", value: summary.reactions_received },
    { label: "Badges", value: summary.badges.length },
  ];
}
