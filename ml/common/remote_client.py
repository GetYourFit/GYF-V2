"""Shared client for the free-tier ZeroGPU serving lane (doctrine D7).

Every remote adapter (encoder, body-shape, skin-tone) delegates GPU work to an HF
ZeroGPU Space over ``gradio_client`` with the *same* mechanics: a base64-PNG image
on the wire and a lazily-built, token-authenticated client. Those mechanics live
here once; each adapter subclasses :class:`GradioSpaceClient` and adds only its own
``predict`` payload-shaping.

``gradio_client`` is imported lazily inside :meth:`GradioSpaceClient._get_client`
so importing an adapter — and unit-testing it with a fake client injected at
``adapter._client`` — needs no network or heavy deps.
"""

from __future__ import annotations

import base64
import io
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from PIL.Image import Image


def image_to_b64_png(image: Image) -> str:
    """Encode a PIL image as a base64 PNG string (the wire format the Space decodes)."""
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class GradioSpaceClient:
    """Lazy, token-authenticated ``gradio_client`` connection to an HF Space.

    Holds the Space url + token and builds the underlying ``Client`` on first use.
    Subclasses call :meth:`_get_client` to ``predict``; tests bypass the network by
    assigning a fake to ``self._client`` (the injection contract every remote test
    relies on).
    """

    # Hard ceiling on a single Space round trip. A ZeroGPU Space that is cold,
    # overloaded, or queue-stalled must not block the caller forever — the callers
    # (in-request photo onboarding, the nightly backfill job) are built to abstain
    # honestly (doctrine D6), so a timeout surfaces as an abstention, not a hang.
    DEFAULT_TIMEOUT_S = 120.0

    def __init__(
        self, url: str, *, hf_token: str | None = None, timeout_s: float | None = None
    ) -> None:
        if not url:
            raise ValueError(f"{type(self).__name__} requires a non-empty Space url")
        self._url = url
        self._hf_token = hf_token or None
        self._timeout_s = timeout_s if timeout_s is not None else self.DEFAULT_TIMEOUT_S
        self._client: object | None = None

    def _get_client(self) -> object:
        if self._client is None:
            from gradio_client import Client  # lazy: only the first real call needs it

            # gradio_client renamed the auth kwarg `hf_token` -> `token` in 2.x.
            # httpx_kwargs sets the per-request timeout on the underlying transport so
            # no single call can block indefinitely.
            self._client = Client(
                self._url,
                token=self._hf_token,
                httpx_kwargs={"timeout": self._timeout_s},
            )
        return self._client
