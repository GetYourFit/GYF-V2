"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Post } from "@gyf/types";

import { CreatePostSheet } from "./create-post-sheet";
import { PostCard } from "./post-card";

export function SocialFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await browserApi().socialFeed({ limit: 30 });
      setPosts(res);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not load the feed. Pull to retry.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const react = useCallback(async (postId: string): Promise<boolean> => {
    const res = await browserApi().reactToPost(postId);
    return res.reacted;
  }, []);

  function handleCreated(post: Post) {
    setPosts((prev) => [post, ...prev]);
  }

  return (
    <>
      {loading && (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="skeleton h-9 w-9" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="skeleton aspect-square w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
          <p className="t-body text-[var(--text-mid)]">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="border border-[var(--border-mid)] px-4 py-2 t-label text-[var(--text)] active:bg-[var(--surface)]"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
          <p className="t-headline text-[var(--text)]">No looks yet</p>
          <p className="t-body text-[var(--text-mid)]">
            Be the first to share a styled look with the community.
          </p>
        </div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onReact={react} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* FAB — create post */}
      <motion.button
        type="button"
        aria-label="Share a look"
        onClick={() => setSheetOpen(true)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] right-4 z-30 flex h-14 w-14 items-center justify-center bg-[var(--accent)] text-[var(--surface)] shadow-[0_4px_24px_rgba(0,0,0,0.18)] active:scale-95 transition-transform"
        whileTap={{ scale: 0.92 }}
      >
        <Plus size={24} />
      </motion.button>

      <CreatePostSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
