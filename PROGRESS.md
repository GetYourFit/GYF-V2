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
  looks get _built around_ owned garments. Freeform/stale rows abstain (D6). Empty wardrobe →
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
`/items/{id}/similar` — visually _similar_ items (near-duplicates of the same
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

## 2026-07-03 — Catalog repair + gendered relevance + personalized explanations

**Asks (this session, sequential):** catalog "not working" on prod; Wear-it-with must
show the complete outfit (done previous entry — complete-the-look); richer explanations
naming skin tone / body type / budget; ask + use gender so users only see their slice +
unisex; mixed stores must classify per-product (no data missed); keep the whole app
efficient/secure/optimised; use subagents/loops.

**Prod catalog diagnosis (the "not working"):** the academic purge left 1,649 real
Shopify items; only 1,103 embedded (546 pending backfill — the user's backfill job had
stalled); "footwear" contained skateboard wheels (substring bug: "W-heels"→heels) and
only 9 rows; 237 unknowns. Verified live: /items/search 200 with real Snitch products;
composition ran but with 0/40 perceived tops → 0.25 confidence and junk footwear.

**Root-cause fixes shipped:**

1. **Taxonomy classifier** (contracts): containment fallback now matches whole words
   with an optional plural suffix — "Shirts"→shirt, "Dresses"→dress, but "Wheels" can
   never hit heels. Vocab widened for real feeds: shoes (generic closed footwear),
   cap, socks; synonyms clogs/slip on/loafers/lace ups/derby/oxford/brogues/hat/
   snapback/beanie. Prod rows re-classified in one batched UPDATE (862 rows) from the
   stored taxonomy.raw_category — junk is out of footwear.
2. **Footwear merchants** (roster): Neeman's, Comet (default_category=sneakers — its
   product_types are model names), Monkstory — all three verified live with INR prices.
   ShopifySource now resolves category via product_type → title → merchant default.
3. **Gendered relevance, end to end:** Merchant.audience (config-as-data per store) +
   per-product inference from the product's own title/tags/type (word-boundary regexes;
   men+women→unisex; product text beats store default — mixed stores classify right,
   nothing dropped) → attributes.taxonomy.gender at ingest → gender predicates in the
   candidate SQL and vector-search SQL (unfaceted rows always pass) → recsys filters
   server-side from profile.gender via contracts.catalog_genders_for (nonbinary/unknown
   = full catalog, never narrowed); /items/search + /similar take a validated gender
   param; Explore passes the profile's gender. Gender remains relevance, never a wall.
