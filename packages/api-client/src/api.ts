// Typed client for the GYF FastAPI core. The single place the web app talks to the
// API: every component goes through this, never an ad-hoc `fetch`. All request/
// response types come from `@gyf/types` (generated from the API's OpenAPI schema by
// `make types`), so the client cannot silently drift from the backend.
//
// Auth is injected as a `TokenProvider`, not imported from Supabase — that keeps this
// module free of framework/runtime coupling and trivially unit-testable (pass a stub
// token getter). Each host binds its own session provider to a client instance via
// `createApi(getToken)`; this package never imports an auth or UI framework.

import type {
  ConsentFlags,
  ConsentInput,
  components,
  FeedbackRequest,
  operations,
  OutfitItem,
  OutfitRecommendation,
  ModelRegistryStatus,
  Post,
  PostInput,
  Profile,
  ProfileInput,
  ProfileSummary,
  SavedItem,
  SavedOutfit,
  SaveOutfitRequest,
  SearchResult,
  SystemStatus,
  TryOnJob,
  TryOnJobCreated,
  WardrobeItem,
  WardrobeItemInput,
} from "@gyf/types";

type ProfilePhotoResponse = components["schemas"]["ProfilePhotoResponse"];

// The transport is deliberately framework-neutral. Hosts choose their API origin when
// constructing `GyfApi`; this local default is useful for tests and local Expo/API work,
// and must not read a Next/Expo environment at module evaluation time.
const DEFAULT_BASE = "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 15_000;

type JsonResponse<T> = T extends { content?: infer Content }
  ? Content extends { "application/json": infer Body }
    ? Body
    : never
  : never;

type OperationResponse<
  Name extends keyof operations,
  Status extends keyof operations[Name]["responses"],
> = JsonResponse<operations[Name]["responses"][Status]>;

type SearchResults = OperationResponse<"search_items_items_search_get", 200>;
type AccountExportResponse = OperationResponse<"export_account_account_export_get", 200> & {
  user_id: string;
  data: Record<string, unknown[]>;
};
type FeedbackAck = OperationResponse<"ingest_feedback_feedback_post", 202>;
type SavedItemsResponse = OperationResponse<"list_collection_collections_get", 200>;
type SavedOutfitsResponse = OperationResponse<"list_saved_outfits_collections_outfits_get", 200>;
type WardrobeItemsResponse = OperationResponse<"list_wardrobe_wardrobe_items_get", 200>;
type BlockedUsersResponse = OperationResponse<"list_blocks_social_blocks_get", 200>;
type FollowingResponse = OperationResponse<"list_follows_social_follows_get", 200>;
type SocialPostsResponse = OperationResponse<"social_feed_social_posts_get", 200>;
// These API responses are currently anonymous JSON maps in FastAPI's OpenAPI output.
// Keep the generated response as the base while making the fields consumed by both
// clients explicit; a later server schema can replace these intersections without
// changing the transport surface.
type FollowResponse = OperationResponse<"follow_user_social_follows__user_id__put", 200> & {
  user_id: string;
  following: boolean;
  newly: boolean;
};
type ReactionResponse = OperationResponse<
  "react_to_post_social_posts__post_id__react_post",
  200
> & {
  post_id: string;
  reacted: boolean;
};
type SupportResponse = OperationResponse<"create_support_message_support_messages_post", 201> & {
  id: string;
  status: string;
};
type MeResponse = OperationResponse<"me_me_get", 200>;
type AlternatesResponse = OperationResponse<"outfit_alternates_outfits_alternates_get", 200>;
type LinkConversionResponse = OperationResponse<"convert_link_cuelinks_links_convert_post", 200>;
type TryOnJobList = OperationResponse<"list_try_on_jobs_tryon_jobs_get", 200>;
type BrowseResults = OperationResponse<"browse_items_items_browse_get", 200>;
type SimilarResults = OperationResponse<"similar_items_items__item_id__similar_get", 200>;
type RecommendQuery = NonNullable<
  operations["recommend_outfits_outfits_recommend_get"]["parameters"]["query"]
>;
type SearchQuery = operations["search_items_items_search_get"]["parameters"]["query"];
type BrowseQuery = NonNullable<operations["browse_items_items_browse_get"]["parameters"]["query"]>;

