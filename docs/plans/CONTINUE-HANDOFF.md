# GYF — New-Session Continuation Prompt

> Paste the block below verbatim into a fresh Claude Code session to continue the GYF
> launch drive with full context, principles, and the correct next step. It is
> self-orienting: it tells you to re-derive live state before acting, so it never goes stale.

---

You are continuing the **GetYourFit (GYF)** build as a **principal engineer** holding a
million-dollar-startup quality bar on code, ML, *and* product/UX. Do not ship
"college-project" work. Cost is not a constraint on doing it right.

## 1. Orient before you act (do this first, every session)
1. Read `CLAUDE.md` (operating guide) and obey doc precedence:
   `docs/vision/ideas-complete.md` → `docs/engineering-doctrine.md` → `docs/tech-stack.md`
   → `docs/roadmap.md`. **The master execution plan is `docs/plans/gyf-v2-launch-program.md`** —
   it is the single source of execution truth (method, order, gates). Also read
   `docs/plans/accuracy-precision-trust.md` (the L1–L6 loop catalog) and
   `docs/plans/reliability-trustworthiness.md` (gates).
2. Re-derive the **live** state — never trust a summary: `git log --oneline -10`,
   `git status`, and check which workstream markers (`✅/⏳`) are set in the master plan.
   Read `~/.claude/.../memory/MEMORY.md` index for prior learnings.
3. Identify **the single highest-IQ next step** in the master plan's current phase and do
   that — do not jump ahead or re-do completed, verified work.

## 2. The method — loop engineering (binds every workstream)
Run every workstream as a **bounded loop**, never write-once:
`rubric → generate → evaluate (auto + visual + adversarial) → specialist review → GATE → promote | iterate`
- **Use subagents and loops as aggressively as possible.** Parallelize independent
  deep-dives across specialized agents. Prefer continuous closed loops over one-shot fixes.
- UI work → `ecc:gan-design`; logic → `ecc:gan-build`. TDD on the micro loop.
- **Specialist reviewers (mandatory per surface):** `ecc:react-reviewer` +
  `ecc:typescript-reviewer` (TSX), `ecc:fastapi-reviewer` + `ecc:python-reviewer` (API),
  `ecc:security-reviewer` / `security-review` (every input/auth/endpoint/storage),
  `ecc:mle-reviewer` (ML), `ecc:a11y-architect` (WCAG 2.2),
  `ecc:frontend-design-direction` (design), `ecc:database-reviewer` (SQL/migrations),
  and the `verify` skill (E2E run-and-observe against the live stack).
- Research the landscape (`ecc:deep-research`) before adopting any new tech.

## 3. Five invariants — never traded, including for speed
1. Quality never silently regresses (eval-gated promotion; offline selects, online promotes).
2. Nothing non-commercial reaches the serving path (CI license gate; SMPL & most try-on
   weights are non-commercial — avoid).
3. Every user-facing output carries **calibrated confidence + a human-readable reason**;
   abstain when unsure.
4. Personal data is the user's (consent + erasure by construction).
5. A working baseline sits behind every capability port (app code never imports a model).

## 4. Non-negotiable quality bars for this product
- **Dataset quality is paramount.** GYF trains/serves on **real data, no synthetic**
  (user photos consented + ephemeral, brand/aggregator catalog with on-model photos,
  first-party behaviour). Open datasets bootstrap perception **only** — never served.
  When touching the catalog: require **real product feeds**, dedupe, validate attributes,
  verify images resolve (public-read 200), keep embeddings in lockstep with items, and
  measure coverage across region (US + India) and category. No academic-dataset filler in
  the live catalog.
- **Accuracy is paramount.** Whatever GYF does — perception, body-type, skin-tone (⚠️
  fairness-gated on Monk Skin Tone before it can influence output; manual fallback always),
  recsys ranking, outfit compatibility, try-on — must clear its **eval report (M1 contract)**
  and an online/counterfactual check before promotion. Mind the offline→online metric gap.
- **Aesthetic is paramount.** Design direction is locked (user pick, 2026-06-29):
  **"Editorial Noir"** — dark, dramatic, luxury, unique to GYF (Vogue/SSENSE after dark).
  Near-black canvas `#0a0a0a`, warm ivory ink `#f4f1ea`, antique-gold `#c9a86a` **reserved
  for confidence + editorial accents only** (primary CTA = ivory fill, ink text). Oversized
  **Playfair** serif `t-display` mastheads, **Inter** body, **JetBrains Mono** metadata;
  **serif-italic** stylist voice (`t-editorial`). The signature = a **gold hairline rule +
  uppercase gold eyebrow** opening the hero / every nav-page masthead (shared `PageHeader`) /
  auth / `/design`. Tokens live in `app/app/globals.css`; full primitive gallery at `/design`.
  Slow confident motion (`--ease-lux`), `prefers-reduced-motion` honored, WCAG 2.2 AA on dark.
  Token-swap discipline: components inherit from the design system — **no arbitrary
  `[var(--x)]` classes, no hardcoded hex outside `globals.css`** (intro splash excepted).
  Run UI work through the **`ecc:gan-design`** loop (generator↔evaluator vs a rubric, pass ≥8.0).
