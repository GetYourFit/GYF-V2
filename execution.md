# GYF — Execution & Build Reference

> **What this is.** A single place for every command, service, port, environment variable,
> and deployment detail needed to build, run, test, and ship GYF (Get Your Fit).

---

## Monorepo Layout

```
GYF-V2/
├── app/                    Next.js 16 web app (TypeScript, React 19)
├── services/
│   └── api/                FastAPI core service (Python 3.12)
├── ml/                     ML platform (perception, recsys, user-model, try-on)
├── packages/
│   ├── contracts/          Shared Python domain types (gyf-contracts, editable)
│   └── types/              Generated TypeScript API types (@gyf/types, workspace:*)
├── infra/                  Apple container stack scripts
├── scripts/                Dev verification and seed scripts
├── eval-reports/           Encoder bake-off JSON results
└── Makefile                All developer tasks (run `make` for help)
```

**Toolchain:**
- JavaScript: **Bun 1.1+** (package manager + runtime), **Turbo 2.x** (task runner)
- Python: **uv** (dependency manager, replaces pip/Poetry), **Python 3.12**
- Containers: **Apple `container`** (macOS local infra, replaces Docker Compose)

---

## Prerequisites

| Tool | Install | Minimum |
|------|---------|---------|
| Bun | `curl -fsSL https://bun.sh/install \| bash` | 1.1 |
| uv | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | latest |
| Apple container | Mac App Store / developer.apple.com | — |
| Node (optional) | via `.nvmrc` | — |

---

## Environment Setup

```bash
cp .env.example .env        # repo root
cp app/.env.example app/.env
# fill in secrets — see variable table below
```

### Key Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | web | Public web URL (default: `http://localhost:3000`) |
| `API_BASE_URL` | web | API origin the browser/SSR calls |
| `GYF_ENV` | api | `local` / `staging` / `production` |
| `GYF_DATABASE_URL` | api | Postgres connection string (use `:5432` session URL for migrations) |
| `GYF_REDIS_URL` | api | Redis connection string |
| `GYF_SUPABASE_URL` | api | Supabase project URL — enables JWKS (ES256) auth |
| `GYF_SUPABASE_JWT_SECRET` | api | Legacy HS256 fallback JWT secret |
| `GYF_AUTH_DISABLED` | api | `true` in local dev only; never in prod |
| `GYF_EVENT_SINK` | api | `local` (JSONL) / `kafka` / `postgres` |
| `GYF_EVENT_TOPIC` | api | Kafka topic name (default: `gyf.interactions`) |
| `GYF_SKIN_TONE_ENABLED` | api | `true` enables skin-tone module (fairness-gated) |
| `GYF_SKINTONE_REMOTE_URL` | api | HF Space URL for ZeroGPU skin-tone inference |
| `GYF_BODY_REMOTE_URL` | api | HF Space URL for ZeroGPU body-shape inference |
| `GYF_HF_TOKEN` | api | Hugging Face access token (gated SAM + ZeroGPU quota) |
| `GYF_MEDIA_BASE_URL` | api | Supabase Storage CDN base URL for catalog images |
| `GYF_ALLOWED_ORIGINS` | api | CORS origins (comma-separated, exact, no trailing slash) |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api | S3-compatible object storage |
| `EVENT_BROKER_URL` | api | Kafka/Redpanda broker (default: `localhost:9092`) |
| `GYF_OTEL_EXPORTER_OTLP_ENDPOINT` | api | OpenTelemetry OTLP endpoint (optional) |
| `GYF_SENTRY_DSN` | api | Sentry DSN (optional) |
| `OTEL_SERVICE_NAME` | web | OTel service name for web traces |

---

## Install

```bash
make install
# runs: bun install  +  uv sync --extra dev --extra postgres --extra migrate  (in services/api)
```

---

## Local Development

### Full stack (web + API)

```bash
make dev
# web → http://localhost:3000
# api → http://localhost:8000
# Ctrl-C stops both
```

### Web only

```bash
make dev-web          # bun run dev (Next.js dev server, port 3000)
```

### API only

```bash
make dev-api          # uvicorn --reload, port 8000
```

### Local infra only (Postgres + pgvector, Redis, Redpanda)

```bash
make up               # start infra containers (Apple container)
make down             # stop (keeps volumes)
make logs             # tail logs
```

### Full containerised stack

```bash
make stack            # build + run everything: web :3000, api :8000, + infra
make stack-down
make stack-logs
make nuke             # stop + delete volumes + locally-built images
```

---

## Database Migrations

```bash
make migrate          # alembic upgrade head against GYF_DATABASE_URL
```

Migration runs automatically on API boot in the Docker/container stack via `docker-entrypoint.sh`.
Use the Postgres **session** URL (`:5432`), not the transaction pooler (`:6543`), for Alembic.

---

## Build

### JavaScript workspaces (Turbo)

```bash
bun run build         # turbo run build → outputs .next/** and dist/**
```

Turbo task graph:
- `build` depends on `^build` (upstream packages first)
- `typecheck` depends on `^build`
- `test` depends on `^build`

### TypeScript config

