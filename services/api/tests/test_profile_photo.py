"""POST /profile/photo — photo onboarding endpoint (consent, shadow gate, merge, abstain).

Uses injected fake adapters (no ml weights) so the endpoint's wiring is verified
without torch: consent gating, the skin-tone shadow flag, per-module abstain, the
merge-by-confidence policy, EXIF-stripping decode, and input validation.
"""

from __future__ import annotations

import io

from fastapi.testclient import TestClient
from PIL import Image

from app import main
from app.main import (
    app,
    get_account_repo,
    get_body_adapter,
    get_profile_repo,
    get_skin_adapter,
)
from app.profile.account import InMemoryAccountRepository
from app.profile.models import Profile
from app.profile.photo import BodyResult, SkinToneResult
from app.profile.repository import InMemoryProfileRepository

DEV_USER = "00000000-0000-0000-0000-000000000001"


class _FakeSkin:
    def __init__(self, result: SkinToneResult) -> None:
        self._r = result

    def estimate(self, image: object) -> SkinToneResult:
        return self._r


class _FakeBody:
    def __init__(self, result: BodyResult) -> None:
        self._r = result

    def estimate(self, image: object) -> BodyResult:
        return self._r


def _png_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (120, 90, 80)).save(buf, format="PNG")
    return buf.getvalue()


def _client(*, skin=None, body=None, consent=("data_processing",), profiles=None) -> TestClient:
    accounts = InMemoryAccountRepository(existing={DEV_USER})
    if consent:
        accounts.update_consent(DEV_USER, {k: True for k in consent})
    profiles = profiles if profiles is not None else InMemoryProfileRepository()
    app.dependency_overrides[get_profile_repo] = lambda: profiles
    app.dependency_overrides[get_account_repo] = lambda: accounts
    app.dependency_overrides[get_skin_adapter] = lambda: skin
    app.dependency_overrides[get_body_adapter] = lambda: body
    return TestClient(app)


def _upload(client: TestClient) -> object:
    return client.post(
        "/profile/photo",
        files={"photo": ("me.png", _png_bytes(), "image/png")},
    )


def teardown_function() -> None:
    app.dependency_overrides.clear()


SKIN = SkinToneResult(
    skin_tone="mst7",
    undertone="warm",
    field_confidence={"skin_tone": 0.7, "undertone": 0.7},
    model_version="st1",
)
BODY = BodyResult(
    body_type="hourglass",
    measurements={"waist": 0.24},
    field_confidence={"body_type": 0.8, "measurements": 0.8},
    model_version="b1",
)


def test_skin_tone_in_shadow_is_not_surfaced(monkeypatch):
    monkeypatch.setattr(main.settings, "skin_tone_enabled", False)
    client = _client(skin=_FakeSkin(SKIN), body=_FakeBody(BODY))
    res = _upload(client)
    assert res.status_code == 200
    body = res.json()
    assert body["source"] == "photo"
    assert body["body_type"] == "hourglass"  # body-type surfaces
    assert body["skin_tone"] is None  # skin-tone held in shadow
    assert "skin_tone" not in body["field_confidence"]


def test_skin_tone_surfaced_when_enabled(monkeypatch):
    monkeypatch.setattr(main.settings, "skin_tone_enabled", True)
    client = _client(skin=_FakeSkin(SKIN), body=_FakeBody(BODY))
    body = _upload(client).json()
    assert body["skin_tone"] == "mst7"
    assert body["undertone"] == "warm"
    assert body["field_confidence"]["skin_tone"] == 0.7


