"""Virtual try-on (M9/F8): the adapters, and the durable-job honesty contract."""

from __future__ import annotations

import base64
import io
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.catalog.directory import InMemoryItemDirectory, ItemDetail
from app.config import settings
from app.main import app
from app.dependencies import (
    get_account_repo,
    get_item_directory,
    get_tryon_job_repo,
    get_tryon_renderer,
)
from app.profile.account import InMemoryAccountRepository
from app.tryon import NullTryOnRenderer, TryOnGarment, TryOnRender
from app.tryon.jobs import InMemoryTryOnJobRepository
from app.tryon.worker import drain
from app.tryon.fashn import FashnTryOnRenderer
from app.tryon.fal_leffa import (
    FalLeffaTryOnRenderer,
    _fetch_bytes,
    _SafeRedirectHandler,
    _validate_result_url,
)

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


@pytest.mark.parametrize(
    "url",
    [
        "http://images.example/result.png",
        "https://127.0.0.1/result.png",
        "https://169.254.169.254/latest/meta-data",
        "https://user:password@images.example/result.png",
        "https://fal.media:8443/result.png",
        "https://notfal.media.example/result.png",
        "https://[::1]/result.png",
    ],
)
def test_fal_result_url_rejects_unsafe_targets(url):
    with pytest.raises(ValueError):
        _validate_result_url(url)


def test_fal_result_url_rejects_private_dns(monkeypatch):
    monkeypatch.setattr(
        "app.tryon.fal_leffa.socket.getaddrinfo",
        lambda *_args, **_kwargs: [(None, None, None, None, ("10.0.0.8", 443))],
    )
    with pytest.raises(ValueError, match="not public"):
        _validate_result_url("https://v3.fal.media/result.png")


def test_fal_result_url_accepts_public_https(monkeypatch):
    monkeypatch.setattr(
        "app.tryon.fal_leffa.socket.getaddrinfo",
        lambda *_args, **_kwargs: [(None, None, None, None, ("8.8.8.8", 443))],
    )
    _validate_result_url("https://v3.fal.media/result.png")


def test_fal_result_redirect_rejects_non_vendor_target():
    with pytest.raises(ValueError, match="fal.media"):
        _SafeRedirectHandler().redirect_request(
            None, None, 302, "Found", {}, "https://127.0.0.1/result.png"
        )


def test_fal_result_download_rejects_oversize(monkeypatch):
    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self, size):
            return b"x" * size

    class Opener:
        def open(self, *_args, **_kwargs):
            return Response()

    monkeypatch.setattr(
        "app.tryon.fal_leffa.socket.getaddrinfo",
        lambda *_args, **_kwargs: [(None, None, None, None, ("8.8.8.8", 443))],
    )
    monkeypatch.setattr("app.tryon.fal_leffa.urllib.request.build_opener", lambda *_: Opener())
    with pytest.raises(ValueError, match="10 MiB"):
        _fetch_bytes("https://fal.media/result.png")


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


# --- The durable job surface (F8) ---------------------------------------------
#
# Try-on is a queue now, so the honesty contract has to hold across a boundary the
# synchronous route never had: the request that takes the photo is not the one that
# renders it. These prove that every refusal still happens BEFORE the photo is accepted,
# that a render is never implied when none exists, and that the photo does not outlive
# the render.


class _CapturingSink:
    def __init__(self) -> None:
        self.events = []

    def publish(self, event) -> None:
        self.events.append(event)

    def publish_many(self, events) -> None:
        self.events.extend(events)


class _StubRenderer:
    def render(self, person_png, garments):
        return TryOnRender(
            image_png=b"rendered",
            confidence=0.72,
            model_version="stub-v1",
            rendered_slots=tuple(g.slot for g in garments),
        )


class _AbstainingRenderer:
    def render(self, person_png, garments):
        return TryOnRender(
            image_png=None,
            confidence=0.0,
            model_version="stub-v1",
            reason="Could not find a clear, front-facing pose.",
        )


