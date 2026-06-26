"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useState } from "react";

import { CreatePostSheet } from "./create-post-sheet";
import { PostCard, type SocialPost } from "./post-card";

const MOCK_POSTS: SocialPost[] = [
  {
    id: "1",
    author: { name: "Aria Khan", handle: "ariakhan", avatarInitial: "A" },
    caption: "Perfect casual Friday look — linen over fitted trousers.",
    outfit: {
      items: ["Cream linen shirt", "Slim charcoal trousers", "White leather loafers"],
      occasion: "Casual",
    },
    likes: 84,
    comments: 12,
    createdAt: "2026-06-24T10:00:00Z",
  },
  {
    id: "2",
    author: { name: "Marco D.", handle: "marcod", avatarInitial: "M" },
    caption: "Wedding guest done right — no florals, just structure.",
    outfit: {
      items: ["Navy double-breasted blazer", "Ivory trousers", "Brown oxford shoes"],
      occasion: "Wedding",
    },
    likes: 211,
    comments: 37,
    createdAt: "2026-06-23T18:30:00Z",
  },
  {
    id: "3",
    author: { name: "Priya S.", handle: "priyastyle", avatarInitial: "P" },
    caption: "GYF picked this for my Diwali look and I'm obsessed ✨",
    outfit: { items: ["Silk kurta", "Palazzo pants", "Juttis"], occasion: "Festive" },
    likes: 563,
    comments: 88,
    createdAt: "2026-06-22T14:00:00Z",
  },
  {
    id: "4",
    author: { name: "James O.", handle: "jamesofit", avatarInitial: "J" },
    caption: "Streetwear minimal — less is more.",
    outfit: {
      items: ["Black oversized tee", "Carpenter pants", "Air Force 1"],
      occasion: "Casual",
    },
    likes: 147,
    comments: 23,
    createdAt: "2026-06-21T09:15:00Z",
  },
];

export function SocialFeed() {
  const [posts, setPosts] = useState<SocialPost[]>(MOCK_POSTS);
  const [sheetOpen, setSheetOpen] = useState(false);

  function handlePost(post: SocialPost) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <>
      {/* Feed */}
      <div className="flex flex-col divide-y divide-[var(--border)]">
        <AnimatePresence mode="popLayout">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </AnimatePresence>
      </div>

      {/* FAB — create post */}
      <motion.button
        type="button"
        aria-label="Create post"
        onClick={() => setSheetOpen(true)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] right-4 z-30 flex h-14 w-14 items-center justify-center bg-[var(--accent)] text-[var(--bg)] shadow-[0_4px_24px_rgba(0,0,0,0.6)] active:scale-95 transition-transform"
        whileTap={{ scale: 0.92 }}
      >
        <Plus size={24} />
      </motion.button>

      <CreatePostSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onPost={handlePost} />
    </>
  );
}
