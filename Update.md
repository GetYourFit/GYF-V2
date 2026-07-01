# GYF — Current Build Status

> **Generated:** 2026-07-01  
> **Branch:** `main`  
> **Purpose:** Snapshot of what is actually built, wired, and live in the codebase right now — frontend design, backend endpoints, and planned execution state. Not a roadmap; a ground-truth record.

---

## 1. What Is Built

### 1.1 Summary

The **backend brain is complete and functional.** The **product surface (frontend) is now substantially built** — all five core tabs, the full onboarding wizard, auth, and the stylist experience are implemented and wired to the live API. The primary remaining gaps are virtual try-on (M9), the photo-based body/skin-tone modules (M3/M4), and beta-hardening (M12).

---

## 2. Frontend — Design System

### Design Language: "Editorial Noir"

A Vogue/SSENSE-inspired dark-mode editorial aesthetic. Near-black canvas, garments read as gallery pieces lit in the dark. Ivory inverts to the primary CTA.

**Color Tokens**

| Token | Value | Purpose |
|---|---|---|
| `--color-bg` | `#0a0a0a` | Near-black page canvas |
| `--color-surface` | `#141414` | Card / panel surface |
| `--color-surface-2` | `#1c1c1c` | Elevated surface (modals, dropdowns) |
| `--color-surface-3` | `#262626` | Hover state on surfaces |
| `--color-text` | `#f4f1ea` | Warm ivory primary ink |
| `--color-text-mid` | `#a8a29a` | Secondary / muted warm grey |
| `--color-text-faint` | `#9a948b` | Muted labels (WCAG-AA ≥4.5:1) |
| `--color-accent` | `#f4f1ea` | Ivory — CTA inverts to ink-on-light |
| `--color-accent-warm` | `#c9a86a` | Antique gold — confidence / editorial accents |
| `--color-border` | `rgba(255,255,255,0.10)` | Subtle structural hairline |
| `--color-rule` | `rgba(255,255,255,0.08)` | Dividers |
| `--color-error` | `#e5675a` | Legible red on dark |

**Typography Scale**

| Class | Font | Size | Use |
|---|---|---|---|
| `.t-display` | Playfair Display (serif) | clamp(2.5rem–5rem) | Hero/display headings |
| `.t-headline` | Playfair Display | clamp(1.75rem–2.75rem) | Section headings |
| `.t-title` | Inter (sans) | 1.125rem / 500wt | Card titles |
| `.t-body` | Inter | 0.9375rem | Body copy |
| `.t-caption` | Inter | 0.8125rem | Captions, hints |
| `.t-label` | Inter | 0.6875rem / 500wt / 0.22em tracking | Tags, buttons, nav labels |
| `.t-mono` | JetBrains Mono | 0.6875rem | Metadata, status, timestamps |
| `.t-editorial` | Playfair Display (italic) | 1.125rem | Stylist explanations, pull quotes |
| `.t-wordmark` | Playfair Display | — | GYF logotype lockup |

**Motion:** Single "lux" easing curve — `cubic-bezier(0.16, 1, 0.3, 1)` — used across all Framer Motion transitions. WCAG `prefers-reduced-motion` is honored everywhere (reduced/static fallbacks).

**Shadows**

| Token | Value |
|---|---|
| `--shadow-card` | `0 10px 40px rgba(0,0,0,0.55)` |
| `--shadow-overlay` | `0 -10px 50px rgba(0,0,0,0.7)` |

---

## 3. Frontend — Pages & Routing

The app uses Next.js 15/16 App Router with two route groups:

- `(auth)` — unauthenticated: `/login`, `/signup`
- `(app)` — authenticated shell with bottom navigation: all product routes

**Route Map**

| Route | Page Component | Status |
|---|---|---|
| `/login` | `AuthForm mode="login"` | ✅ Built |
| `/signup` | `AuthForm mode="signup"` | ✅ Built |
| `/` | `StylistFeed` | ✅ Built |
| `/explore` | `ExploreShell` | ✅ Built |
| `/saved` | `SavedGrid` | ✅ Built |
| `/social` | `SocialFeed` | ✅ Built |
| `/profile` | `ProfileView` | ✅ Built |
| `/onboarding` | `OnboardingWizard` | ✅ Built |
| `/account` | `AccountManager` | ✅ Built |
| `/wardrobe` | `WardrobeGrid` | ✅ Built |
| `/design` | Design system showcase | Internal dev only |

