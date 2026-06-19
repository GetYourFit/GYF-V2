"""Account deletion — the user's right to erase all their data (GDPR/CLAUDE.md §2).

Deleting the ``users`` row cascades (``ON DELETE CASCADE``) to ``profiles`` and
``interactions``, so a single delete erases the profile, the behavioral history,
and the identity in one transaction. Behind a protocol so it is testable without
a live DB and so the auth layer (Supabase) can be cleaned up alongside later.
"""

from __future__ import annotations

from typing import Protocol

_DELETE_USER = "DELETE FROM users WHERE id = %s"


class AccountRepository(Protocol):
    def delete_user(self, user_id: str) -> bool:
        """Delete the user (cascading to profile + interactions). True if removed."""
        ...


class PostgresAccountRepository:
    """Deletes a user and all cascaded data. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def delete_user(self, user_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_DELETE_USER, (user_id,))
            return cur.rowcount > 0


class InMemoryAccountRepository:
    """Set-backed repo for tests. Records which user_ids have been deleted."""

    def __init__(self, existing: set[str] | None = None) -> None:
        self.users: set[str] = set(existing or set())
        self.deleted: set[str] = set()

    def delete_user(self, user_id: str) -> bool:
        if user_id in self.users:
            self.users.discard(user_id)
            self.deleted.add(user_id)
            return True
        return False
