"""Proof that Row-Level Security isolates users (W6 / H-4, migration 0006).

Runs against a live Postgres with all migrations applied (CI's real-PG lane;
locally a pgvector container). It creates two users, then — as a NON-OWNER role
with ``app.current_user_id`` set to user A — proves A cannot see B's rows. RLS
only constrains non-owner roles, so the test deliberately ``SET ROLE``s away from
the migration owner to exercise the policy the way Supabase's anon/authenticated
roles hit it.
"""

from __future__ import annotations

import os
import uuid

import pytest

psycopg = pytest.importorskip("psycopg")

DSN = os.environ.get("GYF_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DSN, reason="set GYF_TEST_DATABASE_URL to a Postgres with migrations applied"
)


def test_rls_hides_other_users_rows():
    user_a = str(uuid.uuid4())
    user_b = str(uuid.uuid4())
    role = f"rls_probe_{uuid.uuid4().hex[:8]}"

    with psycopg.connect(DSN, autocommit=True) as conn:
        # Seed two users + a profile each as the owner (bypasses RLS).
        conn.execute("INSERT INTO users (id) VALUES (%s), (%s)", (user_a, user_b))
        conn.execute(
            "INSERT INTO profiles (user_id) VALUES (%s), (%s)", (user_a, user_b)
        )
        # A non-superuser, non-owner role: RLS applies to it.
        conn.execute(f"CREATE ROLE {role} NOLOGIN")
        conn.execute(f"GRANT SELECT ON profiles, users TO {role}")
        try:
            with conn.transaction():
                conn.execute(f"SET LOCAL ROLE {role}")
                # SET cannot be parameterized; set_config(..., is_local=true) == SET LOCAL.
                conn.execute(
                    "SELECT set_config('app.current_user_id', %s, true)", (user_a,)
                )

                visible = conn.execute("SELECT user_id FROM profiles").fetchall()
                assert visible == [(uuid.UUID(user_a),)], "A must see only its own row"

                b_rows = conn.execute(
                    "SELECT 1 FROM profiles WHERE user_id = %s", (user_b,)
                ).fetchall()
                assert b_rows == [], "A must NOT see B's row (cross-user query empty)"
        finally:
            # Cleanup: role-reset happens at transaction end; drop seeded rows + role.
            conn.execute("DELETE FROM users WHERE id IN (%s, %s)", (user_a, user_b))
            conn.execute(f"REVOKE SELECT ON profiles, users FROM {role}")
            conn.execute(f"DROP ROLE IF EXISTS {role}")
