"""End-to-end Workstream-A evaluation against the live database.

Reads every backfilled embedding + its canonical category from Postgres, runs the
leave-one-out retrieval harness (MRR / Recall@K) grouping by category, and also
reports zero-shot category accuracy vs. the dataset's ground-truth article type.

    GYF_DATABASE_URL=... python scripts/eval_e2e.py
"""

from __future__ import annotations

import json

import numpy as np
from gyf_contracts.taxonomy import classify

from common.config import settings
from eval.retrieval_eval import evaluate_retrieval, write_report

_SQL = """
SELECT e.embedding::text, i.attributes
FROM item_embeddings e JOIN items i ON i.id = e.item_id
ORDER BY i.created_at
"""


def main() -> None:
    import psycopg

    embeddings, groups, predicted = [], [], []
    with psycopg.connect(settings.database_url) as conn:
        for vec_text, attrs in conn.execute(_SQL):
            embeddings.append(np.fromstring(vec_text.strip("[]"), sep=","))
            truth = classify(attrs["taxonomy"]["raw_category"]).name
            groups.append(truth)
            predicted.append((attrs["perception"]["attributes"]["category"], truth))

    matrix = np.asarray(embeddings, dtype=np.float32)
    report = evaluate_retrieval(matrix, groups, model_version=settings.perception_model_version)
    out = write_report(report, f"data/e2e/reports/retrieval_{settings.perception_model_version}.json")

    correct = sum(p["value"] == truth for p, truth in predicted)
    certain = [(p, t) for p, t in predicted if p["certain"]]
    correct_certain = sum(p["value"] == t for p, t in certain)

    print(json.dumps(report.to_dict(), indent=2))
    print(f"\ncategory accuracy (all):     {correct}/{len(predicted)} = {correct / len(predicted):.2%}")
    if certain:
        print(
            f"category accuracy (certain): {correct_certain}/{len(certain)} "
            f"= {correct_certain / len(certain):.2%}"
        )
    print(f"report written: {out}")


if __name__ == "__main__":
    main()
