"""Grace-window purge job: hard-delete accounts tombstoned past the grace period.

Run on a schedule (cron / scheduled task). Hard-deletes every user whose
``deleted_at`` is older than ``settings.account_deletion_grace_days``, cascading
to their profile and interactions. Idempotent and safe to run repeatedly.

    python -m app.profile.purge            # uses the configured grace window
    python -m app.profile.purge --days 7   # override the grace window
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable

from ..config import settings


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
    removed = repo.purge_expired(args.days)
    print(f"purge: removed={removed} grace_days={args.days}")


if __name__ == "__main__":
    main()
