import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, RefreshControl, View } from "react-native";

import { IconHeart } from "@/components/icons";
import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import { AtelierCard } from "@/components/ui/atelier-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createApi, type Post } from "@/lib/api";
import {
  appendUniquePosts,
  applyReaction,
  postCoverImages,
  SOCIAL_PAGE_SIZE,
  toggleId,
  type FeedScope,
} from "@/lib/social-feed";
import { colors, radii, spacing } from "@/theme/tokens";
import { useThemeColors } from "@/theme/use-color-scheme";
import { useResponsive } from "@/theme/use-responsive";

type Status = "loading" | "ready" | "error";

function readableError(error: unknown): string {
  if (error instanceof ApiError && error.isUnauthorized) {
    return "Your session expired. Sign in again to see the community feed.";
  }
  if (error instanceof ApiError && error.isUnavailable) {
    return "The feed is temporarily unavailable. Try again shortly.";
  }
  return "GYF could not load the feed. Check your connection and try again.";
}

function PostCard({
  post,
  isSelf,
  following,
  pending,
  onReact,
  onFollow,
}: {
  post: Post;
  isSelf: boolean;
  following: boolean;
  pending: boolean;
  onReact: () => void;
  onFollow: () => void;
}) {
  const palette = useThemeColors();
  const covers = postCoverImages(post.items, 3);
  return (
    <AtelierCard style={{ gap: spacing.md }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <GyfText tone="muted" variant="label">
          {post.occasion ? post.occasion.toUpperCase() : "A LOOK"}
        </GyfText>
        {isSelf ? (
          <GyfText tone="faint" variant="mono">
            YOU
          </GyfText>
        ) : (
          <PressableScale
            accessibilityLabel={following ? "Unfollow this stylist" : "Follow this stylist"}
            accessibilityRole="button"
            accessibilityState={{ selected: following, disabled: pending }}
            disabled={pending}
            hitSlop={hitSlopFor(28)}
            onPress={onFollow}
          >
            <GyfText style={{ color: following ? palette.textMuted : palette.text }}>
              {following ? "Following" : "Follow"}
            </GyfText>
          </PressableScale>
        )}
      </View>

      {covers.length > 0 ? (
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {covers.map((uri, index) => (
            <Image
              accessibilityLabel={`Look piece ${index + 1}`}
              key={uri}
              source={{ uri }}
              style={{
                backgroundColor: palette.surfaceRaised,
                borderRadius: radii.control,
                flex: 1,
                height: 200,
              }}
            />
          ))}
        </View>
      ) : (
        <View
          accessibilityLabel="Look preview unavailable"
          style={{
            alignItems: "center",
            backgroundColor: palette.surfaceRaised,
            borderRadius: radii.control,
            height: 160,
            justifyContent: "center",
          }}
        >
          <GyfText tone="faint" variant="mono">
            IMAGE UNAVAILABLE
          </GyfText>
        </View>
      )}

      {post.caption ? <GyfText variant="body">{post.caption}</GyfText> : null}

      <PressableScale
        accessibilityLabel={
          post.reacted
            ? `Remove your like; ${post.reaction_count} likes`
            : `Like this look; ${post.reaction_count} likes`
        }
        accessibilityRole="button"
        accessibilityState={{ selected: post.reacted }}
        hitSlop={hitSlopFor(32)}
        onPress={onReact}
        style={{
          alignItems: "center",
          alignSelf: "flex-start",
          flexDirection: "row",
          gap: spacing.xs,
          minHeight: 32,
        }}
      >
        <IconHeart
          color={post.reacted ? palette.error : palette.textMuted}
          filled={post.reacted}
          size={18}
        />
        <GyfText style={{ color: post.reacted ? palette.text : palette.textMuted }} variant="mono">
          {post.reaction_count}
        </GyfText>
      </PressableScale>
    </AtelierCard>
  );
}

export default function SocialRoute() {
  const palette = useThemeColors();
  const { insets } = useResponsive();
  const api = useMemo(() => createApi(), []);
  const [scope, setScope] = useState<FeedScope>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [follows, setFollows] = useState<ReadonlySet<string>>(new Set());
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<unknown>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (nextPage: number, replace: boolean) => {
      const ticket = ++requestId.current;
      if (nextPage > 0) setLoadingMore(true);
      else if (!replace) setStatus("loading");
      try {
        // Feed is the page; follows + viewer id only decorate buttons — best-effort them.
        const [feed, following, me] = await Promise.all([
          api.socialFeed({ limit: SOCIAL_PAGE_SIZE, offset: nextPage * SOCIAL_PAGE_SIZE, scope }),
          nextPage === 0 ? api.listFollows().catch(() => null) : Promise.resolve(null),
          nextPage === 0 ? api.me().catch(() => null) : Promise.resolve(null),
        ]);
        if (ticket !== requestId.current) return; // a newer scope switch won
        setPosts((current) =>
          replace || nextPage === 0 ? feed : appendUniquePosts(current, feed),
        );
        setPage(nextPage);
        setHasMore(feed.length >= SOCIAL_PAGE_SIZE);
        if (following) setFollows(new Set(following));
        if (me) setViewerId(me.user_id);
        setFeedError(null);
        setStatus("ready");
      } catch (error) {
        if (ticket === requestId.current) {
          setFeedError(error);
          setStatus("error");
        }
      } finally {
        if (ticket === requestId.current) setLoadingMore(false);
      }
    },
    [api, scope],
  );

  useEffect(() => {
    void load(0, true);
  }, [load]);

  const react = useCallback(
    async (post: Post) => {
      const next = !post.reacted;
      setPosts((current) => current.map((p) => (p.id === post.id ? applyReaction(p, next) : p)));
      try {
        if (next) await api.reactToPost(post.id);
        else await api.unreactToPost(post.id);
      } catch {
        // revert on failure — the count must never lie
        setPosts((current) =>
          current.map((p) => (p.id === post.id ? applyReaction(p, post.reacted) : p)),
        );
      }
    },
    [api],
  );

  const toggleFollow = useCallback(
    async (userId: string) => {
      if (pending) return;
      const wasFollowing = follows.has(userId);
      setPending(userId);
      setFollows((current) => toggleId(current, userId, !wasFollowing));
      try {
        if (wasFollowing) await api.unfollowUser(userId);
        else await api.followUser(userId);
      } catch {
        setFollows((current) => toggleId(current, userId, wasFollowing));
      } finally {
        setPending(null);
      }
    },
    [api, follows, pending],
  );

  return (
    <FlatList
      accessibilityLabel="Community feed"
      contentContainerStyle={{
        gap: spacing.md,
        padding: spacing.lg,
        paddingBottom: spacing.xxl * 2 + insets.bottom,
        paddingTop: spacing.lg + insets.top,
      }}
      data={posts}
      keyExtractor={(post) => post.id}
      onEndReached={() => {
        if (hasMore && status === "ready" && !loadingMore) void load(page + 1, false);
      }}
      onEndReachedThreshold={0.7}
      refreshControl={
        <RefreshControl
          onRefresh={async () => {
            setRefreshing(true);
            await load(0, true);
            setRefreshing(false);
          }}
          refreshing={refreshing}
          tintColor={palette.text}
        />
      }
      renderItem={({ item }) => (
        <PostCard
          following={follows.has(item.user_id)}
          isSelf={item.user_id === viewerId}
          onFollow={() => void toggleFollow(item.user_id)}
          onReact={() => void react(item)}
          pending={pending === item.user_id}
          post={item}
        />
      )}
      ListHeaderComponent={
        <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ gap: spacing.sm }}>
            <GyfText accessibilityRole="header" variant="display">
              Social
            </GyfText>
            <GyfText tone="muted" variant="body">
              Real looks from the GYF community — like them, follow the stylists you love.
            </GyfText>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <FilterChip
              label="For you"
              onPress={() => setScope("all")}
              selected={scope === "all"}
            />
            <FilterChip
              label="Following"
              onPress={() => setScope("following")}
              selected={scope === "following"}
            />
          </View>
          {loadingMore ? <Skeleton height={120} /> : null}
        </View>
      }
      ListEmptyComponent={
        status === "loading" ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={280} />
            <Skeleton height={280} />
          </View>
        ) : status === "error" ? (
          <ErrorState
            illustration={<IllustrationLooseThread color={palette.textMuted} />}
            message={readableError(feedError)}
            onRetry={() => void load(0, true)}
          />
        ) : (
          <EmptyState
            description={
              scope === "following"
                ? "Follow a stylist and their looks appear here."
                : "Be the first to share a look from the Stylist."
            }
            headline={scope === "following" ? "Nothing here yet" : "No looks yet"}
            illustration={<IllustrationEmptyHanger color={palette.textMuted} />}
          />
        )
      }
    />
  );
}
