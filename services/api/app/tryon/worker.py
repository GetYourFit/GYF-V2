"""The try-on worker: drains the durable job queue through the TryOnRenderer port (F8).

Runs in two places, deliberately, and both are safe because every claim goes through
``FOR UPDATE SKIP LOCKED``:

- **In-process** (a daemon thread started in the API's lifespan). This is the *latency*:
  a render on a warm instance starts within a second of the enqueue. It is best-effort —
  a sleeping or redeploying instance simply isn't draining.
- **Scheduled** (``python -m app.tryon.worker`` from GitHub Actions, exactly like the
  erasure purge job). This is the *guarantee*: it drains whatever the in-process worker
  missed, and it is the only thing that runs when the API is asleep.

Neither can double-render a job, so there is no coordination between them to get wrong.

    python -m app.tryon.worker            # drain the queue, then exit
    python -m app.tryon.worker --once     # claim at most one job
    python -m app.tryon.worker --sweep    # TTL-delete + requeue stranded jobs; no rendering

Cost is bounded before the GPU is touched, never after: the daily cap is re-checked at
claim time, because a job enqueued yesterday must not be able to spend today's budget
after the switch has tripped.
"""

from __future__ import annotations

import argparse
import logging
import threading
import time
from collections.abc import Iterable

from gyf_contracts.consent import behavioral_learning_enabled

from ..config import settings
from .jobs import RETRYABLE_ERRORS, ClaimedJob, TryOnJobRepository

log = logging.getLogger(__name__)

# Backoff between attempts: 30s, 60s, 120s. A retry exists for a wobbling vendor, so
# the first one is fast; the last is slow enough not to hammer an outage.
_BACKOFF_BASE_SECONDS = 30


def _backoff_seconds(attempts: int) -> int:
    return _BACKOFF_BASE_SECONDS * (2 ** max(0, attempts - 1))


def render_one(
    job: ClaimedJob,
    repo: TryOnJobRepository,
    renderer,
    directory,
    sink=None,
    account_repo=None,
) -> str:
    """Render one claimed job to a terminal state. Returns the status written.

    Every exit path calls ``repo.finish`` or ``repo.requeue`` — a claimed job is never
    left ``running``, because a job stuck in ``running`` is a job whose photo is never
    dropped.
    """
    from ..events import InteractionAction, InteractionEvent, InteractionTarget
    from . import TryOnGarment

    # The user may have cancelled while the job sat in the queue. Check before spending
    # the GPU, not after.
    if repo.is_cancelled(job.job_id):
        repo.finish(
            job.job_id,
            "cancelled",
            reason="Cancelled before rendering started.",
            error_code="cancelled_by_user",
        )
        return "cancelled"

    # F4: an item delisted between enqueue and render must not be rendered onto a body
    # and then linked to a dead product page.
    details = directory.lookup(list(job.item_ids))
    garments = [
        TryOnGarment(item_id=item_id, image_url=d.image_url, slot=d.slot)
        for item_id in job.item_ids
        if (d := details.get(item_id)) is not None and d.image_url
    ]
    if not garments:
        repo.finish(
            job.job_id,
            "failed",
            reason="Those pieces are no longer available to render.",
            error_code="no_renderable_items",
        )
        return "failed"

    try:
        render = renderer.render(job.person_png, garments)
    except Exception as exc:  # noqa: BLE001 — the vendor lane is the untrusted edge
        code = "vendor_timeout" if isinstance(exc, TimeoutError) else "vendor_error"
        # Never log the exception payload: a vendor error body can echo the request,
        # and the request carries a body photo (D8).
        log.warning("try-on render failed job=%s code=%s type=%s", job.job_id, code, type(exc))
        if code in RETRYABLE_ERRORS and job.attempts < settings.tryon_max_attempts:
            repo.requeue(job.job_id, _backoff_seconds(job.attempts))
            return "queued"
        repo.finish(
            job.job_id,
            "failed",
            reason="The render didn't finish. Your photo has already been deleted.",
            error_code=code,
        )
        return "failed"

    # An abstention is a correct answer, not a failure: the renderer looked and honestly
    # declined (D6). It is terminal and never retried — asking again gets the same "no".
    if render.abstained:
        repo.finish(
            job.job_id,
            "abstained",
            confidence=render.confidence,
            model_version=render.model_version,
            reason=render.reason,
            error_code="vendor_rejected",
        )
        return "abstained"

    repo.finish(
        job.job_id,
        "succeeded",
        result_png=render.image_png,
        confidence=render.confidence,
        model_version=render.model_version,
        rendered_slots=render.rendered_slots,
        reason=render.reason,
    )

    # The flywheel's try-on signal — moved here from the old synchronous route. Consent
    # is re-checked at render time because the user may have withdrawn it while the job
    # sat in the queue (F3: no route, and no worker, may forget the check).
    if sink is not None and account_repo is not None:
        flags = account_repo.get_consent(job.user_id)
        if behavioral_learning_enabled(flags):
            sink.publish_many(
                [
                    InteractionEvent(
                        user_id=job.user_id,
                        target_type=InteractionTarget.ITEM,
                        target_id=g.item_id,
                        action=InteractionAction.TRYON,
                        context={"model_version": render.model_version},
                    )
                    for g in garments
                ]
            )
    return "succeeded"