- **Optimized & efficient.** Production/professional standards from day one; beta-ready,
  scale-ready; no hardcoded limits; cache embeddings; free-tier-first (Vercel web, Render
  API, Supabase DB/storage, HF ZeroGPU for GPU). Run `web-perf`/Lighthouse to a green target;
  watch bundle size, render perf, query/index health.

## 5. Definition of done (hard gate — do not advance past it)
A workstream is **done only when**: observed working against the **live deployed stack**
(`verify` / chrome-devtools — every nav works, every action persists to prod, real photos
render, no console errors), all specialist reviewers green, `make ci` green. Then make **one
scoped conventional commit** (no AI attribution / no Co-Authored-By trailers). Only push
implemented, verified, functional code. Don't advance to the next milestone until the current
one is end-to-end built **and** verified (happy + failure paths).

## 6. Where the plan currently stands (verify, then continue)
- **Phase 1 = surface-first** (wire the already-strong backend to the frontend + full
  redesign + missing pages + polish), then Phase 2 = ML pillars (photo skin-tone/body-type
  live, try-on), then Phase 3 = security + scale + deploy hardening.
- ✅ **S1 design-system rebuild — DONE & pushed** (`bb53de2`). All primitives under
  `app/components/ui/` (Button, Input, Select, Field, Dialog [subsumes Sheet], Toast, Card,
  Badge, Avatar, Tabs, Skeleton, EmptyState) + layout (`PageContainer`, `PageHeader`); `/design`
  style guide (public via `proxy.ts` matcher).
- ✅ **Editorial Noir redesign — DONE & pushed** (`8611f7e`, gan-design scored 8.13/10).
  Token system flipped to Noir; gold-rule/eyebrow signature on hero+nav+auth+`/design`;
  `t-display` mastheads; serif-italic stylist voice; gold edition numerals on outfit cards;
  `themeColor` bug fixed; `t-wordmark` utility added. tsc/eslint clean; routes 200, clean console.
- ✅ **S2 (Saved & Wardrobe) and S3 (Social) verified already backend-wired** — `saved-grid`,
  `wardrobe-grid`, `social-feed`, `create-post-sheet` all call `browserApi()` (`/collections/
  outfits`, `/wardrobe/items`, `/social/*`) with optimistic UI; **no local-only stores, no
  MOCK_POSTS**. (Re-confirm under the new design if touched.)
- **➡️ NEXT = S4 — build `/account`** (the genuine open Phase-1 gap; nav has no `/account` route).
  Backend already exists: `GET/PUT /profile/consent`, `DELETE /profile/account`; client has
  `getConsent`/`updateConsent`/`deleteAccount` in `app/lib/api.ts`. Build the page: privacy
  consents view/edit, data export, **right-to-erasure** (invariant #4 — move delete-account out
  of onboarding). **DoD:** nav→/account works, consent persists, erasure verified end-to-end
  (tombstones account). **Gate:** `ecc:security-reviewer` (erasure/consent authz) +
  `ecc:react-reviewer` + `ecc:typescript-reviewer` + `verify`, then commit + push.
- Then **S5 polish** (outfit detail modal with reason+confidence, faceted Explore real price
  facet, all loading/empty/error states, micro-interactions, Lighthouse green) → **Phase-1 exit
  gate** (every nav works, actions persist to prod, real photos render, no console errors).
  **Do NOT start Phase 2 (ML pillars) until the Phase-1 exit gate passes.**
- **Confirm against `git log`/`git status` before picking up — do not redo verified work.** When
  touching consumers, migrate bespoke inline UI onto S1 primitives (e.g. the segmented toggle in
  `add-garment-sheet.tsx` hand-rolls `role="tablist"` without keyboard nav).

## 7. Operating rules
- Plan before build; no mockups masquerading as features; everything real and usable.
- Leverage ECC skills whenever they apply. Use the highest-IQ, long-term-correct path.
- Keep docs in lockstep when product/decisions change. Save durable learnings to memory.
- Ask the user only for genuinely creative/irreversible decisions; otherwise pick the
  obvious default, state it, and proceed.

**Now: orient (§1), pick the single highest-IQ next step in the master plan, and execute it
as a bounded loop with subagents — to a verified, committed done.**
