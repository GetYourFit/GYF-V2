"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const [scope, setScope] = useState<"all" | "following">("all");
  const [follows, setFollows] = useState<ReadonlySet<string>>(new Set());
  const [viewerId, setViewerId] = useState<string | null>(null);

  // A slower earlier request must never clobber a newer one (e.g. rapid
  // Following → For you toggles); only the latest call may commit state.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      // The feed is the page; the follow list + viewer id only decorate the
      // follow buttons. Best-effort them so their failure never blanks the feed.
      const api = browserApi();
      const [feed, following, me] = await Promise.all([
        api.socialFeed({ limit: 30, scope }),
        api.listFollows().catch(() => [] as string[]),
        api.me().catch(() => null),
      ]);
      if (seq !== loadSeq.current) return;
      setPosts(feed);
      setFollows(new Set(following));
      setViewerId(me?.user_id ?? null);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(e instanceof ApiError ? e.message : "Could not load the feed. Tap retry.");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const toggleFollow = useCallback(
    async (userId: string) => {
      const wasFollowing = follows.has(userId);
      // Optimistic flip; revert on failure so the UI never lies about state.
      setFollows((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.delete(userId);
        else next.add(userId);
        return next;
      });
      try {
        if (wasFollowing) await browserApi().unfollowUser(userId);
        else await browserApi().followUser(userId);
      } catch (e) {
        setFollows((prev) => {
          const next = new Set(prev);
          if (wasFollowing) next.add(userId);
          else next.delete(userId);
          return next;
        });
        toast({
          variant: "error",
          title: wasFollowing ? "Unfollow failed" : "Follow failed",
          description: e instanceof ApiError ? e.message : "Please try again in a moment.",
        });
      }
    },
    [follows, toast],
  );

  const react = useCallback(
    async (postId: string): Promise<boolean> => {
      try {
        const res = await browserApi().reactToPost(postId);
        return res.reacted;
      } catch (e) {
        toast({
          variant: "error",
          title: "Reaction failed",
          description: e instanceof ApiError ? e.message : "Please try again in a moment.",
        });
        throw e;
      }
    },
    [toast],
  );

  const unreact = useCallback(
    async (postId: string): Promise<void> => {
      try {
        await browserApi().unreactToPost(postId);
      } catch (e) {
        toast({
          variant: "error",
          title: "Couldn't remove the reaction",
          description: e instanceof ApiError ? e.message : "Please try again in a moment.",
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
      <div style={{ maxWidth: "430px", margin: "0 auto", padding: "1.25rem 1rem" }}>
        {/* Header — one row: scope tabs (Ref3 "For You / Following") on the
            left, a single icon-only create action on the right. No separate
            page title, no second CTA — Ref3 never doubles up a control. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.5rem",
          }}
        >
          <div role="group" aria-label="Feed scope" style={{ display: "flex", gap: "1.5rem" }}>
            {(
              [
                { key: "all", label: "For you" },
                { key: "following", label: "Following" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={scope === key}
                onClick={() => setScope(key)}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: scope === key ? "var(--text)" : "var(--text-faint)",
                  fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <motion.button
            type="button"
            aria-label="Share a look"
            onClick={() => setSheetOpen(true)}
            whileTap={reduceMotion ? undefined : { scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "50%",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            <Plus size={18} aria-hidden />
          </motion.button>
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface-2)",
                  borderRadius: "20px",
                  border: "1px solid var(--rule)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.875rem 1rem",
                  }}
                >
                  <div
                    className="skeleton"
                    style={{ width: 40, height: 40, borderRadius: "50%" }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div className="skeleton" style={{ height: 12, width: 96 }} />
                    <div className="skeleton" style={{ height: 10, width: 56 }} />
                  </div>
                </div>
                <div className="skeleton" style={{ aspectRatio: "4/5", width: "100%" }} />
                <div style={{ display: "flex", gap: "0.75rem", padding: "0.875rem 1rem" }}>
                  <div className="skeleton" style={{ height: 12, width: 40 }} />
                  <div className="skeleton" style={{ height: 12, width: 40 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1rem",
              padding: "6rem 1.5rem",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.9375rem",
                color: "var(--text-mid)",
              }}
            >
              {error}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              style={{
                padding: "0.75rem 1.75rem",
                background: "var(--text)",
                color: "var(--bg)",
                borderRadius: "999px",
                border: "none",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
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
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.25rem",
              padding: "6rem 1.5rem",
              textAlign: "center",
            }}
          >
            <EmptyArt />
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  margin: 0,
                }}
              >
                {scope === "following" ? "Nothing here yet" : "No looks yet"}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  color: "var(--text-mid)",
                  maxWidth: "280px",
                  margin: 0,
                }}
              >
                {scope === "following"
                  ? "Follow a stylist from the For-you feed and their looks will land here — always re-rendered for you."
                  : "Be the first to share a styled look — every post is re-rendered for whoever views it."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              style={{
                padding: "0.75rem 1.75rem",
                background: "var(--accent)",
                color: "var(--on-accent)",
                borderRadius: "999px",
                border: "none",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Share a look
            </button>
          </motion.div>
        )}

        {!loading && !error && posts.length > 0 && (
          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {posts.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  index={i}
                  viewerId={viewerId}
                  followed={follows.has(post.user_id)}
                  onReact={react}
                  onUnreact={unreact}
                  onShared={handleShared}
                  onToggleFollow={(userId) => void toggleFollow(userId)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <CreatePostSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
