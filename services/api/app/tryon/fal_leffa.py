"""fal.ai Leffa adapter for the TryOnRenderer port — licensed at inference (D2).

Leffa (Meta, arXiv 2412.08486) is fal.ai's hosted commercial VTON endpoint —
selected over FASHN and over fal's own Kling Kolors endpoint after a live
license/infra research pass (2026-07-06): fal badges this endpoint "Commercial
use" and, unlike most of the space, that badge checks out independently —
Leffa's own GitHub license is genuinely MIT (not a repackaged CC-BY-NC
research checkpoint wearing a commercial sticker, the trap several other
hosted VTON models fall into). It is also the fastest lane surveyed (~6s a
render on A100-class hardware) and — deliberately — the exact architecture
GYF would retrain in-house later on its own merchant on-model photos (D4/D2
"own-it-later"): renting Leffa now and training Leffa's own conditioning
stack on real data later is one continuous path, not a vendor swap.

Contract (fal queue REST convention): POST ``queue.fal.run/{model}`` submits
→ ``{request_id}``; GET ``…/requests/{id}/status`` polls; GET
``…/requests/{id}`` fetches ``{"image": {"url": ...}}``. Unlike Kolors, Leffa
takes an explicit ``garment_type`` enum (upper_body/lower_body/dresses) rather
than inferring placement from the image — a better fit for GYF's own
taxonomy-driven honesty (D6): the adapter never guesses where a garment goes.

Dresses to the person go one garment per call, so a full look composes
sequentially like the FASHN lane: top onto the person, bottom onto that
result. Footwear is not supported by any VTON vendor surveyed and is
honestly skipped (``rendered_slots`` says exactly what the image shows).
Person imagery crosses the wire as a base64 data URI (D8 — the router never
persists any of it; fal's hosted result file is short-lived vendor storage,
matching the posture of GYF's other rendering lane).

Transport is injectable (``(method, url, payload) -> dict``) so the adapter is
fully unit-testable without credits; the default uses stdlib urllib.
"""

from __future__ import annotations

import base64
import ipaddress
import json
import socket
import time
import urllib.error
import urllib.request
from typing import Callable, Sequence
from urllib.parse import urlsplit

from .renderer import TryOnGarment, TryOnRender

_MODEL_PATH = "fal-ai/leffa/virtual-tryon"
_QUEUE_BASE = f"https://queue.fal.run/{_MODEL_PATH}"
MODEL_VERSION = "fal-leffa-vto-v1"

# recsys slot -> Leffa's garment_type enum. Footwear has no category: skipped.
_SLOT_GARMENT_TYPE = {
    "top": "upper_body",
    "bottom": "lower_body",
    "one_piece": "dresses",
}
# The slot order garments are layered in (a top rendered first anchors the fit).
_SLOT_ORDER = ("one_piece", "top", "bottom")

_FIRST_PASS_CONFIDENCE = 0.8
_SEQUENTIAL_DECAY = 0.9

_POLL_INTERVAL_S = 2.0
_TERMINAL = {"COMPLETED", "FAILED"}
_MAX_RESULT_BYTES = 10 * 1024 * 1024
_RESULT_HOST = "fal.media"

Transport = Callable[[str, str, dict | None], dict]


