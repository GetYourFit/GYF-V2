# GYF v2 Launch Program — the loop-engineered drive to a launch-grade product

> **Status:** active execution plan (2026-06-27). Created from `docs/feedbacks/gyf-feedback-v2.md`
> + two grounded audits (frontend reality, dead-code/structure) + verified live-stack state.
> **This is the single source of execution truth for the v2 push** (it absorbed and replaced the
> earlier launch-era plan drafts). Vision/law/tech precedence is unchanged: `ideas-complete.md` → `engineering-doctrine.md`
> → `tech-stack.md` → `roadmap.md`. **DRY:** scope/DoD/model-per-pillar live in those docs; this file is
> *the method, the order, and the verification gates* for shipping the full surface to launch quality.

---

## 0. Decisions locked (2026-06-27, from v2 feedback)

| # | Decision | Choice | Consequence |
|---|---|---|---|
| D-A | **Sequencing** | **Surface-first** | Phase 1 = wire the already-built backend to the frontend + full redesign + missing pages + polish. Phase 2 = ML pillars (photo skin-tone/body-type live, try-on). Phase 3 = security + scale + deploy hardening. Fastest visible payoff: the brain already exists. |
| D-B | **Try-on** | **Build UI + `TryOnRenderer` port, backed by free ZeroGPU only** | $0. Quality/quota-limited and may be flaky; surfaced honestly with confidence + graceful fallback. Doctrine invariant #2 (no non-commercial in serving) still binds → use permissive/licensed-at-inference path on ZeroGPU. |
| D-C | **Design** | **Full redesign — "Editorial Gallery"** | New visual direction from scratch: fashion-magazine meets Linear. Large imagery, **refined serif display + clean sans body**, generous whitespace, slow confident motion. Trust through craft. Anthropic/Linear-tier polish: motion, rich components, modals, empty states, micro-interactions. |
| D-D | **Local vs deploy runtime** | **Apple `container` for local dev (Mac silicon); Docker for Linux deploy** | Keep `infra/container-stack.sh` for local. Add/maintain Docker + compose parity for the Linux cloud target so there is **zero** dev↔prod drift. Assessed below (§6). |

---

## 1. The method — loop engineering (binds every workstream below)

Every workstream is a **bounded loop**, never "write once and hope":

```
rubric → generate → evaluate (auto + visual + adversarial) → review (specialist) → GATE → promote | iterate
```

- **Macro loop** = a workstream's Definition-of-Done (this doc).
- **Meso loop** = per-feature generate↔evaluate (GAN harness for UI: `ecc:gan-design`; for logic: `ecc:gan-build`).
- **Micro loop** = TDD + specialist reviewers + `make ci` before any commit.

**Specialist reviewers / skills used per workstream** (the user mandated ECC + subagents):
`ecc:react-reviewer` + `ecc:typescript-reviewer` (all TSX), `ecc:fastapi-reviewer` + `ecc:python-reviewer` (API), `ecc:security-reviewer` / `security-review` (every input/auth/endpoint), `ecc:mle-reviewer` (ML), `ecc:a11y-architect` (WCAG 2.2), `ecc:frontend-design-direction` (redesign), `ecc:database-reviewer` (SQL/migrations), `verify` skill (E2E run-and-observe).

**Five invariants (never traded, including for speed):** (1) quality never silently regresses (eval-gated); (2) nothing non-commercial in the serving path (CI license gate); (3) every user-facing output carries calibrated confidence + a human reason; (4) personal data is the user's (consent + erasure); (5) a working baseline behind every capability port.

**Commit discipline:** only push code that is *implemented, verified, and functional*. Each workstream ends with a scoped conventional commit (no AI attribution) **after** `make ci` is green and the feature is observed working against the live stack.

---

## 2. Verified current state (2026-06-27) — the real baseline

