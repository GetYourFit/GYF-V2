"""Durable try-on jobs: the queue behind the TryOnRenderer port (F8).

A try-on render takes 10-60s on a GPU. Doing that inside the request meant the
render died with the connection, could not be retried, could not be cancelled, and
had no cost ceiling. Here the request only *enqueues*: the row is the unit of work,
and a worker (:mod:`app.tryon.worker`) claims it.

Three guarantees this module owns, none of which the synchronous path could give:

- **Exactly-once claim.** ``FOR UPDATE SKIP LOCKED`` means two workers racing the
  queue take different jobs rather than rendering the same one twice on a paid GPU.
- **Bounded cost.** ``month_count`` (per user) and ``renders_today`` (global kill
  switch) are counted in SQL, not in process memory — a restart, a second replica or
  a hostile client cannot reset them.
- **Bounded retention.** ``person_png`` is dropped the moment a job goes terminal, so
  the consented body photo lives for the render, not for the job's TTL (doctrine D8).

Quota counts every job the user actually spent GPU on: cancelled jobs are excluded
(nothing was rendered, so nothing is charged), failures are NOT — a failed render
still burned the GPU, and refunding it would be a free retry loop.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Protocol

# Terminal = a worker never touches it again.
TERMINAL_STATUSES = frozenset({"succeeded", "abstained", "failed", "cancelled"})

# Failures worth another GPU pass: the vendor/network wobbled, the render itself was
# never judged. An *abstention* is not here — the renderer looked and honestly
# declined, and re-asking the same question gets the same answer (doctrine D6).
RETRYABLE_ERRORS = frozenset({"vendor_timeout", "vendor_error"})


@dataclass(frozen=True)
class TryOnJob:
    """One durable render request. ``person_png`` is never exposed past the worker."""

    job_id: str
    user_id: str
    status: str
    item_ids: tuple[str, ...]
    attempts: int
    created_at: datetime
    expires_at: datetime
    cancel_requested: bool = False
    confidence: float | None = None
    model_version: str | None = None
    rendered_slots: tuple[str, ...] = ()
    reason: str = ""
    error_code: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    # True iff result_png is non-null — the bytes themselves are streamed by a
    # dedicated route, never carried in a JSON payload.
    has_image: bool = False


@dataclass(frozen=True)
class ClaimedJob:
    """A job handed to a worker: the only place person_png crosses the boundary."""

    job_id: str
    user_id: str
    item_ids: tuple[str, ...]
    person_png: bytes
    attempts: int


class TryOnJobRepository(Protocol):
    def enqueue(
        self, user_id: str, item_ids: list[str], person_png: bytes, ttl_hours: int
    ) -> TryOnJob: ...

    def get(self, job_id: str, user_id: str) -> TryOnJob | None:
        """Owner-scoped read. A job that is not the caller's reads as absent."""
        ...

    def image(self, job_id: str, user_id: str) -> bytes | None: ...

    def list_for_user(self, user_id: str, limit: int = 20) -> list[TryOnJob]: ...

    def month_count(self, user_id: str) -> int:
        """Jobs this user spent GPU on this calendar month (cancelled excluded)."""
        ...

    def renders_today(self) -> int:
        """Deployment-wide renders started today — the global cost kill switch."""
        ...

    def request_cancel(self, job_id: str, user_id: str) -> str | None:
        """Cancel if queued; flag if running. Returns the resulting status, or None."""
        ...

    def claim(self) -> ClaimedJob | None: ...

    def finish(
        self,
        job_id: str,
        status: str,
        *,
        result_png: bytes | None = None,
        confidence: float | None = None,
        model_version: str | None = None,
        rendered_slots: tuple[str, ...] = (),
        reason: str = "",
        error_code: str | None = None,
    ) -> None:
        """Terminal write. Always drops person_png."""
        ...

    def requeue(self, job_id: str, backoff_seconds: int) -> None: ...

    def is_cancelled(self, job_id: str) -> bool: ...

    def sweep(self, stale_running_seconds: int) -> tuple[int, int]:
        """(expired rows deleted, stale running jobs requeued)."""
        ...


_ENQUEUE = """
INSERT INTO tryon_jobs (user_id, item_ids, person_png, expires_at)
VALUES (%s, %s, %s, now() + make_interval(hours => %s))
RETURNING id, status, attempts, created_at, expires_at
"""