4. **Personalized explanations (earned, D6-honest):** undertone sentence only when the
   look's palette actually scores ≥0.6 against the user's undertone hues ("These tones
   sit in the warm-undertone palette…"); budget sentence only when every non-owned
   piece is priced within budget ("Every piece stays within your ₹1,000 budget.");
   **body-type intelligence**: with no explicit NL goal, profile body type sets default
   effects through the same goals engine (oval→elongate, triangle→broaden; others none)
   and the explanation credits it ("Cut for your apple-shaped frame — an unbroken
   vertical line…"). Explicit goals always win.
5. **Backfill sharding** (`--shard i/n`, stable id-hash) + Snitch storefront-domain fix
   (buy links → snitch.com) — committed from the prior session's working tree.

**Verified:** API suite 238 passed (13 new tests: word-boundary+plurals, gender
inference/fallback/fetch, category chain, recsys gender slice + nonbinary full view,
body-type goals + explanation phrases, budget + undertone claims, fixture row widened);
ruff + format clean; web tsc/ESLint/vitest 24/Prettier clean; types regenerated.
Prod re-classified (862 rows, batched single statement). Full roster re-ingest with
gender facets + footwear running against prod; embedding backfill to follow.

## 2026-07-03 (evening) — Ingest resilience + prod gender-coverage repair

**Ask:** feedback-v4 flags men's profile still seeing women's wear with the new
catalog; classifier must not miss any product on mixed stores; finish the backfill;
verify + commit + push.

**Diagnosis:** the classifier/filter code was correct but prod data never caught up —
the roster re-ingest kept dying store-by-store (Supabase pooler drops connections
mid-run; one transient storefront 500 also killed a whole store), leaving 1,130/1,660
rows with no gender facet, and unfaceted rows always pass the filter.

**Fixes:** one-retry-on-fresh-connection guard in PostgresItemRepository.upsert;
one retry on transient HTTP errors in ShopifySource.\_http_get. 2 new tests (both
retry paths). Full roster re-ingest re-run against prod with the fixes; gender
straggler backfill + stale-row cleanup + embedding backfill to follow.

**Verified:** API pytest 242 ✓ ruff check+format ✓ web tsc/ESLint/vitest 24 ✓.

## 2026-07-03 (night) — QoL wave 2: core-loop speed

**Ask:** more QoL/UX changes — research, extend the program, continue implementation;
always pull first, commit+push after.

**Shipped (commit 94b34a5):** `lib/session-cache.ts` (sessionStorage view cache);
stylist feed stale-while-revalidate (instant repaint on tab return, background
refresh only applied while user is still at top — no silent restack); Explore
back-nav restore (items+page+scroll, hydration-safe via mount effect); prefetch
lookahead 200→600px; offline pill in app shell. 2026 research sweep re-confirmed
skeletons/felt-speed/micro-interaction direction; noted in qol-ux-program.md §7.5
with W1/W2 marked shipped. Also formatted two files left prettier-dirty on main.

**Verified:** tsc ✓ eslint ✓ vitest 24 ✓ prettier ✓. Next: W3 (stylist feel —
reactive delta, swap-a-piece, daily pick) per the program's sequencing.

## 2026-07-04 — Highest-IQ pass: prod embedding backfill + swap-a-piece

**Ask:** do the highest-impact work first and implement.

**1. Prod perception backfill (running):** the roster ingest had grown prod to
9,162 items but only 1,596 were embedded — 7,566 invisible to vector search and
composition (the real cause of low-confidence outfits). Full CPU backfill
launched against prod (idempotent, resumable); progress 2,339+ and climbing.

**2. Stylist's pick (commit 2177775):** highest-confidence look gets a labeled
accented frame, only when confidence ≥0.6 (earned claim, D6).

**3. Swap-a-piece (commit 5747475):** new GET /outfits/alternates (same-slot,
gender-scoped, affiliate-attributed alternates via existing retrieval + candidate
hydration + category filter on similar_to_item); new 'swap' interaction action
end to end (contracts→api.ts); SwapButton in outfit detail; feed swaps the piece
in place and logs the labelled compatibility example.

**Verified:** API pytest 242 ✓ ruff ✓ · web tsc/eslint/vitest 24/prettier ✓.

## 2026-07-04 (contd.) — backfill sharded 3×, reactive-feedback delta

Backfill throughput was ~10 items/min single-process (9+ h to drain); killed it
and relaunched as 3 parallel `--shard i/3` workers (stable id-hash split,
idempotent) — ~3× throughput. Progress 2,708/9,162 and climbing.

**Reactive delta (commit 3bdc9f9):** the dismiss/undo strip now names what the
skip actually taught the model — "dialing down <palette> looks like this" from
the dismissed garments' real color signals (generic when no signal; never an
invented claim). W3's §4.1 honest version.

## 2026-07-04 (contd.) — feedback-v4 fix pass: gender, junk, cohesion, social, contrast, profile

**Ask:** embed the last straggler; read gyf-feedback-v4.md and fix everything;
find more issues; commit+push.

**Backfill closed out:** 9,161/9,162 embedded; the one straggler had zero
images (unembeddable) — deleted, it could only render as a broken card.

**Gender truth (the "shows me women's wear" bug):** root cause was 596
unfaceted items (NULL passes the gender filter by design) including obvious
womenswear, plus feed mis-tags ("Rareism Women's …" tagged unisex). Fix at
three layers: (1) `infer_gender` text rules in the shared taxonomy contract —
explicit words override a wrong feed facet, garment words (saree, bralette)
fill blanks, conflicts abstain; wired into ingest for all future feeds;
(2) new `ml/pipelines/backfill_gender.py` — rules first, then zero-shot
women/men against the _stored_ SigLIP embeddings (no image refetch), floor
0.70, honest abstention; run against prod: 171 ruled + 251 zero-shot +
overrides, NULL 596→31. (3) tests both sides.

**Catalog junk (found while spot-checking):** skateboard wheels, bearing
cleaners, jewelry polluting Explore. Fixes: title-fallback classification at
ingest (feeds carry junk category strings while the title says "Joggers");
~15 new taxonomy synonyms (joggers/trouser/overshirt/co-ord/tank/muffler/…);
prod reclassify pass recovered 373 real garments (unknown 804→431); remaining
`unknown` rows are excluded from search/similar retrieval — unstylable items
are never surfaced.

**Composer got eyes (the "really dumb, can't tell what matches" complaint):**
new style-cohesion score component — mean pairwise cosine of the items'
perception embeddings (the signal that _sees_ the garments; colour/formality
arithmetic can't tell a varsity jacket from a blazer of the same hue), weights
rebalanced 0.34/0.26/0.15/0.15/0.10, neutral prior pre-backfill. Explanations
earn two new claims: statement-piece pattern play (exactly one patterned piece,
all reads certain) and "one visual language" (cohesion ≥ 0.75).

**Social page blank (prod):** root cause — `render.yaml`'s `dockerCommand`
replaced the image ENTRYPOINT, so `alembic upgrade head` never ran on Render;
prod lacked the `follows` table and `GET /social/follows` 500'd, and the
client's `Promise.all` let that one failure blank the whole page. Fixed both:
dockerCommand now runs the entrypoint (migrations 0006→0009 apply on next
deploy), and follows/me are best-effort in the client — only a feed failure
shows the error state.

**Contrast (the "white button on white background"):** the light-theme pivot
left noir-era hardcoded hexes in 40 files — three invisible primary CTAs
(`#ffffff` bg + `#faf8f5` text ≈ 1:1), white-alpha borders on light surfaces,
and two failing tokens (`--secondary` 3.3:1 → `#b04760`, `--text-faint` 2.8:1
→ `#767069`). All tokenized to AA.

**Profile page personal:** migration `0009_user_display_name` (users column,
survives style-profile erasure); PUT /profile takes display_name (trim/60-cap,
omitted key never clears); summary returns name + email + member-since with
email-local-part fallback; header shows real name, member-since, styling-
identity chips (only when set, never "unknown"), account gets a display-name
editor.

**Verified:** API pytest 251 ✓ ml pytest 78 ✓ ruff+format ✓ · web tsc/eslint/
bun test 24/prettier ✓. Prod data: gender NULL 596→31, unknown category
804→431 (all suppressed from retrieval).

## 2026-07-04 (contd.) — v4 pass committed+deployed; support surface; Explore scroll unblocked

**Ask:** embed straggler; verify+commit+push v4 pass; find & fix more; explain
"few items in Explore" and the two Render deployments.

**Straggler:** verified on prod — 9,161/9,161 embedded, 0 pending (the one
zero-image row was deleted last pass; nothing left to embed).

**v4 pass shipped** as six scoped commits (gender truth / cohesion / social
entrypoint / profile identity / AA contrast / ml lint) after full green gate
(API 251→256, ml 78, web 24, lint/format/typecheck). Live-verified on prod:
migrations 0006→0009 applied on the very next deploy (entrypoint fix proven),
authenticated smoke user gets 200 from /social/posts, /social/follows,
/profile/summary with personalized display_name.

**Explore "only a few items" — root cause found & fixed:** pgvector HNSW's
default ef_search=40 caps every ANN scan at 40 candidates, so page 2
(offset 24, k 24) returned 16 rows and infinite scroll dead-ended at item 40
of 9,161. Fix: SET LOCAL hnsw.ef_search = k+offset (clamped 40..1000) per
query; price sorts (btree order) skip the beam. Test asserts the beam scales.

**Contact + grievance forms were fake** (showed "sent!" without transmitting —
found by the polish-hunt agent). Now real: migration 0010 support_messages,
POST /support/messages (auth, rate-limited 5/min, length-capped), forms show
success only on 201 with sending/error states.

**More polish:** saved page no longer blanks when one of two lists fails
(Promise.allSettled); collections distinguishes fetch-error (retry button)
from genuinely empty; dead "Curated for you — coming soon" shell removed;
explore cards get skeleton shimmer + fade-in; CompatibilityPanel copy made
honest (score-tier framing, not fake bespoke analysis — D6).

**Two Render deployments:** render.yaml defines exactly ONE service (gyf-api).
Two entries in the dashboard = either normal deploy _history_ (every push is a
deploy) or a duplicate service created manually alongside the blueprint one —
check which one serves gyf-api.onrender.com and suspend the other; it burns
free-tier hours for nothing.

**Two Render services resolved:** `gyf-api-46e6` was a Blueprint-sync duplicate
(created 2026-07-02 when the name `gyf-api` was already taken) — both were
auto-deploying from main. Suspended it via the Render API (reversible); the
live service behind gyf-api.onrender.com is untouched. `gyf-web` on Render is
also a stale leftover (web lives on Vercel) — left alone, autoDeploy off.

**Live-verified after deploy:** migration 0010 applied; deep Explore pages now
full (24/24 at offsets 24/96/192 — previously 16 then dead at 40); POST
/support/messages returns 201 and the row lands in support_messages.

## 2026-07-04 (contd.) — "can't see the men's catalogue" fixed: ANN post-filter starvation

**Ask:** men's+unisex Explore missing items; troubleshoot, fix, verify on prod.

**Root cause (second pgvector footgun today):** WHERE filters (gender/region/
price) apply AFTER the HNSW scan, so a selective filter can annihilate the
whole beam — reproduced live: `dress` + gender=men returned an EMPTY first
page while 7,5k men's/unisex items existed. The gender mapping itself
(men → men+unisex+unfaceted) was verified correct at every layer.

**Fix (commit d55b2f9):** `SET LOCAL hnsw.iterative_scan = relaxed_order`
(pgvector 0.8.0 confirmed on Supabase) alongside the depth-scaled ef_search —
the index keeps walking until the page fills (bounded by max_scan_tuples 20k).
Test asserts iterative_scan is set on ANN queries; price sorts still skip.

**Prod-verified:** 16/16 sweep combos full (dress/shirt/saree/blazer ×
men/women × offset 0/96 all 24/24); similar-items 12/12; latency uncorrelated
with the filter (2.8–10s variance is free-tier host + embedder warmup, noted
as a separate perf concern).

## 2026-07-04 (contd.) — proactive bug sweep: pool selection, races, stranded states

**Ask:** find more issues like the truncation/starvation bugs and fix them.
Two audit agents (API silent-failures + web data-flow) + manual recsys read.

**The big one (commit 3a761eb, independently confirmed by the API auditor):**
candidate pools were `ORDER BY created_at DESC LIMIT 40` — the composer only
ever saw the 40 _newest_ items per slot; taste affinity was computed but never
decided pool membership, so personalization silently degraded to "reorder the
latest ingest". Pools are now ordered by taste affinity when a signal exists
(exact scan, no ANN involved), recency at cold start, depth 80. This is the
likely root of "recommendations don't suit me" (feedback v4).

**Web races (2519269):** social feed scope-switch and stylist feed
apply/refresh had no stale-response guards — a slower earlier request could
overwrite a newer one. Sequence counters added to both.

**Web state traps (a9c0050):** Explore now waits for the profile gender before
its first fetch (was: unfiltered flash + immediate refetch, and back-nav
restore clobbered by the late gender resolve); wardrobe category filter falls
back to All when its last item is removed (was: stranded empty state with no
chip); the post bookmark now actually persists via saveOutfit (was
local-state-only theater that reset on reload).

**Reviewed clean:** compose top-k\*8 truncation (post-scoring, safe), all
`noqa: BLE001` excepts (logged + honest abstain), flat LIMIT 500 lists
(documented beta bounds, dormant), catalog ingest page caps (backstop).

**Gate:** API 257 ✓ web 24 ✓ lint/format/typecheck ✓. Pushed a9c0050.
