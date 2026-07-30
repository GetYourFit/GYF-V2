# Production surface ownership inventory (2026-07-30)

Status: evidence-backed cleanup slice. This inventory is an ownership record, not a deletion
approval. It was built from the Expo/Next route trees, FastAPI OpenAPI, generated OpenAPI types,
workflow/deployment configuration, deep-link configuration and route/test references. The audit
sources are `data/gyf-legacy-architecture-audit/report.md` and
`data/gyf-hard-launch-market-technical-research/report.md` (read-only evidence).

The release guard is `scripts/check_production_surfaces.py`; it is included in `make doctrine` and
Expo production export (`apps/expo/package.json`). `make types` regenerated the generated API
contract after hiding the local-only gallery from OpenAPI.

## Client routes

### Expo Router — primary iOS/Android/web client

| Route | Source | Ownership classification |
|---|---|---|
| `/` | `src/app/(app)/(tabs)/index.tsx` | authenticated product: Stylist complete-outfit decision |
| `/explore` | `src/app/(app)/(tabs)/explore.tsx` | authenticated product: catalogue browse/search |
| `/wardrobe` | `src/app/(app)/(tabs)/wardrobe.tsx` | authenticated product: owned garments |
| `/social` | `src/app/(app)/(tabs)/social.tsx` | authenticated product: social feed |
| `/profile` | `src/app/(app)/(tabs)/profile.tsx` | authenticated product: profile/badges |
| `/account` | `src/app/(app)/account.tsx` | authenticated product: consent/export/deletion |
| `/saved`, `/collections` | `src/app/(app)/saved.tsx`, `collections.tsx` | authenticated product: saved looks/items; collections is a protected compatibility re-export |
| `/canvas` | `src/app/(app)/canvas.tsx` | authenticated product: Lookspace with accessible list fallback |
| `/onboarding`, `/personal-fit` | `src/app/(app)/onboarding.tsx`, `personal-fit.tsx` | authenticated product: manual onboarding/editable profile |
| `/status` | `src/app/(app)/status.tsx` | authenticated product/trust: runtime capability status |
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/welcome` | `src/app/(auth)/*` | public/auth product: auth and recovery |
| `/contact`, `/grievance`, `/terms` | `src/app/(public)/*` | public product/trust: support, grievance, legal |
| `/design` | `src/app/design.tsx` | **local review only**; production returns feature-unavailable and may not render fixtures |
| `+not-found`, `error`, `loading`, `+html`, `+middleware`, `__deployment+api` | `src/app/*` | runtime/platform/evidence support, not product routes |

The deep-link scheme is `gyf` in `apps/expo/app.json`; the EAS web production alias is configured
by `.github/workflows/cd.yml` and its immutable deployment verifier. No production deep link points
to `/design`. The design-review JPEGs under `apps/expo/assets/design-review/` and fixture data under
`apps/expo/src/design-fixtures/` remain protected evidence/test assets.

### Next.js — temporary behavioural oracle/rollback client

| Route | Source | Ownership classification |
|---|---|---|
| `/` | `app/app/(app)/page.tsx` | compatibility/rollback product oracle: Stylist |
| `/explore`, `/wardrobe`, `/social`, `/profile`, `/saved`, `/collections`, `/account`, `/onboarding`, `/contact`, `/grievance`, `/status` | `app/app/(app)/*` | compatibility/rollback product surfaces; retain until parity/F13 |
| `/canvas` | `app/app/canvas/page.tsx` | compatibility/rollback Lookspace; protected until parity/F13 |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | `app/app/(auth)/*` | compatibility/rollback auth |
| `/api/health` | `app/app/api/health/route.ts` | approved operational compatibility probe |
| `/design` | `app/app/design/page.tsx` | **temporary review only**; production calls Next `notFound()` |
| `not-found`, `error`, `global-error`, `loading` | `app/app/*` | runtime/platform support |

`app/` and `vercel.json` are protected rollback surfaces. `app/proxy.ts` deliberately leaves the
review route reachable for local review while the route itself fails closed in production. No Next,
Flutter, VTON, provider, fallback, migration, social, wardrobe, privacy, commerce or evidence path
is retired by this slice.

## FastAPI API ownership

The generated contract now contains **43 OpenAPI paths / 55 operations** in
`packages/types/src/api.ts` and `packages/types/openapi.json`. Product and authenticated paths are
owned by the modular monolith contexts below; `/gallery` is deliberately not in OpenAPI.

| Paths | Methods | Classification / owner |
|---|---|---|
| `/health`, `/ready`, `/me` | GET; GET; GET | approved operational/liveness, readiness, authenticated identity (`system`) |
| `/items/browse`, `/items/search`, `/items/facets`, `/items/{item_id}/similar` | GET | public/authenticated product catalogue (`catalog`) |
| `/profile`, `/profile/photo`, `/consent`, `/profile/summary` | GET/PUT; POST; GET/PUT; GET | authenticated product identity/consent/profile (`profile`) |
| `/account`, `/account/export` | DELETE; GET | authenticated privacy/account lifecycle (`profile`) |
| `/outfits/recommend`, `/outfits/complete`, `/outfits/alternates` | GET | authenticated product Stylist decision core (`recommendations`) |
| `/feedback` | POST | authenticated product learning/event mutation (`feedback`) |
| `/collections`, `/collections/{item_id}`, `/collections/outfits`, `/collections/outfits/{outfit_id}` | GET/POST; DELETE; GET/POST; DELETE | authenticated product saved items/looks (`collections`) |
| `/wardrobe/items`, `/wardrobe/items/{wardrobe_id}` | GET/POST; DELETE/PATCH | authenticated product wardrobe (`wardrobe`) |
| `/social/posts`, `/social/posts/{post_id}/react`, `/social/posts/{post_id}/recreate`, `/social/posts/{post_id}/report` | GET/POST; POST/DELETE; POST; POST | public/authenticated product social and moderation (`social`) |
| `/social/follows`, `/social/follows/{user_id}`, `/social/blocks`, `/social/blocks/{user_id}` | GET; PUT/DELETE; GET; PUT/DELETE | authenticated product social graph/privacy (`social`) |
| `/support/messages` | POST | public/authenticated approved support/grievance (`support`) |
| `/system/status` | GET | approved public trust/status operational surface (`system`) |
| `/system/models` | GET | approved operational model-lane/status surface; no secrets (`system`) |
| `/tryon`, `/tryon/jobs`, `/tryon/jobs/{job_id}`, `/tryon/jobs/{job_id}/image`, `/tryon/jobs/{job_id}` | POST; GET; GET; GET; DELETE | authenticated product capability, **closed by F9 flag**, durable job/rollback owner (`tryon`) |
| `/cuelinks/campaigns`, `/cuelinks/campaigns/eligible`, `/cuelinks/campaigns/{merchant_key}` | GET | approved operational/catalogue-ingestion support (`cuelinks`) |
| `/cuelinks/links/convert`, `/cuelinks/links/preview` | POST; GET | authenticated/product commerce attribution; preview is explicitly non-authenticated (`cuelinks`) |

Additional FastAPI runtime surfaces not represented as generated product operations are `/` (docs
redirect), `/docs`, `/redoc`, `/metrics`, `/media` when configured, and local-only `/gallery`.
`/docs`, `/redoc`, `/metrics` are approved operational surfaces; `/media` is read-only catalogue
serving and is absent when no directory exists. `/gallery` remains test/review only: outside
`GYF_ENV=local`, it returns a security-header-protected 404 and is excluded from OpenAPI/types.

## Contracts, workflows, tests and deployment references

- `packages/types/src/api.ts` and `packages/types/openapi.json` are generated from FastAPI; the
  guard rejects a future `/gallery` contract reappearance. They are not hand-edited.
- `services/api/tests/test_security_headers.py` proves local gallery availability, production 404,
  OpenAPI exclusion, and baseline headers. Existing API route/context tests remain owners for all
  product, privacy, social, wardrobe, commerce, fallback, event, migration and try-on contracts.
- `apps/expo/src/lib/review-surface.test.ts` proves development opt-in and production rejection;
  `src/design-fixtures/*` continues to test review compositions without making them product data.
- `.github/workflows/ci.yml` runs Expo Doctor, API/Expo/web checks and doctrine. `.github/workflows/
  cd.yml` deploys only Expo web plus the Virginia API workflow path; its EAS verifier owns security
  headers, immutable deployment identity and rollback evidence. Data export, purge, try-on worker,
  catalogue-plan and keepalive workflows remain operational/evidence owners.
- `render.yaml` documents the Virginia FastAPI service and keeps the existing CORS/rollback
  references. `vercel.json` and `app/` remain compatibility/rollback until the protected F13 gate.
- `apps/expo/app.json` owns the `gyf` native deep-link scheme and Expo server headers. No workflow,
  static export or release configuration adds a production `/design` or `/gallery` link.

## Deferred candidates with ownership and rollback records

No candidate beyond `/design` and `/gallery` is deleted here. The audit records callers, contracts,
deployment references, tests, requirements, replacement and rollback for: Next/Expo transport
ownership; Flutter; encoder lab/custody/serving lanes; FASHN/fal VTON adapters; Shopify/Cuelinks
catalogue sources; Explore/Canvas virtualization; duplicate API/profile boundaries; historical
migrations/schema; research/evaluation modules; and stale architecture prose. Their protected
requirements and deletion proof remain in the audit and subordinate launch ledger. Any retirement
requires a named gate, protected behaviour evidence, a same-slice replacement and rollback before
F13 approval.

## Local validation record

- `make install` completed cleanly; Expo Doctor passed all 17 checks.
- `make ci` passed: formatting, typecheck, doctrine, standards, 591 API tests / 26 environment-gated
  skips, 276 Expo tests, 81 web tests, and workflow/repo-hygiene/ownership/security/model-license/
  promotion/ports/doc-alignment checks. Existing warnings remain: 8 API framework/test-key warnings,
  one Next raw-`<img>` lint advisory, and existing Vite/Rolldown/React `act(...)` test notices.
- FastAPI/OpenAPI and generated types both measure 43 paths / 55 operations; `/gallery` is absent from
  the generated contract. Local API tests prove `/gallery` remains available in local mode, returns
  404 outside local, and retains the security header set.
- Expo production export and marker assertion pass. The production entry bundle is 2,840,603 bytes;
  the existing 2,700,000-byte web budget remains exceeded, so the bundle-budget gate is a blocker and
  no launch claim is made. The budget script now understands the current `dist/client` export layout.
- A standalone Next production build passed before the final proxy-only gate adjustment; the follow-up
  build was environment-killed (exit 137) during TypeScript while another worktree's Expo build was
  consuming host resources. Web typecheck/lint passed, and the source guard covers the proxy gate;
  rerun the production server probe when review capacity/resources permit.
- No no-mistakes review/PR run was started because the requested review runtime quota is unavailable.
  No merge or push was performed.