class _BoomRenderer:
    def __init__(self, exc: Exception) -> None:
        self.exc = exc
        self.calls = 0

    def render(self, person_png, garments):
        self.calls += 1
        raise self.exc


@pytest.fixture(autouse=True)
def _tryon_open(monkeypatch):
    """The F9 gate ships CLOSED (``tryon_enabled=False``). These tests exercise the
    surface as it behaves once the owner opens it; the gate itself is asserted in
    ``test_tryon_closed_until_f9_gate``."""
    monkeypatch.setattr(settings, "tryon_enabled", True)


def _client(renderer=None, consent=True, jobs=None) -> TestClient:
    account = InMemoryAccountRepository(existing={DEV_USER})
    if consent:
        account.update_consent(DEV_USER, {"data_processing": True})
    app.dependency_overrides[get_account_repo] = lambda: account
    app.dependency_overrides[get_item_directory] = lambda: InMemoryItemDirectory(
        [_TOP, _BOTTOM, _SHOES]
    )
    app.dependency_overrides[get_tryon_renderer] = lambda: renderer or NullTryOnRenderer()
    app.dependency_overrides[get_tryon_job_repo] = lambda: jobs or InMemoryTryOnJobRepository()
    return TestClient(app)


def test_tryon_requires_consent():
    try:
        r = _client(consent=False).post(
            "/tryon", files={"photo": _photo()}, data={"item_ids": "top-1"}
        )
        assert r.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_tryon_null_renderer_rejected_before_photo_processing():
    # Capability gate (F1b): no rendering lane -> refuse the sensitive upload outright.
    # The invalid image body proves the 503 fires before decoding (else it would be 415).
    try:
        r = _client().post(
            "/tryon",
            files={"photo": ("p.png", io.BytesIO(b"not an image"), "image/png")},
            data={"item_ids": "top-1"},
        )
        assert r.status_code == 503
        assert "not available" in r.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_tryon_closed_until_f9_gate(monkeypatch):
    # Even with a working renderer, try-on refuses until the owner flips the gate. The
    # surface must not solicit a body photo for a capability that is not open.
    monkeypatch.setattr(settings, "tryon_enabled", False)
    try:
        r = _client(renderer=_StubRenderer()).post(
            "/tryon", files={"photo": _photo()}, data={"item_ids": "top-1"}
        )
        assert r.status_code == 503
    finally:
        app.dependency_overrides.clear()


def test_tryon_enqueues_and_does_not_render_in_request():
    jobs = InMemoryTryOnJobRepository()
    try:
        r = _client(renderer=_StubRenderer(), jobs=jobs).post(
            "/tryon", files={"photo": _photo()}, data={"item_ids": "top-1,bottom-1"}
        )
        assert r.status_code == 202
        body = r.json()
        assert body["status"] == "queued"
        assert body["quota"] == {"used": 1, "limit": settings.tryon_monthly_quota_per_user}
        # The request did NOT render: no image exists yet, and none is implied.
        job = jobs.get(body["job_id"], DEV_USER)
        assert job.status == "queued"
        assert not job.has_image
    finally:
        app.dependency_overrides.clear()


def test_worker_renders_queued_job_and_logs_events():
    # The assertion that used to live on the synchronous route: a render happens, carries
    # its confidence and slots, and feeds the flywheel one TRYON event per garment.
    jobs = InMemoryTryOnJobRepository()
    sink = _CapturingSink()
    account = InMemoryAccountRepository(existing={DEV_USER})
    directory = InMemoryItemDirectory([_TOP, _BOTTOM, _SHOES])
    jobs.enqueue(DEV_USER, ["top-1", "bottom-1"], b"photo", 24)

    rendered = drain(jobs, _StubRenderer(), directory, sink, account)

    assert rendered == 1
    job = jobs.list_for_user(DEV_USER)[0]
    assert job.status == "succeeded"
    assert job.has_image
    assert job.confidence == 0.72
    assert list(job.rendered_slots) == ["top", "bottom"]
    assert [e.target_id for e in sink.events] == ["top-1", "bottom-1"]
    assert all(e.action.value == "tryon" for e in sink.events)
    # D8: the consented body photo does not outlive the render.
    assert jobs.jobs[job.job_id]["person_png"] is None


