"""Profile persistence: upsert / fetch / delete a user's profile row.

Behind a :class:`ProfileRepository` protocol so the onboarding logic is
unit-testable with an in-memory repo (mirrors the injectable pool on
:class:`app.catalog.ingest.PostgresItemRepository`). The ``profiles`` table is
keyed 1:1 by ``user_id`` (``ON DELETE CASCADE`` from ``users``), so write is an
idempotent upsert on the primary key.
"""

from __future__ import annotations

import json
from threading import Lock
from typing import Callable, Protocol

from .models import PROFILE_FIELDS, BudgetRange, Profile, ProfileInput, profile_from_manual
from .photo import BodyResult, SkinToneResult, profile_from_photo

# SQL kept as module constants so tests can assert against them without a live DB.
_UPSERT_PROFILE = """
INSERT INTO profiles (
    user_id, skin_tone, undertone, body_type, measurements, style_intent,
    budget_range, source, field_confidence, model_version, updated_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
ON CONFLICT (user_id) DO UPDATE SET
    skin_tone = EXCLUDED.skin_tone,
    undertone = EXCLUDED.undertone,
    body_type = EXCLUDED.body_type,
    measurements = EXCLUDED.measurements,
    style_intent = EXCLUDED.style_intent,
    budget_range = EXCLUDED.budget_range,
    source = EXCLUDED.source,
    field_confidence = EXCLUDED.field_confidence,
    model_version = EXCLUDED.model_version,
    updated_at = now()
"""

_SELECT_PROFILE = """
SELECT skin_tone, undertone, body_type, measurements, style_intent,
       budget_range, source, field_confidence, model_version
FROM profiles WHERE user_id = %s
"""

_DELETE_PROFILE = "DELETE FROM profiles WHERE user_id = %s"
_LOCK_PROFILE = "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))"
_SELECT_PROFILE_FOR_UPDATE = _SELECT_PROFILE.rstrip() + " FOR UPDATE"


def _occasion_into(profile: Profile) -> dict[str, object]:
    """Pack occasion + gender into the ``style_intent`` JSONB envelope.

    The baseline ``profiles`` schema has no dedicated ``occasion`` or ``gender``
    column; rather than a migration, both ride inside the ``style_intent`` JSONB
    as ``{"intents": [...], "occasion": "...", "gender": "..."}`` so they
    round-trip losslessly. Older rows without ``gender`` simply read back ``None``.
    """
    return {
        "intents": profile.style_intent,
        "occasion": profile.occasion,
        "gender": profile.gender,
    }


def _style_intent_out(raw: object) -> tuple[list[str], str | None, str | None]:
    """Unpack the ``style_intent`` JSONB envelope into (intents, occasion, gender)."""
    if isinstance(raw, dict):
        intents = raw.get("intents", [])
        occasion = raw.get("occasion")
        gender = raw.get("gender")
        return (list(intents) if isinstance(intents, list) else [], occasion, gender)
    if isinstance(raw, list):  # legacy/plain list of intents
        return (list(raw), None, None)
    return ([], None, None)


class ProfileRepository(Protocol):
    def upsert(self, user_id: str, profile: Profile) -> None:
        """Insert or replace the profile for ``user_id``."""
        ...

    def get(self, user_id: str) -> Profile | None:
        """Return the stored profile for ``user_id``, or ``None``."""
        ...

    def patch_manual(self, user_id: str, payload: ProfileInput) -> Profile | None:
        """Atomically apply only manually supplied profile fields."""
        ...

    def patch_photo(
        self, user_id: str, skin: SkinToneResult | None, body: BodyResult | None
    ) -> Profile:
        """Atomically merge non-abstaining photo estimates."""
        ...

    def delete(self, user_id: str) -> bool:
        """Delete the profile for ``user_id``. Returns True if a row was removed."""
        ...


