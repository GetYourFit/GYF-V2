"""FASHN adapter for the TryOnRenderer port — licensed model at inference (D2).

FASHN (fashn.ai) is the beta rendering lane: a commercially-licensed hosted
try-on model (proprietary weights, ToS grants commercial use of outputs; inputs
and outputs auto-delete after 72h, and ``return_base64=true`` keeps generated
images off their storage entirely — D8). Contract: POST /v1/run submits a
prediction, GET /v1/status/{id} polls it to ``completed``/``failed``.

The vendor dresses ONE garment per call, so a full look is composed
sequentially: the top is rendered onto the person, then the bottom onto that
result. Footwear is not supported by tryon-v1.6 and is honestly skipped
(``rendered_slots`` tells the caller exactly what made it onto the body) —
never rendered badly and passed off as real. Confidence decays with each
sequential pass because composition compounds artifacts; the constants are
deliberate product calibration, not vendor output (FASHN returns none).

Transport is injectable (a ``(method, url, payload) -> dict`` callable) so the
adapter is fully unit-testable without credits; the default uses stdlib urllib.
"""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
from typing import Callable, Sequence

from .renderer import TryOnGarment, TryOnRender

_BASE_URL = "https://api.fashn.ai/v1"
MODEL_VERSION = "fashn-tryon-v1.6"

# recsys slot → FASHN category. Footwear has no category in tryon-v1.6: skipped.
_SLOT_CATEGORY = {"top": "tops", "bottom": "bottoms", "one_piece": "one-pieces"}
# The slot order garments are layered in (a top rendered first anchors the fit).
_SLOT_ORDER = ("one_piece", "top", "bottom")

# Honest-confidence calibration (D6): a single vendor pass is trusted at 0.8;
# each further sequential pass compounds warp/lighting artifacts, so multiply.
_FIRST_PASS_CONFIDENCE = 0.8
_SEQUENTIAL_DECAY = 0.9

_POLL_INTERVAL_S = 2.0
_TERMINAL = {"completed", "failed", "canceled"}

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
                "Authorization": f"Bearer {api_key}",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:  # noqa: S310 — fixed https base
            return json.loads(resp.read().decode())

    return call


class FashnTryOnRenderer:
    """TryOnRenderer port adapter over the FASHN hosted API."""

    def __init__(
        self,
        api_key: str,
        *,
        mode: str = "balanced",
        transport: Transport | None = None,
        timeout_s: float = 30.0,
        max_wait_s: float = 120.0,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._transport = transport or _urllib_transport(api_key, timeout_s)
        self._mode = mode
        self._max_wait_s = max_wait_s
        self._sleep = sleep

    def render(self, person_png: bytes, garments: Sequence[TryOnGarment]) -> TryOnRender:
        ordered = [
            g
            for slot in _SLOT_ORDER
            for g in garments
            if g.slot == slot and g.slot in _SLOT_CATEGORY
        ]
        if not ordered:
            return TryOnRender(
                image_png=None,
                confidence=0.0,
                model_version=MODEL_VERSION,
                reason="No renderable garments in this look (footwear-only is unsupported).",
            )

        model_image = "data:image/png;base64," + base64.b64encode(person_png).decode()
        rendered: list[str] = []
        confidence = _FIRST_PASS_CONFIDENCE
        try:
            for i, garment in enumerate(ordered):
                output_b64 = self._render_one(model_image, garment)
                model_image = "data:image/png;base64," + output_b64
                rendered.append(garment.slot)
                if i > 0:
                    confidence *= _SEQUENTIAL_DECAY
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
            if not rendered:  # nothing usable — abstain rather than mislead
                return TryOnRender(
                    image_png=None,
                    confidence=0.0,
                    model_version=MODEL_VERSION,
                    reason=f"The rendering lane failed before dressing any garment: {exc}",
                )
            # A partial look (e.g. top rendered, bottom failed) is still honest —
            # rendered_slots says exactly what the image shows.
            confidence *= _SEQUENTIAL_DECAY

        image = base64.b64decode(model_image.split(",", 1)[1])
        return TryOnRender(
            image_png=image,
            confidence=round(confidence, 3),
            model_version=MODEL_VERSION,
            rendered_slots=tuple(rendered),
            reason="" if len(rendered) == len(ordered) else "Some garments could not be rendered.",
        )

    def _render_one(self, model_image: str, garment: TryOnGarment) -> str:
        """One vendor pass: submit, poll to terminal, return the output base64."""
        run = self._transport(
            "POST",
            f"{_BASE_URL}/run",
            {
                "model_name": "tryon-v1.6",
                "inputs": {
                    "model_image": model_image,
                    "garment_image": garment.image_url,
                    "category": _SLOT_CATEGORY[garment.slot],
                    "mode": self._mode,
                    "garment_photo_type": "auto",
                    "output_format": "png",
                    # Keep generated user imagery off vendor storage (D8).
                    "return_base64": True,
                },
            },
        )
        if run.get("error"):
            raise ValueError(f"run rejected: {run['error']}")
        prediction_id = run["id"]

        waited = 0.0
        while True:
            state = self._transport("GET", f"{_BASE_URL}/status/{prediction_id}", None)
            status = state.get("status", "")
            if status in _TERMINAL:
                break
            if waited >= self._max_wait_s:
                raise TimeoutError(f"prediction {prediction_id} still {status or 'pending'}")
            self._sleep(_POLL_INTERVAL_S)
            waited += _POLL_INTERVAL_S
        if status != "completed":
            raise ValueError(f"prediction {status}: {state.get('error')}")

        output = state["output"][0]
        # return_base64 outputs arrive as data URIs; tolerate bare base64 too.
        return output.split(",", 1)[1] if output.startswith("data:") else output