**App Shell Layout**

The `(app)` layout wraps every product route in:
- `ToastProvider` — global toast notification context
- `AppShell` — flex column with `main` scroll area + fixed bottom nav
- `BottomNav` — 5-tab persistent navigation with Framer Motion spring indicator

**Bottom Navigation Tabs**

| Icon | Label | Route |
|---|---|---|
| Sparkles | Stylist | `/` |
| Compass | Explore | `/explore` |
| Bookmark | Saved | `/saved` |
| Users | Social | `/social` |
| User | Profile | `/profile` |

Active tab is indicated by a spring-animated `h-px` line at the top of the tab and `text-text` (active) vs `text-text-faint` (inactive) coloring.

---

## 4. Frontend — Components

### Auth
- **`AuthForm`** (`components/auth/auth-form.tsx`) — Email/password form for both login and signup modes. Uses `@supabase/ssr` browser client. Polls the server guard after sign-in before navigating to prevent race with cookie commit. Redirects to `?next=` param on success.

### Onboarding
- **`OnboardingWizard`** (`components/onboarding/onboarding-wizard.tsx`) — 4-step wizard (You → Style → Budget → Privacy) with Framer Motion slide transitions between steps, keyboard and screen-reader focus management, and an accessible `aria-label` progress bar. Pre-fills from an existing profile on load.
  - **Step 1 — You:** Gender selector, Skin tone, Undertone, Body type (with optional photo estimate auto-fill + "Estimated" badge via `PhotoUpload`).
  - **Step 2 — Style:** Multi-select style intent chips + occasion dropdown.
  - **Step 3 — Budget:** Min/max per-garment budget + currency picker.
  - **Step 4 — Privacy:** Consent checkboxes (data processing required; others optional). Inline account-delete button.
- **`PhotoUpload`** (`components/onboarding/photo-upload.tsx`) — Photo upload for skin/body estimation via `POST /profile/photo`. Shows "Estimated" badges on auto-filled dropdowns; user edits clear the badge.
- **`OnboardingForm`** (`components/onboarding/onboarding-form.tsx`) — Flat single-page variant of the same contract.

### Stylist (Home — `/`)
- **`StylistFeed`** (`components/stylist/stylist-feed.tsx`) — Core product screen. Loads `GET /outfits/recommend` and renders a responsive grid (1 → 2 → 3 columns). Handles cold-start redirect to onboarding (404 → `/onboarding`). Supports save, dismiss (with undo strip), and cart actions with behavioral feedback posted to `POST /feedback`. Saves whole outfit via `POST /collections/outfits` for cross-device persistence. Shows `StatusLine` (cold-start / personalized / taste %, applied goals). Staggered card entrance with 60ms per-card delay.
- **`StylistControls`** (`components/stylist/stylist-controls.tsx`) — Occasion selector + NL goal text box. "Apply" triggers a fresh `GET /outfits/recommend`.
- **`OutfitCard`** (`components/stylist/outfit-card.tsx`) — Single outfit look card with garment images, explanation, confidence meter, save/dismiss/cart actions.
- **`OutfitDetail`** (`components/stylist/outfit-detail.tsx`) — Expanded view of an outfit.
- **`ConfidenceMeter`** (`components/stylist/confidence-meter.tsx`) — Visual calibrated confidence bar.

### Explore (`/explore`)
- **`ExploreShell`** (`components/explore/explore-shell.tsx`) — Wraps `FilterBar` + `ExploreGrid` with shared filter state.
- **`FilterBar`** (`components/explore/filter-bar.tsx`) — Sticky top bar with: text search input (debounced), occasion dropdown, style intent dropdown, max-price input (hidden when catalog has no priced items — gated by `GET /items/facets`), sort selector (relevance / price ↑ / price ↓), "Clear (N)" button. Fetches `facets()` once on mount to gate price controls.
- **`ExploreGrid`** (`components/explore/explore-grid.tsx`) — Calls `GET /items/search` with all filter params, renders `ExploreCard` grid.
- **`ExploreCard`** (`components/explore/explore-card.tsx`) — Individual catalog item card.

