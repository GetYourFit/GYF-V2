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
