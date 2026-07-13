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


def _space_input_guards() -> dict[str, object]:
    """Load only the Space's small input guards, never its GPU/model dependencies."""
    import ast
    import base64
    import binascii
    import io

    from PIL import Image

    path = _REGISTRY.parent / "spaces" / "gyf-gpu" / "app.py"
    tree = ast.parse(path.read_text(encoding="utf-8"))
    wanted = {
        "_MAX_IMAGE_BATCH",
        "_MAX_TEXT_BATCH",
        "_MAX_IMAGE_BYTES",
        "_MAX_IMAGE_PIXELS",
        "_MAX_TEXT_CHARS",
        "_MAX_IMAGE_B64_CHARS",
        "_MAX_IMAGE_REQUEST_B64_CHARS",
        "_validate_images",
        "_validate_texts",
        "_decode_image",
    }
    body = [
        node
        for node in tree.body
        if (isinstance(node, ast.Assign) and any(name.id in wanted for name in node.targets))
        or (isinstance(node, ast.FunctionDef) and node.name in wanted)
    ]
    namespace = {"base64": base64, "binascii": binascii, "io": io, "Image": Image}
    exec(compile(ast.Module(body=body, type_ignores=[]), str(path), "exec"), namespace)
    return namespace


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

    embed_texts = next(
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == "embed_texts"
    )
    gpu_decorator = next(
        decorator
        for decorator in embed_texts.decorator_list
        if isinstance(decorator, ast.Call)
        and isinstance(decorator.func, ast.Attribute)
        and decorator.func.attr == "GPU"
    )
    assert {keyword.arg: ast.literal_eval(keyword.value) for keyword in gpu_decorator.keywords} == {
        "duration": 30
    }

    deploy = (_REGISTRY.parent / "scripts" / "deploy_gpu_space.sh").read_text(encoding="utf-8")
    deploy_python = deploy.split("<<'PY'\n", 1)[1].split("\nPY\n", 1)[0]
    upload = next(
        node
        for node in ast.walk(ast.parse(deploy_python))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "upload_folder"
    )
    upload_options = {
        keyword.arg: ast.literal_eval(keyword.value)
        for keyword in upload.keywords
        if keyword.arg in {"allow_patterns", "delete_patterns"}
    }
    assert upload_options == {
        "allow_patterns": ["README.md", "app.py", "requirements.txt"],
        "delete_patterns": "*",
    }

    readme = (space / "README.md").read_text(encoding="utf-8").lower()
    assert "inference lab" in readme
    assert "not a production serving path" in readme


def test_gpu_space_rejects_oversized_or_malformed_public_inputs(monkeypatch):
    import base64
    import io

    from PIL import Image

    guard = _space_input_guards()
    validate_images = guard["_validate_images"]
    validate_texts = guard["_validate_texts"]
    decode_image = guard["_decode_image"]

    validate_images([])
    validate_texts([])
    assert guard["_MAX_IMAGE_BATCH"] == 16
    assert guard["_MAX_TEXT_BATCH"] == 64
    assert guard["_MAX_IMAGE_REQUEST_B64_CHARS"] == 32 * 1024 * 1024
    with pytest.raises(ValueError, match="batch exceeds"):
        validate_images([""] * (guard["_MAX_IMAGE_BATCH"] + 1))
    with pytest.raises(ValueError, match="batch exceeds"):
        validate_texts([""] * (guard["_MAX_TEXT_BATCH"] + 1))
    with pytest.raises(ValueError, match="base64 string"):
        validate_images([1])
    guard["_MAX_IMAGE_REQUEST_B64_CHARS"] = 3
    with pytest.raises(ValueError, match="request"):
        validate_images(["aa", "aa"])
    with pytest.raises(ValueError, match="must be a string"):
        validate_texts([1])
    with pytest.raises(ValueError, match="characters"):
        validate_texts(["x" * (guard["_MAX_TEXT_CHARS"] + 1)])
    with pytest.raises(ValueError, match="valid base64"):
        decode_image("not base64")

    image_bytes = io.BytesIO()
    Image.new("RGB", (1, 1)).save(image_bytes, format="PNG")
    assert decode_image(base64.b64encode(image_bytes.getvalue()).decode()).size == (1, 1)

    guard["_MAX_IMAGE_BYTES"] = 2
    with pytest.raises(ValueError, match="decoded image"):
        decode_image(base64.b64encode(b"abc").decode())

    class OversizedImage:
        width = guard["_MAX_IMAGE_PIXELS"] + 1
        height = 1

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

    guard["_MAX_IMAGE_BYTES"] = 8 * 1024 * 1024
    monkeypatch.setattr(guard["Image"], "open", lambda _stream: OversizedImage())
    with pytest.raises(ValueError, match="pixels"):
        decode_image(base64.b64encode(b"header").decode())


def test_known_non_commercial_models_are_quarantined_to_research():
    # FitDiT / IDM-VTON must never be production-tagged.
    by_name = {c.name: c for c in load_registry(_REGISTRY)}
    for nc in ("fitdit", "idm-vton"):
        if nc in by_name:
            assert by_name[nc].lane is Lane.RESEARCH
            assert not by_name[nc].commercial_ok