- Base: `tsconfig.base.json` — target ES2022, strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`
- Web: `app/tsconfig.json` extends base

### Web Dockerfile (dev image)

```dockerfile
FROM oven/bun:1.3
# Installs workspace deps with --frozen-lockfile
# Binds source at run time for hot reload
# EXPOSE 3000
# CMD: bun run --filter @gyf/web dev
```

### API Dockerfile

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
# uv sync --extra dev --extra postgres --extra migrate --extra photo-remote
# ENTRYPOINT: docker-entrypoint.sh (runs alembic upgrade head then CMD)
# EXPOSE 8000
# CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Generate API Types

The TypeScript types in `packages/types/src/api.ts` are **generated** from the FastAPI OpenAPI schema — never hand-edit this file.

```bash
make types
# 1. Dumps OpenAPI JSON from the running FastAPI app
# 2. Runs openapi-typescript to produce packages/types/src/api.ts
# Then: make typecheck  to confirm FE/BE are in lockstep
```

---

## Code Quality

```bash
make fmt              # Prettier (JS) + Ruff format + Ruff fix (Python)
make fmt-check        # Check only (no writes) — used in CI
make lint             # ESLint (JS) + Ruff check (Python)
make typecheck        # tsc --noEmit across all workspaces
```

---

## Tests

```bash
make test             # test-api (pytest) + bun run test (vitest)
make test-api         # pytest -q in services/api
```

Web tests use **Vitest** (`app/vitest.config.ts`) with `@testing-library/react` and jsdom.

---

## Doctrine Gates

```bash
make doctrine
# Runs:
#   scripts/check_model_licenses.py  — D2: model license compliance
#   scripts/check_promotion.py       — D5: promotion gate
#   scripts/check_ports.py           — D1: port registry
```

---

## Full CI Gate

```bash
make ci
# Runs: fmt-check → lint → typecheck → doctrine → test (all must pass)
```

---

## Security Headers (web)

Applied to every route by Next.js at the edge (`app/next.config.ts`):

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

---

## Deployment

### Web → Vercel (auto)

- Project: `gyf-v2-app`
- Git push to main triggers auto-deploy (Vercel Git integration)
- Framework detected: `nextjs` (via `vercel.json`)
- Manual prod deploy: `make deploy-web`
- Preview deploy: `make deploy-web-preview`

### API → Render (Docker)

- Service: `gyf-api` (free tier, Oregon region)
- Runtime: Docker; context = repo root; Dockerfile: `services/api/Dockerfile`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Health check: `GET /health`
- Auto-deploy: on push (`autoDeploy: true`)
- Config in `render.yaml` — secrets set in Render dashboard (never committed)

### ML / GPU Inference → HF ZeroGPU Spaces

- Space: `spaces/gyf-gpu` (skin-tone + body-type modules)
- Reached via `gradio-client` from the API (`photo-remote` extra)
- Set `GYF_SKINTONE_REMOTE_URL`, `GYF_BODY_REMOTE_URL`, `GYF_HF_TOKEN` in Render dashboard
- Burst capacity: **Modal** or **RunPod** (try-on)

### Database → Supabase (free tier)

- Postgres 16 + pgvector bundled
- 500 MB free; pgvector HNSW for item/outfit/user embeddings
- Migrate with session URL (`:5432`), not transaction pooler (`:6543`)

---

## ML Bake-off (encoder evaluation)

```bash
make m2-bakeoff       # builds gyf-ml-bakeoff image, runs encoder eval, writes to eval-reports/bakeoffs/
make m2-clean         # delete image + model-weight volume (reclaim disk)
```

---

## Service Ports (local)

| Service | Port |
|---------|------|
| Next.js web | 3000 |
| FastAPI API | 8000 |
| Postgres | 5432 |
| Redis | 6379 |
| Redpanda (Kafka) | 9092 |

---

## Python Extras Reference

### `services/api` (`gyf-api`)

| Extra | Pulls in |
|-------|----------|
| `postgres` | psycopg3 binary + pool |
| `migrate` | alembic + sqlalchemy |
| `kafka` | kafka-python |
| `photo-remote` | gyf-ml (light base) + gradio-client |
| `otel` | opentelemetry SDK + FastAPI instrumentation |
| `sentry` | sentry-sdk |
| `dev` | pytest + httpx + ruff |

### `ml/` (`gyf-ml`)

| Extra | Pulls in |
|-------|----------|
| `perception` | open-clip-torch, torch, transformers (Marqo-FashionSigLIP) |
| `postgres` | psycopg3 |
| `remote` | gradio-client (ZeroGPU lane, no torch) |
| `skintone` | pyfacer, torch (face detection + skin parsing) |
| `bodyshape` | torch, torchvision, transformers, timm, kornia, einops, rtmlib, onnxruntime |
| `dev` | pytest + ruff |

---

## Clean

```bash
make clean            # remove app/.next, .turbo, pytest caches, __pycache__
```

---

---

# Phase-Wise Development Plan

> **Design source:** Stitch project `GetYourFit Visual Redesign` (`projects/3973904041071905735`).
> Design system: **Industrial Intelligence** — dark-mode, monochrome industrial palette,
> Plus Jakarta Sans + JetBrains Mono, glassmorphism depth, Framer Motion interactions.
> Every phase maps to exactly one Stitch screen. Build the page, wire the API, ship it — then move on.

---

## Design System Tokens (apply once before Phase 1)

Before touching any page, install and configure the design system globally in `app/`.

### Colors (`tailwind.config.ts` extensions)

```ts
industrial: {
  void:     '#000000',   // base background
  surface:  '#111318',   // page bg
  'surface-low':    '#1a1b21',
  'surface-mid':    '#1e2025',
  'surface-high':   '#282a2f',
  'surface-highest':'#33353a',
},
primary:   '#ffffff',   // headlines, primary CTA
secondary: '#f0bd8f',   // AI insight accent (ochre/tan)
'slate-gray':  '#5A5A65',
'success-green':'#10B981',
'warning-amber':'#F59E0B',
```

### Typography

```ts
fontFamily: {
  sans: ['Plus Jakarta Sans', 'sans-serif'],
  mono: ['JetBrains Mono', 'monospace'],   // label-mono: AI metadata only
},
fontSize: {
  'display-hero': ['72px', { lineHeight: '1.1', letterSpacing: '-0.04em', fontWeight: '800' }],
  'headline-lg':  ['32px', { lineHeight: '1.2', fontWeight: '700' }],
  'headline-md':  ['20px', { lineHeight: '1.4', fontWeight: '600' }],
  'body-base':    ['16px', { lineHeight: '1.6' }],
  'body-sm':      ['14px', { lineHeight: '1.5' }],
  'label-mono':   ['12px', { lineHeight: '1',   letterSpacing: '0.05em', fontWeight: '500' }],
},
```

### Shape & Elevation rules

- **Border radius:** `4px` (`rounded`) for all cards/buttons — no pill shapes
- **Depth:** no box-shadows; use tonal surface layers + `backdrop-blur-xl` for glassmorphism
- **Glassmorphism card:** `bg-white/5 backdrop-blur-2xl border border-white/10`
- **Active/expanded state:** `ring-1 ring-white/10` inner glow
- **Hover (Framer Motion):** `scale: 1.02`, increase `backdropBlur` slightly
- **Grid:** 12-col desktop, 4-col mobile; gutter `1.5rem`; max-width `1280px`
- **Vertical rhythm:** `4rem` between major sections; number sections `01 / 02 / 03`

### Shared components to build first (before any page)

| Component | Description |
|-----------|-------------|
| `<BottomNav>` | 5-tab nav bar (Feed, Explore, Wardrobe, Social, Profile) |
| `<MonoLabel>` | `JetBrains Mono` uppercase badge — used for AI metadata everywhere |
| `<GlassCard>` | Base glassmorphism card wrapper |
| `<ConfidenceMeter>` | Horizontal bar showing AI confidence % |
| `<OccasionChip>` | Transparent + white-border / active solid-white chip |

---

## Phase 1 — Sign In / Login

**Stitch screen:** `GYF Login` · `screens/1fa01df179fc4ce0af6a513d5a424c25` · 780×1768px

### What the screen shows
Full-bleed dark auth page. GYF wordmark at top. Headline in `display-hero`. Social auth buttons (Google, Apple) as primary CTAs. Email/password fallback below. Footer links (Terms, Privacy). No navigation — standalone shell route.

### File targets
```
app/
  app/(auth)/
    login/
      page.tsx          ← Login page RSC shell
  components/auth/
    LoginForm.tsx        ← email + password form with validation
    SocialAuthButton.tsx ← Google / Apple OAuth buttons
  lib/
    supabase/
      client.ts          ← browser Supabase client (already exists or create)
      server.ts          ← server-side Supabase client for RSC
