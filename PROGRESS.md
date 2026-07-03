# GYF — PROGRESS LEDGER (append-only, single source of session context)

> **Contract:** This file is the single source of truth for session context. Every working
> session MUST (1) read this file first, (2) append what was asked, decided, and done —
> **never delete or rewrite past entries**, only append. Newest entries at the bottom.
> Standing directives live in §1 and are amended, never removed (strike through if revoked).

---

## 1. Standing directives from the user (permanent)

1. **Principal-engineer bar** — operate like a principal engineer at a top AI company/FAANG.
   Expert-grade, production-grade, never "college-project" work. No noob mistakes.
2. **Boil the ocean** — do the whole thing, with tests, with documentation. Never offer to
   table something when the permanent solve is within reach. Never a workaround when the real
   fix exists. The standard is "holy shit, that's done", not "good enough".
3. **Use subagents, loop engineering, ECC skills, and ponytail** aggressively on every
   substantial task: parallel specialist reviews, audit→fix→verify loops, ponytail for
   over-engineering audits.
4. **Plan before execution** — always surface the plan first, then implement it.
5. **Commit and push everything** once verified — conventional commits, scoped, **no AI
   attribution trailers**.
6. **Novel-app mindset** — GYF is novel; prefer researched, high-IQ solutions with explicit
   trade-offs, not just pretraining defaults. Clean, robust, secure, efficient, optimized,
   aesthetic — never compromised.
7. **CI/CD, security, efficiency, optimization always on point** — every push must pass the
   full gate (fmt, lint, typecheck, tests, doctrine license/ports gates).
8. **Maintain this ledger** — append every user ask, decision, and change here, every session.
9. **Contact email** — `gyf1ltd@gmail.com` is THE public contact for the whole app.
10. **Real verification, no fakes** — validate with real models/data/stacks, never stubs
    masquerading as verification. Milestone not done until built AND verified (DoD hard gate).
11. **PROGRESS.md is the external context window** (added 2026-07-02) — read it first,
    trust it over re-derivation, append every change, never duplicate its content into
    other stores; duplicated or purposeless docs/lines are deleted (git history suffices);
    never do work twice.

## 2. Where everything else lives (read in this order on session start)

- `PROGRESS.md` (this file) — session ledger + standing directives.
- `CLAUDE.md` — operating guide; §0.5 = current status snapshot (keep in lockstep).
- `docs/roadmap.md`, `docs/plans/gyf-v2-launch-program.md` — build order + launch program.
- `docs/engineering-doctrine.md` — binding design law (ports, license gate, real data, eval-gated).
- Auto-memory (`~/.claude/.../memory/MEMORY.md`) — machine-local session facts.

---

## 3. Session log (append below — never edit above entries)

### 2026-07-02 — Full-repo audit → hardening → follow graph (session: ponytail + 5 subagents)

**User asked:**

- Install + use ponytail; pull everything; complete audit of the codebase → clean, efficient,
  production-grade; then the highest-IQ next move.
- Cuelinks affiliate signup is ON HOLD until registered email `gyf1ltd@gmail.com` is visible on
  https://www.getyourfit.tech → publish it as the app-wide contact.
- "Is GYF complete — is only Cuelinks left?" → verify against ALL markdown requirement docs.
- Standing directives above (§1) restated repeatedly; added plan-before-execute and this ledger.

**Audits run (subagents):** ponytail whole-repo over-engineering audit; ecc:react-reviewer
(app/); ecc:fastapi-reviewer (services/api); ecc:security-reviewer (whole repo);
ecc:mle-reviewer (ml/ + ML-facing API); Explore agent (docs-vs-code requirements gap matrix).
False positives rejected after verification: ML "photo overwrites manual" (documented intent),
`_pgvector` triplication + embedding-dim promotion gate noted as follow-ups (not live defects).

**Shipped (commits `5d686a8..1e71aa7`, all pushed to origin/main):**

- `5d686a8` chore(web): dead code −1,490 lines (unused animations.ts, 7 unused icons + barrel,
  stray root execution.md + logo PNG; design brief → docs/feedbacks/gyf-feedback-v3-design.md).
- `a987e5b` fix(web): SplashScreen render purity; useCountUp set-state-in-effect; Explore sort
  dropdown missing "Relevance" (real UX bug); ItemDetailSheet exit animation never played
  (kept mounted, gated on item); onboarding FieldWrap now real `<label htmlFor>` via useId
  (WCAG 1.3.1/4.1.2); typographic apostrophes (fixed pre-existing failing test); dead imports;
  Prettier normalization of S6 design-pass files.