# has_image is computed, never selected: result_png is megabytes and must not ride
# along on a status poll.
_JOB_COLUMNS = """
id, user_id, status, item_ids, attempts, created_at, expires_at, cancel_requested,
confidence, model_version, rendered_slots, reason, error_code, started_at, finished_at,
result_png IS NOT NULL AS has_image
"""

_GET = f"SELECT {_JOB_COLUMNS} FROM tryon_jobs WHERE id = %s AND user_id = %s"
_IMAGE = "SELECT result_png FROM tryon_jobs WHERE id = %s AND user_id = %s"
_LIST = (
    f"SELECT {_JOB_COLUMNS} FROM tryon_jobs WHERE user_id = %s ORDER BY created_at DESC LIMIT %s"
)

# date_trunc on the DATABASE clock, never the app host's: a skewed API container
# must not be able to hand a user a fresh quota month.
_MONTH_COUNT = """
SELECT count(*) FROM tryon_jobs
WHERE user_id = %s AND status <> 'cancelled' AND created_at >= date_trunc('month', now())
"""
_RENDERS_TODAY = """
SELECT count(*) FROM tryon_jobs
WHERE status <> 'cancelled' AND created_at >= date_trunc('day', now())
"""

# Cancel is one statement so a job cannot be cancelled and claimed concurrently:
# a queued job goes straight to terminal (and sheds the photo); a running one only
# raises a flag, which the worker honours between passes. The vendor's HTTP call is
# not interruptible — that is the honest ceiling, and why 'running' is not a lie.
_CANCEL = """
UPDATE tryon_jobs
SET status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
    cancel_requested = TRUE,
    person_png = CASE WHEN status = 'queued' THEN NULL ELSE person_png END,
    finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END,
    reason = CASE WHEN status = 'queued' THEN 'Cancelled before rendering started.' ELSE reason END,
    error_code = CASE WHEN status = 'queued' THEN 'cancelled_by_user' ELSE error_code END
WHERE id = %s AND user_id = %s AND status IN ('queued', 'running')
RETURNING status
"""

_CLAIM = """
UPDATE tryon_jobs SET status = 'running', started_at = now(), attempts = attempts + 1
WHERE id = (
    SELECT id FROM tryon_jobs
    WHERE status = 'queued' AND next_attempt_at <= now() AND cancel_requested = FALSE
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
RETURNING id, user_id, item_ids, person_png, attempts
"""

_FINISH = """
UPDATE tryon_jobs
SET status = %s, result_png = %s, confidence = %s, model_version = %s,
    rendered_slots = %s, reason = %s, error_code = %s,
    finished_at = now(), person_png = NULL
WHERE id = %s
"""

_REQUEUE = """
UPDATE tryon_jobs
SET status = 'queued', next_attempt_at = now() + make_interval(secs => %s)
WHERE id = %s
"""

_IS_CANCELLED = "SELECT cancel_requested FROM tryon_jobs WHERE id = %s"

_SWEEP_EXPIRED = "DELETE FROM tryon_jobs WHERE expires_at < now()"
# A worker killed mid-render (a GitHub runner timing out, a Render deploy) leaves the
# job 'running' forever. Return it to the queue; attempts already counted, so a job
# that keeps dying still exhausts its retry budget rather than looping for ever.
_SWEEP_STALE = """
UPDATE tryon_jobs SET status = 'queued', next_attempt_at = now()
WHERE status = 'running' AND started_at < now() - make_interval(secs => %s)
"""


def _row_to_job(row: tuple) -> TryOnJob:
    return TryOnJob(
        job_id=str(row[0]),
        user_id=str(row[1]),
        status=row[2],
        item_ids=tuple(row[3] or ()),
        attempts=row[4],
        created_at=row[5],
        expires_at=row[6],
        cancel_requested=row[7],
        confidence=row[8],
        model_version=row[9],
        rendered_slots=tuple(row[10] or ()),
        reason=row[11] or "",
        error_code=row[12],
        started_at=row[13],
        finished_at=row[14],
        has_image=row[15],
    )