def test_worker_abstention_is_terminal_and_carries_no_image():
    # An abstention is a correct answer, not a failure — it is never retried, and the
    # surface can never present an image for it (doctrine D6).
    jobs = InMemoryTryOnJobRepository()
    jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)

    drain(jobs, _AbstainingRenderer(), InMemoryItemDirectory([_TOP]))

    job = jobs.list_for_user(DEV_USER)[0]
    assert job.status == "abstained"
    assert not job.has_image
    assert job.reason == "Could not find a clear, front-facing pose."
    assert job.attempts == 1  # not retried
    assert jobs.jobs[job.job_id]["person_png"] is None


def test_worker_retries_transient_failure_then_gives_up(monkeypatch):
    monkeypatch.setattr(settings, "tryon_max_attempts", 2)
    jobs = InMemoryTryOnJobRepository()
    renderer = _BoomRenderer(TimeoutError("vendor took too long"))
    jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)
    directory = InMemoryItemDirectory([_TOP])

    drain(jobs, renderer, directory)  # attempt 1 -> requeued behind a backoff
    job = jobs.list_for_user(DEV_USER)[0]
    assert job.status == "queued"
    assert renderer.calls == 1

    # The backoff is real: the job is not claimable again until it elapses, so a drain
    # right now must not spend a second GPU call.
    drain(jobs, renderer, directory)
    assert renderer.calls == 1

    jobs.jobs[job.job_id]["next_attempt_at"] = datetime.now(UTC) - timedelta(seconds=1)
    drain(jobs, renderer, directory)  # attempt 2 -> retry budget exhausted, terminal

    job = jobs.list_for_user(DEV_USER)[0]
    assert renderer.calls == 2
    assert job.status == "failed"
    assert job.error_code == "vendor_timeout"
    # The failure copy leads with the deletion, because that is the user's first question.
    assert "deleted" in job.reason
    assert jobs.jobs[job.job_id]["person_png"] is None


def test_worker_skips_job_cancelled_while_queued():
    jobs = InMemoryTryOnJobRepository()
    renderer = _BoomRenderer(AssertionError("must never reach the GPU"))
    job = jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)
    jobs.request_cancel(job.job_id, DEV_USER)

    drain(jobs, renderer, InMemoryItemDirectory([_TOP]))

    assert renderer.calls == 0  # a pre-claim cancel genuinely spends no GPU
    assert jobs.get(job.job_id, DEV_USER).status == "cancelled"


def test_quota_exhausted_refuses_before_photo_is_read():
    jobs = InMemoryTryOnJobRepository()
    for _ in range(settings.tryon_monthly_quota_per_user):
        jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)
    try:
        # An invalid body proves the 429 fires before the upload is decoded.
        r = _client(renderer=_StubRenderer(), jobs=jobs).post(
            "/tryon",
            files={"photo": ("p.png", io.BytesIO(b"not an image"), "image/png")},
            data={"item_ids": "top-1"},
        )
        assert r.status_code == 429
        assert "free renders this month" in r.json()["detail"]
        # No paywall: a free product's quota message never points at something buyable.
        assert "upgrade" not in r.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()


def test_cancelled_jobs_refund_quota():
    jobs = InMemoryTryOnJobRepository()
    job = jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)
    assert jobs.month_count(DEV_USER) == 1
    jobs.request_cancel(job.job_id, DEV_USER)
    # Nothing was rendered, so nothing is charged.
    assert jobs.month_count(DEV_USER) == 0