**Live & proven (this session):**
- Prod Supabase catalog seeded: **24,254 items + 24,242 M2 embeddings** (`google-siglip2-base-v1`), copied from the local stack (no re-encode). Verified.
- Prod **images uploaded**: 24,242 objects in the public `catalog` bucket, **0 failures**, public-read 200. Verified count-matched.
- Prod migration advanced **0003 → 0004 head**; W4 tables (`collections`, `wardrobe_items`, `social_posts`, `post_reactions`) now exist.
- Deployed API (`gyf-api.onrender.com`) `/items/search`, `/items/{id}/similar` return real products + real photos. Verified.

**Honest gaps (the v2 disappointment, from audit):**
- **Frontend↔backend wiring gap:** Saved & Wardrobe are **local-only Zustand** (never call the existing `/collections`, `/wardrobe/items` endpoints). Social is **fully mocked** (`MOCK_POSTS`; "Create post" persists nowhere; no `/social` wiring on the client even though `POST /social/posts` exists).
- **Missing surfaces:** `/profile` route **404s** (bottom-nav links to it); no account/settings page; no try-on UI.
- **Polish:** plain components, few modals/empty-states/skeletons; design judged "cheap" → full redesign (D-C).
- **Codebase:** actually fairly clean — the one genuinely dead file (the M2 bake-off Colab notebook) has been removed. "Garbage" feeling ≈ in-progress UI + legit audit artifacts. Cleanup is light.

---

## 3. PHASE 1 — Surface-first (the launch-visible product)

> Goal: every page real, wired, redesigned, polished, verified against the live stack. No mocks, no local-only persistence, no 404s.

### S0 — Repo hygiene & structure (small, do first)
- ✅ Deleted `notebooks/m2_bakeoff_colab.ipynb` (dead; `make m2-bakeoff` replaces it); dead Cloudflare references purged.
- Confirm `.gitignore` covers caches/build artifacts/logs; ensure `tsconfig.tsbuildinfo`, `logs/` not tracked.
- Add `docs/vision/README.md` (draft→complete evolution) to de-confuse doc sprawl.
- **DoD:** `git status` clean of artifacts; `make ci` green. **Gate:** review diff.

### S1 — Design system rebuild (foundation for D-C full redesign)
- Establish a written **design direction** (typography, color, spacing, motion language, component inventory) — driven via `ecc:frontend-design-direction` + a `ecc:gan-design` loop against a rubric. *(Design direction is the one open creative decision — I will present 2–3 concrete directions for your pick before building, per "ask important decisions".)*
- Build the primitive library (tokens, Button, Input, Select, Modal/Dialog, Sheet, Toast, Card, Skeleton, EmptyState, Tabs, Avatar, Badge) — accessible (WCAG 2.2 via `ecc:a11y-architect`), motion via Framer Motion.
- **DoD:** Storybook-style demo route renders every primitive; a11y audit passes; reviewers green. **Gate:** visual review + `verify`.

### S2 — Wire Saved & Wardrobe to the backend (kill local-only)
- Add client methods `saveOutfit`/`listSaved`/`removeSaved` → `/collections`; `addWardrobeItem`/`listWardrobe`/`removeWardrobe` → `/wardrobe/items`.
- Replace `savedStore`/`wardrobeStore` writes with server calls (keep optimistic UI, reconcile on response).
- **DoD:** create→reload→still there→cross-device; verified against live API. **Gate:** `verify` E2E + reviewers.

### S3 — Social, for real (replace `MOCK_POSTS`)
- Wire `SocialFeed` to `GET /social/posts`; `create-post-sheet` to `POST /social/posts`; reactions to `/social/posts/.../reactions` (build endpoint if missing).
- Re-render shared styles to the **follower's** region/taste via the recommendation path (vision requirement), not blind copy.
- **DoD:** post persists across reload + appears in another user's feed; reactions persist. **Gate:** `verify` + security-review (authz on post ownership).