/** An HTTP-level failure from the API, carrying the status so callers can branch
 *  honestly (404 = not onboarded yet, 503 = a capability is unavailable, …) rather
 *  than treating every error the same. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** No profile/recommendation yet — the caller should route to onboarding. */
  get isNotOnboarded(): boolean {
    return this.status === 404;
  }

  /** A capability (e.g. text search needs the ML runtime) is not available. */
  get isUnavailable(): boolean {
    return this.status === 503;
  }

  /** The account is tombstoned (right-to-erasure in flight) or the caller is signed out. */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** The free monthly try-on quota is spent. Not a paywall — there is nothing to buy,
   *  and the UI must never present one. The GPU is finite; that is all this means. */
  get isQuotaExhausted(): boolean {
    return this.status === 429;
  }
}

/** Returns the current bearer token (Supabase JWT), or null when signed out. */
export type TokenProvider = () => string | null | Promise<string | null>;

/** React Native's native multipart file representation. Web callers keep using `File`. */
export interface MultipartFile {
  uri: string;
  name: string;
  type: string;
}

/** Request query types are derived from the generated OpenAPI operations. The
 *  search helper omits its required `q` because `search()` accepts it separately;
 *  the remaining fields intentionally cover browse/similar convenience callers too. */
export type RecommendParams = RecommendQuery;
export type SearchParams = Omit<SearchQuery, "q" | "slot" | "slots"> &
  Pick<BrowseQuery, "seed"> & {
    /** The API accepts the category vocabulary as a string and validates it server-side. */
    slot?: string | null;
    /** Comma-separated slot vocabulary used by multi-slot search/browse. */
    slots?: string | null;
  };
export type CatalogFacets = components["schemas"]["CatalogFacets"];

export class GyfApi {
  constructor(
    private readonly getToken: TokenProvider = () => null,
    private readonly base: string = DEFAULT_BASE,
    private readonly timeoutMs: number = REQUEST_TIMEOUT_MS,
  ) {}

  // --- Profile & onboarding (manual path) ---

  getProfile(): Promise<Profile> {
    return this.request<Profile>("GET", "/profile");
  }

  putProfile(input: ProfileInput): Promise<Profile> {
    return this.request<Profile>("PUT", "/profile", input);
  }

  deleteProfile(): Promise<void> {
    return this.request<void>("DELETE", "/profile");
  }

  /** Profile stats (outfits made, items saved, wardrobe size, posts, reactions)
   *  plus the gamification badges those thresholds unlock. */
  getProfileSummary(): Promise<ProfileSummary> {
    return this.request<ProfileSummary>("GET", "/profile/summary");
  }

  /** Photo onboarding: upload one photo to explicitly re-estimate skin tone + body type.
   *  Non-abstaining estimates replace their prior fields but remain editable.
   *  A 503 means neither photo module is
   *  available — fall back to the manual form. */
  uploadPhoto(file: File | MultipartFile): Promise<ProfilePhotoResponse> {
    const form = new FormData();
    form.append("photo", file as Blob);
    return this.requestMultipart<ProfilePhotoResponse>("/profile/photo", form);
  }

  // --- Consent & erasure ---

  getConsent(): Promise<ConsentFlags> {
    return this.request<ConsentFlags>("GET", "/consent");
  }

  putConsent(input: ConsentInput): Promise<ConsentFlags> {
    return this.request<ConsentFlags>("PUT", "/consent", input);
  }

  deleteAccount(): Promise<void> {
    return this.request<void>("DELETE", "/account");
  }

  exportAccount(): Promise<AccountExportResponse> {
    return this.request<AccountExportResponse>("GET", "/account/export");
  }

  // --- Recommendation & feedback (the stylist loop) ---

  recommend(params: RecommendParams = {}): Promise<OutfitRecommendation> {
    const query = toQuery({ ...params });
    return this.request<OutfitRecommendation>("GET", `/outfits/recommend${query}`);
  }

  /** Complete the look: personalized full outfits pinned to one catalog item —
   *  every returned outfit contains it, the rest is styled around it. */
  completeLook(itemId: string, params: RecommendParams = {}): Promise<OutfitRecommendation> {
    const query = toQuery({ item_id: itemId, ...params });
    return this.request<OutfitRecommendation>("GET", `/outfits/complete${query}`);
  }

  /** Swap-a-piece: same-slot, visually-coherent alternates for one garment
   *  in a look, affiliate-attributed to the recommendation. */
  alternates(itemId: string, recommendationId?: string, k = 3): Promise<OutfitItem[]> {
    const query = toQuery({ item_id: itemId, recommendation_id: recommendationId, k });
    return this.request<AlternatesResponse>("GET", `/outfits/alternates${query}`).then(
      (r) => r.alternates,
    );
  }

  feedback(body: FeedbackRequest): Promise<FeedbackAck> {
    const event = body.event_id ? body : { ...body, event_id: crypto.randomUUID() };
    return this.request<FeedbackAck>("POST", "/feedback", event);
  }