```

### Frontend tasks
- [ ] Create `(auth)` route group with its own layout (no bottom nav, no header)
- [ ] Build `LoginForm` — black bg, white text, `1px slate-gray` border inputs that turn white on focus, no shadows
- [ ] Build `SocialAuthButton` — rectangular (4px radius), solid white fill + black text for primary
- [ ] Animate form mount with Framer Motion `fadeInUp` (y: 20 → 0, opacity 0 → 1)
- [ ] Handle Supabase `signInWithOAuth` (Google, Apple) and `signInWithPassword`
- [ ] Redirect to `/onboarding` if profile incomplete, else `/feed`
- [ ] Add `<MonoLabel>` version tag (`v2.0`) in corner per design language

### API tasks
- [ ] `GET /profile/me` — returns `{onboarding_complete: bool}` to drive the post-login redirect

### Done when
User can sign in via Google OAuth or email/password and land on the correct next screen.

---

## Phase 2 — Onboarding Wizard · Step A (Photo / Body Setup)

**Stitch screen:** `Onboarding Wizard` · `screens/6f5fab6a90544583af8c219bf6c058f5` · 780×1824px

### What the screen shows
Step 1 of 2. Progress indicator at top (`01 / 02`). Photo upload zone (drag-and-drop + camera icon). Manual-entry toggle below ("skip, enter manually"). Body-type selector chips (Apple, Pear, Hourglass, Rectangle, Inverted Triangle). Height/weight inputs. `Continue →` CTA.

### File targets
```
app/
  app/(auth)/
    onboarding/
      page.tsx           ← Onboarding shell (multi-step state machine)
  components/onboarding/
    StepIndicator.tsx    ← "01 / 02" mono label progress bar
    PhotoUploadZone.tsx  ← drag-drop + file input, EXIF-stripped before upload
    BodyTypeSelector.tsx ← chip grid of 5 body types
    ManualMeasurements.tsx ← height/weight fields
```

### Frontend tasks
- [ ] Multi-step state machine in `page.tsx` (`step: 'body' | 'style'`)
- [ ] `StepIndicator` in `label-mono` uppercase (`STEP 01 / 02`)
- [ ] `PhotoUploadZone` — glassmorphism dashed-border drop zone; preview photo inline on select
- [ ] `BodyTypeSelector` — `OccasionChip` pattern (transparent → solid white on select)
- [ ] `ManualMeasurements` — industrial inputs, metric/imperial toggle
- [ ] Client-side image resize to ≤1280px before upload (canvas API)
- [ ] On submit: `POST /profile/photo` (multipart) or `PATCH /profile` (manual)

### API tasks
- [ ] `POST /profile/photo` — multipart; strips EXIF; dispatches to ZeroGPU body-shape Space; returns `{body_type, confidence}` (already exists in `app/main.py` — wire frontend to it)
- [ ] `PATCH /profile` — accepts manual `{body_type, height_cm, weight_kg}`

### Done when
User completes photo or manual body setup and advances to Step 2.

---

## Phase 3 — Onboarding Wizard · Step B (Style Preferences)

**Stitch screen:** `Onboarding Wizard` · `screens/ffe4432ed4e348c4a57b04dd34df734c` · 780×1786px

### What the screen shows
Step 2 of 2. Style vibe chips (Minimalist, Streetwear, Classic, Bohemian, Athleisure, etc.). Budget range slider. Occasion multi-select chips (Casual, Formal, Date Night, Work, Festive). "Finish & Meet Your Stylist →" CTA.

### File targets
```
app/
  components/onboarding/
    StyleVibeSelector.tsx    ← chip grid, multi-select
    BudgetRangeSlider.tsx    ← min/max dual-thumb slider, industrial styling
    OccasionSelector.tsx     ← reuses OccasionChip, multi-select
```

### Frontend tasks
- [ ] Style vibe multi-select chips — up to 3 selectable; selected chips flip to solid white
- [ ] Budget slider — custom styled, `label-mono` min/max labels, `secondary` (#f0bd8f) track fill
- [ ] Occasion chips — multi-select, same pattern
- [ ] On submit: `PATCH /profile` with `{style_vibes, budget_min, budget_max, occasions}`
- [ ] Mark `onboarding_complete: true` in profile
- [ ] Transition to `/feed` with Framer Motion exit animation (slide left)

### API tasks
- [ ] `PATCH /profile` — add `style_vibes: list[str]`, `budget_min/max: int`, `occasions: list[str]` fields to schema

### Done when
User finishes onboarding and sees the Stylist Feed for the first time. Cold-start recommendations fire immediately.

---

## Phase 4 — Stylist Feed (Primary View)

**Stitch screens:** `GYF Stylist Feed` · `screens/51b754d871834e23866130b88b81a971` (3254px) and `screens/7b4cb35fd13e4a2f882061cd7b0f2cdf` (3232px)

> Two screen variants exist — treat them as the same page at different scroll depths / states.

### What the screens show
The core product. Top bar: GYF wordmark + occasion chips row. Below: vertically stacked `OutfitCard` components. Each card shows:
- `MonoLabel` version tag top-left (`LAYER 01`)
- Stylist reason text (`body-sm`, secondary/ochre colour)
- 3-item garment grid (Top / Bottom / Footwear) with CDN images
- `ConfidenceMeter` bar (e.g. `STYLIZATION: 88%` in `label-mono`)
- Row of action icons: Save (bookmark), Skip (×), Try On (camera), Shop (bag)
- Tap card body → expands (Framer Motion layout animation) to reveal full AI reasoning

Bottom: `NL Goal Box` — command-line style input, placeholder `"I want to look..."`, `label-mono` font, bottom-border only.

Bottom navigation bar (persistent across all logged-in pages).

### File targets
```
app/
  app/(app)/
    feed/
      page.tsx            ← RSC: fetches first batch of outfits server-side
      FeedClient.tsx      ← client: infinite scroll, state, interactions
  components/feed/
    OutfitCard.tsx         ← collapsible card, full design-system treatment
    GarmentTile.tsx        ← single garment image + label
    ConfidenceMeter.tsx    ← labeled progress bar
    NLGoalBox.tsx          ← command-line text input at bottom
    OccasionChipsBar.tsx   ← horizontal scrollable chip row
    FeedActionBar.tsx      ← save / skip / try-on / shop icons