class PostgresTryOnJobRepository:
    """The durable queue. Accepts an injectable pool (the app shares one process-wide)."""

    def __init__(self, dsn: str, pool=None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def enqueue(
        self, user_id: str, item_ids: list[str], person_png: bytes, ttl_hours: int
    ) -> TryOnJob:
        with self._pool.connection() as conn:
            row = conn.execute(_ENQUEUE, (user_id, item_ids, person_png, ttl_hours)).fetchone()
        return TryOnJob(
            job_id=str(row[0]),
            user_id=user_id,
            status=row[1],
            item_ids=tuple(item_ids),
            attempts=row[2],
            created_at=row[3],
            expires_at=row[4],
        )

    def get(self, job_id: str, user_id: str) -> TryOnJob | None:
        with self._pool.connection() as conn:
            row = conn.execute(_GET, (job_id, user_id)).fetchone()
        return _row_to_job(row) if row else None

    def image(self, job_id: str, user_id: str) -> bytes | None:
        with self._pool.connection() as conn:
            row = conn.execute(_IMAGE, (job_id, user_id)).fetchone()
        return bytes(row[0]) if row and row[0] is not None else None

    def list_for_user(self, user_id: str, limit: int = 20) -> list[TryOnJob]:
        with self._pool.connection() as conn:
            rows = conn.execute(_LIST, (user_id, limit)).fetchall()
        return [_row_to_job(r) for r in rows]

    def month_count(self, user_id: str) -> int:
        with self._pool.connection() as conn:
            return conn.execute(_MONTH_COUNT, (user_id,)).fetchone()[0]

    def renders_today(self) -> int:
        with self._pool.connection() as conn:
            return conn.execute(_RENDERS_TODAY).fetchone()[0]

    def request_cancel(self, job_id: str, user_id: str) -> str | None:
        with self._pool.connection() as conn:
            row = conn.execute(_CANCEL, (job_id, user_id)).fetchone()
        return row[0] if row else None

    def claim(self) -> ClaimedJob | None:
        with self._pool.connection() as conn:
            row = conn.execute(_CLAIM).fetchone()
        if not row:
            return None
        return ClaimedJob(
            job_id=str(row[0]),
            user_id=str(row[1]),
            item_ids=tuple(row[2] or ()),
            person_png=bytes(row[3]) if row[3] is not None else b"",
            attempts=row[4],
        )

    def finish(
        self,
        job_id: str,
        status: str,
        *,
        result_png: bytes | None = None,
        confidence: float | None = None,
        model_version: str | None = None,
        rendered_slots: tuple[str, ...] = (),
        reason: str = "",
        error_code: str | None = None,
    ) -> None:
        with self._pool.connection() as conn:
            conn.execute(
                _FINISH,
                (
                    status,
                    result_png,
                    confidence,
                    model_version,
                    list(rendered_slots),
                    reason,
                    error_code,
                    job_id,
                ),
            )

    def requeue(self, job_id: str, backoff_seconds: int) -> None:
        with self._pool.connection() as conn:
            conn.execute(_REQUEUE, (backoff_seconds, job_id))

    def is_cancelled(self, job_id: str) -> bool:
        with self._pool.connection() as conn:
            row = conn.execute(_IS_CANCELLED, (job_id,)).fetchone()
        return bool(row and row[0])

    def sweep(self, stale_running_seconds: int) -> tuple[int, int]:
        with self._pool.connection() as conn:
            expired = conn.execute(_SWEEP_EXPIRED).rowcount
            requeued = conn.execute(_SWEEP_STALE, (stale_running_seconds,)).rowcount
        return expired, requeued


@dataclass
class InMemoryTryOnJobRepository:
    """Test/dev double. Same semantics, no database."""

    jobs: dict[str, dict] = field(default_factory=dict)

    def enqueue(
        self, user_id: str, item_ids: list[str], person_png: bytes, ttl_hours: int
    ) -> TryOnJob:
        now = datetime.now(UTC)
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "job_id": job_id,
            "user_id": user_id,
            "status": "queued",
            "item_ids": tuple(item_ids),
            "person_png": person_png,
            "result_png": None,
            "attempts": 0,
            "cancel_requested": False,
            "next_attempt_at": now,
            "created_at": now,
            "expires_at": now + timedelta(hours=ttl_hours),
            "started_at": None,
            "finished_at": None,
            "confidence": None,
            "model_version": None,
            "rendered_slots": (),
            "reason": "",
            "error_code": None,
        }
        return self._to_job(job_id)

    def _to_job(self, job_id: str) -> TryOnJob:
        j = self.jobs[job_id]
        return TryOnJob(
            job_id=j["job_id"],
            user_id=j["user_id"],
            status=j["status"],
            item_ids=j["item_ids"],
            attempts=j["attempts"],
            created_at=j["created_at"],
            expires_at=j["expires_at"],
            cancel_requested=j["cancel_requested"],
            confidence=j["confidence"],
            model_version=j["model_version"],
            rendered_slots=j["rendered_slots"],
            reason=j["reason"],
            error_code=j["error_code"],
            started_at=j["started_at"],
            finished_at=j["finished_at"],
            has_image=j["result_png"] is not None,
        )

    def get(self, job_id: str, user_id: str) -> TryOnJob | None:
        j = self.jobs.get(job_id)
        if not j or j["user_id"] != user_id:
            return None
        return self._to_job(job_id)

    def image(self, job_id: str, user_id: str) -> bytes | None:
        j = self.jobs.get(job_id)
        if not j or j["user_id"] != user_id:
            return None
        return j["result_png"]

    def list_for_user(self, user_id: str, limit: int = 20) -> list[TryOnJob]:
        mine = [j for j in self.jobs.values() if j["user_id"] == user_id]
        mine.sort(key=lambda j: j["created_at"], reverse=True)
        return [self._to_job(j["job_id"]) for j in mine[:limit]]

    def month_count(self, user_id: str) -> int:
        start = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return sum(
            1
            for j in self.jobs.values()
            if j["user_id"] == user_id and j["status"] != "cancelled" and j["created_at"] >= start
        )

    def renders_today(self) -> int:
        start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        return sum(
            1 for j in self.jobs.values() if j["status"] != "cancelled" and j["created_at"] >= start
        )

    def request_cancel(self, job_id: str, user_id: str) -> str | None:
        j = self.jobs.get(job_id)
        if not j or j["user_id"] != user_id or j["status"] not in ("queued", "running"):
            return None
        j["cancel_requested"] = True
        if j["status"] == "queued":
            j.update(
                status="cancelled",
                person_png=None,
                finished_at=datetime.now(UTC),
                reason="Cancelled before rendering started.",
                error_code="cancelled_by_user",
            )
        return j["status"]

    def claim(self) -> ClaimedJob | None:
        # Mirrors _CLAIM exactly, backoff included: a requeued job is NOT claimable until
        # next_attempt_at has passed. Modelling that here is the difference between a
        # double that proves the retry schedule and one that quietly burns every attempt
        # in a single drain.
        now = datetime.now(UTC)
        pending = sorted(
            (
                j
                for j in self.jobs.values()
                if j["status"] == "queued"
                and not j["cancel_requested"]
                and j["next_attempt_at"] <= now
            ),
            key=lambda j: j["created_at"],
        )
        if not pending:
            return None
        j = pending[0]
        j["status"] = "running"
        j["started_at"] = datetime.now(UTC)
        j["attempts"] += 1
        return ClaimedJob(
            job_id=j["job_id"],
            user_id=j["user_id"],
            item_ids=j["item_ids"],
            person_png=j["person_png"] or b"",
            attempts=j["attempts"],
        )

    def finish(
        self,
        job_id: str,
        status: str,
        *,
        result_png: bytes | None = None,
        confidence: float | None = None,
        model_version: str | None = None,
        rendered_slots: tuple[str, ...] = (),
        reason: str = "",
        error_code: str | None = None,
    ) -> None:
        j = self.jobs[job_id]
        j.update(
            status=status,
            result_png=result_png,
            confidence=confidence,
            model_version=model_version,
            rendered_slots=rendered_slots,
            reason=reason,
            error_code=error_code,
            finished_at=datetime.now(UTC),
            person_png=None,
        )

    def requeue(self, job_id: str, backoff_seconds: int) -> None:
        self.jobs[job_id]["status"] = "queued"
        self.jobs[job_id]["next_attempt_at"] = datetime.now(UTC) + timedelta(
            seconds=backoff_seconds
        )

    def is_cancelled(self, job_id: str) -> bool:
        return bool(self.jobs[job_id]["cancel_requested"])

    def sweep(self, stale_running_seconds: int) -> tuple[int, int]:
        now = datetime.now(UTC)
        expired = [k for k, j in self.jobs.items() if j["expires_at"] < now]
        for k in expired:
            del self.jobs[k]
        requeued = 0
        cutoff = now - timedelta(seconds=stale_running_seconds)
        for j in self.jobs.values():
            if j["status"] == "running" and j["started_at"] and j["started_at"] < cutoff:
                j["status"] = "queued"
                requeued += 1
        return len(expired), requeued