### S4 — Profile & Account/Settings pages (fix the 404)
- Build `/profile` (outfits made/liked, badges scaffold) and `/account` (privacy consents view/edit, data export, **erasure** — invariant #4, delete-account moved out of onboarding).
- **DoD:** nav no longer 404s; erasure path verified end-to-end (sets `deleted_at`, disables account). **Gate:** security-review (erasure, consent), `verify`.

### S5 — Polish pass (top-tier interactivity)
- Outfit detail modal (reason + confidence prominent), compare view, rich empty/loading/error states, micro-interactions, faceted Explore filters (real price facet, not the `score` proxy hack), trending/new sorts.
- **DoD:** every page has loading + empty + error states; no dead clicks. **Gate:** a11y + design review + Lighthouse (web-perf skill) ≥ target.

### Phase-1 exit gate
Deployed web app, loaded via `verify`/chrome-devtools: every nav destination works, every action persists to prod, real photos render, no console errors, Lighthouse green. Commit per workstream.

---

## 4. PHASE 2 — ML pillars (differentiation)

- **M3 photo body-type** + **M4 skin-tone** *live* in onboarding photo path (currently shadow/gated). M4 is **fairness-gated** (Monk Skin Tone eval) before it can influence output — manual fallback always available. Reviewer: `ecc:mle-reviewer`; gate: eval report + license gate.
- **Try-on (D-B):** implement `TryOnRenderer` port + photo-on-body UI, backed by a **free ZeroGPU** Space; honest confidence + graceful "unavailable" fallback; consented + ephemeral + erasable. Multi-garment is the SOTA target, phased.
- **Recsys depth:** impression/feedback flywheel already closes (see `[[flywheel-verification]]`); verify online signal sharpening on prod data.
- **Gate:** each pillar promoted only through its eval report (M1 contract) + online check; nothing non-commercial served.

---

## 5. PHASE 3 — Security, scale, deploy hardening (launch-readiness)

- **Security sweep:** `ecc:security-reviewer` + `security-scan` over auth (Supabase JWT/JWKS, middleware), every endpoint (authz, rate limits, input validation), storage (signed/scoped), secrets hygiene, SSRF/injection, CORS. Fix every finding. No breakable walls.
- **Scale:** Docker images for web+API; the Linux deploy target (see §6); zero-downtime deploy + rollback; load-test the recommend path; cache embeddings; connection pooling.
- **Observability:** OpenTelemetry/Prometheus/Sentry wired; SLOs; drift/eval dashboards.
- **Gate:** load test passes target RPS; security scan clean; rollback rehearsed.

---

## 6. Local (Apple container) vs deploy (Docker/Linux) — assessment (D-D)

- **Local dev = Apple `container`** (Mac silicon native, already orchestrated by `infra/container-stack.sh`). Keep — it's fast and host-clean.
- **Deploy = Linux.** Apple `container` is macOS-only, so prod must use **Docker/OCI images on a Linux host** (Render today; K8s when traffic forces it). The web (`app/Dockerfile`) and API (`services/api/Dockerfile`) Dockerfiles already exist and are OCI-standard → they run unchanged under Docker on Linux. **Action:** add a `docker-compose.yml` mirroring `container-stack.sh` (same images/env/ports) so Linux contributors and CI get identical parity, and so prod images are built/tested the same way. No rewrite — Apple `container` consumes the same Dockerfiles, so there is **no dev↔prod drift risk** beyond the orchestrator, which compose closes.

---

## 7. Cross-cutting guarantees (every phase)

- **Verified before forward:** no workstream is "done" until observed working against the **live** stack (`verify`/chrome-devtools), reviewers green, `make ci` green.
- **Only functional commits pushed** (conventional, no AI attribution; scoped).
- **Security never compromised** — security-review gate on anything touching auth/input/data.
- **Honest intelligence** — confidence + reason on every user-facing output; abstain when unsure.
- **Privacy by construction** — consent + erasure verified.

---

## 8. Immediate next actions (on approval)
1. S0 hygiene (delete dead notebook, gitignore check, vision README).
2. Present **2–3 concrete redesign directions** for your pick (the one creative decision left).
3. Begin S1 design-system rebuild under a GAN-design loop.