### Social (`/social`)
- **`SocialFeed`** (`components/social/social-feed.tsx`) — Loads `GET /social/posts`, renders `PostCard` list. FAB (Plus button) opens `CreatePostSheet`. Supports optimistic reaction via `POST /social/posts/{id}/react`. Error/retry state, empty state with line-art illustration.
- **`PostCard`** (`components/social/post-card.tsx`) — Post with author info, outfit items, reaction count, share/download actions.
- **`CreatePostSheet`** (`components/social/create-post-sheet.tsx`) — Bottom sheet to compose and submit a new post via `POST /social/posts`.

### Saved (`/saved`)
- **`SavedGrid`** (`components/saved/saved-grid.tsx`) — Loads `GET /collections/outfits`, renders saved looks. Also supports saved items from `GET /collections`.
- **`SavedCard`** (`components/saved/saved-card.tsx`) — Saved look card with remove action.

### Wardrobe (`/wardrobe`)
- **`WardrobeGrid`** (`components/wardrobe/wardrobe-grid.tsx`) — Loads `GET /wardrobe/items`, renders with category filter chips (derived from live data, never hardcoded). Add garment (sheet) and remove (optimistic) wired to API. Empty state with concentric border art.
- **`GarmentCard`** (`components/wardrobe/garment-card.tsx`) — Single wardrobe item card.
- **`AddGarmentSheet`** (`components/wardrobe/add-garment-sheet.tsx`) — Bottom sheet for `POST /wardrobe/items` (catalog item_id or freeform title).

### Profile (`/profile`)
- **`ProfileView`** (`components/profile/profile-view.tsx`) — Loads `GET /profile` + `GET /profile/summary` in parallel. Shows: stats grid (Outfits / Saved / Wardrobe / Posts / Reactions) with links to child pages; earned badges; style profile table (skin tone, undertone, body type, occasion, style intent, budget) with edit link to `/onboarding`; account link to `/account`.

### Account (`/account`)
- **`AccountManager`** (`components/account/account-manager.tsx`) — Privacy & data panel: consent flag management, data download, sign-out, account deletion via `DELETE /account`.

### Layout Primitives
- **`AppShell`** — Full-height flex column, `pb` clears bottom nav + iOS safe area.
- **`BottomNav`** — Fixed bottom tab bar, spring-animated active indicator (`layoutId`), iOS safe-area padding.
- **`PageContainer`** — Constrained width container (default / wide / narrow), horizontal padding.
- **`PageHeader`** — Eyebrow label + title + optional description, gold `h-px` separator above eyebrow.

### UI Primitives (`components/ui/`)
`Button`, `Input`, `Select`, `Field` (label + hint + badge slot), `Card`, `Dialog`, `Badge`, `Avatar`, `Tabs`, `Toast` + `ToastProvider`, `Skeleton`, `Switch`, `EmptyState`

---

## 5. Frontend — API Client

**Location:** `app/lib/api.ts` (typed client) + `app/lib/api-client.ts` (Supabase token binding)

The `GyfApi` class wraps every API call. Auth is injected as a `TokenProvider` callback (Supabase JWT), keeping the client Supabase-agnostic and unit-testable. All request/response types come from `@gyf/types` (generated from the backend's OpenAPI schema via `make types`).

**Environment variable:** `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`)

**Typed Methods**

