"""Account lifecycle on the ``users`` row: consent, soft-delete, and purge.

Right-to-erasure (GDPR / CLAUDE.md §2) is a **two-step soft delete**:

1. ``DELETE /account`` tombstones the user (``users.deleted_at = now()``) and
   disables the account immediately — authenticated endpoints reject a tombstoned
   principal, so no further data is written.
2. A **purge job** (:func:`purge_expired`, run on a schedule) hard-deletes users
   tombstoned longer than the grace window; the ``ON DELETE CASCADE`` from
   ``profiles`` and ``interactions`` removes all their data in one transaction.

This leaves a recovery window before erasure is irreversible while still
honoring the user's request the moment they make it. Consent flags
(``users.consent_flags``) live here too since they are also on the ``users`` row.
Everything is behind a protocol so it is testable without a live DB.
"""

from __future__ import annotations

import json
from typing import Protocol

# Tombstone only if not already deleted, so re-deletion is a no-op (idempotent).
_SOFT_DELETE_USER = "UPDATE users SET deleted_at = now() WHERE id = %s AND deleted_at IS NULL"
_IS_DELETED = "SELECT deleted_at IS NOT NULL FROM users WHERE id = %s"
_PURGE_EXPIRED = (
    "DELETE FROM users "
    "WHERE deleted_at IS NOT NULL AND deleted_at < now() - make_interval(days => %s)"
)
# Provision a user row if absent, leaving any existing row (incl. its deleted_at)
# untouched — so this never resurrects a tombstoned account.
_ENSURE_USER = "INSERT INTO users (id) VALUES (%s) ON CONFLICT (id) DO NOTHING"
_GET_CONSENT = "SELECT consent_flags FROM users WHERE id = %s"
# Merge (not replace) so granting one consent never clears another.
_UPDATE_CONSENT = "UPDATE users SET consent_flags = consent_flags || %s WHERE id = %s"


class AccountRepository(Protocol):
    def ensure_user(self, user_id: str) -> None:
        """Provision the user row if absent; never touches an existing one."""
        ...

    def soft_delete(self, user_id: str) -> bool:
        """Tombstone the user (set deleted_at). True iff newly tombstoned."""
        ...

    def is_deleted(self, user_id: str) -> bool:
        """Whether the user is tombstoned (or absent)."""
        ...

    def purge_expired(self, grace_days: int) -> int:
        """Hard-delete users tombstoned > grace_days ago. Returns rows removed."""
        ...

    def get_consent(self, user_id: str) -> dict[str, bool]:
        """The user's current consent flags (empty if none/absent)."""
        ...

    def update_consent(self, user_id: str, flags: dict[str, bool]) -> dict[str, bool]:
        """Merge ``flags`` into the user's consent and return the merged result."""
        ...


class PostgresAccountRepository:
    """Account lifecycle + consent in Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def ensure_user(self, user_id: str) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_ENSURE_USER, (user_id,))

    def soft_delete(self, user_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_SOFT_DELETE_USER, (user_id,))
            return cur.rowcount > 0

    def is_deleted(self, user_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_IS_DELETED, (user_id,)).fetchone()
        # Absent user is treated as "not a live account" -> True.
        return row is None or bool(row[0])

    def purge_expired(self, grace_days: int) -> int:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_PURGE_EXPIRED, (grace_days,))
            return cur.rowcount

    def get_consent(self, user_id: str) -> dict[str, bool]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_GET_CONSENT, (user_id,)).fetchone()
        return dict(row[0]) if row and row[0] else {}

    def update_consent(self, user_id: str, flags: dict[str, bool]) -> dict[str, bool]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_UPDATE_CONSENT, (json.dumps(flags), user_id))
        return self.get_consent(user_id)


class InMemoryAccountRepository:
    """Dict-backed repo for tests. Models tombstones and consent in memory."""

    def __init__(self, existing: set[str] | None = None) -> None:
        # user_id -> {"deleted": bool, "consent": dict}
        self.users: dict[str, dict] = {
            uid: {"deleted": False, "consent": {}} for uid in (existing or set())
        }
        self.purged: set[str] = set()

    def ensure_user(self, user_id: str) -> None:
        self.users.setdefault(user_id, {"deleted": False, "consent": {}})

    def soft_delete(self, user_id: str) -> bool:
        user = self.users.get(user_id)
        if user is None or user["deleted"]:
            return False
        user["deleted"] = True
        return True

    def is_deleted(self, user_id: str) -> bool:
        user = self.users.get(user_id)
        return user is None or user["deleted"]

    def purge_expired(self, grace_days: int) -> int:
        # In-memory has no clock; purge every tombstoned user (grace assumed elapsed).
        expired = [uid for uid, u in self.users.items() if u["deleted"]]
        for uid in expired:
            del self.users[uid]
            self.purged.add(uid)
        return len(expired)

    def get_consent(self, user_id: str) -> dict[str, bool]:
        user = self.users.get(user_id)
        return dict(user["consent"]) if user else {}

    def update_consent(self, user_id: str, flags: dict[str, bool]) -> dict[str, bool]:
        user = self.users.setdefault(user_id, {"deleted": False, "consent": {}})
        user["consent"].update(flags)
        return dict(user["consent"])
