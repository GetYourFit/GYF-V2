"""Request context, structured access logging, and a uniform error envelope (W1).

Three foundation-hardening pieces the audit flagged as missing:

- **Request IDs.** Every request gets/propagates an ``X-Request-ID`` (echoed on the
  response and attached to ``request.state``), so a user-reported failure can be traced
  to exact log lines.
- **Structured access log.** One JSON line per request — method, path, status, duration —
  carrying the request id. Container-friendly (12-factor), greppable, OTel-compatible.
- **Uniform error envelope.** Unhandled exceptions never leak a traceback or internal
  detail to the client (complements the generic-401 fix): they return a stable
  ``{"error": {...}}`` shape with the request id for correlation, while the full
  exception is logged server-side. Known ``HTTPException``s keep their existing shape.
"""

from __future__ import annotations

import logging
import re
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .metrics import begin_catalog_request, catalog_timing_snapshot, reset_catalog_request

logger = logging.getLogger("gyf.access")
_error_logger = logging.getLogger("gyf.error")

REQUEST_ID_HEADER = "X-Request-ID"
_REQUEST_ID_RE = re.compile(r"[^a-zA-Z0-9\-]")


def _sanitize_request_id(value: str | None) -> str:
    """Bound an inbound request id: alnum/hyphen only, max 64 chars, else generate.
    Prevents a client from pushing a huge or odd value into every log line + the
    response header."""
    if value:
        cleaned = _REQUEST_ID_RE.sub("", value)[:64]
        if cleaned:
            return cleaned
    return uuid.uuid4().hex


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "-")


class RequestContextMiddleware:
    """Assign a request id, time the request, and emit one structured access line.

    This is pure ASGI rather than ``BaseHTTPMiddleware`` so request-local catalog
    stage timings survive into the access log; BaseHTTPMiddleware runs the app in a
    child task whose ContextVar writes do not propagate back to the middleware.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", ()))
        inbound = headers.get(REQUEST_ID_HEADER.lower().encode("ascii"))
        request_id = _sanitize_request_id(inbound.decode("latin-1") if inbound else None)
        scope.setdefault("state", {})["request_id"] = request_id
        path = scope.get("path", "-")
        timing_token = begin_catalog_request() if path.startswith("/items/") else None
        start = time.perf_counter()
        status_code = 500

        async def send_with_context(message):
            nonlocal status_code
            if message.get("type") == "http.response.start":
                status_code = int(message.get("status", 500))
                response_headers = list(message.get("headers", []))
                response_headers.append(
                    (REQUEST_ID_HEADER.lower().encode("ascii"), request_id.encode("ascii"))
                )
                message = {**message, "headers": response_headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_context)
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            extra = {
                "request_id": request_id,
                "method": scope.get("method", "-"),
                "path": path,
                "status": status_code,
                "duration_ms": duration_ms,
            }
            if timing_token is not None:
                # Stage labels and outcomes are fixed; no query text, tokens, or item IDs
                # enter the access log. Total includes framework/serialization work.
                extra["catalog_stages"] = catalog_timing_snapshot()
                extra["catalog_total_ms"] = duration_ms
            logger.info("request", extra=extra)
            if timing_token is not None:
                reset_catalog_request(timing_token)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort handler: log the real exception, return a generic 500 envelope."""
    request_id = _request_id(request)
    _error_logger.exception(
        "unhandled exception", extra={"request_id": request_id, "path": request.url.path}
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An internal error occurred. Please retry; if it persists, contact support.",
                "request_id": request_id,
            }
        },
        headers={REQUEST_ID_HEADER: request_id},
    )


def install_request_context(app: FastAPI) -> None:
    """Wire the request-context middleware and the catch-all error handler."""
    app.add_middleware(RequestContextMiddleware)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    # Guard: the catch-all must not shadow HTTPException (401/404/422). FastAPI
    # pre-registers a handler keyed on Starlette's HTTPException; if a refactor ever
    # drops it, fail loud here rather than silently turning 401s into opaque 500s.
    assert StarletteHTTPException in app.exception_handlers, "HTTPException handler missing"


def database_ready(database_url: str) -> bool:
    """A cheap readiness probe: can we open a connection and run ``SELECT 1``?

    Swallows every failure into ``False`` so the readiness endpoint reports *not
    ready* rather than raising. Kept dependency-light (psycopg, already a dep).
    """
    try:
        import psycopg

        with psycopg.connect(database_url, connect_timeout=2) as conn:
            with conn.cursor() as cur:
                # Transaction-scoped so Supavisor transaction pooling cannot
                # hand a later query this probe's timeout on a reused backend.
                cur.execute("SET LOCAL statement_timeout = 1000")  # ms — never stall a probe
                cur.execute("SELECT 1")
                cur.fetchone()
        return True
    except Exception:  # noqa: BLE001 - readiness must never raise
        _error_logger.warning("readiness: database check failed")
        return False