| Method | HTTP | Path |
|---|---|---|
| `getProfile()` | GET | `/profile` |
| `putProfile(input)` | PUT | `/profile` |
| `deleteProfile()` | DELETE | `/profile` |
| `getProfileSummary()` | GET | `/profile/summary` |
| `uploadPhoto(file)` | POST multipart | `/profile/photo` |
| `getConsent()` | GET | `/consent` |
| `putConsent(input)` | PUT | `/consent` |
| `deleteAccount()` | DELETE | `/account` |
| `recommend(params)` | GET | `/outfits/recommend` |
| `feedback(body)` | POST | `/feedback` |
| `search(q, params)` | GET | `/items/search` |
| `facets(region?)` | GET | `/items/facets` |
| `similar(itemId, params)` | GET | `/items/{id}/similar` |
| `saveItem(itemId)` | POST | `/collections` |
| `listSaved()` | GET | `/collections` |
| `unsaveItem(itemId)` | DELETE | `/collections/{item_id}` |
| `saveOutfit(input)` | POST | `/collections/outfits` |
| `listSavedOutfits()` | GET | `/collections/outfits` |
| `removeSavedOutfit(id)` | DELETE | `/collections/outfits/{id}` |
| `addWardrobeItem(input)` | POST | `/wardrobe/items` |
| `listWardrobe()` | GET | `/wardrobe/items` |
| `removeWardrobeItem(id)` | DELETE | `/wardrobe/items/{id}` |
| `socialFeed(params)` | GET | `/social/posts` |
| `createPost(input)` | POST | `/social/posts` |
| `reactToPost(postId, reaction)` | POST | `/social/posts/{id}/react` |
| `recreatePost(postId)` | POST | `/social/posts/{id}/recreate` |

**Error class:** `ApiError(status, message, detail?)` — `.isNotOnboarded` (404), `.isUnavailable` (503), `.isUnauthorized` (401/403).

---

## 6. Backend API — Endpoints

**Runtime:** FastAPI 0.115+ on uvicorn, Python 3.12  
**Local port:** `8000`  
**Auth:** Supabase JWT via `Authorization: Bearer <token>` (local dev: auto-provisioned dev user, no auth required)  
**Docs:** `GET /docs` (Swagger), `GET /redoc`, `GET /gallery` (visual tester)

### System

| Method | Path | Description |
|---|---|---|
| GET | `/` | Redirect → `/docs` |
| GET | `/health` | Liveness probe — process up, never touches DB. Returns env, telemetry flags. |
| GET | `/ready` | Readiness probe — DB reachable. Returns 503 if not. |
| GET | `/me` | Authenticated identity check (user_id, email). |
| GET | `/gallery` | Self-contained HTML outfit gallery — renders real photos, NL goal box, occasion selector. No build step. |

### Profile (`tags: profile`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/profile` | Required | Return the user's style profile. 404 before onboarding. |
| PUT | `/profile` | Required | Upsert manual onboarding data (skin_tone, undertone, body_type, gender, style_intent, occasion, budget_range). Idempotent. |
| DELETE | `/profile` | Required | Erase profile data (keeps account). 204, idempotent. |
| POST | `/profile/photo` | Required | Upload a photo → estimate skin tone + body type → merge into profile. Consent-gated (data_processing). Rate-limited. Accepts JPEG/PNG/WebP ≤ configured limit. Both modules abstain gracefully if ML runtime unavailable. |
| GET | `/consent` | Required | Current consent flags. |
| PUT | `/consent` | Required | Grant/revoke consent flags. |
| DELETE | `/account` | Required | Right-to-erasure: soft-delete (tombstone) the account. Grace-window purge job handles cascade deletion. |
| GET | `/profile/summary` | Required | Stats (outfits_made, items_saved, wardrobe_size, posts, reactions_received) + gamification badges. |

### Recommendations (`tags: recommendations`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/outfits/recommend` | Required | Personalized outfit recommendations. Query params: `occasion` (overrides profile), `k` (1–20, default 5), `region` (e.g. `IN`), `goal` (free-text NL styling goal — "look taller/slimmer/broader"). Returns `OutfitRecommendation` with outfits, explanation, confidence, applied_goals, taste_strength, cold_start flag. 404 before profile. Rate-limited. |

### Feedback (`tags: feedback`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/feedback` | Required | Ingest a behavioral event (save, skip, cart, react, share, follow, try_on, impression). Attributed to the authenticated user. Queued via event sink (JSONL in dev, broker-backed in prod). Returns 202. Rate-limited. |

### Catalog (`tags: catalog`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/items/search` | None | Text→image search (e.g. "red floral summer dress"). Params: `q` (required), `k` (1–50), `offset`, `region`, `max_price`, `sort` (relevance/price_asc/price_desc). 503 if ML runtime unavailable. Rate-limited. |
| GET | `/items/{item_id}/similar` | None | Visually similar items by embedding nearest-neighbours. Params: `k`, `offset`, `region`. |
| GET | `/items/facets` | None | Real catalog filter ranges: total, priced, price_min, price_max. Gates client-side price controls. |

