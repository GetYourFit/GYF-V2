import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, RefreshControl, TextInput, View } from "react-native";

import { IconHeart } from "@/components/icons";
import { IllustrationEmptyHanger, IllustrationLooseThread } from "@/components/illustrations";
import { AtelierButton } from "@/components/ui/atelier-button";
import { AtelierCard } from "@/components/ui/atelier-card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { GyfText } from "@/components/ui/gyf-text";
import { PressableScale, hitSlopFor } from "@/components/ui/pressable-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createApi, type OutfitRecommendation, type Post } from "@/lib/api";
import {
  appendUniquePosts,
  applyReaction,
  postCoverImages,
  postInputForOutfit,
  SOCIAL_CAPTION_MAX,
  SOCIAL_PAGE_SIZE,
  toggleId,
  withoutAuthor,
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

/** A post rebuilt for the viewer's own profile — never a copy of someone else's look. */
function RecreatedLook({ result }: { result: OutfitRecommendation }) {
  const palette = useThemeColors();
  const outfit = result.outfits[0];
  if (!outfit) {
    return (
      <GyfText tone="muted" variant="bodySmall">
        GYF could not build a complete look from your profile for this one yet.
      </GyfText>
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      <GyfText variant="label">YOUR RE-CREATION</GyfText>
      <GyfText tone="muted" variant="bodySmall">
        Rebuilt for your profile and context — a new composition, not a copy or a try-on.
      </GyfText>
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {outfit.items.slice(0, 3).map((item) =>
          item.image_url && /^https:\/\//i.test(item.image_url) ? (
            <Image
              accessibilityLabel={item.title}
              key={item.item_id}
              source={{ uri: item.image_url }}
              style={{
                backgroundColor: palette.surfaceRaised,
                borderRadius: radii.control,
                flex: 1,
                height: 120,
              }}
            />
          ) : (
            <View
              accessibilityLabel={`${item.title}; image unavailable`}
              key={item.item_id}
              style={{
                alignItems: "center",
                backgroundColor: palette.surfaceRaised,
                borderRadius: radii.control,
                flex: 1,
                height: 120,
                justifyContent: "center",
                padding: spacing.xs,
              }}
            >
              <GyfText tone="faint" variant="mono">
                IMAGE UNAVAILABLE
              </GyfText>
            </View>
          ),
        )}
      </View>
      <GyfText tone="muted" variant="bodySmall">
        {outfit.explanation}
      </GyfText>
    </View>
  );
}

function PostCard({
  post,
  isSelf,
  following,
  pending,
  onReact,
  onFollow,
  onRecreate,
  recreatePending,
  onReport,
  onBlock,
}: {
  post: Post;
  isSelf: boolean;
  following: boolean;
  pending: boolean;
  onReact: () => void;
  onFollow: () => void;
  onRecreate: () => void;
  recreatePending: boolean;
  onReport: (reason: string) => void;
  onBlock: () => void;
}) {
  const palette = useThemeColors();
  const covers = postCoverImages(post.items, 3);
  // Inline two-step report (works on web too, unlike Alert): tap Report, pick a
  // reason chip; "sent" is per-card local state — the server keeps the record.
  const [reportState, setReportState] = useState<"idle" | "choose" | "sent">("idle");
  return (
    // Not a card: the look image IS the post. A boxed surface around every feed
    // item made the whole screen read as a stack of cards; the feed's hairline
    // separators divide posts instead. Matches the profile unbox (d9ceaea).
    <View style={{ gap: spacing.md }}>
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
                // Ref4 plate: sharp edges, boxy tone, whole look visible.
                borderRadius: 0,
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

      {isSelf ? null : (
        <AtelierButton
          accessibilityLabel="Recreate this look for my profile"
          disabled={recreatePending}
          label={recreatePending ? "Recreating…" : "Recreate for me"}
          onPress={onRecreate}
        />
      )}

      {isSelf ? null : reportState === "sent" ? (
        <GyfText accessibilityRole="alert" tone="muted" variant="bodySmall">
          Reported. GYF moderation will review this post.
        </GyfText>
      ) : reportState === "choose" ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: spacing.sm }}>
          <GyfText tone="muted" variant="bodySmall">
            Why?
          </GyfText>
          {["Spam", "Not appropriate"].map((reason) => (
            <PressableScale
              accessibilityLabel={`Report as ${reason}`}
              accessibilityRole="button"
              hitSlop={hitSlopFor(32)}
              key={reason}
              onPress={() => {
                onReport(reason);
                setReportState("sent");
              }}
            >
              <GyfText style={{ color: palette.error }} variant="bodySmall">
                {reason}
              </GyfText>
            </PressableScale>
          ))}
          <PressableScale
            accessibilityLabel="Cancel report"
            accessibilityRole="button"
            hitSlop={hitSlopFor(32)}
            onPress={() => setReportState("idle")}
          >
            <GyfText tone="muted" variant="bodySmall">
              Cancel
            </GyfText>
          </PressableScale>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: spacing.lg }}>
          <PressableScale
            accessibilityLabel="Report this post"
            accessibilityRole="button"
            hitSlop={hitSlopFor(32)}
            onPress={() => setReportState("choose")}
          >
            <GyfText tone="faint" variant="bodySmall">
              Report
            </GyfText>
          </PressableScale>
          <PressableScale
            accessibilityLabel="Block this stylist — their posts disappear from your feeds"
            accessibilityRole="button"
            hitSlop={hitSlopFor(32)}
            onPress={onBlock}
          >
            <GyfText tone="faint" variant="bodySmall">
              Block stylist
            </GyfText>
          </PressableScale>
        </View>
      )}
    </View>
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerLoading, setComposerLoading] = useState(false);
  const [composerError, setComposerError] = useState<unknown>(null);
  const [composerLook, setComposerLook] = useState<OutfitRecommendation | null>(null);
  const [caption, setCaption] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [recreating, setRecreating] = useState<string | null>(null);
  const [recreated, setRecreated] = useState<Record<string, OutfitRecommendation>>({});
  const [recreateErrors, setRecreateErrors] = useState<Record<string, string>>({});
  const composerRequestId = useRef(0);

  const closeComposer = useCallback(() => {
    ++composerRequestId.current;
    setComposerOpen(false);
    setComposerLoading(false);
    setPublishing(false);
  }, []);

  const openComposer = useCallback(async () => {
    const ticket = ++composerRequestId.current;
    setComposerOpen(true);
    setComposerLoading(true);
    setPublishing(false);
    setComposerError(null);
    setComposerLook(null);
    setCaption("");
    try {
      const look = await api.recommend({ k: 1 });
      if (ticket === composerRequestId.current) setComposerLook(look);
    } catch (error) {
      if (ticket === composerRequestId.current) setComposerError(error);
    } finally {
      if (ticket === composerRequestId.current) setComposerLoading(false);
    }
  }, [api]);

  const publish = useCallback(async () => {
    // Only ids the server just returned can be published — a look cannot be hand-assembled.
    const input = postInputForOutfit(
      composerLook?.outfits[0],
      composerLook?.recommendation_id ?? "",
      composerLook?.occasion,
      caption,
    );
    if (!input) {
      setComposerError(new Error("No complete look is available to share yet."));
      return;
    }
    const ticket = composerRequestId.current;
    setPublishing(true);
    setComposerError(null);
    try {
      const post = await api.createPost(input);
      // Prepended unconditionally: the post exists server-side now, so showing it is the
      // honest thing even if the composer was closed mid-publish.
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
      if (ticket === composerRequestId.current) {
        closeComposer();
        setComposerLook(null);
        setCaption("");
      }
    } catch (error) {
      if (ticket === composerRequestId.current) setComposerError(error);
    } finally {
      if (ticket === composerRequestId.current) setPublishing(false);
    }
  }, [api, caption, closeComposer, composerLook]);

  const recreate = useCallback(
    async (postId: string) => {
      if (recreating) return;
      setRecreating(postId);
      setRecreateErrors((current) => ({ ...current, [postId]: "" }));
      setRecreated((current) => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
      try {
        const result = await api.recreatePost(postId);
        setRecreated((current) => ({ ...current, [postId]: result }));
      } catch {
        setRecreateErrors((current) => ({
          ...current,
          [postId]: "GYF could not recreate this look for your profile. Try again shortly.",
        }));
      } finally {
        setRecreating(null);
      }
    },
    [api, recreating],
  );

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

  const report = useCallback(
    (postId: string, reason: string) => {
      // ponytail: fire-and-forget — the card's "sent" copy is optimistic; add
      // retry surfacing if moderation reports ever need delivery guarantees.
      void api.reportPost(postId, reason).catch(() => undefined);
    },
    [api],
  );

  const block = useCallback(
    async (userId: string) => {
      let snapshot: Post[] = [];
      setPosts((current) => {
        snapshot = current;
        return withoutAuthor(current, userId);
      });
      try {
        await api.blockUser(userId);
      } catch {
        // revert on failure — the feed must never lie about what's hidden
        setPosts(snapshot);
      }
    },
    [api],
  );

  return (
    <FlatList
      accessibilityLabel="Community feed"
      // Hairline rule between posts now that they are unboxed — the divider the
      // card outline used to imply, at a fraction of the visual weight.
      ItemSeparatorComponent={() => (
        <View
          style={{ backgroundColor: palette.border, height: 1, marginVertical: spacing.lg }}
        />
      )}
      contentContainerStyle={{
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
        <View style={{ gap: spacing.sm }}>
          <PostCard
            following={follows.has(item.user_id)}
            isSelf={item.user_id === viewerId}
            onBlock={() => void block(item.user_id)}
            onFollow={() => void toggleFollow(item.user_id)}
            onReact={() => void react(item)}
            onReport={(reason) => report(item.id, reason)}
            onRecreate={() => void recreate(item.id)}
            pending={pending === item.user_id}
            post={item}
            recreatePending={recreating === item.id}
          />
          {recreated[item.id] ? (
            <AtelierCard>
              <RecreatedLook result={recreated[item.id]} />
            </AtelierCard>
          ) : null}
          {recreateErrors[item.id] ? (
            <GyfText accessibilityRole="alert" style={{ color: palette.error }} variant="bodySmall">
              {recreateErrors[item.id]}
            </GyfText>
          ) : null}
        </View>
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
          {composerOpen ? (
            <AtelierCard style={{ gap: spacing.md }}>
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <GyfText variant="title">Share a real look</GyfText>
                <PressableScale
                  accessibilityLabel="Close share composer"
                  accessibilityRole="button"
                  hitSlop={hitSlopFor(32)}
                  onPress={closeComposer}
                >
                  <GyfText tone="muted" variant="mono">
                    CLOSE
                  </GyfText>
                </PressableScale>
              </View>
              {composerLoading ? (
                <Skeleton height={120} />
              ) : composerError ? (
                <GyfText accessibilityRole="alert" style={{ color: palette.error }}>
                  {readableError(composerError)}
                </GyfText>
              ) : composerLook ? (
                <>
                  <RecreatedLook result={composerLook} />
                  <TextInput
                    accessibilityLabel="Caption for your look"
                    maxLength={SOCIAL_CAPTION_MAX}
                    multiline
                    onChangeText={setCaption}
                    placeholder="Say something about this look (optional)"
                    placeholderTextColor={palette.textFaint}
                    style={{
                      backgroundColor: palette.surfaceRaised,
                      borderRadius: radii.control,
                      color: palette.text,
                      minHeight: 64,
                      padding: spacing.sm,
                    }}
                    value={caption}
                  />
                  <AtelierButton
                    disabled={publishing}
                    label={publishing ? "Sharing…" : "Share this look"}
                    onPress={() => void publish()}
                  />
                </>
              ) : null}
            </AtelierCard>
          ) : (
            <AtelierButton label="Share a look" onPress={() => void openComposer()} />
          )}
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
