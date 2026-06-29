"use client";

import { motion } from "framer-motion";
import { Heart, Share2, Shirt } from "lucide-react";
import { useState } from "react";

import type { Post } from "@gyf/types";

interface PostCardProps {
  post: Post;
  /** React once per (post, user). Returns the persisted reacted state. */
  onReact?: (postId: string) => Promise<boolean>;
  /** Re-render this look for the current user ("dress like me"). */
  onDressLikeMe?: (post: Post) => void;
}

/** A short, stable author handle derived from the opaque user id — the API does
 *  not expose display names yet (v1.x fast-follow), so we show an honest short id. */
function authorOf(userId: string): { handle: string; initial: string } {
  const handle = userId.replace(/-/g, "").slice(0, 8);
  return { handle, initial: (handle[0] ?? "?").toUpperCase() };
}

export function PostCard({ post, onReact, onDressLikeMe }: PostCardProps) {
  const author = authorOf(post.user_id);
  const [reacted, setReacted] = useState(false);
  const [count, setCount] = useState(post.reaction_count);
  const [pending, setPending] = useState(false);

  const heroImage = post.items.find((i) => i.image_url)?.image_url ?? null;

  async function react() {
    if (pending || reacted) return; // one reaction per (post, user) — server-enforced
    setPending(true);
    // optimistic
    setReacted(true);
    setCount((n) => n + 1);
    try {
      const ok = onReact ? await onReact(post.id) : true;
      if (!ok) {
        setReacted(false);
        setCount((n) => Math.max(0, n - 1));
      }
    } catch {
      setReacted(false);
      setCount((n) => Math.max(0, n - 1));
    } finally {
      setPending(false);
    }
  }

  function share() {
    if (navigator.share) {
      void navigator.share({
        title: "An outfit on GYF",
        text: post.caption ?? "Styled with GYF",
      });
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col border-b border-border bg-bg"
    >
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-surface-2 border border-border-mid">
          <span className="t-label text-text">{author.initial}</span>
        </div>
        <div className="min-w-0">
          <p className="t-mono text-[11px] text-text truncate">@{author.handle}</p>
          {post.region && (
            <p className="t-mono text-[10px] text-text-faint uppercase">{post.region}</p>
          )}
        </div>
        {post.occasion && (
          <span className="ml-auto t-mono text-[9px] border border-border-mid px-2 py-0.5 text-text-faint shrink-0">
            {post.occasion}
          </span>
        )}
      </div>

      {/* Hero image — first garment image of the look */}
      {heroImage && (
        <div className="aspect-square w-full overflow-hidden bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={post.caption ?? "Outfit"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Caption + item chips */}
      <div className="px-4 pt-3">
        {post.caption && (
          <p className="t-body text-text">
            <span className="t-label mr-1">@{author.handle}</span>
            {post.caption}
          </p>
        )}
        {post.items.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.items.map((item) => (
              <span
                key={item.item_id}
                className="t-mono text-[9px] border border-border px-2 py-0.5 text-text-faint"
              >
                {item.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-3">
        <button
          type="button"
          aria-label={reacted ? "Reacted" : "React"}
          aria-pressed={reacted}
          onClick={react}
          disabled={pending}
          className="flex items-center gap-1.5 px-2 py-2 transition-colors active:opacity-60 disabled:opacity-50"
        >
          <Heart
            size={20}
            className={
              reacted ? "fill-error text-error" : "text-text-faint"
            }
          />
          <span className="t-mono text-[11px] text-text-faint">{count}</span>
        </button>

        <button
          type="button"
          aria-label="Share"
          onClick={share}
          className="flex items-center gap-1.5 px-2 py-2 text-text-faint transition-colors active:opacity-60"
        >
          <Share2 size={20} />
        </button>

        {onDressLikeMe && (
          <button
            type="button"
            onClick={() => onDressLikeMe(post)}
            className="ml-auto flex items-center gap-1.5 border border-border-mid px-3 py-1.5 t-label text-[10px] text-text transition-colors active:bg-surface"
          >
            <Shirt size={13} />
            Dress like me
          </button>
        )}
      </div>
    </motion.article>
  );
}
