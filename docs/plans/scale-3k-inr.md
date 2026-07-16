# Scale GYF on <₹3,000/month — India-first serving, measured speed, owned moat (updated 2026-07-16)

Status: **ACTIVE, subordinate to** [`active-execution-contract.md`](./active-execution-contract.md).
This document is the researched infrastructure/performance/budget spec the contract's **F2.5**
(performance floor) and **F10** (infrastructure proof/migration) execute. It introduces no new
sequence beyond the owner amendment recorded in the contract on 2026-07-14. Where this document
and the contract disagree, the contract wins. ML depth lives in
[`ml-data-flywheel.md`](./ml-data-flywheel.md); the owned try-on lane in
[`free-vton-moat.md`](./free-vton-moat.md) — this plan does not duplicate them.

## 0. Owner decision being executed (2026-07-14)

- Total hosting + GPU ceiling: **<₹3,000/month (~$35)**, scalable as the user base grows.
- Services must be effective from the Indian subcontinent (latency + payability).
- Rewrite-when-better: existing code may be rewritten where the replacement is **measurably**
  better in debuggability, maintainability, security or speed — measured, not asserted
  (extends the contract's relaxed incumbent-preservation amendment).
- Lean codebase: junk/duplicate deletion remains **F13** (replace-then-delete applies earlier);
  doc consolidation is DONE structurally — the `check_doc_alignment.py` gate enforces exactly
  one execution authority and 22 subordinate/evidence plans.
- Commercial use is real use: free tiers whose terms prohibit commercial/affiliate deployments
  are previews, not production architecture.

## 1. Measured baseline (latest contract evidence: 2026-07-16, from India, prod)

Superseded by the pooled measurement below. These numbers were taken with a client that opened a
fresh connection per sample, so each row carries ~0.5 s of the gate's own handshakes:

| Surface | Measured | Verdict |
| --- | --- | --- |
| `/health` | 0.40 s p50 / 0.86 s p95 | passes the fixed scorecard |
| `/items/browse` | 0.80 s p50 / 0.99 s p95 | improved, still misses both targets |
| `/items/search` cached | 1.20 s p50 / 1.23 s p95 | cache works; cross-region DB/API path misses |
| `/items/search` uncached | 3.68 s p50 / **45.93 s p95** | encoder-error fallback is catastrophic |

## 1a. Corrected baseline (2026-07-16, pooled connection, from India)

`measure_slo.py` now reuses one connection, as Expo's `fetch` and browsers do (fixed in `d8c7f44`;
the per-connection gate reported `/health` at 0.81 s versus 0.29 s pooled). Work is each surface's
p50 minus the `/health` p50 on the same connection — `/health` touches no database, so what is left
of it is transit.

| Surface | p50 / p95 | work | SLO | Verdict |
| --- | --- | --- | --- | --- |
| `/health` | 0.31 / 0.35 s | transit floor | 0.5 / 1.0 s | **PASS** |
| `/items/browse` | 0.61 / 0.68 s | 0.31 s | 0.3 / 0.8 s | p50 FAIL, p95 PASS |
| `/items/search` cached | 0.89 / 0.97 s | 0.59 s | 0.4 / 0.9 s | FAIL |
| `/items/search` uncached | 2.05 / 7.00 s | 1.74 s | 1.5 / 3.0 s | FAIL |

**The remaining cause is topology, not SQL.** Production `EXPLAIN (ANALYZE, BUFFERS)`: the indexed
browse ring (`GYF_BROWSE_INDEXED_RING_ENABLED=true` in `render.yaml`) runs in **0.4 ms warm /
17 ms cold**; the dead legacy hash-sort path would take 5.7 s warm / 20.7 s cold, spilling 18.7 MB
per worker to disk across 61,710 available items. Browse's 0.31 s of work is therefore round
trips: **the API is in Render Oregon and the database is in Supabase `aws-1-us-east-1`
(Virginia)**, so every round trip crosses North America.

Measured TCP RTT from India: **Oregon 320.8 ms · Virginia 233.4 ms · Mumbai 26.2 ms.** Virginia is
87 ms closer to Indian users than Oregon *and* already hosts the database. Co-locating the
stateless API with it is the costed non-Singapore experiment the contract requires — presented for
an owner decision, never silently provisioned.