```

### Frontend tasks
- [ ] Create `(app)` route group with `<BottomNav>` layout
- [ ] `OutfitCard` — `GlassCard` base, collapsible with `layout` Framer Motion, `scale(1.02)` on hover
- [ ] `GarmentTile` — `next/image`, 0px radius, lazy load with blur placeholder
- [ ] `ConfidenceMeter` — `label-mono` label + animated fill bar on card mount
- [ ] `NLGoalBox` — fixed to bottom above nav; on submit dispatches `PATCH /profile` with NL goal then refetches feed
- [ ] `OccasionChipsBar` — horizontal scroll, `OccasionChip` pattern, filters feed on select
- [ ] Infinite scroll via Intersection Observer — load next page when last card 80% visible
- [ ] Optimistic save (bookmark icon fills immediately, API call in background)
- [ ] Skip interaction — card slides out left with Framer Motion exit animation
- [ ] Numbered section labels (`01`, `02`) on left spine per design system

### API tasks
- [ ] `GET /outfits/recommend?occasion=&limit=10&cursor=` — paginated; returns `OutfitCard[]` with `stylist_reason`, `confidence`, items with CDN `image_url`
- [ ] `POST /outfits/{id}/save` — saves outfit; emits `save` interaction event
- [ ] `POST /outfits/{id}/skip` — emits `skip` interaction event
- [ ] `GET /outfits/recommend` already partially exists — confirm pagination + cursor work

### Done when
User sees a personalized feed of complete outfits, can save/skip, set NL goal and occasion filter, and expand a card to read AI reasoning.

---

## Phase 5 — Social Feed

**Stitch screen:** `GYF Social Feed` · `screens/21c43ffaa6754f07a43270b0266632a1` · 780×3662px

### What the screen shows
Community discovery feed. Header: "SOCIAL" in `label-mono`. Cards show user-posted looks with avatar, username, follow button. Each post has: garment image(s), reaction bar (❤️ fire 🔥 save count), comment count, share. Trending looks section (`01 TRENDING`). Follow suggestions sidebar/section.

### File targets
```
app/
  app/(app)/
    social/
      page.tsx
      SocialFeedClient.tsx
  components/social/
    PostCard.tsx         ← user look post
    ReactionBar.tsx      ← fire / heart / save counts + tap to react
    FollowButton.tsx     ← follow / unfollow with optimistic state
    TrendingSection.tsx  ← numbered trending row
```

### Frontend tasks
- [ ] `PostCard` — same `GlassCard` pattern; avatar + username row at top; garment image below
- [ ] `ReactionBar` — emoji icons with count labels in `label-mono`; optimistic update on tap
- [ ] `FollowButton` — `OccasionChip` pattern: transparent border (not following) → solid white (following)
- [ ] `TrendingSection` — `01 TRENDING` mono label; horizontal scroll of trending look thumbnails
- [ ] Infinite scroll (same pattern as Feed)
- [ ] Share sheet: native Web Share API → fallback copy-link

### API tasks
- [ ] `GET /social/feed?cursor=` — returns posts from followed users + trending mix
- [ ] `POST /social/posts/{id}/react` — body `{reaction: 'fire'|'heart'|'save'}`
- [ ] `POST /social/follow/{user_id}` / `DELETE /social/follow/{user_id}`
- [ ] `GET /social/trending?limit=10` — top posts by reaction count in last 24h

### Done when
User can browse community looks, react, follow other users, and see trending posts.

---

## Phase 6 — Explore / Discovery · Browse State

**Stitch screen:** `Explore Discovery` · `screens/f95e49c5a3a946ca82695790fda15bee` · 780×4156px

### What the screen shows
Search-first discovery page. Search bar at top (industrial input: bottom-border only, `label-mono` placeholder). Below: category chips (Tops, Bottoms, Footwear, Accessories, Full Looks). Masonry grid of garment cards — each shows image, brand, price, a `MonoLabel` compatibility tag ("92% MATCH"). Trending styles section (`02 TRENDING STYLES`). Filter drawer (occasion, budget, brand, colour).

### File targets
```
app/
  app/(app)/
    explore/
      page.tsx
      ExploreClient.tsx
  components/explore/
    SearchBar.tsx         ← industrial borderless input
    CategoryChipRow.tsx   ← horizontal chip filter
    GarmentGrid.tsx       ← masonry grid with next/image
    GarmentCard.tsx       ← image + brand + price + match %
    FilterDrawer.tsx      ← slide-up bottom sheet
```

### Frontend tasks
- [ ] `SearchBar` — bottom-border only, `label-mono` placeholder `"SEARCH STYLES..."`, clear button
- [ ] Debounced search (300ms) → `GET /catalog/search?q=`
- [ ] `GarmentGrid` — CSS columns masonry, `gap-2`, images lazy-loaded
- [ ] `GarmentCard` — 0px radius on image, `MonoLabel` match badge top-right corner
- [ ] `FilterDrawer` — Framer Motion slide up from bottom; `OccasionChip` multi-select inside; budget dual-slider
- [ ] URL-driven filter state (`?category=&occasion=&budget_max=`) for shareability

### API tasks
- [ ] `GET /catalog/search?q=&category=&occasion=&budget_max=&cursor=`
- [ ] `GET /catalog/trending?category=` — trending items for the default state

### Done when
User can search, filter by category/occasion/budget, and browse garments with AI match scores.

---

## Phase 7 — Explore / Discovery · Item Detail State

**Stitch screen:** `Explore Discovery` · `screens/f413b6c2073f447ca13f2a6e04880ae1` · 780×4078px

### What the screen shows
Expanded item detail — same page, different state (tap a `GarmentCard` to open). Full-bleed garment image top. Brand / name / price. AI compatibility analysis panel (`GlassCard`): "WHY THIS WORKS" in `label-mono`, bullet reasons, `ConfidenceMeter`. Outfit context: "WEAR IT WITH" — 2 companion items shown. "ADD TO WARDROBE" and "SHOP NOW →" CTAs. Scroll down: similar items grid.

### File targets
```
app/
  components/explore/
    ItemDetailSheet.tsx      ← bottom-sheet or modal, Framer Motion layoutId transition
    CompatibilityPanel.tsx   ← GlassCard with AI reasoning bullets
    WearItWithRow.tsx        ← 2 companion garment tiles
