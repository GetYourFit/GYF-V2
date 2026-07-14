"""Durable virtual try-on jobs (F8).

The gap this closes: ``POST /tryon`` rendered **synchronously**, blocking the request
for the 10-60s a vendor/GPU render takes. On a free-tier instance that request is
killed by the proxy long before the render lands, and a render that *did* land was
lost the moment the client disconnected — no retry, no cancellation, no cost ceiling,
and a body photo held in memory for the whole call.

A job is a row: the request survives the request. The worker claims it with
``FOR UPDATE SKIP LOCKED`` (so two workers can never render the same job), retries
transient vendor failures with backoff, and honours a cancel flag between passes.

Privacy (doctrine D8) is why ``person_png`` is a separate nullable column from
``result_png``: the consented body photo is NULLed the instant the job reaches a
terminal state, so a sensitive upload lives for the minutes a render takes, never
for the job's TTL. ``expires_at`` then sweeps the render itself.

ponytail: photo + render live in the row as BYTEA rather than object storage. The
ceiling is real and worth stating, because it is the reason this is safe *only* with
the current caps. A render is ~250 KB; resident bytes are bounded not by total usage
but by the TTL window times the daily cap — at the shipped defaults (24 h TTL,
``tryon_daily_render_cap`` = 200) that is ~50 MB steady state, inside Supabase's
500 MB free tier alongside the ~90 MB catalogue. Object storage would buy headroom at
the price of an S3 client, a signed-URL path, and a new trust boundary keyed on
``GYF_SUPABASE_SERVICE_ROLE_KEY`` — which is currently recorded as exposed and unrotated.

Upgrade path, and the exact trigger: if the TTL is raised past ~72 h **or** the daily
cap past ~700, resident bytes cross ~175 MB and the free tier becomes the binding
constraint before the GPU budget does. At that point move the blobs to R2 (10 GB free)
behind the same job row — the API surface does not change, because the render is
already served by a route (``GET /tryon/jobs/{id}/image``) and never inlined into JSON.

Revision ID: 0018_tryon_jobs
Revises: 0017_catalog_availability
Create Date: 2026-07-15
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0018_tryon_jobs"
down_revision: str | None = "0017_catalog_availability"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Terminal states are the ones a worker never picks up again. ``abstained`` is a
# SUCCESS of the honest kind (doctrine D6: the renderer declined rather than
# fabricate) — it is deliberately not ``failed``, and it is never retried.
_STATUSES = ("queued", "running", "succeeded", "abstained", "failed", "cancelled")


def upgrade() -> None:
    op.execute(
        f"""
        CREATE TABLE tryon_jobs (
            id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status           TEXT NOT NULL DEFAULT 'queued'
                             CHECK (status IN {_STATUSES}),
            item_ids         TEXT[] NOT NULL,
            person_png       BYTEA,
            result_png       BYTEA,
            confidence       REAL,
            model_version    TEXT,
            rendered_slots   TEXT[] NOT NULL DEFAULT '{{}}',
            reason           TEXT NOT NULL DEFAULT '',
            error_code       TEXT,
            attempts         SMALLINT NOT NULL DEFAULT 0,
            cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
            next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
            started_at       TIMESTAMPTZ,
            finished_at      TIMESTAMPTZ,
            expires_at       TIMESTAMPTZ NOT NULL
        )
        """
    )
    # The claim query's exact predicate: the partial index keeps it a scan of the
    # (small) pending set, never of the whole retained-job history.
    op.execute(
        "CREATE INDEX idx_tryon_jobs_claim ON tryon_jobs (next_attempt_at) WHERE status = 'queued'"
    )
    # Quota counting and the user's job list share this one index.
    op.execute("CREATE INDEX idx_tryon_jobs_user ON tryon_jobs (user_id, created_at DESC)")
    # The TTL sweep.
    op.execute("CREATE INDEX idx_tryon_jobs_expiry ON tryon_jobs (expires_at)")

    # Per-user isolation, same GUC-keyed policy every owned table uses (0006).
    op.execute("ALTER TABLE tryon_jobs ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tryon_jobs_owner ON tryon_jobs
        USING (user_id = current_setting('app.current_user_id', true)::uuid)
        WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tryon_jobs")
