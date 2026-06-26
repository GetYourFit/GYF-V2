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
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("gyf.access")
_error_logger = logging.getLogger("gyf.error")

REQUEST_ID_HEADER = "X-Request-ID"


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "-")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assign a request id, time the request, and emit one structured access line."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        incoming = request.headers.get(REQUEST_ID_HEADER)
        request_id = incoming or uuid.uuid4().hex
        request.state.request_id = request_id

        start = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.info(
                "request",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": status_code,
                    "duration_ms": duration_ms,
                },
            )


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


def database_ready(database_url: str) -> bool:
    """A cheap readiness probe: can we open a connection and run ``SELECT 1``?

    Swallows every failure into ``False`` so the readiness endpoint reports *not
    ready* rather than raising. Kept dependency-light (psycopg, already a dep).
    """
    try:
        import psycopg

        with psycopg.connect(database_url, connect_timeout=2) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
        return True
    except Exception:  # noqa: BLE001 - readiness must never raise
        _error_logger.warning("readiness: database check failed")
        return False
