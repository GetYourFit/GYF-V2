# GYF master plan — mission to moat, under ₹3,000/month (2026-07-15)

Status: **ACTIVE, subordinate to** [`active-execution-contract.md`](./active-execution-contract.md).
This is the single consolidated narrative for GYF: what it is, why it wins, how it runs cheap in
India, and the exact order it ships. It does **not** re-derive authority — execution order lives
in the contract, the ₹3,000 infra/perf numbers in [`scale-3k-inr.md`](./scale-3k-inr.md), the
binding law in [`engineering-doctrine.md`](../engineering-doctrine.md), and the ML depth in
[`ml-data-flywheel.md`](./ml-data-flywheel.md) + [`free-vton-moat.md`](./free-vton-moat.md).
Where this doc and the contract disagree, the contract wins. Product intent stays in
[`ideas-complete.md`](../vision/ideas-complete.md). Older per-cycle plans are git history.

---

## 0. The honest diagnosis (read this first)

GYF does **not** have a planning problem or a bloated codebase — two prior whole-repo audits
found it lean, and the plan corpus above is internally consistent and high quality. The product
feels "in shambles" for three concrete, already-diagnosed reasons, none of which is a rewrite:

1. **Search is 30 s cold.** Root-caused (`scale-3k-inr.md` §1): every uncached text query pays a
   ZeroGPU Space cold-start. The catalogue itself, the SQL, the HNSW index, MMR and bounded
   queries are all fine and CI-proven. The fix (embed cache + nightly warm + scale-to-zero Modal
   miss-lane) is **specified and mostly built** — it is gated on the owner deploying Modal and
   flipping the API to always-on Singapore. This is F2.5.
2. **The API sleeps and sits a continent from every user.** Render free tier sleeps (~26 s wake)
   and lives in Oregon; ~250–300 ms RTT to India on every call. Fix: Render Starter, Singapore
   (~₹600/mo) + Supabase Singapore. Config flip, no code. This is F2.5/F10.
3. **The nightly catalogue job is red.** Not the encoder — image embedding works (verified
   2026-07-15: last nightly embedded 2,355 items on ZeroGPU). The red is a `statement timeout`
   on the gender-facet backfill's unbounded scan. One query fix. This is F1-adjacent, do it now.

**So the mission-critical work is execution, not architecture.** This plan therefore optimises
for *shipping the built fixes + sharpening the moat*, and explicitly rejects a ground-up rewrite
(§8). Everything below is either already in flight or a measured, high-leverage addition.

---

## 1. Mission as engineering targets

GYF is a learning stylist that delivers **explainable outfits on real, purchasable catalogue
facts**, gets **measurably better per user**, and renders the designed look **on the user's own
body** — free. Translated to gates:

| Mission clause | Engineering target | Gate |
| --- | --- | --- |
| "Instant, universal" | search ≤400 ms cached / ≤1.5 s uncached, browse ≤300 ms p50 from India | F2.5 SLO (`scale-3k-inr.md` §2) |
| "Understand *you*" | consented exposure↔outcome joins; taste model that beats cold-start on frozen eval | F3, F5/F6 |
| "Trustworthy, not impressive" | every rec ships reason + calibrated confidence + honest abstention | doctrine D6, F1b |
| "Compounds" | eval-gated learned challengers on GYF's own data; online + counterfactual gates | D5, F6/F12 |
| "On your body" | GYF-owned try-on weights, quota- and kill-switch-bounded, free | F8/F9, `free-vton-moat.md` |
| "Universal → cheap" | total hosting + GPU **< ₹3,000/month**, India-effective, scale-to-zero | F10, `scale-3k-inr.md` §3 |

---

## 2. The ₹3,000/month India architecture — and the scale ladder

The beta stack (full rationale + rejected alternatives in `scale-3k-inr.md` §3):

| Layer | Choice | ₹/mo | Note |
| --- | --- | --- | --- |
| Web | Vercel Hobby | 0 | global edge with Indian PoPs |
| API | **Render Starter, Singapore** | ~600 | always-on (kills 26 s sleep); 100–150 ms from India |
| DB/auth/storage | **Supabase Free, Singapore** | 0 | co-located with API (<5 ms vs cross-Pacific today) |
| Cache / ratelimit | Upstash Redis free | 0 | wired |
| Text-embed (search) | in-DB query cache + **Modal T4 scale-to-zero** miss-lane | 0 | inside Modal's $30/mo free credits (~187 T4-h) |
| Image-embed (batch) | HF ZeroGPU (free) → CPU fallback | 0 | verified working; rent-a-GPU is an env flip (§5) |
| Try-on train / serve | Kaggle free T4×2 / ZeroGPU + burst | 0–1500 | quota + kill-switch bounded (`free-vton-moat.md`) |
| Headroom | — | ≥900 | absorbs Supabase Pro **or** GPU burst, owner picks at F12 |

