"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Share2, Bookmark, Shirt } from "lucide-react";
import { useState } from "react";
import type { Post } from "@gyf/types";
import { browserApi } from "@/lib/api-client";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { UI_COLORS } from "@/lib/ui-colors";

const LUX = [0.16, 1, 0.3, 1] as const;

interface PostCardProps {
  post: Post;
  index?: number;
  /** The viewer's user id — used to hide Follow on the viewer's own posts. */
  viewerId?: string | null;
  /** Whether the viewer currently follows this post's author. */
  followed?: boolean;
  onReact?: (postId: string) => Promise<boolean>;
  onUnreact?: (postId: string) => Promise<void>;
  onShared?: (text: string) => void;
  onDressLikeMe?: (post: Post) => void;
  onToggleFollow?: (userId: string) => void;
}

function authorOf(userId: string): { handle: string; initial: string } {
  const handle = userId.replace(/-/g, "").slice(0, 8);
  return { handle, initial: (handle[0] ?? "?").toUpperCase() };
}

export function PostCard({
  post,
  index = 0,
  viewerId,
  followed = false,
  onReact,
  onUnreact,
  onShared,
  onDressLikeMe,
  onToggleFollow,
}: PostCardProps) {
  const reduceMotion = useReducedMotion();
  const author = authorOf(post.user_id);
  const [reacted, setReacted] = useState(post.reacted ?? false);
  const [saved, setSaved] = useState(false);
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [count, setCount] = useState(post.reaction_count);
  const [pending, setPending] = useState(false);
  const [burst, setBurst] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const heroPath = post.items.find((i) => i.image_url)?.image_url;
  const heroImage = mediaUrl(heroPath, 800);

  async function toggleSave() {
    // ponytail: saved state is per-session (fresh loads start unsaved) — the
    // saved-looks page is the durable view; wire feed-level saved detection
    // if users ask for it.
    if (savePending || post.items.length === 0) return;
    setSavePending(true);
    if (saved) {
      setSaved(false);
      try {
        if (savedOutfitId) await browserApi().removeSavedOutfit(savedOutfitId);
        setSavedOutfitId(null);
      } catch {
        setSaved(true);
      } finally {
        setSavePending(false);
      }
      return;
    }
    setSaved(true);
    try {
      const savedLook = await browserApi().saveOutfit({
        outfit_key: `post:${post.id}`,
        item_ids: post.items.map((i) => i.item_id),
        occasion: post.occasion ?? undefined,
        explanation: post.caption ?? undefined,
      });
      setSavedOutfitId(savedLook.id);
    } catch {
      setSaved(false);
    } finally {
      setSavePending(false);
    }
  }

  /** Toggle from the heart button; double-tap only ever likes (never un-likes). */
  async function react(mode: "toggle" | "like" = "toggle") {
    if (pending) return;
    if (reacted && mode === "like") return;
    setPending(true);
    if (reacted) {
      setReacted(false);
      setCount((n) => Math.max(0, n - 1));
      try {
        await onUnreact?.(post.id);
      } catch {
        setReacted(true);
        setCount((n) => n + 1);
      } finally {
        setPending(false);
      }
      return;
    }
    setReacted(true);
    setCount((n) => n + 1);
    setBurst((b) => b + 1);
    try {
      if (onReact) await onReact(post.id);
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
        .catch(() => {});
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
      style={{
        listStyle: "none",
        background: "#ffffff",
        borderRadius: "20px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.08)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Author row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 1rem 0.75rem",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "#f4f1ec",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            border: "2px solid #ffffff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              fontWeight: 700,
              color: "#5c5650",
            }}
          >
            {author.initial}
          </span>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#1c1a17",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            @{author.handle}
          </p>
          {post.region && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--text-faint)",
                margin: 0,
                marginTop: "1px",
              }}
            >
              {post.region}
            </p>
          )}
        </div>
        {onToggleFollow && post.user_id !== viewerId && (
          <motion.button
            type="button"
            onClick={() => onToggleFollow(post.user_id)}
            aria-pressed={followed}
            aria-label={
              followed ? `Unfollow @${author.handle}` : `Follow @${author.handle}'s style`
            }
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              padding: "0.35rem 0.875rem",
              background: followed ? UI_COLORS.social : "transparent",
              border: `1.5px solid ${UI_COLORS.social}`,
              borderRadius: "999px",
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: followed ? "#faf8f5" : UI_COLORS.social,
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.2s, color 0.2s",
            }}
          >
            {followed ? "Following" : "Follow"}
          </motion.button>
        )}
      </div>

      {/* Hero image */}
      {heroImage && (
        <button
          type="button"
          onDoubleClick={() => void react("like")}
          aria-label="Double-tap to react"
          style={{
            position: "relative",
            aspectRatio: "4/5",
            width: "100%",
            overflow: "hidden",
            background: "#f4f1ec",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "block",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            srcSet={mediaSrcSet(heroPath, 800)}
            alt={post.caption ?? "A styled outfit"}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transition: "transform 0.5s ease",
            }}
          />
          {post.occasion && (
            <span
              style={{
                position: "absolute",
                top: "0.75rem",
                left: "0.75rem",
                background: "rgba(255,255,255,0.90)",
                color: "#5c5650",
                fontFamily: "var(--font-body)",
                fontSize: "0.7rem",
                fontWeight: 600,
                borderRadius: "999px",
                padding: "0.2rem 0.625rem",
                backdropFilter: "blur(8px)",
              }}
            >
              {post.occasion}
            </span>
          )}
          <AnimatePresence>
            {burst > 0 && !reduceMotion && (
              <motion.span
                key={burst}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1.1, 1.3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: LUX }}
                style={{
                  pointerEvents: "none",
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-hidden
              >
                <Heart
                  size={72}
                  style={{
                    fill: "var(--secondary)",
                    color: "var(--secondary)",
                    filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))",
                  }}
                />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      )}

      {/* Reaction bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          padding: "0.875rem 1rem 0.5rem",
        }}
      >
        <motion.button
          type="button"
          aria-label={reacted ? "Reacted" : "React"}
          aria-pressed={reacted}
          onClick={() => void react("toggle")}
          disabled={pending}
          whileTap={reduceMotion ? undefined : { scale: 0.88 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            minHeight: 44,
            minWidth: 44,
          }}
        >
          <Heart
            size={18}
            aria-hidden
            style={{
              color: reacted ? "var(--secondary)" : "var(--text-faint)",
              fill: reacted ? "var(--secondary)" : "none",
              transition: "all 0.2s",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: reacted ? "#1c1a17" : "#5c5650",
            }}
          >
            {count}
          </span>
        </motion.button>

        <motion.button
          type="button"
          aria-label={saved ? "Saved to your collections" : "Save this look"}
          onClick={() => void toggleSave()}
          whileTap={reduceMotion ? undefined : { scale: 0.88 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            minHeight: 44,
            minWidth: 44,
          }}
        >
          <Bookmark
            size={18}
            aria-hidden
            style={{
              color: saved ? "var(--secondary)" : "var(--text-faint)",
              fill: saved ? "var(--secondary)" : "none",
              transition: "all 0.2s",
            }}
          />
        </motion.button>

        <motion.button
          type="button"
          aria-label="Share"
          onClick={share}
          whileTap={reduceMotion ? undefined : { scale: 0.88 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            minHeight: 44,
            minWidth: 44,
          }}
        >
          <Share2 size={18} aria-hidden style={{ color: "var(--text-faint)" }} />
        </motion.button>

        {onDressLikeMe && (
          <motion.button
            type="button"
            onClick={() => onDressLikeMe(post)}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.4rem 0.875rem",
              background: "transparent",
              border: "1.5px solid #1c1a17",
              borderRadius: "999px",
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#1c1a17",
              cursor: "pointer",
            }}
          >
            <Shirt size={13} aria-hidden />
            Dress like me
          </motion.button>
        )}
      </div>

      {/* Caption */}
      {post.caption && (
        <div style={{ padding: "0 1rem 1rem" }}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              color: "#1c1a17",
              lineHeight: 1.5,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: captionExpanded ? undefined : 2,
              WebkitBoxOrient: "vertical",
              overflow: captionExpanded ? "visible" : "hidden",
            }}
          >
            <span style={{ fontWeight: 600 }}>@{author.handle} </span>
            {post.caption}
          </p>
          {post.caption.length > 80 && (
            <button
              type="button"
              onClick={() => setCaptionExpanded((v) => !v)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                color: "var(--text-faint)",
                cursor: "pointer",
                marginTop: "0.25rem",
              }}
            >
              {captionExpanded ? "less" : "more"}
            </button>
          )}
        </div>
      )}

      {/* Item chips */}
      {post.items.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0 1rem 1rem" }}>
          {post.items.map((item) => (
            <span
              key={item.item_id}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "#5c5650",
                background: "#f4f1ec",
                borderRadius: "999px",
                padding: "0.25rem 0.75rem",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {item.title}
            </span>
          ))}
        </div>
      )}
    </motion.li>
  );
}
