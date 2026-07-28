from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

import pytest

from gyf_contracts.eval_report import RUNTIME_MODELS


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "ml" / "serving" / "modal_encoder.py"


class _FakeImage:
    def __init__(self) -> None:
        self.local_sources: list[tuple[str, bool]] = []
        self.env_vars: dict[str, str] = {}

    def add_local_python_source(self, package: str, *, copy: bool = False):
        self.local_sources.append((package, copy))
        return self

    def pip_install(self, *_args, **_kwargs):
        return self

    def env(self, mapping: dict[str, str]):
        self.env_vars.update(mapping)
        return self


class _FakeModal(types.SimpleNamespace):
    def __init__(self) -> None:
        image = _FakeImage()
        app = types.SimpleNamespace(
            cls=lambda **_kwargs: (lambda cls: cls),
            local_entrypoint=lambda: (lambda fn: fn),
        )
        super().__init__(
            _image=image,
            Image=types.SimpleNamespace(
                debian_slim=lambda **_kwargs: image,
            ),
            Volume=types.SimpleNamespace(
                from_name=lambda *_args, **_kwargs: object(),
            ),
            Secret=types.SimpleNamespace(
                from_name=lambda *_args, **_kwargs: object(),
            ),
            App=lambda *_args, **_kwargs: app,
            enter=lambda **_kwargs: (lambda fn: fn),
            asgi_app=lambda: (lambda fn: fn),
        )


def _load_modal_encoder(monkeypatch: pytest.MonkeyPatch):
    fake_modal = _FakeModal()
    monkeypatch.syspath_prepend(str(ROOT / "packages" / "contracts"))
    monkeypatch.setitem(sys.modules, "modal", fake_modal)
    module_name = "test_modal_encoder_import"
    sys.modules.pop(module_name, None)
    spec = importlib.util.spec_from_file_location(module_name, MODULE_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, fake_modal


def test_modal_lane_defaults_to_the_canonical_runtime_binding(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("GYF_PERCEPTION_MODEL", raising=False)

    module, fake_modal = _load_modal_encoder(monkeypatch)

    binding = RUNTIME_MODELS["encoder"]
    assert module.MODEL_ID == binding.model_uri
    assert fake_modal._image.env_vars["GYF_PERCEPTION_MODEL"] == binding.model_uri
    assert ("gyf_contracts", True) in fake_modal._image.local_sources


def test_modal_lane_accepts_the_canonical_override(monkeypatch: pytest.MonkeyPatch):
    binding = RUNTIME_MODELS["encoder"]
    monkeypatch.setenv("GYF_PERCEPTION_MODEL", binding.model_uri)

    module, _fake_modal = _load_modal_encoder(monkeypatch)

    assert module.MODEL_ID == binding.model_uri


def test_modal_lane_rejects_invalid_override(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("GYF_PERCEPTION_MODEL", "hf-hub:unapproved/model")

    with pytest.raises(RuntimeError, match="invalid GYF_PERCEPTION_MODEL override"):
        _load_modal_encoder(monkeypatch)
