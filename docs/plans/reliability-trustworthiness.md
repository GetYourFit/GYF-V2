# RELIABILITY & TRUSTWORTHINESS — the cross-cutting plan to make GYF provably dependable

> **Status:** plan created 2026-06-29, in response to a class of failures (not one bug).
> **Owner doc:** this is binding cross-cutting law alongside `engineering-doctrine.md`.
> Referenced from `roadmap.md` (§ Reliability track) and `CLAUDE.md` §0.5.
>
> **Thesis.** GYF's intelligence is strong, but features have been marked "deployed"
> while silently broken in production for *days* (e.g. body-type onboarding:
> `body_ran=False` from 2026‑06‑27→29 while local tests were green). The moat is
> worthless if the user can't trust that what we say is live is actually working. This
> plan closes the gap between **"tests pass"** and **"works in production, observably."**

---

## 1. The observed failure modes (root causes, from real incidents)

| # | Failure mode | Concrete evidence | Root cause |
|---|---|---|---|
| R1 | **"Done" ≠ working in prod** | body-type "v1 deployed" but `body_ran=False` for days | Definition-of-Done allowed unit-green without a live end-to-end proof |
| R2 | **Silent prod degradation** | nobody noticed body abstaining until a user did | No success-rate metric / alert per onboarding module or remote lane |
| R3 | **Contract drift API ↔ Space** | Space returned `vertices`; API later expected `measurements` | The two deploy independently; no wire-contract test against the *live* Space |
| R4 | **Stale long-lived caches** | API process cached the old Space schema after a Space redeploy | Process-wide adapter/client singletons never refresh; no restart-on-dependency-change |
| R5 | **Config-as-hidden-state** | `GYF_BODY_REMOTE_URL` once resolved to the literal `true` → 404 `spaces/true` | Env vars (`sync:false`) live only in the dashboard; nothing validates them at boot |
| R6 | **Remote-lane fragility** | ZeroGPU cold start → first call hangs ~10s then abstains | No warmth/health probe; abstain looks identical to "module ran and found nothing" |
| R7 | **Accuracy unvalidated** | classifier thresholds provisional; skin-tone surfaced via owner override of the fairness gate | No labelled eval set; promotion not gated on real accuracy/fairness |
| R8 | **Frontend/cache masking** | API returns a value, UI still shows "couldn't read features" | No e2e check across the API→browser boundary; caching unaccounted |

Everything below is a direct countermeasure to one or more of these.

---

## 2. The five reliability invariants (add to the doctrine's five)

1. **Live-verified or not-done.** A capability is "done" only when an automated check
   exercises it **through the real production surface** and asserts a correct result —
   not when unit tests pass. (kills R1)
2. **No silent abstention.** Every user-facing module emits a metric on *every* call:
   `ran / abstained / errored`, with the reason. A sustained abstain/error spike pages
   us before a user notices. (kills R2, R6)
3. **Contracts are tested at the wire, against the live dependency.** Any port with a
   remote implementation has a contract test that runs against the actual deployed
   Space in CI/post-deploy, not just a fake. (kills R3)
4. **Config is validated at boot and surfaced at `/health`.** The service refuses to
   claim a lane is available unless its env is well-formed *and* the dependency
   answered a health ping. (kills R4, R5)
5. **Promotion is gated on real accuracy + fairness, measured on held-out labelled
   data.** No model reaches users on "looks plausible." (kills R7)

---

## 3. Workstreams (build order; each is small and independently shippable)

### REL-1 — Post-deploy smoke gate (highest leverage; do first)
A single script `scripts/smoke_prod.sh` that, after any deploy, hits the **live** API +
each **live** Space and asserts a real result:
- `GET /health` → 200 and reports each lane `{wired, reachable}` (see REL-3).
- Space lanes: call `/embed_images`, `/estimate_skin_tone`, `/estimate_body` with a
  bundled fixture image → assert non-abstain shape (`model_confidence > 0`, expected keys).
- API photo path: a seeded test user uploads a fixture photo → assert `body_type` and
  (gated) `skin_tone` come back populated, confidences in `[0,1]`.
- Wire it as a **Render post-deploy hook** and a **GitHub Actions `deploy-verify` job**
  that fails loudly (and can auto-rollback). DoD: a broken body lane turns the pipeline
  red within minutes, automatically. (R1, R3, R8)

### REL-2 — Module observability + alerting
- Emit structured counters: `gyf_photo_module_total{module, outcome}` (outcome ∈
  ran|abstained|errored) and a latency histogram, via the existing telemetry
  (Prometheus/OTel). The `gyf.photo` log line already carries `*_ran`; promote it to a metric.
