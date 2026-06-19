"""Profile persistence: upsert / fetch / delete a user's profile row.

Behind a :class:`ProfileRepository` protocol so the onboarding logic is
unit-testable with an in-memory repo (mirrors the injectable pool on
:class:`app.catalog.ingest.PostgresItemRepository`). The ``profiles`` table is
keyed 1:1 by ``user_id`` (``ON DELETE CASCADE`` from ``users``), so write is an
idempotent upsert on the primary key.
"""

from __future__ import annotations

import json
from typing import Protocol

from .models import BudgetRange, Profile

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


def _occasion_into(profile: Profile) -> dict[str, object]:
    """Pack the occasion into ``style_intent`` JSONB envelope.

    The baseline ``profiles`` schema has no dedicated ``occasion`` column; rather
    than a migration in Cycle 1, occasion rides inside the ``style_intent`` JSONB
    as ``{"intents": [...], "occasion": "..."}`` so it round-trips losslessly.
    """
    return {"intents": profile.style_intent, "occasion": profile.occasion}


def _style_intent_out(raw: object) -> tuple[list[str], str | None]:
    """Unpack the ``style_intent`` JSONB envelope into (intents, occasion)."""
    if isinstance(raw, dict):
        intents = raw.get("intents", [])
        occasion = raw.get("occasion")
        return (list(intents) if isinstance(intents, list) else [], occasion)
    if isinstance(raw, list):  # legacy/plain list of intents
        return (list(raw), None)
    return ([], None)


class ProfileRepository(Protocol):
    def upsert(self, user_id: str, profile: Profile) -> None:
        """Insert or replace the profile for ``user_id``."""
        ...

    def get(self, user_id: str) -> Profile | None:
        """Return the stored profile for ``user_id``, or ``None``."""
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
        budget = profile.budget_range.model_dump() if profile.budget_range else None
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(
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

    def get(self, user_id: str) -> Profile | None:
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            row = conn.execute(_SELECT_PROFILE, (user_id,)).fetchone()
        if row is None:
            return None
        return _row_to_profile(row)

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
    intents, occasion = _style_intent_out(style_intent_raw)
    return Profile(
        skin_tone=skin_tone,
        undertone=undertone,
        body_type=body_type,
        measurements=measurements or {},
        style_intent=intents,
        budget_range=BudgetRange(**budget_raw) if budget_raw else None,
        occasion=occasion,
        source=source or "manual",
        field_confidence=field_confidence or {},
        model_version=model_version,
    )


class InMemoryProfileRepository:
    """Dict-backed repo for tests and dry runs. Keyed by ``user_id``."""

    def __init__(self) -> None:
        self.profiles: dict[str, Profile] = {}

    def upsert(self, user_id: str, profile: Profile) -> None:
        self.profiles[user_id] = profile

    def get(self, user_id: str) -> Profile | None:
        return self.profiles.get(user_id)

    def delete(self, user_id: str) -> bool:
        return self.profiles.pop(user_id, None) is not None
