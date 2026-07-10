"""Virtual try-on (M9): the FASHN adapter and POST /tryon honesty contract."""

from __future__ import annotations

import base64
import io

from fastapi.testclient import TestClient
from PIL import Image

from app.catalog.directory import InMemoryItemDirectory, ItemDetail
from app.main import app
from app.dependencies import (
    get_account_repo,
    get_event_sink,
    get_item_directory,
    get_tryon_renderer,
)
from app.profile.account import InMemoryAccountRepository
from app.tryon import NullTryOnRenderer, TryOnGarment, TryOnRender
from app.tryon.fashn import FashnTryOnRenderer
from app.tryon.fal_leffa import FalLeffaTryOnRenderer

DEV_USER = "00000000-0000-0000-0000-000000000001"

_TOP = ItemDetail(
    item_id="top-1",
    title="Navy Oxford Shirt",
    category="shirt",
    slot="top",
    price=None,
    currency=None,
    color="navy",
    buy_url=None,
    image_url="https://cdn.example/top-1.jpg",
)
_BOTTOM = ItemDetail(
    item_id="bottom-1",
    title="Charcoal Chinos",
    category="trousers",
    slot="bottom",
    price=None,
    currency=None,
    color="charcoal",
    buy_url=None,
    image_url="https://cdn.example/bottom-1.jpg",
)
_SHOES = ItemDetail(
    item_id="shoes-1",
    title="White Sneakers",
    category="casual shoes",
    slot="footwear",
    price=None,
    currency=None,
    color="white",
    buy_url=None,
    image_url="https://cdn.example/shoes-1.jpg",
)

_PNG_B64 = base64.b64encode(b"rendered-png-bytes").decode()


def _photo() -> tuple[str, io.BytesIO, str]:
    buf = io.BytesIO()
    Image.new("RGB", (64, 128), "white").save(buf, format="PNG")
    buf.seek(0)
    return ("me.png", buf, "image/png")


# --- FASHN adapter (fake transport — no credits, no network) -----------------


class _FakeTransport:
    """Scripted FASHN API: records calls, completes each prediction in one poll."""

    def __init__(self, fail_on_run: int | None = None) -> None:
        self.runs: list[dict] = []
        self._fail_on_run = fail_on_run

    def __call__(self, method: str, url: str, payload: dict | None) -> dict:
        if method == "POST":
            self.runs.append(payload["inputs"])
            if self._fail_on_run == len(self.runs):
                return {"id": None, "error": "PoseError"}
            return {"id": f"pred-{len(self.runs)}", "error": None}
        return {
            "status": "completed",
            "output": ["data:image/png;base64," + _PNG_B64],
            "error": None,
        }


def _renderer(transport) -> FashnTryOnRenderer:
    return FashnTryOnRenderer("key", transport=transport, sleep=lambda _s: None)


def _garments(*details: ItemDetail) -> list[TryOnGarment]:
    return [TryOnGarment(item_id=d.item_id, image_url=d.image_url, slot=d.slot) for d in details]


def test_fashn_composes_sequentially_and_decays_confidence():
    transport = _FakeTransport()
    render = _renderer(transport).render(b"person", _garments(_TOP, _BOTTOM))
    assert not render.abstained
    assert render.rendered_slots == ("top", "bottom")
    # Pass 2's model_image must be pass 1's OUTPUT — sequential composition.
    assert transport.runs[1]["model_image"] == "data:image/png;base64," + _PNG_B64
    assert transport.runs[0]["category"] == "tops"
    assert transport.runs[1]["category"] == "bottoms"
    # Generated user imagery stays off vendor storage (D8).
    assert all(run["return_base64"] is True for run in transport.runs)
    assert render.confidence == round(0.8 * 0.9, 3)  # second pass decays trust


def test_fashn_skips_footwear_honestly():
    transport = _FakeTransport()
    render = _renderer(transport).render(b"person", _garments(_TOP, _SHOES))
    assert render.rendered_slots == ("top",)  # shoes never sent to the vendor
    assert len(transport.runs) == 1


def test_fashn_abstains_when_nothing_renderable():
    render = _renderer(_FakeTransport()).render(b"person", _garments(_SHOES))
    assert render.abstained and render.confidence == 0.0


def test_fashn_partial_failure_returns_honest_partial():
    transport = _FakeTransport(fail_on_run=2)  # top renders, bottom is rejected
    render = _renderer(transport).render(b"person", _garments(_TOP, _BOTTOM))
    assert not render.abstained
    assert render.rendered_slots == ("top",)
    assert "could not be rendered" in render.reason


def test_fashn_total_failure_abstains():
    transport = _FakeTransport(fail_on_run=1)
    render = _renderer(transport).render(b"person", _garments(_TOP))
    assert render.abstained and "failed" in render.reason


# --- fal.ai Leffa adapter (fake transport — no credits, no network) ----------


class _FakeFalTransport:
    """Scripted fal queue API: records submits, completes each in one poll."""

    def __init__(self, fail_on_run: int | None = None) -> None:
        self.runs: list[dict] = []
        self._fail_on_run = fail_on_run

    def __call__(self, method: str, url: str, payload: dict | None) -> dict:
        if method == "POST":
            self.runs.append(payload)
            return {"request_id": f"req-{len(self.runs)}"}
        if url.endswith("/status"):
            failed = self._fail_on_run == len(self.runs)
            return {
                "status": "FAILED" if failed else "COMPLETED",
                "error": "PoseError" if failed else None,
            }
        return {"image": {"url": "data:image/png;base64," + _PNG_B64}}


def _fal_renderer(transport) -> FalLeffaTryOnRenderer:
    return FalLeffaTryOnRenderer("key", transport=transport, sleep=lambda _s: None)