### Collections (`tags: collections`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/collections` | Required | Save an item to shortlist. Idempotent per (user, item). 404 if item unknown. |
| GET | `/collections` | Required | User's saved items, most-recently-saved first, enriched. |
| DELETE | `/collections/{item_id}` | Required | Remove item from shortlist. Idempotent, 204. |
| POST | `/collections/outfits` | Required | Save a whole look (styling session). Idempotent per (user, outfit_key). |
| GET | `/collections/outfits` | Required | User's saved looks, most-recently-saved first, re-rendered. |
| DELETE | `/collections/outfits/{outfit_id}` | Required | Remove a saved look. Idempotent, 204. |

### Wardrobe (`tags: wardrobe`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/wardrobe/items` | Required | Add a garment — catalog `item_id` (enriched, 404 if unknown) or freeform `title` (auto-classified). 201. |
| GET | `/wardrobe/items` | Required | User's owned garments, most-recently-added first. |
| DELETE | `/wardrobe/items/{wardrobe_id}` | Required | Remove a garment by wardrobe id. 204, idempotent. |

### Social (`tags: social`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/social/posts` | Required | Ranked feed (engagement then recency). Params: `limit` (1–50), `offset`. Each post re-rendered with live item data. |
| POST | `/social/posts` | Required | Share an outfit as a post. Item ids stored + re-rendered. 201. |
| POST | `/social/posts/{post_id}/react` | Required | React once per (post, user). 404 if post unknown. Rate-limited. |
| POST | `/social/posts/{post_id}/recreate` | Required | Re-render a post's look for the *caller* — using caller's region, taste, and body context. Not a blind copy. 404 if post/profile missing. Rate-limited. |

---

## 7. Backend — ML Modules

### What's Active in Production

| Capability | Status | Implementation |
|---|---|---|
| **Visual perception / embeddings** | ✅ Active | SigLIP / Marqo-FashionSigLIP; pgvector HNSW index on `item_embeddings` |
| **Cold-start outfit composition** | ✅ Active | Content-based retrieval → compatibility scoring → diverse ranked outfits |
| **Online taste model** | ✅ Active | Interaction-weighted `TasteRepository` from `interactions` table |
| **NL styling goals** | ✅ Active | Text → effect parser (elongate/slim/broaden) → color-theory + body-type attribute re-weighting |
| **Occasion / region conditioning** | ✅ Active | First-class query params on recommend + region_tags on items |
| **Honest confidence + explanation** | ✅ Active | Each outfit carries `confidence`, `score`, `explanation` (stylist reason) |
| **Impression logging** | ✅ Active | Recommendation events auditable via `interactions` table |
| **Skin-tone estimation** | ⚠️ Shadow | Computed if ML runtime available; NOT surfaced until fairness gate (Monk Skin Tone eval) passes. `skin_tone_enabled` flag controls surfacing. |
| **Body-type from photo** | ⚠️ Pending | Port exists; SAM 3D Body → MHR + Anny adapters not yet deployed (M3, pending GPU lane). |
| **Embedding upgrade** | ⏳ In progress | Bakeoff harness built (`make m2-bakeoff`); real run pending GPU. |
| **Virtual try-on** | ❌ Not built | `TryOnRenderer` port defined in architecture; no implementation yet (M9). |

---

## 8. Database Schema

**PostgreSQL 16 + pgvector**  
**Migrations:** Alembic (7 versions, 0001–0007); API migrates to head on boot.

### Tables

| Table | Description |
|---|---|
| `users` | Accounts: region, locale, consent_flags (JSONB), soft-delete via `deleted_at` |
| `profiles` | Style profile per user: skin_tone, undertone, body_type, measurements, style_intent, budget_range, source (manual/photo), field_confidence (JSONB), model_version |
| `items` | Catalog garments: title, category, attributes (JSONB), price, currency, region_tags, affiliate_url, image_refs (JSONB), source_provider, source_license, image_hash, dedupe_key |
| `item_embeddings` | Vector(768) per item with HNSW cosine index + model_version |
| `interactions` | Behavioral events: user_id, target_type, target_id, action, weight, ts, context (JSONB). Indexed on (user_id, action, ts DESC) and (user_id, ts DESC). |
| `outfits` | Composed outfit records: item_ids[], occasion, compatibility_score, explanation, confidence |
| `models` | Model registry: name, version, metrics (JSONB), status (shadow/canary/prod/rolled_back) |
| `alembic_version` | Migration tracking |