def test_daily_cap_is_the_global_kill_switch(monkeypatch):
    monkeypatch.setattr(settings, "tryon_daily_render_cap", 1)
    jobs = InMemoryTryOnJobRepository()
    jobs.enqueue("00000000-0000-0000-0000-0000000000ff", ["top-1"], b"photo", 24)
    try:
        r = _client(renderer=_StubRenderer(), jobs=jobs).post(
            "/tryon", files={"photo": _photo()}, data={"item_ids": "top-1"}
        )
        assert r.status_code == 503
        assert "free for everyone" in r.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_capped_worker_leaves_jobs_queued_not_failed(monkeypatch):
    # The cap means "not today", not "never". A queued job is not broken, so it must not
    # be failed — it drains tomorrow.
    monkeypatch.setattr(settings, "tryon_daily_render_cap", 0)
    jobs = InMemoryTryOnJobRepository()
    job = jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)

    assert drain(jobs, _StubRenderer(), InMemoryItemDirectory([_TOP])) == 0
    assert jobs.get(job.job_id, DEV_USER).status == "queued"


def test_another_users_job_reads_as_absent():
    jobs = InMemoryTryOnJobRepository()
    job = jobs.enqueue("00000000-0000-0000-0000-0000000000ff", ["top-1"], b"photo", 24)
    try:
        client = _client(renderer=_StubRenderer(), jobs=jobs)
        # 404, not 403: the response must not confirm that the job id exists.
        assert client.get(f"/tryon/jobs/{job.job_id}").status_code == 404
        assert client.get(f"/tryon/jobs/{job.job_id}/image").status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_render_is_served_by_route_not_inlined_in_json():
    jobs = InMemoryTryOnJobRepository()
    jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)
    drain(jobs, _StubRenderer(), InMemoryItemDirectory([_TOP]))
    job_id = jobs.list_for_user(DEV_USER)[0].job_id
    try:
        client = _client(renderer=_StubRenderer(), jobs=jobs)
        body = client.get(f"/tryon/jobs/{job_id}").json()
        assert body["image_url"] == f"/tryon/jobs/{job_id}/image"
        assert "image_b64" not in body  # a poll must not move megabytes to say "done"

        img = client.get(body["image_url"])
        assert img.status_code == 200
        assert img.content == b"rendered"
        # A picture of the user's body must never land in a shared cache.
        assert "private" in img.headers["cache-control"]
    finally:
        app.dependency_overrides.clear()


def test_ttl_sweep_deletes_the_render():
    jobs = InMemoryTryOnJobRepository()
    job = jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)
    drain(jobs, _StubRenderer(), InMemoryItemDirectory([_TOP]))
    # Age it past its TTL.
    jobs.jobs[job.job_id]["expires_at"] = datetime.now(UTC) - timedelta(seconds=1)

    expired, _ = jobs.sweep(settings.tryon_stale_running_seconds)

    assert expired == 1
    assert jobs.get(job.job_id, DEV_USER) is None  # the render is genuinely gone


def test_sweep_requeues_a_job_stranded_by_a_dead_worker():
    jobs = InMemoryTryOnJobRepository()
    job = jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)
    jobs.claim()  # a worker takes it, then dies mid-render
    jobs.jobs[job.job_id]["started_at"] = datetime.now(UTC) - timedelta(hours=1)

    _, requeued = jobs.sweep(stale_running_seconds=60)

    assert requeued == 1
    assert jobs.get(job.job_id, DEV_USER).status == "queued"


def test_worker_honours_withdrawn_learning_consent():
    # F3: no route — and no worker — may forget the consent check. The user can withdraw
    # while the job sits in the queue, and the render must still not train on them.
    jobs = InMemoryTryOnJobRepository()
    sink = _CapturingSink()
    account = InMemoryAccountRepository(existing={DEV_USER})
    account.update_consent(DEV_USER, {"behavioral_learning": False})
    jobs.enqueue(DEV_USER, ["top-1"], b"photo", 24)

    drain(jobs, _StubRenderer(), InMemoryItemDirectory([_TOP]), sink, account)

    assert jobs.list_for_user(DEV_USER)[0].status == "succeeded"  # the render still happens
    assert sink.events == []  # but nothing is learned from it
