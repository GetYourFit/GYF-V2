# Encoder evaluation alignment audit — 2026-07-13

## Verdict

The local 840-query report is **not** a text-to-catalog evaluation and is not comparable with
the Marqo report. It must not be used to claim that SigLIP 2 improves live search.

No model lane, registry binding, metric value, or promotion report was changed by this audit.
Keeping the current SigLIP 2 production binding is the safest no-regression action: reverting to
Marqo would also be an unmeasured text-search change. The next encoder swap must remain blocked
until both models are evaluated on the same frozen text-query relevance set and catalog snapshot.

## Evidence

| Artifact or code | What it establishes |
|---|---|
| `ml/data/e2e/reports/retrieval_google-siglip2-base-v1.json` | Local ignored artifact: 840 queries, MRR 0.9383. It contains no dataset id, catalog fingerprint, protocol, query text, relevance judgments, or creation time. |
| `ml/data/e2e/reports/retrieval_marqo-fashionSigLIP-v1.json` | Local ignored artifact: 112 queries, MRR 0.8078. Its different sample count alone makes a direct comparison invalid. |
| `scripts/eval_e2e.py` | Reads stored **image embeddings** from Postgres, uses every catalog item as a query, and defines relevance as equality of canonical category. It never calls `encode_texts` and never reads text-query judgments. |
| `ml/eval/retrieval_eval.py` | Implements leave-one-out embedding self-retrieval. The diagonal is removed and same-group labels are relevant; this is image-to-image category clustering. |
| `eval-reports/bakeoffs/*.json` | The only apples-to-apples SigLIP 2/Marqo run: 112 images, same category labels. SigLIP 2 MRR 0.8422 versus Marqo 0.8078. This supports category clustering only. |
| `.gitignore`, `data/e2e/`, `scripts/e2e_workstream_a.sh` | The raw reports, feed, and images are ignored. The runner reuses whatever local feed and live database happen to exist. There is no committed manifest tying the 840 rows to an immutable dataset/catalog hash. |

The 840 result can be recomputed on a database, but the recorded number is not reproducible from
version-controlled inputs: the exact 840-row catalog snapshot and embeddings are absent. The
current local feed has 24,242 rows, so it does not identify that historical subset.

## Exact missing evaluation

Before any future encoder promotion, create one frozen, versioned text-to-catalog benchmark with:

1. A catalog snapshot id and SHA-256, item ids, image provenance/license, and model/version used
   to create each candidate's image embeddings.
2. A committed query manifest containing query id, literal user-style query text, locale/region,
   and independently judged relevant item ids (prefer graded relevance). Include category,
   attribute, occasion, colour, and compositional queries; do not derive relevance from the model.
3. The same queries, candidate pool, filters, and relevance judgments for SigLIP 2 and Marqo.
   Encode query text with each candidate's text tower and rank that candidate's image embeddings.
4. MRR, Recall@1/5/10, NDCG@10 for graded judgments, zero-result rate, latency, and slice results.
   Report paired uncertainty and require no statistically supported regression against the served
   incumbent. Online shadow/interleaving evidence remains required before traffic promotion under
   doctrine D5.

Until that artifact exists, the truthful gate is: category-clustering evidence may keep the
current model in place, but it cannot justify another text-search promotion or a quality claim for
personalization, outfit recommendation, or conversion.
