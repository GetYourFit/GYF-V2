"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { browserApi } from "@/lib/api-client";
import type { Post } from "@gyf/types";

import { CreatePostSheet } from "./create-post-sheet";
import { PostCard } from "./post-card";

const LUX = [0.16, 1, 0.3, 1] as const;

/** Editorial line-art shown when the feed is empty — a framed look on a rail,
 *  drawn in hairline strokes to match the gallery design language. */
function EmptyArt() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
      className="text-border-hi"
    >
      <rect x="14" y="10" width="68" height="76" />
      <path d="M48 10v8" />
      <path d="M34 30c0-7 6-12 14-12s14 5 14 12" />
      <path d="M48 30 32 46v28h32V46L48 30Z" />
      <path d="M48 30v44" strokeDasharray="2 4" />
    </svg>
  );
}

export function SocialFeed() {
  const reduceMotion = useReducedMotion();
  const { toast } = useToast();
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
        e instanceof ApiError ? e.message : "Could not load the feed. Tap retry.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const react = useCallback(
    async (postId: string): Promise<boolean> => {
      try {
        const res = await browserApi().reactToPost(postId);
        return res.reacted;
      } catch (e) {
        toast({
          variant: "error",
          title: "Reaction failed",
          description:
            e instanceof ApiError ? e.message : "Please try again in a moment.",
        });
        throw e;
      }
    },
    [toast],
  );

  const handleShared = useCallback(
    (text: string) => {
      toast({ variant: "success", title: "Shared", description: text });
    },
    [toast],
  );

  const handleCreated = useCallback(
    (post: Post) => {
      setPosts((prev) => [post, ...prev]);
      toast({
        variant: "success",
        title: "Look shared",
        description: "Your look is now live in the community feed.",
      });
    },
    [toast],
  );

  return (
    <>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        {loading && (
          <div className="flex flex-col gap-6" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col border border-border bg-surface"
              >
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="skeleton h-9 w-9" />
                  <div className="flex flex-col gap-2">
                    <div className="skeleton h-3 w-24" />
                    <div className="skeleton h-2 w-14" />
                  </div>
                </div>
                <div className="skeleton aspect-square w-full" />
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="skeleton h-3 w-10" />
                  <div className="skeleton h-3 w-10" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 px-6 py-24 text-center">
            <p className="t-body text-text-mid">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="border border-border-mid px-5 py-2.5 t-label text-text transition-colors hover:border-border-hi hover:bg-surface-2"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: LUX }}
            className="flex flex-col items-center gap-5 px-6 py-24 text-center"
          >
            <EmptyArt />
            <div className="flex flex-col gap-2">
              <p className="t-headline text-text">No looks yet</p>
              <p className="t-body mx-auto max-w-xs text-text-mid">
                Be the first to share a styled look — every post is re-rendered for
                whoever views it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-1 border border-border-mid px-5 py-2.5 t-label text-text transition-colors hover:border-border-hi hover:bg-surface-2"
            >
              Share a look
            </button>
          </motion.div>
        )}

        {!loading && !error && posts.length > 0 && (
          <ul className="flex list-none flex-col gap-6">
            <AnimatePresence mode="popLayout" initial={false}>
              {posts.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  index={i}
                  onReact={react}
                  onShared={handleShared}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* FAB — create post. Offset clears the bottom nav + iOS safe area. */}
      <motion.button
        type="button"
        aria-label="Share a look"
        onClick={() => setSheetOpen(true)}
        initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.25, ease: LUX }}
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] right-4 z-30 flex h-14 w-14 items-center justify-center bg-accent text-bg shadow-lg transition-transform sm:bottom-8 sm:right-8"
      >
        <Plus size={24} aria-hidden />
      </motion.button>

      <CreatePostSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