def drain(repo, renderer, directory, sink=None, account_repo=None, once: bool = False) -> int:
    """Claim and render until the queue is empty (or the daily cap trips). Returns count."""
    done = 0
    while True:
        if repo.renders_today() >= settings.tryon_daily_render_cap:
            # The kill switch. Queued jobs stay queued and drain tomorrow — they are not
            # failed, because nothing is wrong with them; the deployment is just at its
            # ceiling for today.
            log.warning("try-on daily render cap reached (%s)", settings.tryon_daily_render_cap)
            return done
        job = repo.claim()
        if job is None:
            return done
        render_one(job, repo, renderer, directory, sink, account_repo)
        done += 1
        if once:
            return done


def _build():
    """Construct the worker's collaborators outside a request (no FastAPI Depends here)."""
    from ..affiliate import linker_from_settings
    from ..catalog.directory import PostgresItemDirectory
    from ..dependencies import get_tryon_renderer, shared_pool
    from ..profile.account import PostgresAccountRepository
    from ..sink import get_sink
    from .jobs import PostgresTryOnJobRepository

    dsn = settings.database_url
    pool = shared_pool(dsn)
    return (
        PostgresTryOnJobRepository(dsn, pool=pool),
        get_tryon_renderer(),
        PostgresItemDirectory(dsn, pool=pool, linker=linker_from_settings()),
        get_sink(pool=pool if settings.event_sink == "postgres" else None),
        PostgresAccountRepository(dsn, pool=pool),
    )


def start_background_worker() -> threading.Thread | None:
    """Start the in-process drain loop. Best-effort latency; the cron is the guarantee.

    ponytail: a daemon thread, not an asyncio task — ``renderer.render`` is a blocking
    HTTP call to the GPU lane and would otherwise need the whole port made async for no
    gain. One thread, polling every few seconds, is the entire mechanism.
    """
    if not (settings.tryon_enabled and settings.tryon_inproc_worker):
        return None

    def loop() -> None:
        repo, renderer, directory, sink, account_repo = _build()
        while True:
            try:
                if drain(repo, renderer, directory, sink, account_repo) == 0:
                    repo.sweep(settings.tryon_stale_running_seconds)
            except Exception:  # noqa: BLE001 — a worker that dies stops every render
                log.exception("try-on worker loop failed; retrying")
            time.sleep(settings.tryon_worker_poll_seconds)

    thread = threading.Thread(target=loop, name="tryon-worker", daemon=True)
    thread.start()
    return thread


def main(argv: Iterable[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Drain the durable try-on job queue.")
    parser.add_argument("--once", action="store_true", help="Claim at most one job.")
    parser.add_argument("--sweep", action="store_true", help="TTL/stale sweep only; no rendering.")
    args = parser.parse_args(list(argv) if argv is not None else None)

    repo, renderer, directory, sink, account_repo = _build()

    if args.sweep:
        expired, requeued = repo.sweep(settings.tryon_stale_running_seconds)
        print(f"tryon sweep: expired={expired} requeued={requeued}")
        return

    rendered = drain(repo, renderer, directory, sink, account_repo, once=args.once)
    expired, requeued = repo.sweep(settings.tryon_stale_running_seconds)
    print(f"tryon worker: rendered={rendered} expired={expired} requeued={requeued}")


if __name__ == "__main__":
    main()
