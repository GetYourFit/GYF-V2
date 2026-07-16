"""Grace-window purge job: hard-delete accounts tombstoned past the grace period.

Run on a schedule (cron / scheduled task). Hard-deletes every user whose
``deleted_at`` is older than ``settings.account_deletion_grace_days``, cascading
to their profile and interactions. Idempotent and safe to run repeatedly.

    python -m app.profile.purge            # uses the configured grace window
    python -m app.profile.purge --days 7   # override the grace window

A user's avatar bytes live in Supabase Storage, outside the database cascade, in a
public bucket. They are erased *before* the row, because the row is the only record
that erasure was requested: deleting it first would orphan the bytes with nothing left
to retry from. A user whose bytes could not be erased keeps their tombstone and is
reported as deferred, so the next run retries rather than the account quietly ending up
half-erased with its face still public. Exit code is non-zero when anything defers, so
a scheduled run surfaces it instead of printing into the void.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Iterable

from ..config import settings
from .avatar import delete_avatar_objects


def main(argv: Iterable[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Purge accounts past the deletion grace window.")
    parser.add_argument(
        "--days",
        type=int,
        default=settings.account_deletion_grace_days,
        help="Grace window in days; tombstones older than this are hard-deleted.",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    from .account import PostgresAccountRepository

    repo = PostgresAccountRepository(settings.database_url)
    removed, deferred = 0, []
    for user_id, avatar_url in repo.list_expired(args.days):
        # Only an account that actually has avatar bytes waits on Storage. Otherwise an
        # absent service-role key would hold up erasure for users who never uploaded one.
        if avatar_url and not delete_avatar_objects(user_id):
            deferred.append(user_id)
            continue
        if repo.purge_user(user_id):
            removed += 1
    print(f"purge: removed={removed} deferred={len(deferred)} grace_days={args.days}")
    if deferred:
        print(f"purge: DEFERRED (avatar bytes not erased, tombstone kept): {' '.join(deferred)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