**Scale ladder (the plan is scale-ready by construction, not by rewrite):**
- **0–10k users (beta):** the table above. Scale-to-zero everywhere; spend tracks usage, floors
  near ₹600. 10k-user capacity was costed and fits the ceiling (evidence in git-history master plan §18).
- **10k–100k:** Supabase Pro ($25) for connection pooling + 8 GB; keep Modal for embeds; add a
  read replica only if pgvector p95 slips. Still India-region, still scale-to-zero GPU.
- **100k+:** promote pgvector → Qdrant (self-host on the Singapore box or Qdrant Cloud free →
  paid) **only when a measured recall/latency ceiling is hit** — the port (`retrieval`) already
  abstracts this, so it's an adapter swap, not a migration. Dedicated GPU only when idle-billing
  becomes cheaper than per-request burst (a measured crossover, not a guess).

Every step is a config/adapter change behind an existing port — the doctrine's D1/D7 buy this.

---

## 3. Blazing-fast + cheap retrieval — the novel optimisations (new, high-leverage)

The current retrieval is correct but stores full-width fp32 vectors. Three SOTA techniques make
it **4–30× smaller and faster on the same free Supabase 500 MB**, and none needs a model change —
they exploit properties the incumbent already has:

1. **Matryoshka truncation (coarse-to-fine search).** SigLIP 2 is MRL-trained
   ([MRL](https://arxiv.org/abs/2205.13147); [SigLIP 2](https://arxiv.org/abs/2502.14786) adopts
   it), so its embedding *prefix* is itself a valid smaller embedding. Store a **256-dim** prefix
   as the HNSW-indexed search vector (4.5× smaller than 1152-dim, 4–6× faster scan, fits the free
   tier with room for 100k+ items), then **re-rank the top-K on the full-width vector** kept in a
   side column. Recall stays ~unchanged for top-K; cost drops hard. One migration + a two-stage
   query. *(Robustness caveat: [2605.16608](https://arxiv.org/html/2605.16608v1) shows truncation
   is safe except under heavy truncation — 256 is well inside the safe zone; measure recall@20
   before promoting, per D5.)*
2. **Quantised candidate generation.** pgvector supports `halfvec` (fp16, 2× smaller, near-lossless)
   today; 1-bit/int8 RaBitQ-style candidate gen + full-precision rerank
   ([RaBitQ line, 2605.16007](https://arxiv.org/pdf/2605.16007);
   [cloud-CPU vector search, 2505.07621](https://arxiv.org/pdf/2505.07621)) gives another large
   step on cheap CPUs. Ship `halfvec` first (trivial, safe), reserve binary for the 100k+ rung.
3. **Zipfian query-embedding cache** (already in `scale-3k-inr.md` §4) — after a week most searches
   are embed-free. Combined with (1)+(2), the warm search hot path is pure in-region pgvector on
   tiny vectors: **sub-100 ms is reachable on the free tier**, not just the ≤400 ms SLO.

These are the "blazing fast + budget" answer, and they *compound* the moat: a smaller, faster
index means more headroom under ₹3k as the catalogue and user base grow.

---

## 4. The ML platform — SOTA per component (arxiv-scanned 2026-07-15)

Verdict up front: **no component is on a wrong or dead-end choice.** Every pick is current SOTA or
the correct pragmatic launch step with a documented upgrade path. The moat is data + eval +
adapter (doctrine), not backbone-swapping. Keep, and gate upgrades on measured wins.

| Component | Current pick | SOTA now (arxiv) | Action |
| --- | --- | --- | --- |
| Perception encoder | Marqo-FashionSigLIP | [SigLIP 2](https://arxiv.org/abs/2502.14786); generic backbones weak on multi-item street looks ([LookBench](https://arxiv.org/html/2601.14706v1)) | **Keep** + apply §3 Matryoshka/quantisation. Fashion-tuned + our-data adapter is the right hedge. |
| Recsys | two-tower + ranker → HSTU/TIGER | [Semantic-ID handbook](https://arxiv.org/pdf/2507.22224); [Snapchat in prod](https://arxiv.org/pdf/2604.03949); OneRec | **Keep launch stack**; the handbook is the migration playbook at P2 event volume. |
| Outfit compatibility | transformer-over-set + GNN + DPP/MMR | [FGAT](https://arxiv.org/pdf/2508.11105); [History-aware Transformers](https://arxiv.org/abs/2407.00289); [Loom occasion priors](https://arxiv.org/pdf/2605.09830) | **Keep**; fold Loom's occasion-aware priors into our existing occasion conditioning (cheap win). |
| Body measurement | SAM 3D Body → MHR + Anny | [Anny](https://arxiv.org/pdf/2511.03589) (our calib model); [SAM-3DB fidelity audit](https://arxiv.org/html/2601.06035) | **Keep**; read the fidelity audit before any sizing promotion (it speaks to the DoD threshold). |
| Skin tone (fairness-gated) | custom CIELAB + Monk eval | [regressor 0.5 MST dist under diverse light](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11122461/); [colorimeter audit](https://arxiv.org/html/2602.10265) | **Research-lane only**; our eval fails DoD (gap 3.2 vs ≤1.0). Try the diverse-lighting regressor; promote only on the fairness gate. |
| Virtual try-on | licensed→own on brand photos | [MuGa-VTON](https://arxiv.org/abs/2508.08488), [DiT-VTON](https://arxiv.org/pdf/2510.04797) multi-garment DiT | **Own lane (Leffa LoRA on GYF pairs)** per contract F8; MuGa/DiT-VTON is the own-it-later target. Blocked on GPU budget + data, not research. |
| Intent parsing | Qwen 3.x NLU | stable | **Keep.** |
| Continuous eval | offline selects, online promotes (A/B + IPS) | [SNIPS/MNAR OPE](https://ar5iv.labs.arxiv.org/html/2502.08993); [IPS-weighted BPR](https://www.arxiv.org/pdf/2509.00333) | **Keep**; adopt SNIPS + MNAR correction once logged propensities are sufficient. |

---

## 5. The moat — why no competitor can copy it

Infra is copyable; ₹3k of hosting is not a moat. The uncopyable asset is the **closed learning
loop this budget keeps alive**, three reinforcing layers:

1. **Consented first-party behaviour with exact exposure↔outcome joins** (F3) → learned rankers no
   one else has the data to train (`ml-data-flywheel.md`).
2. **Try-on weights fine-tuned on GYF's own catalogue on-model pairs** (F8/F9) — real paired data a
   competitor cannot legally train on; the only production lane, free and quota-bounded
   (`free-vton-moat.md`).
3. **On-device taste (novel, differentiating, privacy-native).** A small per-user taste model that
   runs *on the user's phone* (the parked Flutter surface is the vehicle), syncing only gradients/
   summaries — device-cloud collaboration
   ([CHORD, 2510.03038](https://arxiv.org/pdf/2510.03038);
   [on-device seq-rec, 2601.09306](https://arxiv.org/html/2601.09306);
   [edge-AI survey, 2503.06027](https://arxiv.org/pdf/2503.06027)). This is simultaneously a
   **privacy moat** (personalisation without shipping behaviour to the server), a **latency win**
   (instant re-rank on-device), and a **cost win** (free compute on the user's hardware) — and it
   is directly aligned with doctrine D8. Design it now, ship at the mobile phase (post-F11); it is
   the one thing on this list that a FAANG incumbent's server-centric stack structurally resists.

---

## 6. Security, privacy & production quality (non-negotiable floor)

Already binding (doctrine invariants, contract F2); this plan does not relax them for speed:
- RLS + least-privilege DB ownership; per-user private storage; consent switch real at every sink
  (sink, taste repo, training export); export + hard-delete + session revocation with evidence.
- Every user-facing output: calibrated confidence + human reason + honest abstention.
- No non-commercial weight on the serving path (CI license gate D2); nothing promoted without the
  eval gate D5; deterministic fallback behind every ML/GPU port (D1, invariant #5).
- Bounded queries, rate limits, security headers, CVE-clean deps — all CI-gated today.
- Every slice ships with `make fmt-check lint typecheck doctrine test` + `bun run build` **and**
  before/after SLO numbers from an Indian vantage (contract verification set + `scale-3k-inr.md` §2).

---

## 7. Lean codebase — the deletion set (no rewrite; delete-then-verify)

The repo is lean; the honest cleanup is bounded, and the contract already schedules it as **F13**
(after behaviour is protected). Do not rewrite working, deployed, tested code — that trades a
known-good system for unknown risk against a mission that needs *shipping*, not churn. The F13
deletion set:
- Parked Flutter client **only if** mobile is deferred past the loop (else it becomes §5.3's vehicle — keep).
- Duplicate Saved/Collections surface; the losing Canvas vs Explore surface (after the eval picks one).
- Stale scaffolds/assets/docs; unused Kafka/Redpanda paths; the fal/FASHN try-on adapters once the
  owned checkpoint promotes (replace-then-delete); migration shims; cancelled payment planning.
- **Done this session (2026-07-15):** deleted the dead paywall doc, the duplicate `gyf-complete-plan`,
  the 2,522-line superseded master plan, and a foreign `subagents_configs/` dir; consolidated the
  plan corpus to this doc + contract + `scale-3k-inr` + `ml-data-flywheel` + `free-vton-moat`.

Everything replaced earlier (per replace-then-delete) already dies in its own slice; F13 only
sweeps what's left.

---

## 8. Why not a ground-up rewrite (the expert call)

The owner authorised a rewrite "if measurably better." Measured, it is not: the app is deployed,
tested (55 web + 346 API + 83 ML tests green), CI-gated, and behind clean capability ports that
already let any single component be swapped without touching call sites. A rewrite would discard
that verified surface to re-earn it, delaying the only things that move the product — the F2.5
speed fix and the moat. The correct, higher-IQ path is **surgical replacement behind the ports**:
each component upgrades in place, gated on a measured win, with the deterministic incumbent always
behind it. That *is* the doctrine. Rewrite is the expensive way to stand still.

---

## 9. Execution — mapped to the contract (order is the contract's, not re-invented)

| Contract slice | This plan's work | Owner action needed |
| --- | --- | --- |
| **now** | fix the gender-backfill `statement timeout` (unbounded scan); commit the encoder CPU-fallback + lane-report diff | — |
| F1b | truthful filters/confidence/capability checks | — |
| F2 | consent/export/deletion/RLS (built; verify) | click a real recovery email once |
| **F2.5** | §3 embed cache + Matryoshka/`halfvec` + Modal miss-lane; Render Starter+Singapore; Supabase Singapore; measure SLOs | **deploy Modal; flip Render region+plan (₹600); create Supabase Singapore project** |
| F3 | learning-event truth (exposure↔outcome joins) | — |
| F4 | catalogue truth (rights/price/availability/freshness) incl. image CDN decision | — |
| F5/F6 | free recsys incumbent + small learned challenger through eval/shadow/cohort gates | — |
| F7 | colour + photo assistance (correctable, separately consented) | approve fairness eval thresholds + panel |
| F8/F9 | owned try-on lane (Leffa LoRA on GYF pairs), eval scorecard, open free+quota-bounded | fund a Kaggle/GPU burst if used |
| F10 | region migration with parity gates; VPS/Fly re-eval only on SLO miss | — |
| F11 | two-week closed free beta | recruit beta cohort |
| F12/F13 | evidence-led improvement; deletion sweep (§7); design on-device taste (§5.3) | pick Supabase-Pro vs GPU headroom from reconciled cost |

---

## 10. The four flips that end "in shambles"

Everything else is code the plan already covers. These owner-only actions unblock the felt pain:
1. **Deploy the Modal T4 text-embed endpoint** (kills the 30 s cold search). Wrap `spaces/gyf-gpu/app.py`.
2. **Flip Render → Starter, Singapore** (~₹600/mo; kills the 26 s sleep + halves RTT).
3. **Create the Supabase Singapore project** (co-locate DB with API; the migration recipe is proven).
4. **Set `GYF_ENCODER_REMOTE_KIND=http` + a rented-GPU URL** only when a nightly reports `lane=local`
   on a non-empty queue (image-embed already works on ZeroGPU; this is the headroom switch).

---

## Sources
arxiv, retrieved 2026-07-15 — see inline links in §3–§5. Prior evidence: `scale-3k-inr.md`,
`ml-data-flywheel.md`, `free-vton-moat.md`, `engineering-doctrine.md`, and the git-history July
master plan (§17–19 arXiv/INR/bias research).