### Extensions
- `pgvector` — vector similarity (HNSW index with cosine ops)
- `pgcrypto` — `gen_random_uuid()` for primary keys

### Row-Level Security
Migration 0006 enables RLS on user-scoped tables.

### Migration History

| Version | What |
|---|---|
| 0001 | Baseline schema (users, profiles, items, interactions, outfits) |
| 0002 | Perception catalog (item_embeddings, HNSW index, model registry) |
| 0003 | Interaction context (JSONB context field on interactions) |
| 0004 | Collections, wardrobe, social tables |
| 0005 | Saved outfits |
| 0006 | Row-level security |
| 0007 | Price index on items |

---

## 9. Technology Stack

### Frontend (`app/`)

| Technology | Version | Role |
|---|---|---|
| Next.js | 16.2.9 | App Router, RSC, middleware auth guard |
| React | 19.2.4 | UI runtime |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | v4 | Utility styles + `@theme` design tokens |
| Framer Motion | 12.40 | Animations, transitions, layout animations |
| Lucide React | 1.20 | Icons |
| @supabase/ssr | 0.5.2 | Auth cookies + server-side session |
| @supabase/supabase-js | 2.47 | Auth client |
| @vercel/otel | 2.1.3 | Frontend observability |
| Vitest + @testing-library/react | 3.2 / 16.1 | Unit + component tests |

### Backend (`services/api/`)

| Technology | Version | Role |
|---|---|---|
| Python | 3.12 | Runtime |
| FastAPI | 0.115+ | HTTP framework |
| uvicorn | 0.30+ | ASGI server |
| Pydantic v2 | 2.9+ | Schema + settings |
| PyJWT | 2.9+ | Supabase JWT verification |
| Pillow | 10+ | Photo decode / EXIF strip |
| python-multipart | 0.0.9+ | File upload |
| prometheus-client | 0.21+ | Metrics |
| OpenTelemetry (otel extra) | 1.27+ | Traces |
| Sentry (sentry extra) | 2.14+ | Error tracking |
| psycopg (postgres extra) | 3.2+ | PostgreSQL async driver |
| Alembic (migrate extra) | 1.16+ | Schema migrations |
| SQLAlchemy | 2.0+ | Migration DSL |
| kafka-python (kafka extra) | 2.0+ | Event broker |
| gradio-client (photo-remote extra) | 2.0+ | HF Spaces remote ML calls |

### Infrastructure / Dev

| Tool | Role |
|---|---|
| Bun 1.1+ | JS package manager + workspace runner |
| uv | Python dep management (target 3.12) |
| Apple `container` | macOS-native local infra (replaces Docker) |
| Makefile | Canonical command interface |
| PostgreSQL 16 + pgvector | Data store + vector search |
| Redis / Upstash | Cache + rate limiting |
| Redpanda / Kafka | Event backbone (local dev: JSONL sink) |
| Supabase | Auth (JWT/OIDC) + DB (prod) |
| Vercel | Frontend deploy (auto-deploy from `app/`) |
| HF Spaces + ZeroGPU | GPU ML inference (free tier) |
| GitHub Actions | CI (fmt + lint + typecheck + tests + license gate) |

### Shared Contracts (`packages/`)

| Package | Role |
|---|---|
| `@gyf/types` (TypeScript) | API types generated from OpenAPI schema (`make types`) |
| `gyf-contracts` (Python) | Pydantic contracts shared between API and ML |

---

## 10. Planned Execution — Milestone Status

