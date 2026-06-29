"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Share2, Shirt } from "lucide-react";
import { useState } from "react";

import type { Post } from "@gyf/types";

const LUX = [0.16, 1, 0.3, 1] as const;

interface PostCardProps {
  post: Post;
  /** Position in the feed — drives the staggered entrance. */
  index?: number;
  /** React once per (post, user). Returns the persisted reacted state. */
  onReact?: (postId: string) => Promise<boolean>;
  /** Surface a toast after a successful native share. */
  onShared?: (text: string) => void;
  /** Re-render this look for the current user ("dress like me"). */
  onDressLikeMe?: (post: Post) => void;
}

/** A short, stable author handle derived from the opaque user id — the API does
 *  not expose display names yet (v1.x fast-follow), so we show an honest short id. */
function authorOf(userId: string): { handle: string; initial: string } {
  const handle = userId.replace(/-/g, "").slice(0, 8);
  return { handle, initial: (handle[0] ?? "?").toUpperCase() };
}

export function PostCard({
  post,
  index = 0,
  onReact,
  onShared,
  onDressLikeMe,
}: PostCardProps) {
  const reduceMotion = useReducedMotion();
  const author = authorOf(post.user_id);
  const [reacted, setReacted] = useState(false);
  const [count, setCount] = useState(post.reaction_count);
  const [pending, setPending] = useState(false);
  const [burst, setBurst] = useState(0);

  const heroImage = post.items.find((i) => i.image_url)?.image_url ?? null;

  async function react() {
    if (pending || reacted) return; // one reaction per (post, user) — server-enforced
    setPending(true);
    setReacted(true);
    setCount((n) => n + 1);
    setBurst((b) => b + 1);
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
    const text = post.caption ?? "Styled with GYF";
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator
        .share({ title: "An outfit on GYF", text })
        .then(() => onShared?.("Look shared from your device."))
        .catch(() => {
          /* user dismissed the native sheet — not an error */
        });
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard
        .writeText(text)
        .then(() => onShared?.("Caption copied to your clipboard."));
    }
  }

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
      transition={{
        duration: 0.4,
        ease: LUX,
        delay: reduceMotion ? 0 : Math.min(index * 0.06, 0.36),
      }}
      className="flex list-none flex-col border border-border bg-surface"
    >
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border-mid bg-surface-2">
          <span className="t-label text-text">{author.initial}</span>
        </div>
        <div className="min-w-0">
          <p className="t-mono truncate text-text">@{author.handle}</p>
          {post.region && (
            <p className="t-mono mt-1 uppercase text-text-faint">{post.region}</p>
          )}
        </div>
        {post.occasion && (
          <span className="t-mono ml-auto shrink-0 border border-border-mid px-2 py-1 uppercase text-text-faint">
            {post.occasion}
          </span>
        )}
      </div>

      {/* Hero image — first garment image of the look */}
      {heroImage && (
        <button
          type="button"
          onDoubleClick={react}
          aria-label="Double-tap to react"
          className="group relative aspect-square w-full overflow-hidden bg-surface-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={post.caption ?? "A styled outfit"}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
          {/* Heart burst on double-tap react */}
          <AnimatePresence>
            {burst > 0 && !reduceMotion && (
              <motion.span
                key={burst}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 1.3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: LUX }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                aria-hidden
              >
                <Heart size={72} className="fill-surface text-surface drop-shadow" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}

      {/* Caption + item chips */}
      <div className="px-4 pt-3">
        {post.caption && (
          <p className="t-body text-text">
            <span className="t-label mr-1.5">@{author.handle}</span>
            {post.caption}
          </p>
        )}
        {post.items.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.items.map((item) => (
              <span
                key={item.item_id}
                className="t-mono border border-border px-2 py-1 text-text-faint"
              >
                {item.title}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-3">
        <motion.button
          type="button"
          aria-label={reacted ? "Reacted" : "React to this look"}
          aria-pressed={reacted}
          onClick={react}
          disabled={pending}
          whileTap={reduceMotion ? undefined : { scale: 0.88 }}
          className="flex items-center gap-1.5 px-2 py-2 transition-colors hover:text-text disabled:opacity-50"
        >
          <Heart
            size={20}
            className={reacted ? "fill-error text-error" : "text-text-faint"}
            aria-hidden
          />
          <span className="t-mono text-text-faint">{count}</span>
        </motion.button>

        <motion.button
          type="button"
          aria-label="Share this look"
          onClick={share}
          whileTap={reduceMotion ? undefined : { scale: 0.88 }}
          className="flex items-center gap-1.5 px-2 py-2 text-text-faint transition-colors hover:text-text"
        >
          <Share2 size={20} aria-hidden />
        </motion.button>

        {onDressLikeMe && (
          <button
            type="button"
            onClick={() => onDressLikeMe(post)}
            className="t-label ml-auto flex items-center gap-1.5 border border-border-mid px-3 py-2 text-text transition-colors hover:border-border-hi hover:bg-surface-2"
          >
            <Shirt size={13} aria-hidden />
            Dress like me
          </button>
        )}
      </div>
    </motion.li>
  );
}
