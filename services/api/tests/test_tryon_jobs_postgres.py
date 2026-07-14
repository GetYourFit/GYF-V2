"""The durable try-on queue against a real Postgres (F8).

The in-memory double proves the state machine. It cannot prove the things that only
exist in the database, and those are exactly the ones that cost money or leak data if
they are wrong:

- ``FOR UPDATE SKIP LOCKED`` really does hand one job to exactly one of two racing
  workers. If it does not, every render is paid for twice.
- The consented body photo is really gone from the row once the job is terminal.
- Erasure really cascades a user's jobs away.
- RLS really hides another user's job — the render is a picture of their body.
"""

from __future__ import annotations

import uuid

import pytest

from app.tryon.jobs import PostgresTryOnJobRepository


def _user(conn, user_id: str) -> None:
    conn.execute("INSERT INTO users (id) VALUES (%s) ON CONFLICT DO NOTHING", (user_id,))


@pytest.fixture
def repo(live_db: str):
    import psycopg

    with psycopg.connect(live_db) as conn:
        conn.execute("DELETE FROM tryon_jobs")
        conn.commit()
    return PostgresTryOnJobRepository(live_db)


@pytest.fixture
def user(live_db: str):
    import psycopg

    user_id = str(uuid.uuid4())
    with psycopg.connect(live_db) as conn:
        _user(conn, user_id)
        conn.commit()
    yield user_id
    with psycopg.connect(live_db) as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()


def test_skip_locked_gives_one_job_to_exactly_one_worker(live_db: str, repo, user):
    """Two workers race the same single queued job. One gets it; the other gets nothing.

    This is the whole reason the in-process worker and the cron worker can both run
    without coordinating — and the reason a Render zero-downtime deploy (old and new
    instance live at once) cannot double-charge the GPU.
    """
    import psycopg

    repo.enqueue(user, ["top-1"], b"photo-bytes", 24)

    # Worker A opens a transaction and claims, holding the row lock.
    with psycopg.connect(live_db) as conn_a:
        conn_a.autocommit = False
        claimed_a = conn_a.execute(
            """
            UPDATE tryon_jobs SET status = 'running', attempts = attempts + 1
            WHERE id = (
                SELECT id FROM tryon_jobs
                WHERE status = 'queued' AND next_attempt_at <= now()
                ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
            )
            RETURNING id
            """
        ).fetchone()

        # Worker B races it *while A's transaction is still open*. It must skip the
        # locked row rather than block on it or take it.
        with psycopg.connect(live_db) as conn_b:
            claimed_b = conn_b.execute(
                """
                UPDATE tryon_jobs SET status = 'running', attempts = attempts + 1
                WHERE id = (
                    SELECT id FROM tryon_jobs
                    WHERE status = 'queued' AND next_attempt_at <= now()
                    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
                )
                RETURNING id
                """
            ).fetchone()
            conn_b.commit()

        conn_a.commit()

    assert claimed_a is not None
    assert claimed_b is None


def test_photo_is_dropped_the_moment_the_job_is_terminal(live_db: str, repo, user):
    """D8: the body photo lives for the render, not for the job's TTL."""
    import psycopg

    job = repo.enqueue(user, ["top-1"], b"photo-bytes", 24)
    claimed = repo.claim()
    assert claimed.person_png == b"photo-bytes"  # the worker does get the photo

    repo.finish(job.job_id, "succeeded", result_png=b"render", confidence=0.7)

    with psycopg.connect(live_db) as conn:
        person, result = conn.execute(
            "SELECT person_png, result_png FROM tryon_jobs WHERE id = %s", (job.job_id,)
        ).fetchone()
    assert person is None
    assert bytes(result) == b"render"