| Milestone | Stage | Status | Notes |
|---|---|---|---|
| **M0** Model registry + CI license gate | 0 | ✅ Done | `is_servable()` + non-commercial CI block + D1 import lint |
| **M1** Eval harness + promotion gate | 0 | ✅ Done | `eval-reports/` schema, `check_promotion.py` blocks missing reports |
| **M2** Embedding upgrade (SigLIP 2) | 1 | ⏳ In progress | Bakeoff harness built; real run pending GPU lane |
| **M3** Photo body-type (SAM 3DB → MHR) | 1 | ⏳ Pending | Port + consent intake exist; adapters not deployed |
| **M4** Skin-tone module (fairness-gated) | 1 | ⚠️ Shadow | Computed but not surfaced; fairness gate (Monk eval) not yet passed |
| **M5** Auth + onboarding UI | 2 | ✅ Done | Login/signup + full 4-step onboarding wizard live |
| **M6** Stylist experience | 2 | ✅ Done | Outfit cards, NL goal box, occasion, feedback loop, saved looks |
| **M7** Discovery & commerce | 2 | ✅ Done | Explore page, text search, similar items, affiliate redirect |
| **M8** Collections + profile | 2 | ✅ Done | Saved grid, saved outfits, wardrobe, profile page, account page |
| **M8.5** Trust & transparency surface | 2 | ❌ Not built | Operator model status view not yet implemented |
| **M9** Virtual try-on (`TryOnRenderer`) | 3 | ❌ Not built | Port defined in architecture; no impl |
| **M10** Social posts | 4 | ✅ Done | Social feed, create post, reactions, style-recreate (re-render for follower) |
| **M11** Gamification (badges) | 4 | ⚠️ Partial | Badge field in `profile/summary`; earning engine not fully implemented |
| **M12** Beta hardening | 5 | ❌ Not done | Security review, perf/a11y audit, e2e tests, free-tier deploy gates |

### What's Left for a Shippable Beta

1. **M2 (embeddings)** — needs a GPU run to promote the encoder. Unblocks retrieval quality uplift.
2. **M3/M4 (photo modules)** — M3 needs GPU deployment; M4 needs Monk fairness eval pass. Both land as enhancements behind the live onboarding surface.
3. **M9 (try-on)** — largest missing user-facing feature. Requires licensed model at inference + photo storage consent.
4. **M11 (gamification)** — badge earning logic needs wiring to the interactions count gates.
5. **M12 (hardening)** — security audit, rate-limit tuning, full e2e test suite, WCAG 2.2 AA audit, Vercel/Supabase/HF ZeroGPU deploy verification.

---

## 11. Development Commands

```bash
make install     # bun install + uv sync
make up          # local infra (Postgres+pgvector, Redis, Redpanda) via Apple container
make dev         # web :3000 + API :8000
make dev-api     # API only
make test        # API pytest + JS vitest
make lint        # ruff + ESLint
make fmt         # Prettier + Ruff
make ci          # full local gate: fmt-check + lint + typecheck + test
make stack       # full stack in Apple container (web + api + DB, no host deps)
make nuke        # stop + delete containers, volumes, built images
```

**API endpoints available locally:**
- `http://localhost:8000/docs` — Swagger UI
- `http://localhost:8000/gallery` — Visual outfit tester (no JSON, real photos)
- `http://localhost:8000/health` — Liveness
- `http://localhost:3000` — Web app

**Live-DB e2e verification (real Postgres, no fakes):**
```bash
bash scripts/e2e_workstream_a.sh
```
Spins up `pgvector/pgvector:pg16` on `:5433` via Apple container.

---

## 12. Key Architectural Invariants (Non-Negotiable)

1. **Quality never silently regresses** — eval-gated promotion; no model in serving without a passing eval report.
2. **Nothing non-commercial reaches the serving path** — CI license gate (M0) blocks it.
3. **Every user-facing output carries calibrated confidence + a human reason** — `explanation` + `confidence` on every outfit.
4. **Personal data is the user's** — consent capture, soft-delete, right-to-erasure (`DELETE /account`), ephemeral photo processing.
5. **A working baseline always sits behind every capability port** — manual onboarding always works even when photo modules are down; cold-start always works even without taste history.
6. **App code never imports a model directly** — capability ports only (D1). The frontend talks to the API; the API talks to ports; model adapters live behind ports.
7. **No synthetic data in training** — user photos, brand catalog, and first-party behavior only.
8. **Free-tier first** — Vercel (web), Supabase/Neon (DB), HF ZeroGPU (ML inference) until scale forces otherwise.