def test_photo_estimate_fills_field_over_prior_value(monkeypatch):
    # Uploading a photo is an explicit re-estimate request, so a real estimate fills
    # the field even when a prior value exists — the user sees it, badged "Estimated",
    # and can correct it before saving (which re-stamps it manual). This is the
    # behaviour users expect from clicking "Estimate from photo".
    monkeypatch.setattr(main.settings, "skin_tone_enabled", True)
    existing = InMemoryProfileRepository()
    existing.upsert(
        DEV_USER,
        Profile(skin_tone="mst3", field_confidence={"skin_tone": 1.0}, source="manual"),
    )
    client = _client(skin=_FakeSkin(SKIN), body=_FakeBody(BODY), profiles=existing)
    body = _upload(client).json()
    assert body["skin_tone"] == "mst7"  # photo estimate now fills the field
    assert body["field_confidence"]["skin_tone"] == 0.7
    assert body["body_type"] == "hourglass"


def test_zero_confidence_undertone_guess_is_not_surfaced(monkeypatch):
    # Mirrors the live Space on an abstain: no clean face → skin_tone="unknown" but the
    # undertone classifier has no sentinel and falls back to "neutral", with quality
    # (and thus confidence) collapsed to 0.0. A zero-confidence guess must never be
    # adopted (D6), or the user sees "Estimated undertone" while skin tone stays blank.
    monkeypatch.setattr(main.settings, "skin_tone_enabled", True)
    abstained = SkinToneResult(
        skin_tone="unknown",
        undertone="neutral",
        field_confidence={"skin_tone": 0.0, "undertone": 0.0},
        model_version="st1",
    )
    client = _client(skin=_FakeSkin(abstained), body=None)
    body = _upload(client).json()
    assert body["skin_tone"] is None  # abstained sentinel → not surfaced
    assert body["undertone"] is None  # zero-confidence guess → not surfaced either
    assert body["field_confidence"] == {}


def test_consent_required():
    client = _client(skin=_FakeSkin(SKIN), body=_FakeBody(BODY), consent=())
    assert _upload(client).status_code == 403


def test_unsupported_content_type():
    client = _client(skin=_FakeSkin(SKIN), body=_FakeBody(BODY))
    res = client.post("/profile/photo", files={"photo": ("x.gif", b"GIF89a", "image/gif")})
    assert res.status_code == 415


def test_spoofed_content_type_rejected_by_magic_bytes():
    # A non-image payload wearing an image/png content_type must still be rejected
    # before PIL parses it — the magic-byte sniff, not the spoofable MIME header (M-4).
    client = _client(skin=_FakeSkin(SKIN), body=_FakeBody(BODY))
    res = client.post(
        "/profile/photo",
        files={"photo": ("evil.png", b"<?php echo 'pwn'; ?>\x00\x00\x00\x00", "image/png")},
    )
    assert res.status_code == 415


def test_both_modules_absent_is_503():
    client = _client(skin=None, body=None)
    assert _upload(client).status_code == 503


def test_capability_gate_precedes_upload_validation():
    # F1b: with no estimator configured the 503 must fire BEFORE the body is
    # validated or decoded — an oversized upload proves it (else it would 413).
    client = _client(skin=None, body=None)
    huge = io.BytesIO(b"x" * (main.settings.max_photo_bytes + 10))
    r = client.post("/profile/photo", files={"photo": ("p.jpg", huge, "image/jpeg")})
    assert r.status_code == 503


def test_one_module_absent_still_succeeds(monkeypatch):
    # Body runtime absent (GPU-gated locally), skin present + enabled → still works.
    monkeypatch.setattr(main.settings, "skin_tone_enabled", True)
    client = _client(skin=_FakeSkin(SKIN), body=None)
    body = _upload(client).json()
    assert body["skin_tone"] == "mst7"
    assert body["body_type"] is None  # body abstained (runtime absent)


def test_undecodable_upload_is_422():
    # Valid PNG magic so it passes the byte sniff, but a corrupt body PIL can't
    # decode — exercises the decode-failure path (415 is for non-image signatures).
    client = _client(skin=_FakeSkin(SKIN), body=_FakeBody(BODY))
    corrupt_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    res = client.post("/profile/photo", files={"photo": ("x.png", corrupt_png, "image/png")})
    assert res.status_code == 422