  // --- Visual search & shop-the-look ---

  search(q: string, params: SearchParams = {}, signal?: AbortSignal): Promise<SearchResult[]> {
    const query = toQuery({ q, ...params });
    return this.request<SearchResults>("GET", `/items/search${query}`, undefined, signal).then(
      (r) => r.results,
    );
  }

  /** Empty-state catalogue feed — NO text embedding, NO vector scan (unlike
   *  `search`). Works when the ML lane is cold; deployed latency is measured at
   *  the database/API boundary. Use for the unqueried view, and switch to `search`
   *  the moment the user types a real query. */
  browse(
    params: Omit<SearchParams, "sort" | "max_price"> = {},
    signal?: AbortSignal,
  ): Promise<SearchResult[]> {
    const query = toQuery({ ...params });
    return this.request<BrowseResults>("GET", `/items/browse${query}`, undefined, signal).then(
      (r) => r.results,
    );
  }

  /** Available catalog filter ranges (price coverage + min/max) for the optional
   *  region and canonical audience slice. Drives which filters Explore renders. */
  facets(region?: string, gender?: string): Promise<CatalogFacets> {
    const query = toQuery({ ...(region ? { region } : {}), ...(gender ? { gender } : {}) });
    return this.request<CatalogFacets>("GET", `/items/facets${query}`);
  }

  similar(
    itemId: string,
    params: SearchParams = {},
    signal?: AbortSignal,
  ): Promise<SearchResult[]> {
    const query = toQuery({ ...params });
    return this.request<SimilarResults>(
      "GET",
      `/items/${encodeURIComponent(itemId)}/similar${query}`,
      undefined,
      signal,
    ).then((r) => r.results);
  }

  convertAffiliateLink(url: string, subid: string): Promise<LinkConversionResponse> {
    return this.request<LinkConversionResponse>("POST", "/cuelinks/links/convert", { url, subid });
  }

  // --- Collections (saved shortlist) ---

  /** Save a catalog item to the shortlist. Idempotent per (user, item). 404 if unknown. */
  saveItem(itemId: string): Promise<SavedItem> {
    return this.request<SavedItem>("POST", "/collections", { item_id: itemId });
  }

  /** The user's saved items, most-recently-saved first, enriched for display. */
  listSaved(): Promise<SavedItem[]> {
    return this.request<SavedItemsResponse>("GET", "/collections").then((r) => r.items);
  }

  /** Remove an item from the shortlist. Idempotent. */
  unsaveItem(itemId: string): Promise<void> {
    return this.request<void>("DELETE", `/collections/${encodeURIComponent(itemId)}`);
  }

  // --- Saved outfits (saved looks / styling sessions) ---

  /** Save a whole look. Idempotent per (user, outfit_key) — re-saving updates the snapshot. */
  saveOutfit(input: SaveOutfitRequest): Promise<SavedOutfit> {
    return this.request<SavedOutfit>("POST", "/collections/outfits", input);
  }

  /** The user's saved looks, most-recently-saved first, each re-rendered. */
  listSavedOutfits(): Promise<SavedOutfit[]> {
    return this.request<SavedOutfitsResponse>("GET", "/collections/outfits").then((r) => r.outfits);
  }

  /** Remove a saved look by id. Idempotent. */
  removeSavedOutfit(outfitId: string): Promise<void> {
    return this.request<void>("DELETE", `/collections/outfits/${encodeURIComponent(outfitId)}`);
  }

  // --- Wardrobe (owned garments) ---

  /** Add a garment: a catalog `item_id` or a freeform `title` (auto-classified). */
  addWardrobeItem(input: WardrobeItemInput): Promise<WardrobeItem> {
    return this.request<WardrobeItem>("POST", "/wardrobe/items", input);
  }

  /** The user's owned garments, most-recently-added first. */
  listWardrobe(): Promise<WardrobeItem[]> {
    return this.request<WardrobeItemsResponse>("GET", "/wardrobe/items").then((r) => r.items);
  }

  /** Manual correction: reclassify one owned garment; slot follows the category. */
  updateWardrobeItem(wardrobeId: string, category: string): Promise<WardrobeItem> {
    return this.request<WardrobeItem>(
      "PATCH",
      `/wardrobe/items/${encodeURIComponent(wardrobeId)}`,
      { category },
    );
  }

  /** Remove a wardrobe garment by id. Idempotent. */
  removeWardrobeItem(wardrobeId: string): Promise<void> {
    return this.request<void>("DELETE", `/wardrobe/items/${encodeURIComponent(wardrobeId)}`);
  }

