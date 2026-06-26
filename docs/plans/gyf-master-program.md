# GYF Master Program — the complete, loop-engineered build of the full vision

> **Status:** proposed master plan (2026-06-27). **Scope: the entire product**, M0→M12 + P2–P5.
> **DRY contract:** this does **not** restate scope/DoD/order — those live in `docs/roadmap.md`
> (order + per-milestone DoD), `docs/engineering-doctrine.md` (law/gates), `docs/tech-stack.md`
> (model per pillar), `docs/vision/ideas-complete.md` (the why). **This file = the execution method:**
> how every milestone in the roadmap is driven to "done" as a gated loop, plus the cross-cutting
> production quality/security/deploy/eval loops that `feedback-v2` demands.
> The launch slice (`docs/plans/launch-loop-engineering.md`, W0–W8) is **one window** of this program.

## 1. The method (applies to every milestone below)

Every milestone is a **bounded loop**: `rubric → generate → evaluate (auto + visual + adversarial) →
review → gate → promote | iterate`. Three nested tiers (macro = milestone DoD; meso = per-feature
GAN generate↔evaluate; micro = TDD + reviewers + `make ci`). Gated by the **five invariants**
(no silent regression · nothing non-commercial served · confidence+reason on every output · user
owns their data · baseline behind every port). Method detail + ECC skill/agent mapping:
`docs/plans/launch-loop-engineering.md` §1, §6, §7 — **the same machinery runs the whole program.**

**Promotion rule (D5):** offline metrics *select* candidates; **online A/B + interleaving + IPS
*promote*.** No milestone counts as done until DoD passes on **happy and failure paths**
(milestone-done discipline).

## 2. Program map — status × loop, in dependency order

Legend: ✅ done · ⏳ in progress · ▢ not started. (Status = ground truth per `roadmap.md` §0.)

### Stage 0 — Foundation controls
| M | Loop / gate (DoD ref: roadmap) | Status |
| --- | --- | --- |
| **M0** license gate + import-boundary lint | non-commercial artifact fails CI; clean passes | ✅ |
| **M1** eval harness + promotion gate | promotion requires a passing eval report | ✅ |

### Stage 1 — Finish the stylist brain (gated adapters behind ports)
| M | Loop / gate | Status |
| --- | --- | --- |
| **M2** embedding upgrade (SigLIP2 / Fashion encoder) | re-embed catalog, MRR/Recall ≥ baseline, promoted via M1 — **needs a real GPU-lane run** | ⏳ |
| **M3** photo body-type (SAM 3D Body→MHR+Anny) | photo→body_type+measurements+confidence; manual path intact; fairness report | ▢ |
| **M4** skin-tone ⚠️ fairness-gated | Monk-spectrum fairness eval passes **before** enable; degrades to manual | ▢ |

### Stage 2 — Product surface (the payable core) — **= launch plan W0–W8**
| M | Loop / gate | Status |
| --- | --- | --- |
| **M5** auth + onboarding UI (manual ships first; photo path stubbed) | secure signup→consent→editable profile→recs | ▢ |
| **M6** stylist experience (outfit cards, reason+confidence, NL goal, occasion, feedback) | diverse explained outfits; feedback updates taste live | ▢ |
| **M7** discovery + commerce (visual search, shop-the-look redirect + affiliate attribution) | real buy-links + attribution | ▢ |
| **M8** collections + sessions + wardrobe stub + profile | saved/sessions/history persist | ▢ |
| **M8.5** trust/transparency surface (user confidence labels + operator model-status view) | experimental labels + live-vs-shadow eval scores | ▢ |

