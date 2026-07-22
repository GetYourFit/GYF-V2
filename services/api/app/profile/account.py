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

from gyf_contracts.consent import normalize_consent_flags

# Tombstone only if not already deleted, so re-deletion is a no-op (idempotent).
_SOFT_DELETE_USER = "UPDATE users SET deleted_at = now() WHERE id = %s AND deleted_at IS NULL"
_IS_DELETED = "SELECT deleted_at IS NOT NULL FROM users WHERE id = %s"
# Listed, then purged one at a time, because a user's avatar bytes live in Supabase
# Storage and must be erased *before* the row that records the erasure request. Row-first
# would orphan the bytes with nothing left to retry from; bytes-first leaves the tombstone
# standing for the next run. See profile/avatar.py.
_LIST_EXPIRED = (
    "SELECT id, avatar_url FROM users "
    "WHERE deleted_at IS NOT NULL AND deleted_at < now() - make_interval(days => %s)"
)
_PURGE_USER = "DELETE FROM users WHERE id = %s AND deleted_at IS NOT NULL"
# Provision a user row if absent, leaving any existing row (incl. its deleted_at)
# untouched — so this never resurrects a tombstoned account.
_ENSURE_USER = "INSERT INTO users (id) VALUES (%s) ON CONFLICT (id) DO NOTHING"
_GET_CONSENT = "SELECT consent_flags FROM users WHERE id = %s"
# Merge (not replace) so granting one consent never clears another.
_UPDATE_CONSENT = "UPDATE users SET consent_flags = consent_flags || %s WHERE id = %s"
_SET_DISPLAY_NAME = "UPDATE users SET display_name = %s WHERE id = %s"
_SET_PHONE = "UPDATE users SET phone_country_code = %s, phone_number = %s WHERE id = %s"
_GET_PHONE = "SELECT phone_country_code, phone_number FROM users WHERE id = %s"
_SET_AVATAR_URL = "UPDATE users SET avatar_url = %s WHERE id = %s"
# The profile-summary hot path needs all of these from the one users row — read
# them in a single query rather than three round-trips (identity + phone + avatar).
_GET_PROFILE_FIELDS = (
    "SELECT display_name, created_at, phone_country_code, phone_number, avatar_url "
    "FROM users WHERE id = %s"
)
# Data-portability export (F2): every user-owned table and its owning column —
# the same ownership map erasure cascades over (0006 RLS list + social/follows/
# support). Fixed literals, so the f-string query below cannot be injected into.
_EXPORT_TABLES: tuple[tuple[str, str], ...] = (
    ("users", "id"),
    ("profiles", "user_id"),
    ("interactions", "user_id"),
    ("collections", "user_id"),
    ("saved_outfits", "user_id"),
    ("wardrobe_items", "user_id"),
    ("post_reactions", "user_id"),
    ("social_posts", "user_id"),
    ("support_messages", "user_id"),
    ("follows", "follower_id"),
    ("tryon_jobs", "user_id"),
)

