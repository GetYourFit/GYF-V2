"""In-process fixed-window rate limiting (W1, security H-3).

A dependency-free limiter: no slowapi/redis required, so it runs everywhere the API
runs (local Apple-container, CI, single-replica deploy) with zero extra infra. It
blunts the concrete abuse the security baseline flagged — GPU-cost exhaustion on
``/profile/photo``, taste-model poisoning via ``/feedback`` stuffing, and request
floods on unauthenticated search.

Keying: per **client IP** + route. Limits are read from ``settings`` at call time,
so they can be tuned via env (``GYF_RATE_LIMIT_*``) without code changes, and
overridden in tests. (Per-user keying needs guaranteed dependency ordering relative
to auth; it lands with the Redis backend in W7 — until then IP keying is the honest,
correct baseline.)

Scope caveat (W7): the counter lives in this process. A multi-replica deployment
needs a shared store (Redis) for a *global* limit; the ``Limiter`` interface here is
the seam where that swaps in. Documented in ``config.py`` — not silently shipped.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

from fastapi import HTTPException, Request, status

from .config import settings


@dataclass
class _Window:
    count: int
    reset_monotonic: float


class FixedWindowLimiter:
    """Thread-safe fixed-window counter. ``hit`` returns (allowed, retry_after_s)."""

    def __init__(self) -> None:
        self._buckets: dict[str, _Window] = {}
        self._lock = threading.Lock()

    # Sweep expired buckets when the map grows past this, so a flood of distinct IPs
    # can't grow memory without bound (the windows are short-lived anyway).
    _SWEEP_THRESHOLD = 10_000

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        if limit <= 0:  # 0 = disabled for this route
            return True, 0
        now = time.monotonic()
        with self._lock:
            if len(self._buckets) > self._SWEEP_THRESHOLD:
                self._buckets = {k: w for k, w in self._buckets.items() if now < w.reset_monotonic}
            window = self._buckets.get(key)
            if window is None or now >= window.reset_monotonic:
                window = _Window(count=0, reset_monotonic=now + window_seconds)
                self._buckets[key] = window
            window.count += 1
            retry_after = max(0, int(round(window.reset_monotonic - now)))
            return window.count <= limit, retry_after

    def reset(self) -> None:
        """Clear all buckets (used by tests for isolation)."""
        with self._lock:
            self._buckets.clear()


# Module-level shared limiter (per-process). Tests may call ``.reset()``.
limiter = FixedWindowLimiter()


def _client_id(request: Request) -> str:
    """Identify the caller by client IP. X-Forwarded-For is trusted **only** when the
    immediate TCP peer is a configured trusted proxy (``GYF_TRUSTED_PROXIES``);
    otherwise a client could spoof XFF to mint unlimited identities and bypass the
    limit. With no trusted proxy configured we always key on the real socket peer."""
    peer = request.client.host if request.client else "unknown"
    if peer in settings.trusted_proxy_set:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return f"ip:{forwarded.split(',')[0].strip()}"
    return f"ip:{peer}"


def rate_limit(route: str, limit_attr: str) -> object:
    """Build a FastAPI dependency enforcing ``settings.<limit_attr>`` for ``route``.

    Limits are read at request time (not captured here), so env tuning and test
    monkeypatching both take effect without re-importing.
    """

    async def _dependency(request: Request) -> None:
        if not settings.rate_limit_enabled:
            return
        limit = int(getattr(settings, limit_attr))
        key = f"{route}:{_client_id(request)}"
        allowed, retry_after = limiter.hit(key, limit, settings.rate_limit_window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please retry later.",
                headers={"Retry-After": str(retry_after)},
            )

    return _dependency
