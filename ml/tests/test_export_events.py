"""Tests for the behavioral-event export (pipelines.export_events).

Pure-function coverage: the impression↔engagement join, label semantics from
the reward contract, organic-positive handling, and the report aggregates.
"""

from __future__ import annotations

from pipelines.export_events import _learning_consent_predicate, build_examples, build_report


def _event(action: str, ts: str, *, user="u1", target="i1", ttype="item", context=None):
    return {
        "user_id": user,
        "target_type": ttype,
        "target_id": target,
        "action": action,
        "weight": None,
        "context": context or {},
        "ts": ts,
    }


IMP_CTX = {
    "recommendation_id": "rec-1",
    "occasion": "casual",
    "goals": ["slim"],
    "rank": 0,
    "score": 0.9,
}


def test_impression_without_engagement_is_a_zero_label_negative():
    examples = build_examples([_event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX)])
    assert len(examples) == 1
    ex = examples[0]
    assert ex["label"] == 0.0
    assert ex["engaged_action"] is None
    assert ex["score"] == 0.9
    assert ex["propensity"] is None
    assert ex["rank"] == 0
    assert ex["occasion"] == "casual"


def test_later_engagement_labels_the_impression_with_strongest_signal():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
        _event("view", "2026-07-01T10:01:00+00:00"),
        _event("cart", "2026-07-01T10:02:00+00:00"),
    ]
    examples = build_examples(rows)
    assert len(examples) == 1  # engagements folded into the impression, not duplicated
    assert examples[0]["label"] == 1.2
    assert examples[0]["engaged_action"] == "cart"


def test_skip_labels_negative():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
        _event("skip", "2026-07-01T10:01:00+00:00"),
    ]
    (ex,) = build_examples(rows)
    assert ex["label"] == -0.6
    assert ex["engaged_action"] == "skip"


def test_engagement_before_impression_does_not_leak_backward():
    rows = [
        _event("save", "2026-07-01T09:00:00+00:00"),
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
    ]
    examples = build_examples(rows)
    # the earlier save is organic (unserved), the impression stays unengaged
    labels = sorted(e["label"] for e in examples)
    assert labels == [0.0, 1.0]
    organic = next(e for e in examples if e["label"] == 1.0)
    assert organic["propensity"] is None


def test_organic_engagement_without_impression_exports_as_positive():
    (ex,) = build_examples([_event("save", "2026-07-01T10:00:00+00:00")])
    assert ex["label"] == 1.0
    assert ex["propensity"] is None
    assert ex["engaged_action"] == "save"


def test_non_item_targets_are_not_organic_examples():
    examples = build_examples([_event("follow", "2026-07-01T10:00:00+00:00", ttype="user")])
    assert examples == []


def test_examples_are_scoped_per_user_and_item():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
        _event("save", "2026-07-01T10:01:00+00:00", user="u2"),  # different user
        _event("save", "2026-07-01T10:01:00+00:00", target="i2"),  # different item
    ]
    imp = next(e for e in build_examples(rows) if e["recommendation_id"] is not None)
    assert imp["label"] == 0.0


def test_attribution_is_scoped_by_target_type():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", ttype="item", context=IMP_CTX),
        _event("save", "2026-07-01T10:01:00+00:00", ttype="outfit", context=IMP_CTX),
    ]
    examples = build_examples(rows)
    assert [e["label"] for e in examples] == [0.0, 1.0]


def test_recommendation_id_prevents_repeated_item_credit():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
        _event(
            "impression",
            "2026-07-01T11:00:00+00:00",
            context={**IMP_CTX, "recommendation_id": "rec-2"},
        ),
        _event(
            "save",
            "2026-07-01T11:01:00+00:00",
            context={"recommendation_id": "rec-2"},
        ),
    ]
    examples = build_examples(rows)
    assert [(e["recommendation_id"], e["label"]) for e in examples] == [
        ("rec-1", 0.0),
        ("rec-2", 1.0),
    ]


def test_exact_recommendation_can_credit_an_older_preceding_impression():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
        _event(
            "impression",
            "2026-07-01T11:00:00+00:00",
            context={**IMP_CTX, "recommendation_id": "rec-2"},
        ),
        _event(
            "save",
            "2026-07-01T11:01:00+00:00",
            context={"recommendation_id": "rec-1"},
        ),
    ]
    examples = build_examples(rows)
    assert [e["label"] for e in examples] == [1.0, 0.0]


def test_legacy_engagement_credits_only_latest_impression():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
        _event(
            "impression",
            "2026-07-01T11:00:00+00:00",
            context={**IMP_CTX, "recommendation_id": "rec-2"},
        ),
        _event("save", "2026-07-01T11:01:00+00:00"),
    ]
    examples = build_examples(rows)
    assert [e["label"] for e in examples] == [0.0, 1.0]


def test_export_filter_uses_canonical_learning_consent_with_legacy_fallback():
    predicate = _learning_consent_predicate("u")
    assert "u.consent_flags ->> 'behavioral_learning'" in predicate
    assert "u.consent_flags ->> 'personalization'" in predicate
    assert predicate.index("behavioral_learning") < predicate.index("personalization")
    assert "<> 'false'" in predicate


def test_report_contains_rates_and_tables():
    rows = [
        _event("impression", "2026-07-01T10:00:00+00:00", context=IMP_CTX),
        _event(
            "impression", "2026-07-01T10:00:00+00:00", target="i2", context={**IMP_CTX, "rank": 1}
        ),
        _event("save", "2026-07-01T10:01:00+00:00"),
    ]
    report = build_report(rows, build_examples(rows))
    assert "1/2 (50.0%)" in report  # positive engagement rate on served items
    assert "| impression | 2 |" in report
    assert "| casual | 2 | 50.0% |" in report
    assert "| 0 | 1 | 100.0% |" in report  # rank-0 engaged, rank-1 not
