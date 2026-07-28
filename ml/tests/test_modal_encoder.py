from __future__ import annotations

import importlib.util
import shutil
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
        self.local_files: list[tuple[str, str]] = []
        self.local_dirs: list[tuple[str, str]] = []
        self.env_vars: dict[str, str] = {}

    def add_local_python_source(self, package: str, *, copy: bool = False):
        self.local_sources.append((package, copy))
        return self

    def add_local_file(self, local_path: str, *, remote_path: str):
        self.local_files.append((local_path, remote_path))
        return self

    def add_local_dir(self, local_path: str, *, remote_path: str):
        self.local_dirs.append((local_path, remote_path))
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
    return _load_modal_encoder_from_path(monkeypatch, MODULE_PATH)


def _load_modal_encoder_from_path(monkeypatch: pytest.MonkeyPatch, module_path: Path):
    fake_modal = _FakeModal()
    monkeypatch.syspath_prepend(str(ROOT / "packages" / "contracts"))
    monkeypatch.setitem(sys.modules, "modal", fake_modal)
    module_name = "test_modal_encoder_import"
    sys.modules.pop(module_name, None)
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, fake_modal


def _copy_policy_bundle(destination: Path) -> None:
    shutil.copy2(ROOT / "models.registry.json", destination / "models.registry.json")
    shutil.copytree(ROOT / "eval-reports", destination / "eval-reports")


def _copy_isolated_modal_bundle(destination: Path) -> Path:
    module_path = destination / "ml" / "serving" / "modal_encoder.py"
    module_path.parent.mkdir(parents=True)
    shutil.copy2(MODULE_PATH, module_path)
    _copy_policy_bundle(destination)
    return module_path


def test_modal_lane_defaults_to_the_canonical_runtime_binding(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("GYF_PERCEPTION_MODEL", raising=False)

    module, fake_modal = _load_modal_encoder(monkeypatch)

    binding = RUNTIME_MODELS["encoder"]
    assert module.MODEL_ID == binding.model_uri
    assert fake_modal._image.env_vars["GYF_PERCEPTION_MODEL"] == binding.model_uri
    assert ("gyf_contracts", True) in fake_modal._image.local_sources
    assert ("models.registry.json", "/opt/gyf-runtime/models.registry.json") in fake_modal._image.local_files
    assert ("eval-reports", "/opt/gyf-runtime/eval-reports") in fake_modal._image.local_dirs


def test_modal_lane_accepts_the_canonical_override_from_the_bundled_policy(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    binding = RUNTIME_MODELS["encoder"]
    module_path = _copy_isolated_modal_bundle(tmp_path / "bundle")
    monkeypatch.setenv("GYF_PERCEPTION_MODEL", binding.model_uri)

    module, _fake_modal = _load_modal_encoder_from_path(monkeypatch, module_path)

    assert module.MODEL_ID == binding.model_uri


def test_modal_lane_rejects_invalid_override_from_the_bundled_policy(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    module_path = _copy_isolated_modal_bundle(tmp_path / "bundle")
    monkeypatch.setenv("GYF_PERCEPTION_MODEL", "hf-hub:unapproved/model")

    with pytest.raises(RuntimeError, match="invalid GYF_PERCEPTION_MODEL override"):
        _load_modal_encoder_from_path(monkeypatch, module_path)


def test_modal_lane_rejects_override_when_the_bundled_policy_is_missing_reports(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    bundle_root = tmp_path / "bundle"
    module_path = bundle_root / "ml" / "serving" / "modal_encoder.py"
    module_path.parent.mkdir(parents=True)
    shutil.copy2(MODULE_PATH, module_path)
    shutil.copy2(ROOT / "models.registry.json", bundle_root / "models.registry.json")
    monkeypatch.setenv("GYF_PERCEPTION_MODEL", RUNTIME_MODELS["encoder"].model_uri)

    with pytest.raises(RuntimeError, match="does not resolve under"):
        _load_modal_encoder_from_path(monkeypatch, module_path)