  /** Record a moderation report against a post. */
  reportPost(postId: string, reason: string): Promise<void> {
    return this.request<void>("POST", `/social/posts/${encodeURIComponent(postId)}/report`, {
      reason,
    });
  }

  /** Hide a user's posts from the caller's feeds. Idempotent. */
  blockUser(userId: string): Promise<void> {
    return this.request<void>("PUT", `/social/blocks/${encodeURIComponent(userId)}`);
  }

  /** Undo a block. Idempotent. */
  unblockUser(userId: string): Promise<void> {
    return this.request<void>("DELETE", `/social/blocks/${encodeURIComponent(userId)}`);
  }

  /** The caller's block list, most recent first. */
  listBlocks(): Promise<string[]> {
    return this.request<BlockedUsersResponse>("GET", "/social/blocks").then((r) => r.blocked);
  }

  /** The caller's identity (id + email) as the API resolves it from the token. */
  me(): Promise<MeResponse> {
    return this.request<MeResponse>("GET", "/me");
  }

  // --- Trust surface (M8.5) ---

  /** What is live, experimental (beta/shadow), degraded, or planned. Public. */
  systemStatus(): Promise<SystemStatus> {
    return this.request<SystemStatus>("GET", "/system/status");
  }

  /** Operator view: every model, its lane, and whether it may serve — the same
   *  verdict the CI license gate enforces. Public (names/licenses only). */
  systemModels(): Promise<ModelRegistryStatus> {
    return this.request<ModelRegistryStatus>("GET", "/system/models");
  }

  // --- Virtual try-on (M9) ---

  /** Queue a try-on render (202). The render happens in a durable background job, so the
   *  user can close the page — poll `tryOnJob` for the outcome.
   *
   *  Deliberately NOT retried: a retried POST would enqueue a second job and spend a
   *  second render from the user's quota. */
  createTryOnJob(
    photo: File | MultipartFile,
    itemIds: string[],
    signal?: AbortSignal,
  ): Promise<TryOnJobCreated> {
    const form = new FormData();
    form.append("photo", photo as Blob);
    form.append("item_ids", itemIds.join(","));
    return this.requestMultipart<TryOnJobCreated>("/tryon", form, signal);
  }

  /** Poll one try-on job. Inherits `request`'s 502-504 retry, which is what makes the
   *  poll survive a sleeping API instance without any retry logic of its own. */
  tryOnJob(jobId: string, signal?: AbortSignal): Promise<TryOnJob> {
    return this.request<TryOnJob>(
      "GET",
      `/tryon/jobs/${encodeURIComponent(jobId)}`,
      undefined,
      signal,
    );
  }

  /** The caller's recent renders and their remaining free quota. */
  tryOnJobs(signal?: AbortSignal): Promise<TryOnJobList> {
    return this.request<TryOnJobList>("GET", "/tryon/jobs", undefined, signal);
  }

  /** Cancel a render. A queued job is genuinely cancelled and the quota refunded; a job
   *  already on the GPU stops being waited for, but its seconds are spent. Idempotent. */
  cancelTryOnJob(jobId: string): Promise<TryOnJob> {
    return this.request<TryOnJob>("DELETE", `/tryon/jobs/${encodeURIComponent(jobId)}`);
  }

  // --- Social (shared looks) ---

  /** The ranked social feed: posts by engagement then recency, each look rendered.
   *  `scope: "following"` narrows it to authors the caller follows. */
  socialFeed(
    params: { limit?: number; offset?: number; scope?: "all" | "following" } = {},
  ): Promise<Post[]> {
    const query = toQuery({ ...params });
    return this.request<SocialPostsResponse>("GET", `/social/posts${query}`).then((r) => r.posts);
  }

  /** Follow a user's style (idempotent). 422 self-follow, 404 unknown user. */
  followUser(userId: string): Promise<FollowResponse> {
    return this.request<FollowResponse>("PUT", `/social/follows/${encodeURIComponent(userId)}`);
  }

  /** Stop following (idempotent — 204 either way). */
  unfollowUser(userId: string): Promise<void> {
    return this.request<void>("DELETE", `/social/follows/${encodeURIComponent(userId)}`);
  }

  /** The user ids the caller follows, most recent first. */
  listFollows(): Promise<string[]> {
    return this.request<FollowingResponse>("GET", "/social/follows").then((r) => r.following);
  }

  /** Share an outfit as a post. The look's item ids are stored and re-rendered. */
  createPost(input: PostInput): Promise<Post> {
    return this.request<Post>("POST", "/social/posts", input);
  }

