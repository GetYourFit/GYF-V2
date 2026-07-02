"""Security response headers for every API response.

The Next.js frontend sets its own headers (``app/next.config.ts``), but responses
served directly from the API origin — ``/docs``, ``/redoc``, the ``/gallery`` HTML
page, and JSON error bodies — need the same baseline. This middleware adds
MIME-sniffing, clickjacking, and referrer protection on every response, plus HSTS
outside local dev.

Design notes / trade-offs:
- Implemented as a pure ASGI middleware (not ``BaseHTTPMiddleware``) so it adds
  headers without buffering the response body or breaking streaming/StaticFiles.
- ``X-Frame-Options: DENY`` + a matching CSP ``frame-ancestors 'none'`` — the API
  never needs to be framed. The ``/docs``/``/redoc`` Swagger UIs load their assets
  from the same origin, so a restrictive CSP would break them; we intentionally
  keep CSP minimal here (``frame-ancestors`` only) and let the frontend own the
  full content policy for the surfaces users actually render.
- HSTS is emitted only when not running locally, so ``http://localhost`` dev is
  never pinned to HTTPS.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

Scope = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[MutableMapping[str, Any]]]
Send = Callable[[MutableMapping[str, Any]], Awaitable[None]]

_BASE_HEADERS: tuple[tuple[bytes, bytes], ...] = (
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"content-security-policy", b"frame-ancestors 'none'"),
    (b"referrer-policy", b"strict-origin-when-cross-origin"),
    (b"cross-origin-opener-policy", b"same-origin"),
)
_HSTS = (b"strict-transport-security", b"max-age=63072000; includeSubDomains")


class SecurityHeadersMiddleware:
    """ASGI middleware that appends baseline security headers to every response."""

    def __init__(self, app: Callable[..., Awaitable[None]], *, hsts: bool) -> None:
        self._app = app
        self._headers: tuple[tuple[bytes, bytes], ...] = (
            (*_BASE_HEADERS, _HSTS) if hsts else _BASE_HEADERS
        )

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        async def send_with_headers(message: MutableMapping[str, Any]) -> None:
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                existing = {name.lower() for name, _ in headers}
                for name, value in self._headers:
                    # Never clobber a header a handler set deliberately.
                    if name not in existing:
                        headers.append((name, value))
            await send(message)

        await self._app(scope, receive, send_with_headers)


def install_security_headers(app: Any) -> None:
    """Attach :class:`SecurityHeadersMiddleware`; enable HSTS outside local dev."""
    from .config import settings

    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.env != "local")