- Dashboard panel + alert: **abstain-rate per module > 30% over 15 min ⇒ alert**;
  **error-rate > 5% ⇒ page.** Same for the recsys/perception lanes. (R2, R6)

### REL-3 — `/health` lane reachability + boot-time config assertions
- Extend `/health` to report, per capability lane: `wired` (env present & well-formed) and
  `reachable` (a cheap probe to the Space succeeded recently, cached ~60s). Distinguish
  `down` from `not-configured`.
- At startup, **validate every `GYF_*_REMOTE_URL`** (must parse as an https URL or
  `owner/space` id — reject `true`/empty-with-flag-on) and log a single explicit
  config summary. Fail fast on contradiction (e.g. `SKIN_TONE_ENABLED=true` but no
  reachable skin lane). (R4, R5)

### REL-4 — Remote-lane resilience
- **Schema refresh:** the remote adapters must re-fetch the Space api-info on a coercion
  mismatch (and on a periodic TTL), so an API process survives a Space redeploy without a
  manual restart. Add a `RemoteEstimator` base that owns retry + bounded timeout +
  one schema-refresh-on-mismatch. (R3, R4)
- **Warmth:** a lightweight cron pings each Space `/health` route every N min to fight
  ZeroGPU cold starts; bounded timeout on every call so a cold Space abstains fast and
  cleanly, never hangs the request. (R6)
- **Contract versioning:** stamp every Space payload with `model_version`; the adapter
  logs (and metrics) a mismatch between expected and received contract. (R3)

### REL-5 — Deploy choreography for contract changes
- A documented, enforced order: **when a wire contract changes, deploy the Space first,
  verify it (REL-1), then deploy the API.** Add a `make deploy-space && make smoke-space`
  step before the API auto-deploys. Optionally make the API tolerant of *both* old and new
  payload shapes for one release (N/N-1 compatibility) to remove the ordering hazard
  entirely. (R3)

### REL-6 — Accuracy & fairness eval gates (extends M1)
- Assemble small **labelled holdout sets**: body-type (silhouette class per photo) and
  skin-tone (Monk Skin Tone), spanning diverse bodies/tones/lighting. Real, consented or
  open-licensed; never synthetic for the fairness gate.
- `eval-reports/body-type-*.json` and `skin-tone-*.json` with accuracy + per-bucket
  fairness (`max_band_gap`), wired into `check_promotion.py`. The skin-tone owner override
  in `render.yaml` is **temporary** and removed once the gate passes. (R7)
- Calibrate `classify.py` thresholds + the confidence floor against the body-type holdout
  (replaces today's provisional table). (R7)

### REL-7 — End-to-end user-journey tests (the product surface)
- A Playwright journey (the `e2e-runner`) for the critical flows: sign-up → manual
  onboarding → recommendations → feedback; and photo onboarding → fields populate/abstain
  honestly. Runs against a preview deploy on every PR. (R1, R8)

---

## 4. Sequencing & integration into the master plan

Add a **Reliability track** to `roadmap.md` that runs **in parallel** with feature
milestones (it is not a phase to "finish first" — it is a standing quality system):

1. **Now (unblock trust):** REL-1 (smoke gate) + REL-3 (`/health` + boot config) — these
   would have caught every incident above. Small, do immediately.
2. **Next:** REL-2 (observability/alerts) + REL-4 (remote resilience) — stop silent
   degradation and the stale-cache/cold-start class.
3. **Alongside M2/M3/M4 promotion:** REL-6 (accuracy+fairness gates) — no estimator counts
   as "done" without a real eval report (already the M1 contract; this supplies the data).
4. **With the M5/M6 product surface:** REL-7 (journey tests) + REL-5 (deploy choreography).

**Definition-of-Done upgrade (binding, applies to every milestone from now):** a milestone
is done when (a) unit/contract tests pass, **(b) the post-deploy smoke gate is green against
the live surface**, (c) a metric proves the happy path in prod, and (d) for any model, a
passing eval report exists. This supersedes the looser "built + verified" wording.

---

## 5. Immediate concrete fixes already applied (2026-06-29)
- Body-type v2 (RTMW + BiRefNet, arm-robust, lighting-invariant, confidence∈[0,1]) built,
  locally verified on real photos, deployed to the Space, and verified by a **direct live
  call** to `/estimate_body` (returned real measurements). `GYF_BODY_REMOTE_URL` confirmed
  set; API restarted to drop the stale Space schema (R4). See
  `docs/plans/m3-body-type-rtmw-birefnet.md`.
- **Next action:** implement REL-1 + REL-3 so this verification is automatic, not manual.
