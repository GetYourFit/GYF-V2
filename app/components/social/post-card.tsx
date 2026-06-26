"use client";

import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, Shirt } from "lucide-react";
import { useState } from "react";

export interface SocialPost {
  id: string;
  author: { name: string; handle: string; avatarInitial: string };
  caption: string;
  imageUrl?: string;
  outfit?: { items: string[]; occasion?: string };
  likes: number;
  comments: number;
  createdAt: string;
}

interface PostCardProps {
  post: SocialPost;
  onDressLikeMe?: (post: SocialPost) => void;
}

export function PostCard({ post, onDressLikeMe }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);

  function toggleLike() {
    setLiked((v) => !v);
    setLikeCount((n) => (liked ? n - 1 : n + 1));
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: `${post.author.name}'s outfit on GYF`, text: post.caption });
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col border-b border-[var(--border)] bg-[var(--bg)]"
    >
      {/* Author row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--surface-2)] border border-[var(--border-mid)]">
          <span className="t-label text-[var(--text)]">{post.author.avatarInitial}</span>
        </div>
        <div className="min-w-0">
          <p className="t-label text-[var(--text)] truncate">{post.author.name}</p>
          <p className="t-mono text-[10px] text-[var(--text-faint)]">@{post.author.handle}</p>
        </div>
        {post.outfit?.occasion && (
          <span className="ml-auto t-mono text-[9px] border border-[var(--border-mid)] px-2 py-0.5 text-[var(--text-faint)] shrink-0">
            {post.outfit.occasion}
          </span>
        )}
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="aspect-square w-full overflow-hidden bg-[var(--surface-2)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl}
            alt={`Outfit by ${post.author.name}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Caption */}
      <div className="px-4 pt-3">
        <p className="t-body text-[var(--text)]">
          <span className="t-label mr-1">{post.author.handle}</span>
          {post.caption}
        </p>
        {post.outfit?.items && post.outfit.items.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.outfit.items.map((item, i) => (
              <span
                key={i}
                className="t-mono text-[9px] border border-[var(--border)] px-2 py-0.5 text-[var(--text-faint)]"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-3">
        <button
          type="button"
          aria-label={liked ? "Unlike" : "Like"}
          onClick={toggleLike}
          className="flex items-center gap-1.5 px-2 py-2 transition-colors active:opacity-60"
        >
          <Heart
            size={20}
            className={
              liked ? "fill-[var(--error)] text-[var(--error)]" : "text-[var(--text-faint)]"
            }
          />
          <span className="t-mono text-[11px] text-[var(--text-faint)]">{likeCount}</span>
        </button>

        <button
          type="button"
          aria-label="Comments"
          className="flex items-center gap-1.5 px-2 py-2 text-[var(--text-faint)] transition-colors active:opacity-60"
        >
          <MessageCircle size={20} />
          <span className="t-mono text-[11px]">{post.comments}</span>
        </button>

        <button
          type="button"
          aria-label="Share"
          onClick={share}
          className="flex items-center gap-1.5 px-2 py-2 text-[var(--text-faint)] transition-colors active:opacity-60"
        >
          <Share2 size={20} />
        </button>

        {onDressLikeMe && (
          <button
            type="button"
            onClick={() => onDressLikeMe(post)}
            className="ml-auto flex items-center gap-1.5 border border-[var(--border-mid)] px-3 py-1.5 t-label text-[10px] text-[var(--text)] transition-colors active:bg-[var(--surface)]"
          >
            <Shirt size={13} />
            Dress like me
          </button>
        )}
      </div>

      <p className="px-4 pb-4 t-mono text-[9px] text-[var(--text-faint)]">
        {new Date(post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </p>
    </motion.article>
  );
}