```

### Frontend tasks
- [ ] Use Framer Motion `layoutId` on `GarmentCard` image → shared element transition into `ItemDetailSheet`
- [ ] `CompatibilityPanel` — glassmorphism card, `label-mono` header, secondary colour for reason bullets
- [ ] `WearItWithRow` — calls `GET /catalog/{id}/pairings` and renders 2 tiles
- [ ] "ADD TO WARDROBE" → `POST /wardrobe/items`
- [ ] "SHOP NOW" → external affiliate link (tracked via `POST /affiliate/click`)

### API tasks
- [ ] `GET /catalog/{id}` — full item detail incl. AI compatibility analysis
- [ ] `GET /catalog/{id}/pairings?limit=2` — companion items
- [ ] `POST /affiliate/click` — logs click event for attribution

### Done when
Tapping any garment card opens a full detail sheet with AI reasoning and a working shop link.

---

## Phase 8 — Fashion Profile

**Stitch screen:** `GYF Fashion Profile` · `screens/f6d936e8f7304334bc6ce5ad8015358b` · 780×6168px

### What the screen shows
User's identity page. Top: avatar, display name, `MonoLabel` style identity tag (e.g. `MINIMALIST · SMART CASUAL`), edit button. Stats row: Outfits Saved / Looks Created / Followers / Following (in `label-mono`). Style DNA section (`01 STYLE DNA`): visual breakdown of vibes, colour palette swatches, occasion distribution. Badge shelf (`02 ACHIEVEMENTS`): Fashion Mogger, Trendsetter, etc. as icon+label cards. Recent looks grid (`03 LOOKS`). Shared/public posts section.

### File targets
```
app/
  app/(app)/
    profile/
      page.tsx              ← own profile (RSC, authenticated)
      [username]/
        page.tsx            ← other user's public profile
  components/profile/
    ProfileHeader.tsx       ← avatar + name + style tag + edit
    StatsRow.tsx            ← 4 stats in label-mono
    StyleDNA.tsx            ← vibe bars + colour swatches + occasion pie
    BadgeShelf.tsx          ← badge cards
    LooksGrid.tsx           ← saved/created looks masonry
```

### Frontend tasks
- [ ] `ProfileHeader` — avatar upload (tap to replace), style identity tag in `MonoLabel`
- [ ] `StatsRow` — 4 items separated by `1px` vertical rules, `label-mono` values
- [ ] `StyleDNA` — colour swatches from user's saved items (computed server-side); vibe horizontal bars with `ConfidenceMeter` style fill; section number `01` left-aligned
- [ ] `BadgeShelf` — horizontal scroll; badges are earned (event-driven); locked badges greyed out
- [ ] `LooksGrid` — same masonry as Explore; tapping opens `ItemDetailSheet`
- [ ] Edit profile → sheet with name, avatar, style vibes, occasions (reuses onboarding components)

### API tasks
- [ ] `GET /profile/me` — own profile with style DNA + badge list
- [ ] `GET /profile/{username}` — public profile
- [ ] `GET /profile/me/looks` — saved + created looks paginated
- [ ] `GET /profile/me/badges` — earned badges with `earned_at`

### Done when
User sees their full style identity, DNA breakdown, badges, and looks grid.

---

## Phase 9 — Wardrobe

**Stitch screen:** `GYF Wardrobe` · `screens/fd1431592ec14d638ee30b1d50b14e5e` · 780×4348px

### What the screen shows
The user's personal wardrobe. Header: `"MY WARDROBE"` in `label-mono` + item count. Category tabs (All / Tops / Bottoms / Footwear / Accessories) as chips. Masonry grid of wardrobe items — each shows image, name, brand, `MonoLabel` category tag. Long-press / swipe → delete. "BUILD AN OUTFIT →" CTA that enters outfit composition mode. Wear-frequency heatmap section (`02 WEAR INSIGHTS`).

### File targets
```
app/
  app/(app)/
    wardrobe/
      page.tsx
      WardrobeClient.tsx
  components/wardrobe/
    WardrobeGrid.tsx         ← masonry grid of owned items
    WardrobeItem.tsx         ← image card with swipe-to-delete
    WearInsights.tsx         ← frequency heatmap / stats
    OutfitBuilderEntry.tsx   ← CTA card to enter builder
```

### Frontend tasks
- [ ] `WardrobeGrid` — category-filtered masonry; `MonoLabel` item count header
- [ ] `WardrobeItem` — swipe left (Framer Motion drag) reveals delete; tap opens item detail
- [ ] `WearInsights` — section `02`; simple bar chart of most-worn categories; no external charting lib (pure CSS bars)
- [ ] "BUILD AN OUTFIT" → navigate to `/feed?mode=build` or a dedicated composition sheet
- [ ] Empty state: glassmorphism prompt card "ADD YOUR FIRST PIECE →" linking to Explore

### API tasks
- [ ] `GET /wardrobe/items?category=&cursor=` — paginated wardrobe
- [ ] `DELETE /wardrobe/items/{id}`
- [ ] `GET /wardrobe/insights` — wear frequency by category

### Done when
User can view, filter, and remove their wardrobe items, and see basic wear insights.

---

## Phase 10 — Collections

**Stitch screen:** `GYF Collections` · `screens/89496a00367b4e5db64b6966213a23b4` · 780×6636px

### What the screen shows
Curated outfit collections — the deepest/richest scroll page (6636px). Section `01 MY COLLECTIONS`: user-created named collections (e.g. "Work Fits", "Weekend Vibes") shown as large cards with cover image + item count + `MonoLabel` tag. Tap → expands into full outfit list inside the collection. Section `02 CURATED FOR YOU`: AI-generated themed collections (e.g. "MINIMALIST SUMMER", "EVENING EDGE") — same card format but marked with `CURATED` badge. Section `03 TRENDING COLLECTIONS`: community's most-saved collections. "CREATE COLLECTION +" FAB.

### File targets
```
app/
  app/(app)/
    collections/
      page.tsx
      CollectionsClient.tsx
      [id]/
        page.tsx              ← individual collection detail
  components/collections/
    CollectionCard.tsx        ← large card: cover + name + count + tag
    CollectionDetail.tsx      ← expanded outfit list inside collection
    CuratedBadge.tsx          ← MonoLabel "CURATED" badge
    CreateCollectionSheet.tsx ← bottom sheet: name + pick outfits