def test_photo_is_dropped_on_failure_and_on_cancel(live_db: str, repo, user):
    import psycopg

    failed = repo.enqueue(user, ["top-1"], b"photo", 24)
    repo.claim()
    repo.finish(failed.job_id, "failed", error_code="vendor_error", reason="nope")

    cancelled = repo.enqueue(user, ["top-1"], b"photo", 24)
    repo.request_cancel(cancelled.job_id, user)

    with psycopg.connect(live_db) as conn:
        rows = conn.execute(
            "SELECT person_png FROM tryon_jobs WHERE user_id = %s", (user,)
        ).fetchall()
    assert [r[0] for r in rows] == [None, None]


def test_quota_counts_spent_gpu_and_refunds_a_pre_claim_cancel(repo, user):
    for _ in range(3):
        repo.enqueue(user, ["top-1"], b"photo", 24)
    cancelled = repo.enqueue(user, ["top-1"], b"photo", 24)
    assert repo.month_count(user) == 4

    repo.request_cancel(cancelled.job_id, user)

    # Nothing was rendered for the cancelled job, so it is not charged.
    assert repo.month_count(user) == 3


def test_cancelling_a_running_job_flags_it_but_does_not_refund(repo, user):
    """The honest ceiling: a vendor render already in flight cannot be un-spent."""
    job = repo.enqueue(user, ["top-1"], b"photo", 24)
    repo.claim()

    repo.request_cancel(job.job_id, user)

    assert repo.is_cancelled(job.job_id)
    assert repo.get(job.job_id, user).status == "running"  # not silently 'cancelled'
    assert repo.month_count(user) == 1  # the GPU seconds are spent; no refund


def test_sweep_deletes_expired_and_requeues_stranded_jobs(live_db: str, repo, user):
    import psycopg

    expired = repo.enqueue(user, ["top-1"], b"photo", 24)
    stranded = repo.enqueue(user, ["top-1"], b"photo", 24)
    repo.claim()  # claims `expired` (oldest first)
    repo.claim()  # claims `stranded`
    with psycopg.connect(live_db) as conn:
        conn.execute(
            "UPDATE tryon_jobs SET expires_at = now() - interval '1 hour' WHERE id = %s",
            (expired.job_id,),
        )
        conn.execute(
            "UPDATE tryon_jobs SET started_at = now() - interval '1 hour' WHERE id = %s",
            (stranded.job_id,),
        )
        conn.commit()

    deleted, requeued = repo.sweep(stale_running_seconds=60)

    assert deleted == 1
    assert requeued == 1
    assert repo.get(expired.job_id, user) is None
    assert repo.get(stranded.job_id, user).status == "queued"


def test_another_users_job_is_invisible(repo, user, live_db: str):
    import psycopg

    other = str(uuid.uuid4())
    with psycopg.connect(live_db) as conn:
        _user(conn, other)
        conn.commit()
    try:
        job = repo.enqueue(other, ["top-1"], b"photo", 24)
        repo.claim()
        repo.finish(job.job_id, "succeeded", result_png=b"their-body")

        # Owner-scoped by construction: the caller cannot read the row or the render.
        assert repo.get(job.job_id, user) is None
        assert repo.image(job.job_id, user) is None
        assert repo.list_for_user(user) == []
        assert repo.request_cancel(job.job_id, user) is None
        # ...but the owner can.
        assert repo.image(job.job_id, other) == b"their-body"
    finally:
        with psycopg.connect(live_db) as conn:
            conn.execute("DELETE FROM users WHERE id = %s", (other,))
            conn.commit()


def test_erasure_cascades_jobs_away(live_db: str, repo):
    """Right-to-erasure: deleting the user takes their renders with them, for free."""
    import psycopg

    victim = str(uuid.uuid4())
    with psycopg.connect(live_db) as conn:
        _user(conn, victim)
        conn.commit()
    job = repo.enqueue(victim, ["top-1"], b"photo", 24)
    repo.claim()
    repo.finish(job.job_id, "succeeded", result_png=b"render")

    with psycopg.connect(live_db) as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (victim,))
        conn.commit()
        remaining = conn.execute(
            "SELECT count(*) FROM tryon_jobs WHERE user_id = %s", (victim,)
        ).fetchone()[0]
    assert remaining == 0
