// Typed client for the GYF FastAPI core. The single place the web app talks to the
// API: every component goes through this, never an ad-hoc `fetch`. All request/
// response types come from `@gyf/types` (generated from the API's OpenAPI schema by
// `make types`), so the client cannot silently drift from the backend.
//
// Auth is injected as a `TokenProvider`, not imported from Supabase — that keeps this
// module free of framework/runtime coupling and trivially unit-testable (pass a stub
// token getter). The Supabase wiring lives in `app/lib/supabase` and is bound to a
// client instance via `createApi(getToken)`.

import type {
  ConsentInput,
  FeedbackRequest,
  OutfitRecommendation,
  Post,
  PostInput,
  Profile,
  ProfileInput,
  SavedItem,
  SavedOutfit,
  SaveOutfitRequest,
  SearchResult,
  WardrobeItem,
  WardrobeItemInput,
} from "@gyf/types";

const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** An HTTP-level failure from the API, carrying the status so callers can branch
 *  honestly (404 = not onboarded yet, 503 = a capability is unavailable, …) rather
 *  than treating every error the same. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
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
}

/** Returns the current bearer token (Supabase JWT), or null when signed out. */
export type TokenProvider = () => string | null | Promise<string | null>;

export interface RecommendParams {
  /** Overrides the profile's stored occasion (casual, business, wedding, festive, …). */
  occasion?: string;
  /** How many outfits to return (1–20). */
  k?: number;
  /** Region code (e.g. "IN") for culture-aware garments. */
  region?: string;
  /** Free-text styling goal ("look taller / slimmer / broader"). */
  goal?: string;
}

export interface SearchParams {
  k?: number;
  region?: string;
}

interface SearchResults {
  results: SearchResult[];
}

interface FeedbackAck {
  status: string;
  action: string;
}

export class GyfApi {
  constructor(
    private readonly getToken: TokenProvider = () => null,
    private readonly base: string = DEFAULT_BASE,
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

  /** Photo onboarding: upload one photo to estimate skin tone + body type.
   *  Returns the merged profile (estimated fields are editable and never override
   *  higher-confidence manual values). A 503 means neither photo module is
   *  available — fall back to the manual form. */
  uploadPhoto(file: File): Promise<Profile> {
    const form = new FormData();
    form.append("photo", file);
    return this.requestMultipart<Profile>("/profile/photo", form);
  }

  // --- Consent & erasure ---

  getConsent(): Promise<Record<string, boolean>> {
    return this.request<Record<string, boolean>>("GET", "/consent");
  }

  putConsent(input: ConsentInput): Promise<Record<string, boolean>> {
    return this.request<Record<string, boolean>>("PUT", "/consent", input);
  }

  deleteAccount(): Promise<void> {
    return this.request<void>("DELETE", "/account");
  }

  // --- Recommendation & feedback (the stylist loop) ---

  recommend(params: RecommendParams = {}): Promise<OutfitRecommendation> {
    const query = toQuery({ ...params });
    return this.request<OutfitRecommendation>("GET", `/outfits/recommend${query}`);
  }

  feedback(body: FeedbackRequest): Promise<FeedbackAck> {
    return this.request<FeedbackAck>("POST", "/feedback", body);
  }

  // --- Visual search & shop-the-look ---

  search(q: string, params: SearchParams = {}): Promise<SearchResult[]> {
    const query = toQuery({ q, ...params });
    return this.request<SearchResults>("GET", `/items/search${query}`).then((r) => r.results);
  }

  similar(itemId: string, params: SearchParams = {}): Promise<SearchResult[]> {
    const query = toQuery({ ...params });
    return this.request<SearchResults>(
      "GET",
      `/items/${encodeURIComponent(itemId)}/similar${query}`,
    ).then((r) => r.results);
  }

  // --- Collections (saved shortlist) ---

  /** Save a catalog item to the shortlist. Idempotent per (user, item). 404 if unknown. */
  saveItem(itemId: string): Promise<SavedItem> {
    return this.request<SavedItem>("POST", "/collections", { item_id: itemId });
  }

  /** The user's saved items, most-recently-saved first, enriched for display. */
  listSaved(): Promise<SavedItem[]> {
    return this.request<{ items: SavedItem[] }>("GET", "/collections").then((r) => r.items);
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
    return this.request<{ outfits: SavedOutfit[] }>("GET", "/collections/outfits").then(
      (r) => r.outfits,
    );
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
    return this.request<{ items: WardrobeItem[] }>("GET", "/wardrobe/items").then((r) => r.items);
  }

  /** Remove a wardrobe garment by id. Idempotent. */
  removeWardrobeItem(wardrobeId: string): Promise<void> {
    return this.request<void>("DELETE", `/wardrobe/items/${encodeURIComponent(wardrobeId)}`);
  }

  // --- Social (shared looks) ---

  /** The ranked social feed: posts by engagement then recency, each look rendered. */
  socialFeed(params: { limit?: number; offset?: number } = {}): Promise<Post[]> {
    const query = toQuery({ ...params });
    return this.request<{ posts: Post[] }>("GET", `/social/posts${query}`).then((r) => r.posts);
  }

  /** Share an outfit as a post. The look's item ids are stored and re-rendered. */
  createPost(input: PostInput): Promise<Post> {
    return this.request<Post>("POST", "/social/posts", input);
  }

  /** React once per (post, user). 404 if the post does not exist. */
  reactToPost(postId: string, reaction = "like"): Promise<{ post_id: string; reacted: boolean }> {
    return this.request("POST", `/social/posts/${encodeURIComponent(postId)}/react`, { reaction });
  }

  /** Re-render a post's look for the *caller* — never a blind copy. 404 if gone / not onboarded. */
  recreatePost(postId: string): Promise<OutfitRecommendation> {
    return this.request<OutfitRecommendation>(
      "POST",
      `/social/posts/${encodeURIComponent(postId)}/recreate`,
    );
  }

  // --- internals ---

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const headers = new Headers({ Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");

    const res = await fetch(`${this.base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return this.handle<T>(res);
  }

  /** Like `request`, but sends multipart form data — the browser sets the
   *  `Content-Type` (with boundary) itself, so we must NOT set it here. */
  private async requestMultipart<T>(path: string, form: FormData): Promise<T> {
    const token = await this.getToken();
    const headers = new Headers({ Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${this.base}${path}`, { method: "POST", headers, body: form });
    return this.handle<T>(res);
  }

  private async handle<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;

    const raw = await res.text();
    const data: unknown = raw ? safeJson(raw) : null;
    if (!res.ok) {
      throw new ApiError(res.status, errorMessage(data, res.statusText), data);
    }
    return data as T;
  }
}

/** Build a `createApi`-bound instance once Supabase (or any token source) is wired. */
export function createApi(getToken: TokenProvider, base?: string): GyfApi {
  return new GyfApi(getToken, base);
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
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