```

### Frontend tasks
- [ ] `CollectionCard` — full-width card with `GlassCard` overlay on cover image; `MonoLabel` item count; section numbers `01 / 02 / 03`
- [ ] Tap collection → route to `/collections/[id]` with shared element transition on cover image
- [ ] `CollectionDetail` — full outfit list as vertical cards, same `OutfitCard` pattern
- [ ] AI-curated collections: `CURATED` badge in secondary (ochre) colour, `warning-amber` for beta disclaimer if applicable
- [ ] "CREATE COLLECTION +" FAB — fixed bottom-right; Framer Motion scale-in; opens `CreateCollectionSheet`
- [ ] `CreateCollectionSheet` — name input + pick from saved outfits (checklist)

### API tasks
- [ ] `GET /collections?type=user|curated|trending&cursor=`
- [ ] `GET /collections/{id}` — outfits in collection
- [ ] `POST /collections` — `{name, outfit_ids[]}`
- [ ] `PATCH /collections/{id}` — rename / add/remove outfits
- [ ] `DELETE /collections/{id}`
- [ ] `POST /collections/{id}/save` — save a curated/trending collection to own library

### Done when
User can browse their own, AI-curated, and trending collections, create new ones, and add outfits to them.

---

## Phase Sequence Summary

| Phase | Screen | Stitch ID | Height | Key unlock |
|-------|--------|-----------|--------|------------|
| DS | Design system tokens + shared components | — | — | Tokens, BottomNav, GlassCard, MonoLabel |
| 1 | GYF Login | `1fa01df1` | 1768px | Auth flow end-to-end |
| 2 | Onboarding Wizard — Body Setup | `6f5fab6a` | 1824px | Photo upload + body-type |
| 3 | Onboarding Wizard — Style Prefs | `ffe4432e` | 1786px | Cold-start personalisation data |
| 4 | GYF Stylist Feed | `51b754d8` + `7b4cb35f` | 3254px | Core product — outfit cards + AI reasoning |
| 5 | GYF Social Feed | `21c43ffa` | 3662px | Community + reactions + follow |
| 6 | Explore Discovery — Browse | `f95e49c5` | 4156px | Search + filter + catalog grid |
| 7 | Explore Discovery — Item Detail | `f413b6c2` | 4078px | Shared element transitions + affiliate |
| 8 | GYF Fashion Profile | `f6d936e8` | 6168px | Style DNA + badges + looks grid |
| 9 | GYF Wardrobe | `fd143159` | 4348px | Personal item management |
| 10 | GYF Collections | `89496a00` | 6636px | Curated + user collections |

### Completion gates (every phase must pass before moving on)

1. `make ci` passes (fmt + lint + typecheck + doctrine + tests)
2. Page matches Stitch design — verified with `make dev` in browser at 390px viewport
3. API endpoints responding with real data (no hardcoded mocks in prod paths)
4. Framer Motion interactions implemented (not deferred)
5. `MonoLabel` / `ConfidenceMeter` / `GlassCard` used correctly per design system rules

---

## Global Design Amendments

> These rules apply to **every phase** without exception. They override any conflicting detail
> in individual phase specs above. Review this section before starting any phase.

---

### Amendment 1 — No Emojis. SVGs Only.

Every icon, reaction indicator, status symbol, and decorative glyph across the entire app must
be a high-quality inline SVG or an SVG from a vetted icon library. No emoji characters anywhere
— not in buttons, reaction bars, badges, empty states, loading states, or copy.

**Library:** use `lucide-react` (already in `app/package.json`) for all utility icons.
For fashion-specific glyphs not in Lucide (hanger, outfit, try-on, swatch), create custom SVGs
in `app/components/icons/` as typed React components.

**Icon file structure:**
```
app/components/icons/
  Hanger.tsx          ← wardrobe / add to wardrobe
  OutfitStack.tsx     ← outfit card header
  TryOn.tsx           ← virtual try-on action
  Swatch.tsx          ← colour / style DNA
  StyleDNA.tsx        ← profile style section
  Fire.tsx            ← social reaction (replaces fire emoji)
  Spark.tsx           ← AI / intelligence indicator
  index.ts            ← barrel export
```

**Rules:**
- All SVGs must be `currentColor` so they inherit text colour and respond to dark/light context
- Size via `width` / `height` props with sensible defaults (`24` for actions, `20` for inline, `16` for labels)
- Never use `<img src="*.svg">` — always inline React SVG components for colour control
- Social reactions (fire, heart, save): replace with `Fire.tsx`, `Heart` (Lucide), `Bookmark` (Lucide)
- Badge icons on the Profile page: unique SVG per badge, stored in `app/components/icons/badges/`
- `BottomNav` tab icons: Lucide `Sparkles` (Feed), `Search` (Explore), `Archive` (Wardrobe),
  `Users` (Social), `User` (Profile) — all 24px, `currentColor`

---

### Amendment 2 — Mobile-First Layout (390px canonical viewport)

All pages are designed and tested at **390px wide** (iPhone 15 Pro). Desktop is a stretch
goal — mobile is the product.

**Viewport and meta:**
```tsx
// app/layout.tsx
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

**Layout rules per page:**
- Single-column layout everywhere; no side-by-side panels
- Container: `w-full max-w-[390px] mx-auto` — content never exceeds canonical width on any device
- Tap targets: minimum `44×44px` (WCAG 2.5.5); all icon buttons wrapped in `min-h-[44px] min-w-[44px]`
- Bottom navigation bar: `h-[64px]` + `pb-safe` (env safe-area-inset-bottom for notched phones)
- Fixed bottom elements (NL Goal Box, FAB, BottomNav): use `pb-[env(safe-area-inset-bottom)]`
- `OutfitCard` garment grid: `grid-cols-3 gap-2` within `w-full` — three items equal width
- `GarmentTile` images: `aspect-[3/4]` portrait ratio, `object-cover`, `w-full`
- Masonry in Explore / Wardrobe: `columns-2 gap-2` (CSS columns, no JS masonry library)
- Font scaling: `display-hero` caps at `48px` on mobile (override from 72px desktop definition)
- Touch gestures: horizontal scroll for chip rows — `overflow-x-auto scrollbar-none`
- Pull-to-refresh on Feed and Social: native scroll event listener, custom SVG spinner

