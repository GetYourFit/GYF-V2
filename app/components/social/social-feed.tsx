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
  const [scope, setScope] = useState<"all" | "following">("all");
  const [follows, setFollows] = useState<ReadonlySet<string>>(new Set());
  const [viewerId, setViewerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Feed + follow list together: the follow list marks each author's button
      // state, so rendering either without the other flashes wrong UI.
      const api = browserApi();
      const [feed, following, me] = await Promise.all([
        api.socialFeed({ limit: 30, scope }),
        api.listFollows(),
        api.me(),
      ]);
      setPosts(feed);
      setFollows(new Set(following));
      setViewerId(me.user_id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the feed. Tap retry.");
    } finally {
      setLoading(false);
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
      <div style={{ maxWidth: "390px", margin: "0 auto", padding: "1.25rem 1rem" }}>
        {/* Feed header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "#1c1a17",
              margin: 0,
            }}
          >
            Community
          </h1>
          <motion.button
            type="button"
            onClick={() => setSheetOpen(true)}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              padding: "0.5rem 1.125rem",
              background: "#d4607a",
              color: "#ffffff",
              borderRadius: "999px",
              border: "none",
              fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Share a look
          </motion.button>
        </div>

        {/* Scope toggle — global feed vs. authors the user follows */}
        <div
          role="group"
          aria-label="Feed scope"
          style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}
        >
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
                padding: "0.4rem 1rem",
                borderRadius: "999px",
                border: `1px solid ${scope === key ? "#1c1a17" : "rgba(0,0,0,0.12)"}`,
                background: scope === key ? "#1c1a17" : "transparent",
                color: scope === key ? "#faf8f5" : "#5c5650",
                fontFamily: "var(--font-body, 'Plus Jakarta Sans', sans-serif)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: "#ffffff",
                  borderRadius: "20px",
                  border: "1px solid rgba(0,0,0,0.08)",
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
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "#5c5650" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              style={{
                padding: "0.75rem 1.75rem",
                background: "#1c1a17",
                color: "#faf8f5",
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
                  color: "#1c1a17",
                  margin: 0,
                }}
              >
                {scope === "following" ? "Nothing here yet" : "No looks yet"}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  color: "#5c5650",
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
                background: "#d4607a",
                color: "#ffffff",
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
                  onShared={handleShared}
                  onToggleFollow={(userId) => void toggleFollow(userId)}
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
        initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={
          reduceMotion
            ? { duration: 0.2 }
            : { type: "spring", stiffness: 380, damping: 26, delay: 0.35 }
        }
        whileTap={reduceMotion ? undefined : { scale: 0.88 }}
        style={{
          position: "fixed",
          bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
          right: "1.25rem",
          zIndex: 30,
          display: "flex",
          width: 52,
          height: 52,
          alignItems: "center",
          justifyContent: "center",
          background: "#d4607a",
          color: "#ffffff",
          borderRadius: "999px",
          border: "none",
          boxShadow: "0 4px 20px rgba(212,96,122,0.40)",
          cursor: "pointer",
        }}
      >
        <Plus size={22} aria-hidden />
      </motion.button>

      <CreatePostSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
