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
- **Aesthetic is paramount.** Design direction is locked: **"Editorial Gallery"** —
  fashion-magazine meets Linear; light editorial gallery (off-white / `#111` ink),
  refined serif display + clean sans body, generous whitespace, large imagery, slow
  confident motion, Anthropic/Linear-tier polish (modals, empty/loading/error states,
  skeletons, micro-interactions). Trust through craft. Token-swap discipline: components
  inherit from the design system, no arbitrary `[var(--x)]` classes.
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
- ✅ **S1 design-system rebuild — DONE & verified** (commit `bb53de2`). All Editorial-Gallery
  primitives exist under `app/components/ui/` (Button, Input, Select, Field, Dialog [subsumes
  Sheet], Toast, Card, Badge, Avatar, Tabs, Skeleton, EmptyState) + layout primitives
  (`PageContainer`, `PageHeader`); a `/design` style guide renders every primitive (excluded
  from the auth matcher in `proxy.ts`). Tokens + type scale in `app/app/globals.css`.
- **➡️ NEXT = S2 — wire Saved & Wardrobe to the backend (kill local-only Zustand).** Add client
  methods `saveOutfit`/`listSaved`/`removeSaved` → `/collections` and `addWardrobeItem`/
  `listWardrobe`/`removeWardrobe` → `/wardrobe/items`; replace `savedStore`/`wardrobeStore`
  writes with server calls (optimistic UI, reconcile on response). **DoD:** create→reload→still
  there→cross-device, verified against the **live** API; `verify` E2E + `ecc:react-reviewer` +
  `ecc:typescript-reviewer` + `ecc:fastapi-reviewer` + `security-review` (authz on ownership) green.
- Then **S3** real Social (replace `MOCK_POSTS`, reactions, follower-rerendered shares),
  **S4** `/profile` + `/account` (consent/export/erasure), **S5** polish (outfit detail modal
  with reason+confidence, faceted Explore, real loading/empty/error states, Lighthouse green).
- **Confirm against `git status`/`git log` and the plan's `✅/⏳` markers before picking up —
  do not redo verified work.** As consumers are touched (S2–S5), migrate bespoke inline UI onto
  the S1 primitives (e.g. the segmented toggle in `add-garment-sheet.tsx` still hand-rolls
  `role="tablist"` without keyboard nav — fold into a primitive when you touch it).

## 7. Operating rules
- Plan before build; no mockups masquerading as features; everything real and usable.
- Leverage ECC skills whenever they apply. Use the highest-IQ, long-term-correct path.
- Keep docs in lockstep when product/decisions change. Save durable learnings to memory.
- Ask the user only for genuinely creative/irreversible decisions; otherwise pick the
  obvious default, state it, and proceed.

**Now: orient (§1), pick the single highest-IQ next step in the master plan, and execute it
as a bounded loop with subagents — to a verified, committed done.**