  /** React once per (post, user). 404 if the post does not exist. */
  reactToPost(postId: string, reaction = "like"): Promise<ReactionResponse> {
    return this.request<ReactionResponse>(
      "POST",
      `/social/posts/${encodeURIComponent(postId)}/react`,
      { reaction },
    );
  }

  /** Remove the caller's reaction (idempotent 204). */
  unreactToPost(postId: string): Promise<void> {
    return this.request<void>("DELETE", `/social/posts/${encodeURIComponent(postId)}/react`);
  }

  /** Re-render a post's look for the *caller* — never a blind copy. 404 if gone / not onboarded. */
  recreatePost(postId: string): Promise<OutfitRecommendation> {
    return this.request<OutfitRecommendation>(
      "POST",
      `/social/posts/${encodeURIComponent(postId)}/recreate`,
    );
  }

  /** Submit a contact or grievance message. Success is only shown on a 201. */
  submitSupportMessage(input: {
    kind: "contact" | "grievance";
    category?: string;
    message: string;
    reply_email?: string;
  }): Promise<SupportResponse> {
    return this.request<SupportResponse>("POST", "/support/messages", input);
  }

  // --- internals ---

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const token = await this.getToken();
    const requestId = createRequestId();
    const headers = requestHeaders(token, requestId, body);
    if (body !== undefined) headers.set("Content-Type", "application/json");

    // Cold-start resilience: the free-tier API sleeps and its first response can
    // be a proxy 502/503/504 or a dropped connection. Users were tapping 3–4
    // times to get one page. Retry safe GETs twice with a short backoff —
    // by the second try the instance is usually awake. Mutations never retry
    // except /feedback, whose stable event_id makes retries safe.
    const createsSlate =
      path.startsWith("/outfits/recommend") || path.startsWith("/outfits/complete");
    const attempts = (method === "GET" && !createsSlate) || path === "/feedback" ? 3 : 1;
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1500 * i));
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const timeoutController = new AbortController();
      const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;
      try {
        const res = await fetch(`${this.base}${path}`, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          // Forwarded so callers can actually cancel: a superseded search/browse
          // (fast filter changes) aborts its fetch instead of resolving late and
          // clobbering newer results.
          signal: requestSignal,
        });
        if (res.status >= 502 && res.status <= 504 && i < attempts - 1) {
          lastErr = new ApiError(res.status, res.statusText, null, requestId);
          continue;
        }
        return await this.handle<T>(res, requestId);
      } catch (e) {
        if (signal?.aborted) throw e;
        if ((e as { name?: string }).name === "AbortError") {
          // A timeout is this request's total latency bound, not a retry signal.
          // Retrying it made safe GETs stall for 3× the advertised 15 seconds.
          throw e;
        }
        if (e instanceof ApiError) throw e;
        lastErr = e; // network drop (TypeError) — retry
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastErr;
  }

  /** Like `request`, but sends multipart form data — the browser sets the
   *  `Content-Type` (with boundary) itself, so we must NOT set it here.
   *
   *  Never retried (unlike `request`'s safe GETs): these POSTs upload a photo and start
   *  paid work, so a silent retry would double-spend the user's quota. */
  private async requestMultipart<T>(
    path: string,
    form: FormData,
    signal?: AbortSignal,
  ): Promise<T> {
    const token = await this.getToken();
    const requestId = createRequestId();
    const headers = requestHeaders(token, requestId);
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const res = await fetch(`${this.base}${path}`, {
        method: "POST",
        headers,
        body: form,
        signal: requestSignal,
      });
      return this.handle<T>(res, requestId);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async handle<T>(res: Response, requestId?: string): Promise<T> {
    if (res.status === 204) return undefined as T;

    const raw = await res.text();
    const data: unknown = raw ? safeJson(raw) : null;
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(data, res.statusText), data, requestId);
    }
    return data as T;
  }
}

/** Build headers shared by JSON and multipart requests without coupling to a host. */
function requestHeaders(token: string | null, requestId: string, body?: unknown): Headers {
  const headers = new Headers({ Accept: "application/json", "X-Request-ID": requestId });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Feedback's event_id is the existing server idempotency key. Mirroring it in
  // the standard header lets proxies and future API adapters preserve the same
  // retry identity without changing the JSON contract or retrying unsafe writes.
  if (body && typeof body === "object" && "event_id" in body) {
    const eventId = (body as { event_id?: unknown }).event_id;
    if (typeof eventId === "string" && eventId) headers.set("Idempotency-Key", eventId);
  }
  return headers;
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `gyf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Build a `createApi`-bound instance once Supabase (or any token source) is wired. */
export function createApi(getToken: TokenProvider, base?: string): GyfApi {
  return new GyfApi(getToken, base);
}

function toQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}