**Mobile-specific Tailwind config additions:**
```ts
screens: { 'xs': '390px' }   // canonical mobile breakpoint
```

**Testing requirement:** every phase gate check must be done at 390px in Chrome DevTools
mobile emulation before being marked done.

---

### Amendment 3 — GYF Logo Presence Rules

The GYF logo must be **prominent and legible** wherever it appears. It is never small,
never faded, never used as a subtle watermark at reduced opacity in interactive UI.

**Logo component:**
```
app/components/brand/
  GYFLogo.tsx       ← primary logo SVG (wordmark)
  GYFMark.tsx       ← icon-only logomark (for tight spaces)
```

**Placement rules per screen:**

| Screen | Logo treatment |
|--------|---------------|
| Loading screen | Full wordmark, `GYFLogo`, centered, 200px wide, animated (see Amendment 5) |
| Login | `GYFLogo` at top, `min-w-[160px]`, white, full opacity |
| Onboarding (both steps) | `GYFMark` in top-left header, `40px` tall, never below `32px` |
| Stylist Feed | `GYFLogo` in top bar, `min-w-[80px]` — this is the primary app chrome |
| Social Feed | `GYFLogo` in top bar, same as Feed |
| Explore | `GYFLogo` in top bar, same as Feed |
| Profile | `GYFMark` as profile page header decorative element, `48px` |
| Wardrobe | `GYFLogo` top bar |
| Collections | `GYFLogo` top bar |
| BottomNav | Not in nav — logo lives in top bar only |

**Technical requirements:**
- `GYFLogo.tsx` must accept a `width` prop (default `120`) and render at that exact size
- Always `fill="currentColor"` or explicit `fill="#ffffff"` — never rely on inherited fill
- On coloured or image backgrounds, wrap in a `drop-shadow` filter for legibility
- The wordmark SVG path must be self-contained (no external font rendering)

---

### Amendment 4 — Animation Specification (All Pages)

Framer Motion is already in `app/package.json`. Every page and component must use the
animation patterns below. Nothing should snap in — everything transitions.

**Global animation variants (define once in `app/lib/animations.ts`):**

```ts
export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.25 },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
}

export const slideInRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -40 },
  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
}

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.07 } },
}
```

**Per-page animation requirements:**

| Page / Component | Animation |
|-----------------|-----------|
| Page transitions (all) | `slideInRight` via Next.js layout with `AnimatePresence` |
| Login — form fields | `staggerChildren` + `fadeUp` on each field, 70ms stagger |
| Login — CTA button | `scaleIn` delayed 0.3s |
| Onboarding steps | `slideInRight` between Step A → B; step indicator number animates count-up |
| Onboarding chips (body type, vibe) | `scaleIn` on select; deselect reverses |
| Feed — OutfitCard mount | `fadeUp` staggered per card (0.1s delay × index, capped at 5 cards) |
| Feed — OutfitCard hover | `whileHover: { scale: 1.02 }` + backdrop blur intensifies (`filter` transition) |
| Feed — OutfitCard expand | `layout` animation on the card; inner reasoning text `fadeIn` with 0.15s delay |
| Feed — Skip action | `x: -120, opacity: 0` exit, 0.25s |
| Feed — Save action | Bookmark SVG: `scale 1 → 1.3 → 1` spring on fill, `duration: 0.3` |
| Feed — ConfidenceMeter | Width animates from 0% → actual value on card entry, `duration: 0.8, ease: "easeOut"` |
| NL Goal Box | On focus: border opacity `0.3 → 1`, `duration: 0.2` |
| Social — PostCard mount | Same `fadeUp` stagger as feed cards |
| Social — ReactionBar tap | SVG icon `scale: 1 → 1.4 → 1` spring; count number animates up |
| Social — FollowButton | Background fill animates from transparent → white, `duration: 0.2` |
| Explore — SearchBar focus | Bottom border width `0 → 100%` sweep, `duration: 0.3` |
| Explore — FilterDrawer | `y: "100%" → 0` slide up from bottom, `duration: 0.35, ease: [0.22, 1, 0.36, 1]` |
| Explore — GarmentCard | `fadeUp` stagger with index in masonry |
| Item Detail — shared element | Framer Motion `layoutId` on garment image: seamless expand from grid card |
| Profile — StyleDNA bars | Each bar width animates `0 → value` on scroll-into-view (Intersection Observer) |
| Profile — Badge | `scaleIn` staggered; locked badges `opacity: 0.35`, no animation |
| Wardrobe — item entry | `fadeUp` stagger |
| Wardrobe — swipe to delete | `x: 0 → -80` drag constraint; confirm button `fadeIn` on threshold cross |
| Collections — CollectionCard | `fadeUp` stagger; cover image `scale: 1.03` on hover |
| Collections — expand transition | `layoutId` on cover image into full collection detail |
| Collections — FAB | `scaleIn` on mount; `whileTap: { scale: 0.92 }` |
| BottomNav — active tab | Active icon `scale: 1 → 1.15` spring + label fades in below |
| BottomNav — tab switch | `AnimatePresence` mode `wait` on active indicator underline |

**`AnimatePresence` wiring:**
```tsx
// app/layout.tsx  (app route group)
<AnimatePresence mode="wait">
  <motion.div key={pathname} {...slideInRight}>
    {children}
  </motion.div>
</AnimatePresence>
```

**Reduce motion:**
```ts
// app/lib/animations.ts — wrap all variants
import { useReducedMotion } from 'framer-motion'
// In components: if prefersReducedMotion, set duration: 0 and remove translate/scale
```

---

### Amendment 5 — Animated Loading Screen

**Stitch reference:** no dedicated Stitch screen — spec below is the authoritative design.

**Route:** `app/loading.tsx` (Next.js built-in loading convention) renders while any route
segment suspends. Additionally, a full-page `<SplashScreen>` component shows on first app
load (before hydration completes) controlled by `sessionStorage` — shows once per session.

