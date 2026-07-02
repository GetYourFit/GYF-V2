"""Shared fixtures for live-database integration tests.

Most of the suite uses in-memory repositories via FastAPI dependency overrides —
fast, hermetic, and enough for logic/contract coverage. But in-memory repos cannot
catch the failures that only appear against real Postgres: a broken migration, a
column the SQL expects but the schema lacks, or a behavioral event that is accepted
by the API yet never lands in the `interactions` table. The golden-path test
(``test_golden_path.py``) exercises the *real* Postgres repositories end to end to
guard exactly those gaps.

Safety: these fixtures refuse to run against anything but a local database, so they
can never truncate a deployed/Supabase instance. A non-local ``GYF_DATABASE_URL``
(or an unreachable DB) skips the live tests rather than touching shared data.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.config import settings

API_DIR = Path(__file__).resolve().parents[1]


def _test_dsn() -> str:
    """The DB these tests target: an explicit test DSN if set (CI uses this so the
    suite never touches the app's configured DB), else the local default."""
    return os.environ.get("GYF_TEST_DATABASE_URL") or settings.database_url


# Categories the candidate query actually filters on, per slot — derived from the
# shared taxonomy so the seed stays correct if the taxonomy changes.
from app.recsys.conditioning import _CATEGORIES_BY_SLOT  # noqa: E402

_LOCAL_HOSTS = ("localhost", "127.0.0.1", "@postgres", "::1")


def _is_local(dsn: str) -> bool:
    return any(host in dsn for host in _LOCAL_HOSTS)


@pytest.fixture(scope="session")
def live_db() -> str:
    """A migrated, seeded local Postgres DSN — or skip if none is available.

    Brings the schema to head from migrations alone (the bug this guards against:
    a fresh DB must build from Alembic with no side-loaded schema), then seeds a
    minimal, taxonomy-correct catalog so composition has a pool per slot.
    """
    dsn = _test_dsn()
    if not _is_local(dsn):
        pytest.skip("live DB tests run only against a local database (set GYF_TEST_DATABASE_URL)")

    # Point the app's repositories (which read settings.database_url at request time)
    # at the same DB the fixture migrates and seeds.
    settings.database_url = dsn

    try:
        import psycopg
    except ImportError:  # pragma: no cover - postgres extra not installed
        pytest.skip("psycopg not installed (run with the `postgres` extra)")

    try:
        with psycopg.connect(dsn, connect_timeout=3):
            pass
    except Exception as exc:  # noqa: BLE001 - any connect failure means "no DB, skip"
        pytest.skip(f"no reachable local Postgres at {dsn!r}: {exc}")

    # Build the schema from migrations alone — this is the regression guard for the
    # schema-source-of-truth fix (fresh DB → `alembic upgrade head`, no manual stamp).
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_DIR,
        capture_output=True,
        text=True,
        env={**os.environ, "GYF_DATABASE_URL": dsn},
    )
    assert result.returncode == 0, f"alembic upgrade head failed:\n{result.stderr}"

    _seed_catalog(dsn)
    return dsn


def _seed_catalog(dsn: str) -> None:
    """Insert a small, deterministic catalog covering top/bottom/footwear slots."""
    import json

    import psycopg

    rows = []
    for slot in ("top", "bottom", "footwear"):
        categories = _CATEGORIES_BY_SLOT[slot]
        for i in range(4):
            category = categories[i % len(categories)]
            key = f"test::{slot}::{i}"
            rows.append(
                (
                    f"Test {category} {i}",
                    category,
                    json.dumps({"color": "navy"}),
                    49.0,
                    "USD",
                    json.dumps([f"{key}.jpg"]),
                    "test-fixture",
                    "research",
                    key,  # image_hash
                    key,  # dedupe_key
                )
            )

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM items WHERE source_provider = 'test-fixture'")
            cur.executemany(
                """
                INSERT INTO items (
                    title, category, attributes, price, currency, region_tags,
                    affiliate_url, image_refs, source_provider, source_license,
                    image_hash, dedupe_key
                ) VALUES (%s, %s, %s, %s, %s, '{}', NULL, %s, %s, %s, %s, %s)
                ON CONFLICT (dedupe_key) DO NOTHING
                """,
                rows,
            )
        conn.commit()


@pytest.fixture
def reset_user_state(live_db: str):
    """Clear per-user rows before each live test so runs are independent."""
    import psycopg

    def _clear() -> None:
        with psycopg.connect(live_db) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM interactions")
                cur.execute("DELETE FROM profiles")
                cur.execute("DELETE FROM users")
            conn.commit()

    _clear()
    yield live_db
    _clear()


@pytest.fixture(autouse=True)
def _disable_rate_limit_by_default():
    """Rate limiting uses a shared in-process counter; left on, its per-route caps
    would couple unrelated tests (e.g. repeated photo uploads tripping the limit).
    Disable it for the suite by default; the dedicated rate-limit test re-enables it."""
    from app.config import settings
    from app.ratelimit import limiter

    prev = settings.rate_limit_enabled
    settings.rate_limit_enabled = False
    limiter.reset()
    yield
    settings.rate_limit_enabled = prev
    limiter.reset()