def test_fal_leffa_composes_sequentially_and_decays_confidence():
    transport = _FakeFalTransport()
    render = _fal_renderer(transport).render(b"person", _garments(_TOP, _BOTTOM))
    assert not render.abstained
    assert render.rendered_slots == ("top", "bottom")
    # Pass 2's person image must be pass 1's OUTPUT — sequential composition.
    assert transport.runs[1]["human_image_url"] == "data:image/png;base64," + _PNG_B64
    assert transport.runs[0]["garment_image_url"] == _TOP.image_url
    assert transport.runs[0]["garment_type"] == "upper_body"
    assert transport.runs[1]["garment_type"] == "lower_body"
    assert render.confidence == round(0.8 * 0.9, 3)
    assert render.model_version == "fal-leffa-vto-v1"


def test_fal_leffa_skips_footwear_and_abstains_on_nothing_renderable():
    transport = _FakeFalTransport()
    render = _fal_renderer(transport).render(b"person", _garments(_TOP, _SHOES))
    assert render.rendered_slots == ("top",) and len(transport.runs) == 1
    assert _fal_renderer(_FakeFalTransport()).render(b"p", _garments(_SHOES)).abstained


def test_fal_leffa_partial_failure_returns_honest_partial():
    transport = _FakeFalTransport(fail_on_run=2)
    render = _fal_renderer(transport).render(b"person", _garments(_TOP, _BOTTOM))
    assert not render.abstained
    assert render.rendered_slots == ("top",)
    assert "could not be rendered" in render.reason


def test_fal_leffa_total_failure_abstains():
    render = _fal_renderer(_FakeFalTransport(fail_on_run=1)).render(b"p", _garments(_TOP))
    assert render.abstained and "failed" in render.reason


def test_tryon_provider_selection_covers_both_licensed_lanes(monkeypatch):
    from app import dependencies as deps

    # Simulate registry promotion; the runtime-gate regression tests pin today's
    # research cards to the null renderer until that promotion actually happens.
    monkeypatch.setattr(deps, "runtime_model_verdict", lambda _runtime: (True, []))
    monkeypatch.setattr(deps.settings, "tryon_provider", "fal-leffa")
    monkeypatch.setattr(deps.settings, "fal_api_key", "k")
    assert isinstance(deps.get_tryon_renderer(), FalLeffaTryOnRenderer)
    monkeypatch.setattr(deps.settings, "tryon_provider", "fashn")
    monkeypatch.setattr(deps.settings, "fashn_api_key", "k")
    assert isinstance(deps.get_tryon_renderer(), FashnTryOnRenderer)
    monkeypatch.setattr(deps.settings, "fashn_api_key", "")
    assert isinstance(deps.get_tryon_renderer(), NullTryOnRenderer)


# --- POST /tryon endpoint -----------------------------------------------------


class _CapturingSink:
    def __init__(self) -> None:
        self.events = []

    def publish(self, event) -> None:
        self.events.append(event)


def _client(renderer=None, consent=True, sink=None) -> TestClient:
    account = InMemoryAccountRepository(existing={DEV_USER})
    if consent:
        account.update_consent(DEV_USER, {"data_processing": True})
    app.dependency_overrides[get_account_repo] = lambda: account
    app.dependency_overrides[get_item_directory] = lambda: InMemoryItemDirectory(
        [_TOP, _BOTTOM, _SHOES]
    )
    app.dependency_overrides[get_tryon_renderer] = lambda: renderer or NullTryOnRenderer()
    app.dependency_overrides[get_event_sink] = lambda: sink or _CapturingSink()
    return TestClient(app)


class _StubRenderer:
    def render(self, person_png, garments):
        return TryOnRender(
            image_png=b"rendered",
            confidence=0.72,
            model_version="stub-v1",
            rendered_slots=tuple(g.slot for g in garments),
        )


def test_tryon_requires_consent():
    try:
        r = _client(consent=False).post(
            "/tryon", files={"photo": _photo()}, data={"item_ids": "top-1"}
        )
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_tryon_null_renderer_abstains_honestly():
    try:
        r = _client().post("/tryon", files={"photo": _photo()}, data={"item_ids": "top-1"})
        assert r.status_code == 200
        body = r.json()
        assert body["image_b64"] is None and body["confidence"] == 0.0
        assert "not configured" in body["reason"]
    finally:
        app.dependency_overrides.clear()


def test_tryon_renders_and_logs_events():
    sink = _CapturingSink()
    try:
        r = _client(renderer=_StubRenderer(), sink=sink).post(
            "/tryon", files={"photo": _photo()}, data={"item_ids": "top-1,bottom-1"}
        )
        assert r.status_code == 200
        body = r.json()
        assert base64.b64decode(body["image_b64"]) == b"rendered"
        assert body["rendered_slots"] == ["top", "bottom"]
        assert body["confidence"] == 0.72
        # The behavioral spine captures the try-on per garment.
        assert [e.target_id for e in sink.events] == ["top-1", "bottom-1"]
        assert all(e.action.value == "tryon" for e in sink.events)
    finally:
        app.dependency_overrides.clear()


def test_tryon_unknown_items_404():
    try:
        r = _client().post("/tryon", files={"photo": _photo()}, data={"item_ids": "ghost"})
        assert r.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_tryon_rejects_non_image_upload():
    try:
        r = _client().post(
            "/tryon",
            files={"photo": ("evil.png", io.BytesIO(b"not an image"), "image/png")},
            data={"item_ids": "top-1"},
        )
        assert r.status_code == 415
    finally:
        app.dependency_overrides.clear()
