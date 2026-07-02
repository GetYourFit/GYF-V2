"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart, Share2, Bookmark, Shirt } from "lucide-react";
import { useState } from "react";
import type { Post } from "@gyf/types";

const LUX = [0.16, 1, 0.3, 1] as const;

interface PostCardProps {
  post: Post;
  index?: number;
  onReact?: (postId: string) => Promise<boolean>;
  onShared?: (text: string) => void;
  onDressLikeMe?: (post: Post) => void;
}

function authorOf(userId: string): { handle: string; initial: string } {
  const handle = userId.replace(/-/g, "").slice(0, 8);
  return { handle, initial: (handle[0] ?? "?").toUpperCase() };
}

export function PostCard({ post, index = 0, onReact, onShared, onDressLikeMe }: PostCardProps) {
  const reduceMotion = useReducedMotion();
  const author = authorOf(post.user_id);
  const [reacted, setReacted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [count, setCount] = useState(post.reaction_count);
  const [pending, setPending] = useState(false);
  const [burst, setBurst] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const heroImage = post.items.find((i) => i.image_url)?.image_url ?? null;

  async function react() {
    if (pending || reacted) return;
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
                color: "#9a9490",
                margin: 0,
                marginTop: "1px",
              }}
            >
              {post.region}
            </p>
          )}
        </div>
        <motion.button
          type="button"
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            padding: "0.35rem 0.875rem",
            background: "transparent",
            border: "1.5px solid #1c1a17",
            borderRadius: "999px",
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#1c1a17",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Follow
        </motion.button>
      </div>

      {/* Hero image */}
      {heroImage && (
        <button
          type="button"
          onDoubleClick={react}
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
                    fill: "#d4607a",
                    color: "#d4607a",
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
          onClick={react}
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
              color: reacted ? "#d4607a" : "#9a9490",
              fill: reacted ? "#d4607a" : "none",
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
          aria-label="Save"
          onClick={() => setSaved((v) => !v)}
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
              color: saved ? "#d4607a" : "#9a9490",
              fill: saved ? "#d4607a" : "none",
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
          <Share2 size={18} aria-hidden style={{ color: "#9a9490" }} />
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
                color: "#9a9490",
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