def _urllib_transport(api_key: str, timeout_s: float) -> Transport:
    def call(method: str, url: str, payload: dict | None) -> dict:
        body = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(
            url,
            data=body,
            method=method,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Key {api_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:  # noqa: S310 — fixed https base
            return json.loads(resp.read().decode())

    return call


def _validate_result_url(url: str) -> None:
    parsed = urlsplit(url)
    hostname = parsed.hostname or ""
    if (
        parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or (hostname != _RESULT_HOST and not hostname.endswith(f".{_RESULT_HOST}"))
    ):
        raise ValueError("try-on result URL must use fal.media HTTPS")
    try:
        addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("try-on result host did not resolve") from exc
    if not addresses or any(not ipaddress.ip_address(info[4][0]).is_global for info in addresses):
        raise ValueError("try-on result host is not public")


class _SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        _validate_result_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _fetch_bytes(url: str, timeout_s: float = 30.0) -> bytes:
    _validate_result_url(url)
    opener = urllib.request.build_opener(_SafeRedirectHandler())
    with opener.open(url, timeout=timeout_s) as resp:  # noqa: S310 — validated above
        image = resp.read(_MAX_RESULT_BYTES + 1)
    if len(image) > _MAX_RESULT_BYTES:
        raise ValueError("try-on result exceeded 10 MiB")
    return image


class FalLeffaTryOnRenderer:
    """TryOnRenderer port adapter over fal.ai's hosted Leffa VTO."""

    def __init__(
        self,
        api_key: str,
        *,
        transport: Transport | None = None,
        fetch: Callable[[str], bytes] = _fetch_bytes,
        timeout_s: float = 30.0,
        max_wait_s: float = 120.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._transport = transport or _urllib_transport(api_key, timeout_s)
        self._fetch = fetch
        self._max_wait_s = max_wait_s
        self._sleep = sleep

    def render(self, person_png: bytes, garments: Sequence[TryOnGarment]) -> TryOnRender:
        ordered = [
            g
            for slot in _SLOT_ORDER
            for g in garments
            if g.slot in _SLOT_GARMENT_TYPE and g.slot == slot
        ]
        if not ordered:
            return TryOnRender(
                image_png=None,
                confidence=0.0,
                model_version=MODEL_VERSION,
                reason="No renderable garments in this look (footwear-only is unsupported).",
            )

        person_image = "data:image/png;base64," + base64.b64encode(person_png).decode()
        image: bytes | None = None
        rendered: list[str] = []
        confidence = _FIRST_PASS_CONFIDENCE
        try:
            for i, garment in enumerate(ordered):
                image = self._render_one(person_image, garment)
                person_image = "data:image/png;base64," + base64.b64encode(image).decode()
                rendered.append(garment.slot)
                if i > 0:
                    confidence *= _SEQUENTIAL_DECAY
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
            if image is None:  # nothing usable — abstain rather than mislead
                return TryOnRender(
                    image_png=None,
                    confidence=0.0,
                    model_version=MODEL_VERSION,
                    reason=f"The rendering lane failed before dressing any garment: {exc}",
                )
            # Partial look (top rendered, bottom failed) stays honest via rendered_slots.
            confidence *= _SEQUENTIAL_DECAY

        return TryOnRender(
            image_png=image,
            confidence=round(confidence, 3),
            model_version=MODEL_VERSION,
            rendered_slots=tuple(rendered),
            reason="" if len(rendered) == len(ordered) else "Some garments could not be rendered.",
        )

    def _render_one(self, person_image: str, garment: TryOnGarment) -> bytes:
        """One vendor pass: submit to the queue, poll to terminal, fetch the image."""
        run = self._transport(
            "POST",
            _QUEUE_BASE,
            {
                "human_image_url": person_image,
                "garment_image_url": garment.image_url,
                "garment_type": _SLOT_GARMENT_TYPE[garment.slot],
            },
        )
        request_id = run["request_id"]

        waited = 0.0
        while True:
            state = self._transport("GET", f"{_QUEUE_BASE}/requests/{request_id}/status", None)
            status = state.get("status", "")
            if status in _TERMINAL:
                break
            if waited >= self._max_wait_s:
                raise TimeoutError(f"request {request_id} still {status or 'pending'}")
            self._sleep(_POLL_INTERVAL_S)
            waited += _POLL_INTERVAL_S
        if status != "COMPLETED":
            raise ValueError(f"request {status}: {state.get('error')}")

        result = self._transport("GET", f"{_QUEUE_BASE}/requests/{request_id}", None)
        url = result["image"]["url"]
        # sync-mode style data URIs come back inline; hosted results are fetched.
        if url.startswith("data:"):
            return base64.b64decode(url.split(",", 1)[1])
        return self._fetch(url)
