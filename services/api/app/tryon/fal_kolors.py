"""fal.ai Kling Kolors adapter for the TryOnRenderer port — licensed at inference (D2).

Kling's Kolors Virtual Try-On v1.5, hosted on fal.ai, is an alternative
rendering lane to FASHN: proprietary weights served pay-per-image with
commercial use of outputs permitted (fal model page labels the endpoint
"Commercial use"; ~$0.07/render). Contract (fal queue REST convention):
POST ``queue.fal.run/{model}`` submits → ``{request_id}``; GET
``…/requests/{id}/status`` polls; GET ``…/requests/{id}`` fetches the result.

The model dresses ONE garment per call (no explicit category — Kolors infers
placement from the garment image), so a full look composes sequentially like
the FASHN lane: top onto the person, bottom onto that result. Footwear is not
supported and is honestly skipped (``rendered_slots`` says exactly what the
image shows). Person imagery crosses the wire as a base64 data URI and the
render is fetched back immediately; fal's hosted output file is short-lived
vendor storage, mirroring FASHN's 72h auto-delete posture (D8 — the router
never persists any of it).

Confidence calibration matches the FASHN adapter deliberately: the numbers
describe *sequential composition* (artifact compounding per pass), which is a
property of the lane shape, not the vendor.

Transport is injectable (``(method, url, payload) -> dict``) so the adapter is
fully unit-testable without credits; the default uses stdlib urllib.
"""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
from typing import Callable, Sequence

from .renderer import TryOnGarment, TryOnRender

_MODEL_PATH = "fal-ai/kling/v1-5/kolors-virtual-try-on"
_QUEUE_BASE = f"https://queue.fal.run/{_MODEL_PATH}"
MODEL_VERSION = "kling-kolors-vto-v1.5"

# Kolors places the garment itself — no category parameter — but only tops,
# bottoms, and one-piece garments render credibly. Footwear: honestly skipped.
_RENDERABLE_SLOTS = ("one_piece", "top", "bottom")

_FIRST_PASS_CONFIDENCE = 0.8
_SEQUENTIAL_DECAY = 0.9

_POLL_INTERVAL_S = 2.0
_TERMINAL = {"COMPLETED", "FAILED"}

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


def _fetch_bytes(url: str, timeout_s: float = 30.0) -> bytes:
    with urllib.request.urlopen(url, timeout=timeout_s) as resp:  # noqa: S310 — vendor result URL
        return resp.read()


class FalKolorsTryOnRenderer:
    """TryOnRenderer port adapter over fal.ai's hosted Kling Kolors VTO."""

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
        ordered = [g for slot in _RENDERABLE_SLOTS for g in garments if g.slot == slot]
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
