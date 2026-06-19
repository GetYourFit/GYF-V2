"""Evaluation harness — offline metrics for candidate selection.

Per the ML lifecycle (plan §4), offline metrics gate *candidate selection only*;
promotion to production requires online A/B + interleaving + counterfactual eval.
This package starts with retrieval metrics (MRR / Recall@K) for perception.
"""