## 2. Target SLOs (the gate for F2.5/F10 promotion)

From an Indian connection, warm service, p50 / p95:

- `/items/browse` ≤ 300 ms / 800 ms
- `/items/search` (cached query) ≤ 400 ms / 900 ms
- `/items/search` (uncached query) ≤ 1.5 s / 3 s — never a cold-GPU 30 s
- Any authenticated page's API data ≤ 500 ms p50
- Zero sleep wakes during Indian daytime (00:00–18:00 UTC)

A change ships only with before/after numbers against these; regressions roll back via the
same config they shipped with.

## 3. The ₹3,000 architecture

| Layer | Choice | ₹/month | Why |
| --- | --- | --- | --- |
| Web | **Render Static after Expo-web parity** | 0 while allowance holds | Commercially permitted static CDN; meter the active workspace's outbound allowance—[Render documents](https://render.com/docs/new-workspace-plans) 5 GB included and $0.15/GB overage for migrated Hobby workspaces from 2026-08-01; Vercel Hobby cannot host the affiliate production surface |
| API | **Existing Render Starter, Oregon** | ≤₹700 ($7 at planning rate ₹100/USD) | Already paid and always-on; owner rejected a Singapore migration |
| DB/auth/storage | **Existing Supabase Free project** | 0 | Avoid identity/data migration before a measured need; review at 70% of every limit |
| Cache/ratelimit | Upstash Redis free (unchanged) | 0 | already wired |
| Text-embed (search) | **Existing in-DB cache** + Modal CPU/T4 scale-to-zero miss candidate | 0 while inside verified credit | Choose CPU/GPU and region only from p95 and cost-per-success; the official $30 credit equals ~50.8 base-price T4 hours, not 187; export required audit evidence because [Starter logs](https://modal.com/pricing) are retained only briefly |
| Try-on training | Kaggle free (30 h/wk T4×2) per `free-vton-moat.md` | 0 | F8 |
| Try-on serving | **Closed pre-PMF**; later Modal/RunPod scale-to-zero benchmark | hard cap ₹1,500 | HF ZeroGPU hosting needs PRO and India-issued cards remain an operational risk; no dependency on it for production |
| Bandwidth/tax/FX reserve | hard cash reserve | ₹650 | ₹500 bandwidth + ₹150 tax/FX buffer |
| Total hard ceiling | API + reserves + optional GPU | **≤₹2,850** | leaves ₹150 emergency margin; GPU cap is zero until F9 opens a lane |

Current alternatives (rechecked 2026-07-16): Mumbai VPS (Vultr / DO / Lightsail)
— best raw latency but buys self-managed TLS/deploys/monitoring/patching for one person; revisit
only if the current stack still misses SLOs after measured software fixes and the owner approves
the operational burden. Fly.io Mumbai — region exists but has quota/operability tradeoffs. AWS Lightsail Mumbai —
payability fine, but the official 4 GB tier is $20/month and consumes most of the ceiling before
GPU. Indian GPU clouds (E2E Networks) — training is already
free on Kaggle; serving stays scale-to-zero (a dedicated GPU is idle-billed waste at beta scale).
Vercel Hobby is rejected for commercial production by its official fair-use terms; Vercel Pro
($20/month) plus API and tax leaves no safe GPU/bandwidth headroom.

Topology rule (owner 2026-07-16): do not create a Singapore candidate or migrate the current
identity/database stack. First reduce query count, remove sequential fallback scans, bound
hydration fan-out and prove the current Oregon Starter with the fixed India matrix. If that still
fails, F10 may prepare a time-boxed, non-Singapore comparison with secret parity and rollback, but
provisioning requires a separate owner decision. Any future auth move must update Supabase
`site_url`/allowlists and JWKS configuration atomically.

## 4. Close the catalogue/search incident (F2.5)

The cache and HTTP encoder port already shipped; immediate repetition proved the cache works. The
remaining work is evidence, not another speculative cache:

1. Emit one request trace with DNS/connect/TTFB/model-load, pool acquire, taste, cache/encoder,
   retrieval SQL, MMR and directory hydration stages. Preserve ranking behaviour.
2. Capture production `EXPLAIN (ANALYZE, BUFFERS)` for anonymous/authenticated browse, filtered
   browse, deep page, cached search and uncached search. Record rows, loops, buffers and index use.
3. Run warm/cold and cached/uncached matrices from India against the current deployment, then
   change only the largest measured stage: encoder lane, pool/SQL/index, hydration or topology.
4. Test the existing Render Starter after each root-cause fix. Do not use a region or database
   migration as the default answer.
5. Pass all §2 SLO rows for a sustained observation window; rehearse rollback. Do not hide the
   failure with keepalive traffic, client caching, skeletons or degraded ranking.

The encoder-error outlier proves keyword fallback is material. Replace dynamic `%ILIKE%` OR scans
with PostgreSQL-native `to_tsvector`/`to_tsquery` prefix lexemes and a matching partial GIN
expression index. GIN is PostgreSQL's preferred text-search index; using the built-in `simple`
configuration avoids an extension dependency and preserves catalogue names. `ts_rank_cd(..., 32)`
keeps the fallback confidence bounded. Build concurrently, verify the exact partial predicate and
index use with production-like data, and deploy migration + query atomically. The legacy browse
path stays only as rollback until its gate, then is deleted with its replacement or at F13.

## 5. What compounds into a moat (already planned, not re-planned here)

The moat is **not** infrastructure or a paper/model name—both are copyable. The defensible asset is
the
closed loop this budget keeps alive: consented behavioural events with exact exposure↔outcome
joins (F3), catalogue truth (F4), eval-gated learned rankers (F5/F6), and try-on weights
fine-tuned on rights-cleared GYF pairs that competitors cannot simply take from GYF
([`ml-data-flywheel.md`](./ml-data-flywheel.md), [`free-vton-moat.md`](./free-vton-moat.md)).
Every rupee above serves that loop; nothing here duplicates it.

## 6. Budget truth at scale

The ₹3,000 ceiling is a **beta constraint**, not a million-user promise. On
[current Supabase pricing](https://supabase.com/pricing), MAU overage alone would be roughly
$2,925/month for one million MAU after the included 100,000, before database compute, storage,
egress, support or GPU. Even if only 1% of one million users requested one 30-second T4 try-on
each month, raw GPU time would exceed the whole ₹3,000 ceiling before cold starts and failed
renders.

Therefore GYF scales by gates:

1. Stay below ₹3,000 while proving activation, D30 retention and unit economics with quotas.
2. At 70% of a provider limit, freeze discretionary inference and prepare a costed next tier.
3. Increase spend only when trailing confirmed contribution covers the next tier with 2× safety
   for three months, or the owner explicitly funds growth.
4. At large scale, negotiate committed-use/provider pricing and separate static, transactional
   and GPU budgets. Never preserve a startup free-tier topology merely because it was cheap.

## 7. Execution mapping (contract order preserved)

| Contract slice | This plan's work |
| --- | --- |
| **F2.5** | §4 trace + EXPLAIN + one measured root-cause fix; before/after India SLO evidence |
| F4 | catalogue truth incl. image hosting/CDN decision — measure image LCP first; Supabase cached egress (5 GB free) or R2 free if it's the bottleneck |
| F8/F9 | Frozen pre-PMF; benchmark cost per successful render, then enforce ₹1,500 cap, quotas + kill switch |
| **F10** | current-topology proof; bandwidth/cost alerts, durable audit export and store release declarations; non-Singapore comparison only after measured SLO failure and owner approval |
| F12 | reconciled real cost vs ceiling; no Supabase Pro upgrade fits the fixed ceiling alongside the API, so trigger a topology review before 70% of any free-tier limit |
| F13 | deletion of everything replaced above (old project/provider lane, Vercel production config, keepalive bandaid once always-on) |

Verification for every slice: the contract's phase set (`make fmt-check lint typecheck doctrine
test`, `bun run build`) plus this plan's §2 SLO measurements from an Indian vantage.
