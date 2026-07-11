# v6 Response — Frontend Audit & Status (2026-07-11)

Response to `gyf-feedback-v6.md`. What was fixed this cycle, page-by-page status,
and the free cold-start fix you asked for.

## Fixed this cycle

| Complaint (v6) | Root cause | Fix |
|---|---|---|
| "App doesn't open after login" | Splash screen SSR/client hydration mismatch orphaned a full-screen div at z-index 9999 | Splash renders identically on server+client, dismisses in mount effect (`c4ab613`) |
| "Press 3–4 times for the endpoint to connect" | Cold Render instance drops the first fetch; no retry | API client retries GETs ×3 with backoff; mutations never retry (`api.ts`) |
| "Nav pill still tinted" | Resting state used near-opaque chrome; glass only while scrolling | Solid state deleted — pill is always untinted liquid glass with glyph halos |
| "Same products again and again" (Explore/Canvas) | Browse shuffled by a *daily* seed — identical order all day, all surfaces | Per-session seed end-to-end (`/items/browse?seed=`); fresh order every visit, stable paging within one |
| Explore/Canvas echo each other | No shared memory of what was shown | Session seen-set (`recordSeen`/`seenSet`) recorded by both surfaces |
| "Profile page cluttered" | Every fact rendered twice: hero stats duplicated the Stats grid; identity chips duplicated the Style-profile table | Deduplicated — one stats grid (3×2), hero keeps only avatar/name/intents/edit |
| Grid tiles jumping mid-scroll | CSS multi-column rebalances on every append | Fixed two-column masonry (`i % 2`) |
| Infinite scroll dead-ends early | `hasMore` required a full page; one dry slot ended everything | Any non-empty page continues |

## Cold start — the free fix (action needed, ~5 min)

Render free tier sleeps at 15 min idle. GitHub cron is best-effort (delays up to
30 min under load), so it leaks cold starts. The reliable free fix:

1. Create a free account at **cron-job.org** (reliable 5-min cadence, free forever).
2. Add a job: `GET https://gyf-api.onrender.com/items/browse?k=1`, every 5 minutes.
   - This endpoint touches the **database**, so it warms the whole path
     (instance + Postgres pool + page cache). `/health` never did — that's why
     the app felt cold even when the instance was awake.
3. Keep the GitHub workflow as backup; delete it once cron-job.org has run for a week.

The client-side retry (shipped) covers the residual gap: the first user after a
slip-through waits one retry cycle instead of seeing a dead page.
The *real* fix remains a non-sleeping host (paid Render, Fly min-machines=1, or
an Oracle Always-Free VM) — infra migration, own decision cycle.

## Page-by-page status

| Page | Status | Notes |
|---|---|---|
| Login / Signup | ✅ Working | Clean render, no console errors (verified headless) |
| Onboarding | ✅ Working | 4-step wizard functional; photo estimate is best-effort by design |
| Stylist (home) | ⚠️ Functional, quality-limited | Loads; outfit quality gated by the recsys (see overhaul plan). No seen-set exclusion yet — `/outfits/recommend` has no `exclude` param |
| Explore | ✅ Working after this cycle | Stable masonry, session-seeded, retrying fetches; warm-path browse is still 1–5 s server-side (DB-bound, see plan) |
| Canvas | ⚠️ Working, perf-limited | Same seeded browse; k=96 initial load is the heaviest query in the app; "infinite" feel depends on warm DB |
| Saved / Wardrobe | ✅ Working | Simple CRUD lists |
| Social | ⚠️ Half-baked | Posting works; feed depth/reactions thin — needs its own cycle |
| Profile | ✅ Redesigned this cycle | Deduplicated; single source per fact |
| Account | ✅ Working | Consent, export, delete verified during account-deletion testing |
| Status / Contact / Grievance | ✅ Working | |

## Systemic (not per-page)

- **Responsiveness**: the shell is a fixed 430 px mobile column centered on
  desktop (`app-shell.tsx` `maxWidth: 430`). That is a deliberate mobile-first
  choice, not broken scaling — but a real desktop layout (grid widens, nav
  docks left) is a design cycle, not a patch. Decide if desktop is a target.
- **Catalog quality/size**: ~49 k items, all embedded. "Limited/trash products"
  is an ingest problem (sources, dedupe, category hygiene), not a frontend one.
- **Dead weight**: repo carries parked Flutter app (`gyf_app/`), `Reference/`
  backup, and superseded plan docs. Pruning is safe and worth one commit.
