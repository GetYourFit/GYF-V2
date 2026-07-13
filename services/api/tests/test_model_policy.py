"""Tests for the model license/lane gate (engineering-doctrine D2) + the live registry."""

from __future__ import annotations

from pathlib import Path

import pytest

from gyf_contracts.model_policy import (
    Lane,
    ModelCard,
    is_servable,
    load_registry,
    production_card_for,
)

_REGISTRY = Path(__file__).resolve().parents[3] / "models.registry.json"


def _card(**over) -> ModelCard:
    base = dict(
        name="m",
        capability="encoder",
        provider="p",
        license="Apache-2.0",
        lane=Lane.PRODUCTION,
        commercial_ok=True,
        train_data_commercial_ok=True,
        train_data_license="Apache-2.0",
        eval_report="eval-1",
    )
    base.update(over)
    return ModelCard(**base)


def test_clean_production_model_is_servable():
    ok, reasons = is_servable(_card())
    assert ok and reasons == []


def test_research_lane_is_never_servable():
    ok, reasons = is_servable(_card(lane=Lane.RESEARCH))
    assert not ok
    assert any("not production" in r for r in reasons)


def test_non_commercial_model_blocked_with_reason():
    ok, reasons = is_servable(_card(commercial_ok=False, license="CC-BY-NC"))
    assert not ok
    assert any("not commercial-OK" in r for r in reasons)


def test_non_commercial_training_data_blocked():
    # The "MIT code, non-commercial weights" trap: model OK, training data not.
    ok, reasons = is_servable(_card(train_data_commercial_ok=False))
    assert not ok
    assert any("training-data" in r for r in reasons)


def test_missing_eval_blocks_when_required():
    assert not is_servable(_card(eval_report=None))[0]
    assert is_servable(_card(eval_report=None), require_eval=False)[0]


def test_reasons_accumulate():
    ok, reasons = is_servable(_card(lane=Lane.RESEARCH, commercial_ok=False, eval_report=None))
    assert not ok and len(reasons) >= 3


def test_live_registry_loads_and_every_production_model_is_servable():
    cards = load_registry(_REGISTRY)
    assert cards, "registry is empty"
    for c in cards:
        if c.lane is Lane.PRODUCTION:
            ok, reasons = is_servable(c)
            assert ok, f"{c.name} is production but not servable: {reasons}"


def test_production_card_for_resolves_version_from_uri():
    cards = [
        _card(name="prod", model_uri="uri://prod", model_version="prod-v1"),
        _card(name="old", lane=Lane.RESEARCH, model_uri="uri://old", model_version="old-v1"),
    ]
    assert production_card_for("uri://prod", cards).model_version == "prod-v1"


def test_production_card_for_rejects_research_unknown_and_unservable():
    cards = [
        _card(name="research", lane=Lane.RESEARCH, model_uri="uri://r"),
        _card(name="noneval", model_uri="uri://n", model_version="n-v1", eval_report=None),
    ]
    with pytest.raises(ValueError, match="not production"):
        production_card_for("uri://r", cards)
    with pytest.raises(ValueError, match="not servable"):
        production_card_for("uri://n", cards)
    with pytest.raises(ValueError, match="no production model registered"):
        production_card_for("uri://missing", cards)


def test_production_card_for_matches_the_live_perception_default():
    # The backfill resolves the stamped version from this exact lookup; keep it green.
    card = production_card_for("hf-hub:timm/ViT-B-16-SigLIP2", load_registry(_REGISTRY))
    assert card.model_version == "google-siglip2-base-v1"


def _space_allowed_models() -> set[str]:
    """The GPU Space's ALLOWED_MODELS literal, read without importing its torch/gradio deps."""
    import ast

    src = (_REGISTRY.parent / "spaces" / "gyf-gpu" / "app.py").read_text(encoding="utf-8")
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Assign) and any(
            isinstance(t, ast.Name) and t.id == "ALLOWED_MODELS" for t in node.targets
        ):
            return set(ast.literal_eval(node.value))
    raise AssertionError("ALLOWED_MODELS not found in spaces/gyf-gpu/app.py")


def _norm_uri(uri: str) -> str:
    # "hf://Marqo/x" and "hf-hub:Marqo/x" both denote the same HF repo "Marqo/x".
    return uri.split(":", 1)[-1].lstrip("/")


def test_gpu_space_allowlist_is_commercial_clean_per_registry():
    """The public inference lab serves research encoder candidates for bake-offs, but its
    hand-maintained allow-list is not covered by the CI license gate. Guard it: every model it may
    load must map to a registry encoder card whose model *and* training-data licenses are
    commercial-OK — so a non-commercial checkpoint can never be slipped into the served lane."""
    clean = {
        _norm_uri(c.model_uri): c
        for c in load_registry(_REGISTRY)
        if c.capability == "encoder"
        and c.model_uri
        and c.commercial_ok
        and c.train_data_commercial_ok
    }
    for model_id in _space_allowed_models():
        assert _norm_uri(model_id) in clean, (
            f"Space allow-list has '{model_id}' with no commercial-clean encoder card in the "
            f"registry — promotion rule bypassed"
        )


def test_gpu_space_is_an_encoder_lab_not_a_production_or_photo_surface():
    import ast

    space = _REGISTRY.parent / "spaces" / "gyf-gpu"
    tree = ast.parse((space / "app.py").read_text(encoding="utf-8"))
    api_names = {
        keyword.value.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        for keyword in node.keywords
        if keyword.arg == "api_name" and isinstance(keyword.value, ast.Constant)
    }
    assert api_names == {"embed_images", "embed_texts"}

    readme = (space / "README.md").read_text(encoding="utf-8").lower()
    assert "inference lab" in readme
    assert "not a production serving path" in readme


def test_known_non_commercial_models_are_quarantined_to_research():
    # FitDiT / IDM-VTON must never be production-tagged.
    by_name = {c.name: c for c in load_registry(_REGISTRY)}
    for nc in ("fitdit", "idm-vton"):
        if nc in by_name:
            assert by_name[nc].lane is Lane.RESEARCH
            assert not by_name[nc].commercial_ok