### Stage 3 — See-it-on-you (try-on v1)
| **M9** try-on behind `TryOnRenderer` | render designed outfit on user photo + reason; async job/progress; safety filter; consent storage; honest fallback. ⚠️ **license**: free/open VTON weights are mostly non-commercial (invariant #2) → use permissive/own-on-brand-photos | ▢ |

### Stage 4 — Social & gamification
| **M10** socials (posts, react/share, **style-following re-rendered to follower's tone**) | follow → outfits re-rendered, not copied | ▢ |
| **M11** gamification (badges/perks from engagement, profile) | badges award from real engagement signals | ▢ |

### Stage 5 — Beta launch hardening → 🎯 Phase-1 launch
| **M12** security review + rate limits + e2e + perf/a11y + observability/alerting + deploy | beta gate: no high/critical security findings, SLOs met, zero-downtime + rollback | ▢ |

### Phases 2–5 — post-launch, data-driven (unlock as first-party behaviour accrues)
| Phase | Loop / gate | Status |
| --- | --- | --- |
| **P2** Taste engine — HSTU (Apache) foundation+adapter **trained on our events** behind `Ranker`; compatibility (TATTOO→GNN); wardrobe/context/mood | promote over embedding baseline **only via online gate**; embedding stays cold-start fallback | ▢ |
| **P3** Shopping companion — multi-retailer, price/availability sync, smarter buying | accurate live price/availability; multi-retailer ranking | ▢ |
| **P4** Owned try-on — train MIT/Apache VTON on **brand on-model photos** when per-render cost justifies ownership; footwear push | owned model ≥ rented quality at lower marginal cost | ▢ |
| **P5** Ambient + B2B — HSTU-scale collective intelligence; **B2B data engine** (event lake → DP + k-anonymity → distilled partner API, PII-separated) | distilled model serves partners; strict PII separation proven | ▢ |

## 3. Cross-cutting production loops (run continuously, never deferred — feedback-v2's "no compromise")

These are not milestones; they are **standing gates** every milestone passes through (roadmap §Cross-cutting):

- **X1 — Quality/eval (W8).** Offline + online + **visual/E2E** (`ecc:e2e-runner`) gates in CI; drift + shadow + auto-rollback. The connective tissue making every loop gateable.
- **X2 — Frontend excellence (W5 method, every UI milestone).** Design system + tokens + motion; WCAG 2.2 AA; Core Web Vitals budget; **PWA-first, mobile-first** (native camera for try-on); zero console errors; no mockups. Driven by `ecc:gan-design` against an explicit aesthetic rubric.
- **X3 — Security (W6, hard gate before every deploy).** AuthN/Z, Supabase **RLS**, secret hygiene, input validation, rate limiting, SSRF/injection/OWASP, dependency CVEs, consent/erasure paths. `ecc:security-review` + `security-reviewer` + `ecc:security-scan`. "No walls that can be broken."
- **X4 — Data flywheel & catalog (W2).** Real+expanded catalog (open dataset now + affiliate feeds); region/culture localization (India sarees, US not) in `taxonomy` + conditioning; clean first-party event capture (the D4 moat).
- **X5 — Deployment & ops (W7).** Production multi-stage Docker images → **Kubernetes** (Helm, ingress+TLS, HPA, GPU lane, secrets, CI/CD preview→prod, blue-green + rollback, dashboards/alerts). Dev stays on Apple `container`.
- **X6 — Privacy & cost discipline.** Consent + erasure by construction; cost budgets as acceptance criteria; free-tier-first except where you chose scale-out (K8s — surface the bill before provisioning).

## 4. Critical path to launch (what actually gates 🎯)

```
M0,M1 ✅ ──► M2 (GPU run) ─┐
                          ├─► [Stage 2: M5→M6→M7,M8,M8.5]  ──► M12 hardening ──► 🎯 LAUNCH
M3, M4 (photo, gated) ────┘     (X1–X6 standing gates throughout)
        try-on(M9) · social(M10,M11) trail launch ·  P2–P5 are post-launch
```
Launch needs: **M2 promoted, Stage 2 complete, X1–X6 green, M12 beta gate passed.** M3/M4 land behind the live surface (manual path ships first). Everything past M9 is fast-follow / post-launch.

## 5. Honest flags & open inputs

- **Flags:** try-on license (M9/P4) · skin-tone fairness (M4) · offline→online recsys gap (P2) · K8s cost vs free-tier-first.
- **Open inputs** (gate specific milestones, not the plan): K8s provider+budget (X5/M12) · affiliate provider+API access (X4/M7) · design language (X2/M6) · catalog size+regions (X4/M2). From `launch-loop-engineering.md` §9.

## 6. Execution order (start here)

**Loop 0** (next): grounded read-only audit (dead-code map · frontend page-by-page state · security baseline) via subagents → execute **W0 hygiene** → return a sharpened, file-level backlog with per-milestone rubrics. Then drive the critical path M2→Stage 2→M12 to launch, with M3/M4 and the post-launch stages following through the same gates. **Nothing advances un-verified.**