- `180cf3b` feat(web): CONTACT_EMAIL=`gyf1ltd@gmail.com` in `app/lib/contact.ts`; surfaced on
  public auth footer (login/signup — visible unauthenticated for Cuelinks verification) +
  account page "Contact & support" section.
- `3648e5d` feat(api): SecurityHeadersMiddleware (pure ASGI) — nosniff, frame-deny, CSP
  frame-ancestors, referrer-policy, COOP on every response; HSTS outside local. +5 tests.
- `3565647` fix(api): photo onboarding decode+inference offloaded to threadpool (was blocking
  the event loop for seconds per remote GPU call — availability risk).
- `447d577` fix(api): offset caps (le=10k) on search/similar; rate limit on /similar; LIMIT 500
  on collections/saved-outfits/wardrobe list queries.
- `2a98df3` docs: CLAUDE.md §0.5 + roadmap synced to verified reality (they claimed "app/ is a
  marketing landing page only" and "M2 pending" — both false; M2 ✅, full surface deployed).
- `0916a97` feat(social): **FOLLOW GRAPH** — migration 0008 `follows` (PK-idempotent,
  self-follow CHECK, RLS follower-owned, cascades for erasure); repo follow/unfollow/following +
  author-scoped feed (FK violation = existence check, no extra query); endpoints
  PUT/DELETE `/social/follows/{id}` (422 self, 404 unknown), GET `/social/follows`,
  `GET /social/posts?scope=following`; frontend For-you/Following toggle, real Follow/Following
  button (was a dead click!), optimistic toggle with revert, hidden on own posts, /me identity.
  5 new API tests. Render entrypoint runs `alembic upgrade head` → 0008 auto-applies on deploy.
- `1e71aa7` chore(types): api.ts regenerated from OpenAPI (FE/BE lockstep).

**Gates at end of session:** Prettier ✓ ESLint ✓ tsc ✓ web vitest 24/24 ✓ API pytest 182 ✓
ruff ✓ doctrine license gate ✓ ports gate ✓. Everything pushed.

**Requirements gap matrix (2026-07-02 audit verdict — GYF is NOT "complete except Cuelinks"):**

- BUILT+WIRED: auth, manual onboarding, outfit generation + explanations + confidence,
  diversity, NL goals, occasion, region-aware, feedback loop, collections/saved looks, wardrobe,
  Explore search/facets, buy-redirect, social posts/reactions/recreate, profile+badges,
  account/consent/erasure, **follow graph (this session)**.
- DEGRADED on prod: photo onboarding (Render lacks GPU runtime → modules abstain unless
  GYF_SKINTONE_REMOTE_URL/GYF_BODY_REMOTE_URL/GYF_HF_TOKEN set + Space live); skin-tone
  fairness gate is owner-overridden to "true" in render.yaml (Monk eval not yet passed).
- MISSING (the real remaining work):
  1. **Virtual try-on (M9)** — zero code; needs TryOnRenderer port + licensed model at
     inference + UI. Headline Phase-1/2 feature.
  2. **Affiliate attribution** — raw buy_url redirect only; blocked on Cuelinks approval →
     then build CatalogFeedPort connector (real prices/buy URLs unlock the inert price filter
     - revenue + D4 flywheel). USER ACTION: reply to Cuelinks with the site URL once deployed.
  3. **Wardrobe-aware recommendations** — wardrobe stored but recsys never reads it ("styles
     around your real closet" unrealized).
  4. **M8.5 operator trust surface**; **M12 beta hardening**; B2B engine (P5, post-launch).
- Data gap: prod catalog prices are all NULL (academic seed) — price filter inert until real
  affiliate feed. Design feedback v3 (curved corners, logo everywhere, palette) partially
  applied; verify visually next design pass.

**Key decisions this session:**

- Defensive LIMIT over full pagination for per-user lists (YAGNI until a client pages).
- Follow existence check via FK violation, not a pre-query (one round trip, race-free).
- ItemDetailSheet stays mounted (AnimatePresence owns enter/exit) — pattern to reuse for sheets.
- Curly apostrophes standardized in UI copy (matches tests + avoids JSX escaping).

**Next highest-IQ moves (ranked):**

1. USER: answer Cuelinks (site URL + promo plan) → unblocks W-DATA.
2. Build CatalogFeedPort + Cuelinks connector (untrusted-feed validation, SSRF-safe image
   loader, currency-normalized prices) the moment the account clears.
3. Wardrobe-aware recsys conditioning (real "dress around what you own").
4. Try-on M9: pick licensed inference model, TryOnRenderer port, ZeroGPU Space, UI.
5. M3/M4 GPU lane on prod (set the three Render env vars once Space is funded/live).

### 2026-07-02 (later) — PROGRESS.md promoted to THE context window; doc dedup sweep

**User asked:** Use PROGRESS.md as the single external context window — never rebuild
context internally or in auto-memory when it already lives here; always update it on every
change; remove all duplicated docs and any content without a purpose (every line must earn
its place); never do work twice. Restated §1 directives (novel/expert/no-noob-mistakes,
boil-the-ocean, commit+push) — already codified above, no change needed. Re-asked "is GYF
complete except Cuelinks?" — answer unchanged from this morning's gap matrix (§ above):
NO — try-on (M9), affiliate attribution, wardrobe-aware recsys, M8.5/M12 remain.

**Standing directive added to §1 (amendment): 11. PROGRESS.md is the external context
window** — read it first, trust it over re-derivation for session context, append every
change, never duplicate its content into other stores.

**Shipped (docs dedup):**

- Deleted `docs/plans/CONTINUE-HANDOFF.md` — its handoff role is superseded by this ledger;
  its unique §4 Editorial-Noir design spec was inlined into
  `docs/plans/gyf-v2-launch-program.md` S1 (the one place that referenced it).
- Deleted `docs/vision/drafts/` (ideas.md, ideas.V2.md) — pure duplicates folded into
  `ideas-complete.md` long ago; git history preserves them. Updated CLAUDE.md repo map/
  precedence, ideas-complete.md maintenance note, tech-stack.md §223 citation.

### 2026-07-03 — Wardrobe-aware recommendations (closet-anchored styling) ✅

**User asked:** re-audit "is GYF complete except Cuelinks?" (answer unchanged: NO — see the
2026-07-02 gap matrix), then continue with the highest-IQ unblocked move while Cuelinks
approval waits. Also: never add AI attribution trailers to commits.

**Shipped — "styles around your real closet" is now real (gap #3 closed):**
- `CandidateRepository.candidates_by_ids` (Postgres `WHERE id = ANY` over the shared SELECT;
  no region/price predicates — you already own these) + `Candidate.owned` flag.
- Service `_ground_in_wardrobe`: the 12 most recent catalog-referenced wardrobe rows resolve
  to full candidates, are flagged owned, and are injected at the front of their slot pools —
  looks get *built around* owned garments. Freeform/stale rows abstain (D6). Empty wardrobe →
  byte-identical recommendation (test-pinned).
- `compose.WardrobeContext` + `wardrobe_fit` (blend weight 0.25, applied last like goals):
  0.5 × **anchor** (any owned garment in the look; one anchor = full credit — an anchored look
  plus new pieces is the reuse+commerce sweet spot, all-owned is not rewarded more) +
  0.5 × **versatility** (new coloured pieces scored by best CIELAB harmony against the owned
  palette — purchases must pair with the closet, never orphans).
- Explanations name the grounding honestly: "Built around the <garment> you already own." /
  "It pairs easily with pieces already in your wardrobe." (only at fit ≥ 0.85).
- API surface: `OutfitItem.owned`, `OutfitRecommendation.wardrobe_grounded` (transparency §7);
  router passes the wardrobe repo; api.ts regenerated (FE/BE lockstep).
- Web: "You own this" badge on outfit-card tiles + outfit-detail rows; owned garments show no
  price and no buy link; shop-the-look skips owned items.
- Tests: 7 new (anchor beats unanchored, palette versatility, byte-identical no-wardrobe,
  service grounding + explanation, freeform/stale abstention, endpoint badge, by-ids lookup).

**Also fixed (pulled main was CI-red):** `top-menu.tsx` react-hooks/set-state-in-effect ×2 —
mounted flag → `useSyncExternalStore` hydration snapshot; close-on-navigation → render-time
state adjustment (React docs pattern), no post-commit re-render.

**Gates:** API pytest 189 ✓ ruff ✓ web ESLint/tsc/vitest 24 ✓ Prettier ✓ license gate ✓
ports gate ✓. Env notes: uv needs `UV_CACHE_DIR=$PWD/.uv-cache` (~/.cache unwritable);
`make types`' bunx cannot write its tempdir — use
`node node_modules/.bun/node_modules/openapi-typescript/bin/cli.js`; strip the telemetry log
line that leaks into openapi.json line 1.

**Remaining gap matrix after this session:** try-on (M9), affiliate attribution (Cuelinks —
waiting on approval), M8.5 operator trust surface, M12 beta hardening, prod GPU-lane env vars.

### 2026-07-03 — M8.5 operator/user trust surface ✅ + ZeroGPU body lane verified live

**User asked:** ZeroGPU is the GPU lane; nothing may stay degraded — continue development.

**Shipped — `/system/status` + `/status` (the M8.5 trust surface, gap #4 closed):**
- `GET /system/status` (no auth — transparency is the point; no secrets/URLs/user data):
  per-capability honest state (`live/beta/shadow/degraded/planned`) derived from real
  runtime state (remote-lane config, installed runtimes, DB reachability, the
  eval-reports fairness-gate artifact), plus catalog aggregate health (items/embeddings/
  prices/images) and the event sink. Never 500s: an unreachable DB is itself a status.
- Web `/status` page rendering the report; linked from the top menu ("System Status").
- Types regenerated (SystemStatus/Capability exported); `GyfApi.systemStatus()`.
- Tests: honesty pins (try-on=planned, price gap reported), unreachable-DB and
  exploding-stats paths both 200.

**ZeroGPU lane un-degraded (the stale gotcha killed):** the deployed Space
`GetYourFit-gyf-gpu.hf.space` now serves **all four** endpoints — verified live via
`gradio_api/info` AND a real `/estimate_body` call through the wire format (returned
rtmw-birefnet-v1 measurements, confidence 1.0). The old "GYF_BODY_REMOTE_URL must stay
UNSET (no SAM on Space)" note is obsolete. **Remaining one-time op (user):** set
`GYF_BODY_REMOTE_URL=https://GetYourFit-gyf-gpu.hf.space` on the Render service
(dashboard or `render login` + env set) → photo body-type goes live on prod; /status
will then report it honestly.

**Gates:** API pytest 192 ✓ ruff check+format ✓ web ESLint/tsc/vitest 24 ✓ Prettier ✓.
(Separate chore commit: ruff-format drift on 10 files after the ruff bump.)

### 2026-07-03 — Status surface false-negative fixed; prod photo path VERIFIED LIVE

User set GYF_BODY_REMOTE_URL on Render. Prod /system/status now reports photo body-type
live/remote-gpu, skin-tone beta/remote-gpu, DB ready, 24,254 items (12 priced). The status
page's text_search check was a false negative (proxied via local torch, but prod embeds
queries over GYF_ENCODER_REMOTE_URL — real search returns 200 with results); the check now
mirrors the real serving path (remote lane → local torch → degraded). +1 test (4 total).

### 2026-07-03 — Virtual try-on (M9) built end-to-end behind the TryOnRenderer port ✅ (lane pending credits+eval)

**User asked:** continue with the recommended moves — try-on + skin-tone fairness eval.

**Vendor research (subagent, cited):** FASHN AI wins the licensed-inference lane —
proprietary weights, ToS grants commercial output use, ~$0.075/image (~$0.15–0.23/outfit via
sequential top→bottom), 72h vendor auto-delete + return_base64 keeps renders off vendor
storage (D8), available from India. Runner-up: Vertex AI VTO (GA). Kolors-via-fal ($0.07,
commercially cleared by fal) as A/B hedge; Leffa (MIT) on our ZeroGPU Space as the $0
own-lane candidate (flag: trained on VITON-HD/DressCode research data). ALL Replicate
IDM-VTON/CatVTON/OOTDiffusion deployments are CC-BY-NC → fail the license gate.

**Shipped:**
- `app/tryon/` — `TryOnRenderer` port (D1): `render(person_png, garments) -> TryOnRender`
  (image | honest abstention, calibrated confidence, rendered_slots, reason);
  `NullTryOnRenderer` baseline (invariant #5) serves when no lane is configured.
- `app/tryon/fashn.py` — FASHN adapter: sequential composition (one-piece→top→bottom;
  footwear honestly skipped — unsupported by tryon-v1.6), confidence decays 0.8×0.9^k per
  extra pass, partial-look honesty, injectable transport (stdlib urllib; zero new deps).
- `POST /tryon` — consent-gated, photo validated exactly like onboarding uploads
  (type sniff, size, decompression-bomb), ephemeral in-memory processing, per-garment
  TRYON events into the behavioral spine, tight rate limit (3/min — vendor credits).
- `/system/status` now reports try-on beta/licensed-api when configured, planned otherwise.
- Registry: `fashn-tryon-v1.6` in RESEARCH lane — the license gate correctly refused
  production without an eval report (D5). Promotion recipe in the registry notes.
- Web: "See it on you" in outfit detail — upload → render with confidence + rendered-slots
  caption + "never stored" promise; abstention shows the reason, never a fake.
- Tests: 10 new (sequential composition + D8 pin, footwear skip, partial/total failure,
  consent 403, null-lane honesty, event logging, 404, upload sniffing). API total 203.

**Activation (user):** buy FASHN credits → run the eval look-set → record
eval-reports/tryon-fashn-v1.json → flip registry lane to production → set
GYF_TRYON_PROVIDER=fashn + GYF_FASHN_API_KEY on Render.

## 2026-07-03 — Behavioral-data export pipeline (no data wasted)

**Ask:** "data is getting wasted — make it useful internally." Also confirmed VTON
position (M9 built, dormant pending FASHN credits + env vars) and Leffa licensing
(MIT code, but weights VITON-HD/DressCode-tainted → serving-lane unusable; architecture
reusable for own-it-later on brand photos).

**Shipped:** `ml/pipelines/export_events.py` + `make data-export` — turns the
append-only `interactions` spine into versioned artifacts under `ml/data/exports/<date>/`:
- `examples.jsonl` — one training example per served item: impression (rank, propensity
  score, occasion, goals) joined with later engagements by the same user/item; label =
  strongest signed reward per the reward contract (signals.py). Organic engagements
  (no impression) export as propensity-null positives. This is the (context, slate,
  label, propensity) dataset the future two-tower/ranker + IPS gate consume.
- `report.md` — operator insight: engagement/skip rates, by-occasion and by-slate-rank
  tables, event volume/user counts.

**Verified:** 8 unit tests (join, labels, no backward leakage, per-user/item scoping,
report aggregates) + a real end-to-end run against a genuine Postgres (pgserver) with
the prod schema — impression+save → label 1.0 @ propensity 0.87; skip → −0.6 organic.
Prod-run blocked only on the rotated DB password (user-only); `make data-export` with
GYF_DATABASE_URL runs it against prod as-is.

**Decision:** no model training yet — at beta volume a trained two-tower underperforms
the content+taste baseline; the export makes flipping training on trivial later.

## 2026-07-03 — Nightly automated data export (GitHub Actions)

`.github/workflows/data-export.yml`: nightly (04:00 IST) + manual dispatch; runs
`pipelines.export_events` read-only against prod, uploads examples+report as a
90-day artifact, and prints the insight report into the run summary. Guarded —
green no-op until the repo secret `GYF_PROD_DATABASE_URL` (Supabase session-pooler
URL with the rotated password) is set. VTON research note: Kolors-Virtual-Try-On
weights were never released (Space-only demo; commercial API pending) — no
genuinely free commercial VTON exists; FASHN pay-per-render stays the beta lane.

## 2026-07-03 — Affiliate attribution LIVE (Cuelinks lane behind the AffiliateLinker port)

Cuelinks approved (channel cid=274785; token verified live against /api/v2 — campaigns
200, transactions 204/empty as expected). Shipped the full revenue seam:

- `app/affiliate.py` — AffiliateLinker port: CuelinksLinker (deeplink wrap, subid
  sanitization, idempotent, non-http passthrough) + NullAffiliateLinker baseline.
- Two choke points wrap every surfaced buy link: ItemDirectory.lookup (explore/
  social/collections/saved → subid "catalog") and recsys serve (subid =
  recommendation_id → a conversion joins back to the exact impression slate).
- `purchase` action added to the event vocabulary (reward 1.5, mirrored in
  signals.py + ml export) — the ground-truth commerce label.
- `scripts/sync_conversions.py` — nightly Cuelinks transactions → purchase events
  (idempotent by transaction id; joins subid → impression → user+item; never
  guesses on foreign subids). Wired into data-export.yml before the export.
- /system/status affiliate_commerce flips to live/cuelinks when GYF_CUELINKS_CID set.
- render.yaml sets GYF_CUELINKS_CID=274785 (public channel id; token only in CI).
- Verified: real deeplink 302s to Myntra with our cid+subid; 214 API tests pass
  (11 new); ruff clean.

**User actions:** add GitHub secrets GYF_PROD_DATABASE_URL + GYF_CUELINKS_API_TOKEN.
**Honest gap:** Cuelinks has NO product feed API — real prices/images still need
merchant catalog ingestion (separate W-DATA track); wrapping applies to whatever
buy_urls the catalog holds (academic seed rows have none yet).

## 2026-07-03 — Shopify D2C catalog connector (real products, $0, no aggregator)

Real buyable fashion now has a free ingestion lane: Shopify's public
`/products.json` on popular Indian D2C brands. Planned first (user-confirmed),
then shipped on the EXISTING FeedSource port — no parallel system:

- `app/catalog/merchants.py` — config-as-data roster, 9 stores each verified
  live before inclusion (Snitch, Freakins, The Bear House, Bonkers Corner,
  Rare Rabbit, BlissClub, Urban Monkey, Littlebox, Offduty). US-INR brands
  join as registry entries when verified (most US Shopify stores serve USD).
- `ShopifySource` (sources.py) — paged fetch (polite delay, honest UA,
  50k backstop), lowest in-stock variant price, currency guard, price sanity
  bounds, out-of-stock skip, malformed-product tolerance, title fallback for
  blank product_type. provenance license="merchant-public-feed".
- `ingest_shopify_roster()` + `--provider shopify` CLI — per-store failure
  isolation (one dead store never kills the roster refresh).
- media.py root-cause fix: absolute image URLs pass through (were being
  mangled by basename+media-base rebasing).
- Nightly workflow step refreshes prices/stock (idempotent by dedupe_key).
- Merchant choice in the feed stays EMERGENT (embeddings + conditioning +
  taste + behavioral spine) — no hardcoded merchant preference (D5/D6).
- Verified: 9 offline tests + live e2e (25 real Snitch products → real
  Postgres, canonical categories, INR prices, 7 images/product, idempotent
  re-run). API suite 223 passed; ruff clean.

**Honest gaps:** new items need the embedding backfill (existing recipe:
CPU lane `GYF_ENCODER_REMOTE_URL=""` or ZeroGPU) before they are stylable —
not yet automated in CI (torch install weight); permission emails to brands
recommended (public endpoint, ToS-grey without them); US-INR roster empty
until a store verifies.

## 2026-07-03 — "Complete the look": item-anchored outfit completion ✅

**Ask:** don't only recommend a product — for any product, show the complete
outfit to pair with it (shirt → these pants + these shoes), personalized.

**Root cause found:** the Explore item sheet's "Wear it with" row called
`/items/{id}/similar` — visually *similar* items (near-duplicates of the same
garment), not a coordinated outfit. Fixed at the engine, not the UI:

- `recsys.service.recommend(anchor_item_id=…)`: the item is resolved via
  `candidates_by_ids` (no region/price predicates — the user chose it), pinned
  as the SOLE candidate in its slot after wardrobe grounding, and blueprints
  are filtered to those containing the anchor's slot (a full-body blueprint can
  never emit an anchor-free look). Everything else is the existing engine:
  occasion, undertone, taste, NL goals, wardrobe versatility, MMR diversity,
  explanation + calibrated confidence, affiliate wrapping, impression logging
  (context now carries `anchor_item_id` for anchored-slate training data).
  Unknown item → LookupError → 404.
- `GET /outfits/complete?item_id=…&k=&occasion=&goal=&region=` (same auth +
  recommend rate limit); `OutfitRecommendation.anchor_item_id` echoed.
- Web: `GyfApi.completeLook()`; item detail sheet section renamed
  **"Complete the look"** — renders the other pieces of the composed outfit
  (slot + price + title, tap → affiliate link), the stylist explanation, and a
  "% match" confidence chip. Honest empty state when no look can be assembled.
- api.ts/openapi regenerated (FE/BE lockstep).

**Verified:** 4 new tests (every outfit contains the anchor; unknown anchor
404/LookupError; anchor-free blueprints excluded; endpoint + impression
context). API pytest 227 ✓ ruff check+format ✓ web tsc/ESLint/vitest 24/
Prettier ✓ license gate ✓ ports gate ✓. Scoped commit only — the Shopify
roster ingest/backfill files still uncommitted from the running prod job.
