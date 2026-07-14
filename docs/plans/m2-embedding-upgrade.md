# M2 · Embedding upgrade — eval-driven bake-off (not a forced swap)

> **Roadmap:** STAGE 1 → M2. **Doctrine:** D3 (clean foundation), D5 (eval-gated promotion via M1),
> D1/D2 (port + license gate). **Dep:** M1 (✅). **Status:** shipped; historical/evidence only under the active execution contract; evaluation scope corrected
> 2026-07-13. See `docs/research/encoder-eval-alignment-2026-07-13.md`.

## Research finding that reshapes this milestone

The roadmap names the target "SigLIP 2 / Marqo-FashionSigLIP-2." **Marqo-FashionSigLIP-2 does
not exist** — Marqo publishes only `marqo-fashionSigLIP` (the incumbent: ViT-B-16-SigLIP, 768-dim,
Apache-2.0). "SigLIP 2" exists only as Google's **generic** `google/siglip2-*` (Apache-2.0),
which is *not* fashion-tuned. The incumbent's +57% MRR over FashionCLIP came from fashion
fine-tuning; a naive swap to generic SigLIP 2 would most likely **regress** fashion retrieval —
exactly what M1's `is_improvement` gate is built to prevent.

**Therefore M2 is an evidence-driven bake-off, not an assumed upgrade.** We benchmark candidates
against the incumbent on the same dataset and promote *only* a candidate that wins. A defensible
outcome of M2 is "incumbent stays; we have proof + a reusable comparison harness" — that is a
*successful* milestone (it protects quality and exercises M1), not a failure.

## Candidates (all Apache-2.0; research lane until proven)

| Candidate | Why | Risk |
| --- | --- | --- |
| `marqo-fashionSigLIP` (incumbent) | Fashion-tuned SOTA at its size; the bar to beat | — |
| `google/siglip2-base-patch16-224` | SigLIP 2 recipe (self-distillation, masked pred); same B/16 size, fair comparison | generic, not fashion-tuned → may lose |
| `google/siglip2-so400m-patch16-384` | Larger backbone; could win on raw scale | higher dim/cost; re-embed + DB dim change; latency |

> Decisions ("research before choosing", CLAUDE.md §14): start with the base SigLIP 2 (cheapest,
> same size — isolates "v2 recipe" from "more params"). Escalate to so400m only if base is close.

## The dimension problem (the real engineering work)

`item_embeddings.embedding` is `vector(768)` (migration 0002) and `EMBEDDING_DIM = 768` is
hard-coded. Base SigLIP 2 keeps 768 (drop-in); so400m emits 1152. A winning non-768 candidate
needs: an Alembic migration to the new dim, `EMBEDDING_DIM` made model-derived (read from the
encoder, not a constant), and a full re-embed under a new `model_version`. We do **not** change
the column until a candidate has *won* the bake-off — measure first, migrate only to promote.

## Build order

1. **Comparison harness (verifiable now, CPU-cheap).** `ml/eval/compare.py`:
   `compare_encoders(encoders, dataset) -> {name: EvalReport}` + a `rank_candidates` that applies
   `gyf_contracts.eval_report.is_improvement` (candidate vs incumbent on the gate metric `mrr`).
   Reuses `evaluate_retrieval` per encoder on the *same* image set/groups. Emits one `EvalReport`
   per candidate into `eval-reports/`. Tested with fake encoders (no weights) — deterministic.
2. **Registry (verifiable now).** Add the two SigLIP-2 candidates to `models.registry.json` as
   `lane: research`, `eval_report: null` (research-lane = offline-only, never served; the M0/M1
   gates already enforce this). License Apache-2.0, verified above.
3. **Real bake-off (uv + GPU/CPU lane — cannot run on the 3.9 box).** Wire candidates into
   `SiglipEncoder` (open_clip/transformers already load `google/siglip2-*`), re-embed the e2e
   catalog per candidate, run `compare.py`, write reports. This is the heavy step; needs the
   perception extra + weight downloads (`HF_HOME=.hf-cache`).
4. **Conditional promotion.** *If* a candidate wins (`is_improvement` true, gate cleared): dim
   migration if needed → re-embed catalog → flip registry entry to `production` + attach its
   report → `check_promotion.py` stays green. *If not:* record the comparison reports as evidence,
   keep the incumbent, close M2.

## DoD

- `compare.py` ranks candidates by the M1 gate metric and emits per-candidate `EvalReport`s;
  unit-tested with fakes (runs in the 3.9 venv).
- Both SigLIP-2 candidates registered research-lane; `check_model_licenses.py` /
  `check_promotion.py` stay green (research lane is exempt, never served).
- A real bake-off has been run in the GPU/uv lane and its reports committed; the promote/keep
  decision is recorded here with the numbers.
- Promotion (if any) goes through M1 unchanged — proving the gate pipeline on a live candidate.

## Feedback v1 implementation (shipped) — abstain on uncertain attributes

User manual-test feedback (`docs/feedbacks/gyf-feedback-v1.md`): perception is accurate "most of
the time, only some attributes with low confidence are incorrect." Errors concentrate in the
low-confidence tail — exactly where D6 says to **abstain**, not guess.

Perception already tags each attribute `{value, confidence, certain}` (`certain = confidence ≥
min_confidence`), but only `formality` honored it downstream; `aesthetic`/`pattern`/`silhouette`/
`fit` — the signals the NL-goal effects engine and aesthetic conditioning act on — were read as
fact regardless of confidence. So a wrong low-confidence `silhouette` could misguide a "look
slimmer" goal.

**Fix (`services/api/app/recsys/candidates.py`):** the candidate SQL now also reads each
structural attribute's `certain` flag, and `_row_to_candidate` drops the value (→ `None`) unless
perception was certain (`_certain` helper). Downstream already guards `is not None`, so an
uncertain read now cleanly **abstains** instead of misranking. Legacy items without the flag are
treated as uncertain (conservative). Verified: `test_uncertain_structural_attributes_abstain`,
`test_certain_structural_attributes_pass_through`; full suite green (API 105, ML 23).

## Honesty note (D6)

If no candidate beats the incumbent, we say so plainly and keep `marqo-fashionSigLIP`. "Latest"
is not a goal; "measurably better, commercial-clean" is (engineering-doctrine thesis).

The completed 112-image bake-off measured image-to-image clustering by canonical category. It did
not measure the production text-to-catalog task. The separate local 840-query artifact used the
same image-to-image protocol, has no matching Marqo run, and lacks a versioned catalog snapshot;
it is therefore neither task-aligned nor a valid cross-model comparison. Promotion state is kept
unchanged to avoid an equally unmeasured rollback. Any later encoder swap requires the frozen,
same-query/same-catalog text relevance evaluation specified in the alignment audit above.
</content>
</invoke>