# Tables whose export needs an explicit column list instead of ``*``. Only tryon_jobs
# so far, and for one reason: it holds image BYTEA. ``row_to_json`` would base64 every
# render into the export payload and turn a portability download into hundreds of MB —
# and the person photo, if a job were somehow mid-flight, would be *in* that file. The
# user's renders are already downloadable one-by-one from the try-on surface; the export
# carries the job's facts, not its pixels. Fixed literals, so still not injectable.
_EXPORT_COLUMNS: dict[str, str] = {
    "tryon_jobs": (
        "id, user_id, status, item_ids, confidence, model_version, rendered_slots, "
        "reason, error_code, attempts, created_at, started_at, finished_at, expires_at"
    ),
}


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

    def list_expired(self, grace_days: int) -> list[tuple[str, str | None]]:
        """``(user_id, avatar_url)`` for every user tombstoned > grace_days ago."""
        ...

    def purge_user(self, user_id: str) -> bool:
        """Hard-delete one tombstoned user. True if a row was removed.

        Refuses a user who is not tombstoned, so a purge run can never delete a live
        account through a stale id.
        """
        ...

    def get_consent(self, user_id: str) -> dict[str, bool]:
        """The user's current consent flags (empty if none/absent)."""
        ...

    def update_consent(self, user_id: str, flags: dict[str, bool]) -> dict[str, bool]:
        """Merge ``flags`` into the user's consent and return the merged result."""
        ...

    def set_display_name(self, user_id: str, name: str | None) -> None:
        """Set (or clear, with ``None``) the user's display name."""
        ...

    def set_phone(self, user_id: str, country_code: str | None, number: str | None) -> None:
        """Set (or clear, with ``None``) the user's phone country code + number."""
        ...

    def get_phone(self, user_id: str) -> tuple[str | None, str | None]:
        """``(country_code, number)`` for the user; ``(None, None)`` if absent."""
        ...

    def set_avatar_url(self, user_id: str, url: str | None) -> None:
        """Set (or clear, with ``None``) the user's profile picture URL."""
        ...

    def get_profile_fields(
        self, user_id: str
    ) -> tuple[str | None, object | None, str | None, str | None, str | None]:
        """``(display_name, created_at, phone_country_code, phone_number, avatar_url)``
        in one read — the profile-summary hot path. All ``None`` if the user is absent."""
        ...

    def export_data(self, user_id: str) -> dict[str, list[dict]]:
        """Data-portability export: every row the user owns, keyed by table."""
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

    def list_expired(self, grace_days: int) -> list[tuple[str, str | None]]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            rows = conn.execute(_LIST_EXPIRED, (grace_days,)).fetchall()
        return [(str(row[0]), row[1]) for row in rows]

    def purge_user(self, user_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_PURGE_USER, (user_id,))
            return cur.rowcount > 0

    def get_consent(self, user_id: str) -> dict[str, bool]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_GET_CONSENT, (user_id,)).fetchone()
        return normalize_consent_flags(dict(row[0]) if row and row[0] else {})

    def update_consent(self, user_id: str, flags: dict[str, bool]) -> dict[str, bool]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_UPDATE_CONSENT, (json.dumps(flags), user_id))
        return self.get_consent(user_id)

    def set_display_name(self, user_id: str, name: str | None) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_SET_DISPLAY_NAME, (name, user_id))

    def set_phone(self, user_id: str, country_code: str | None, number: str | None) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_SET_PHONE, (country_code, number, user_id))

    def get_phone(self, user_id: str) -> tuple[str | None, str | None]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_GET_PHONE, (user_id,)).fetchone()
        return (row[0], row[1]) if row else (None, None)

    def set_avatar_url(self, user_id: str, url: str | None) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(_SET_AVATAR_URL, (url, user_id))

    def get_profile_fields(
        self, user_id: str
    ) -> tuple[str | None, object | None, str | None, str | None, str | None]:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_GET_PROFILE_FIELDS, (user_id,)).fetchone()
        return tuple(row) if row else (None, None, None, None, None)  # type: ignore[return-value]

    def export_data(self, user_id: str) -> dict[str, list[dict]]:
        out: dict[str, list[dict]] = {}
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            for table, col in _EXPORT_TABLES:
                # table/col/cols are fixed literals from _EXPORT_TABLES and
                # _EXPORT_COLUMNS; only the user id is a parameter.
                cols = _EXPORT_COLUMNS.get(table, "*")
                row = conn.execute(
                    f"SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) "
                    f"FROM (SELECT {cols} FROM {table} WHERE {col} = %s) t",
                    (user_id,),
                ).fetchone()
                rows = row[0] if row else []
                out[table] = rows if isinstance(rows, list) else json.loads(rows)
        return out


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

    def list_expired(self, grace_days: int) -> list[tuple[str, str | None]]:
        # In-memory has no clock; every tombstoned user counts (grace assumed elapsed).
        return [(uid, u.get("avatar_url")) for uid, u in self.users.items() if u["deleted"]]

    def purge_user(self, user_id: str) -> bool:
        user = self.users.get(user_id)
        if user is None or not user["deleted"]:
            return False
        del self.users[user_id]
        self.purged.add(user_id)
        return True

    def get_consent(self, user_id: str) -> dict[str, bool]:
        user = self.users.get(user_id)
        return normalize_consent_flags(dict(user["consent"]) if user else {})

    def update_consent(self, user_id: str, flags: dict[str, bool]) -> dict[str, bool]:
        user = self.users.setdefault(user_id, {"deleted": False, "consent": {}})
        user["consent"].update(flags)
        return self.get_consent(user_id)

    def set_display_name(self, user_id: str, name: str | None) -> None:
        user = self.users.setdefault(user_id, {"deleted": False, "consent": {}})
        user["display_name"] = name

    def set_phone(self, user_id: str, country_code: str | None, number: str | None) -> None:
        user = self.users.setdefault(user_id, {"deleted": False, "consent": {}})
        user["phone_country_code"] = country_code
        user["phone_number"] = number

    def get_phone(self, user_id: str) -> tuple[str | None, str | None]:
        user = self.users.get(user_id)
        if user is None:
            return (None, None)
        return (user.get("phone_country_code"), user.get("phone_number"))

    def set_avatar_url(self, user_id: str, url: str | None) -> None:
        user = self.users.setdefault(user_id, {"deleted": False, "consent": {}})
        user["avatar_url"] = url

    def get_profile_fields(
        self, user_id: str
    ) -> tuple[str | None, object | None, str | None, str | None, str | None]:
        user = self.users.get(user_id)
        if user is None:
            return (None, None, None, None, None)
        return (
            user.get("display_name"),
            user.get("created_at"),
            user.get("phone_country_code"),
            user.get("phone_number"),
            user.get("avatar_url"),
        )

    def export_data(self, user_id: str) -> dict[str, list[dict]]:
        # In-memory holds only the users row; the Postgres impl covers every
        # owned table (see _EXPORT_TABLES) and is proven in test_export_postgres.
        user = self.users.get(user_id)
        if user is None:
            return {"users": []}
        row = {k: v for k, v in user.items() if k != "deleted"}
        row["id"] = user_id
        row["consent_flags"] = dict(user.get("consent", {}))
        row.pop("consent", None)
        return {"users": [row]}