**File targets:**
```
app/
  app/
    loading.tsx                   ← Next.js route-level loading UI
  components/brand/
    SplashScreen.tsx              ← full-page animated splash (session-once)
    FashionQuoteCarousel.tsx      ← rotating quote display
    GYFLogoAnimated.tsx           ← logo with draw-on SVG animation
```

---

#### Visual Design

**Layout (390px, full viewport height):**
```
┌─────────────────────────────┐  ← bg: #000000 (industrial-void)
│                             │
│                             │
│       ┌──────────────┐      │  ← GYFLogo animated wordmark
│       │  G Y F  →   │      │     width: 200px, centered
│       └──────────────┘      │     subtle horizontal draw-on animation
│                             │
│   ━━━━━━━━━━━━━━━━━━━━━━   │  ← 1px progress line, left-to-right sweep
│                             │     secondary (#f0bd8f) colour
│                             │
│  "Fashion is the armor to   │  ← Quote text, body-sm, on-surface-variant
│   survive the reality of    │     (#c4c7c8), centered, max-w-[280px]
│   everyday life."           │
│                             │
│   — Bill Cunningham         │  ← Attribution, label-mono, 0.5 opacity
│                             │
│                             │
│        [ • · · · ]          │  ← 3-dot indicator: active dot is white,
│                             │     others slate-gray — rotates with quotes
└─────────────────────────────┘
```

**GYF logo animation (`GYFLogoAnimated.tsx`):**
- SVG path `stroke-dasharray` + `stroke-dashoffset` draw-on from left to right
- Duration: `1.2s`, ease `[0.22, 1, 0.36, 1]`
- After draw: `opacity` of fill fades in `0 → 1` over `0.4s`
- Logo is pure white, `200px` wide, centered

**Progress line:**
- Full-width `1px` horizontal line below the logo
- Framer Motion `scaleX: 0 → 1` from `transformOrigin: "left"`
- Duration: matches estimated load time (default `2s`); colour `#f0bd8f` (secondary)
- On completion: `opacity: 1 → 0` fade out

**Quote rotation:**
- Quotes rotate every `3.5s` when loading persists beyond first quote
- `AnimatePresence mode="wait"`: current quote exits `fadeUp` reversed, next enters `fadeUp`
- Attribution animates in with `0.15s` delay after quote text

---

#### Fashion Quotes Bank

Store in `app/lib/fashionQuotes.ts` — rotate randomly, never repeat consecutively:

```ts
export const fashionQuotes = [
  {
    quote: "Fashion is the armor to survive the reality of everyday life.",
    author: "Bill Cunningham",
  },
  {
    quote: "Style is a way to say who you are without having to speak.",
    author: "Rachel Zoe",
  },
  {
    quote: "Elegance is not about being noticed, it's about being remembered.",
    author: "Giorgio Armani",
  },
  {
    quote: "Clothes mean nothing until someone lives in them.",
    author: "Marc Jacobs",
  },
  {
    quote: "Fashion is about dressing according to what's fashionable. Style is more about being yourself.",
    author: "Oscar de la Renta",
  },
  {
    quote: "The most beautiful thing you can wear is confidence.",
    author: "Blake Lively",
  },
  {
    quote: "In difficult times, fashion is always outrageous.",
    author: "Elsa Schiaparelli",
  },
  {
    quote: "You can have anything you want in life if you dress for it.",
    author: "Edith Head",
  },
  {
    quote: "Fashion is what you buy. Style is what you do with it.",
    author: "Unknown",
  },
  {
    quote: "Dress how you want to be addressed.",
    author: "Unknown",
  },
  {
    quote: "A woman who wears no perfume has no future.",
    author: "Coco Chanel",
  },
  {
    quote: "Buy less. Choose well. Make it last.",
    author: "Vivienne Westwood",
  },
  {
    quote: "Fashion is not something that exists in dresses only. Fashion is in the sky, in the street.",
    author: "Coco Chanel",
  },
  {
    quote: "Simplicity is the keynote of all true elegance.",
    author: "Coco Chanel",
  },
  {
    quote: "When in doubt, wear red.",
    author: "Bill Blass",
  },
  {
    quote: "The dress must follow the body of a woman, not the body following the shape of the dress.",
    author: "Hubert de Givenchy",
  },
  {
    quote: "One is never over-dressed or under-dressed with a Little Black Dress.",
    author: "Karl Lagerfeld",
  },
  {
    quote: "Don't be into trends. Don't make fashion own you, but you decide what you are.",
    author: "Gianni Versace",
  },
  {
    quote: "Fashion is about something that comes from within you.",
    author: "Ralph Lauren",
  },
  {
    quote: "Luxury must be comfortable, otherwise it is not luxury.",
    author: "Coco Chanel",
  },
]
```

---

#### `SplashScreen.tsx` behaviour

```
1. Renders immediately on first session load (check sessionStorage['gyf_splash_shown'])
2. GYFLogoAnimated draws on — duration 1.2s
3. Progress line sweeps left-to-right — duration 2s
4. First quote fades up — starts at 0.8s (overlapping with logo)
5. If app loads in < 2s: hold splash until 2s minimum, then exit
6. If app loads in > 2s: quotes keep rotating every 3.5s until load completes
7. Exit: full-page `opacity: 1 → 0` over 0.4s, then unmount
8. Set sessionStorage['gyf_splash_shown'] = true so it doesn't repeat in same session
```

#### `loading.tsx` (route-level, shows during navigation)

Simpler version — no full splash:
```
- GYFMark (icon-only logomark), 48px, centered vertically
- Pulses: `opacity: 0.4 → 1 → 0.4` repeat, duration 1.2s
- Progress line at very top of viewport (like GitHub/YouTube top bar)
  width: 0 → 85% over 1.5s (indeterminate), colour #f0bd8f
- No quote carousel (too distracting for mid-session navigation)
```

---

### Amendment 6 — Completion Gates (Updated)

All previous completion gates apply. Add these:

6. Zero emoji characters in the page — grep check: `grep -r "[\u{1F000}-\u{1FFFF}]" app/` returns nothing
7. All icons render as SVG components — no `<img>` tags for icons
8. GYF logo meets minimum size per Amendment 3 table
9. Page tested at 390px in Chrome DevTools — no horizontal overflow (`document.body.scrollWidth === 390`)
10. `prefers-reduced-motion` checked — animations disable gracefully
11. Loading screen verified: logo draws on, quote appears, progress line sweeps, exits cleanly