class PostgresProfileRepository:
    """Upserts/reads/deletes profiles in Postgres. Lazy pool, injectable for tests."""

    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def upsert(self, user_id: str, profile: Profile) -> None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            _upsert(conn, user_id, profile)

    def get(self, user_id: str) -> Profile | None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_SELECT_PROFILE, (user_id,)).fetchone()
        if row is None:
            return None
        return _row_to_profile(row)

    def patch_manual(self, user_id: str, payload: ProfileInput) -> Profile | None:
        if not payload.model_fields_set.intersection(PROFILE_FIELDS):
            return self.get(user_id)
        return self._patch(user_id, lambda existing: profile_from_manual(payload, existing))

    def patch_photo(
        self, user_id: str, skin: SkinToneResult | None, body: BodyResult | None
    ) -> Profile:
        return self._patch(
            user_id, lambda existing: profile_from_photo(skin=skin, body=body, existing=existing)
        )

    def _patch(self, user_id: str, merge: Callable[[Profile | None], Profile]) -> Profile:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            with conn.transaction():
                # The advisory lock also serializes concurrent first writes, when
                # there is no profile row for SELECT FOR UPDATE to lock yet.
                conn.execute(_LOCK_PROFILE, (user_id,))
                row = conn.execute(_SELECT_PROFILE_FOR_UPDATE, (user_id,)).fetchone()
                profile = merge(_row_to_profile(row) if row is not None else None)
                _upsert(conn, user_id, profile)
        return profile

    def delete(self, user_id: str) -> bool:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            cur = conn.execute(_DELETE_PROFILE, (user_id,))
            return cur.rowcount > 0


def _row_to_profile(row: tuple) -> Profile:
    """Map a ``_SELECT_PROFILE`` row tuple to a :class:`Profile`."""
    (
        skin_tone,
        undertone,
        body_type,
        measurements,
        style_intent_raw,
        budget_raw,
        source,
        field_confidence,
        model_version,
    ) = row
    intents, occasion, gender = _style_intent_out(style_intent_raw)
    return Profile(
        skin_tone=skin_tone,
        undertone=undertone,
        body_type=body_type,
        gender=gender,
        measurements=measurements or {},
        style_intent=intents,
        budget_range=BudgetRange(**budget_raw) if budget_raw else None,
        occasion=occasion,
        source=source or "manual",
        field_confidence=field_confidence or {},
        model_version=model_version,
    )


def _upsert(conn: object, user_id: str, profile: Profile) -> None:
    budget = profile.budget_range.model_dump() if profile.budget_range else None
    conn.execute(  # type: ignore[attr-defined]
        _UPSERT_PROFILE,
        (
            user_id,
            profile.skin_tone,
            profile.undertone,
            profile.body_type,
            json.dumps(profile.measurements),
            json.dumps(_occasion_into(profile)),
            json.dumps(budget) if budget is not None else None,
            profile.source,
            json.dumps(profile.field_confidence),
            profile.model_version,
        ),
    )


class InMemoryProfileRepository:
    """Dict-backed repo for tests and dry runs. Keyed by ``user_id``."""

    def __init__(self) -> None:
        self.profiles: dict[str, Profile] = {}
        self._lock = Lock()

    def upsert(self, user_id: str, profile: Profile) -> None:
        self.profiles[user_id] = profile

    def get(self, user_id: str) -> Profile | None:
        return self.profiles.get(user_id)

    def patch_manual(self, user_id: str, payload: ProfileInput) -> Profile | None:
        if not payload.model_fields_set.intersection(PROFILE_FIELDS):
            return self.get(user_id)
        return self._patch(user_id, lambda existing: profile_from_manual(payload, existing))

    def patch_photo(
        self, user_id: str, skin: SkinToneResult | None, body: BodyResult | None
    ) -> Profile:
        return self._patch(
            user_id, lambda existing: profile_from_photo(skin=skin, body=body, existing=existing)
        )

    def _patch(self, user_id: str, merge: Callable[[Profile | None], Profile]) -> Profile:
        with self._lock:
            profile = merge(self.profiles.get(user_id))
            self.profiles[user_id] = profile
            return profile

    def delete(self, user_id: str) -> bool:
        return self.profiles.pop(user_id, None) is not None
