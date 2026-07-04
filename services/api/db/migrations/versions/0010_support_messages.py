"""Support messages — real storage behind the contact and grievance forms.

Both forms previously showed a success state without transmitting anything (a
mockup masquerading as a feature — CLAUDE.md §7.1 #12). Every submission now
lands in one table an operator can read. ``user_id`` is the authenticated
principal; ``reply_email`` is the address the user typed (may differ from their
account email). Length CHECKs mirror the API caps so a bypassed client can't
store unbounded text.

Revision ID: 0010_support_messages
Revises: 0009_user_display_name
Create Date: 2026-07-04
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0010_support_messages"
down_revision: str | None = "0009_user_display_name"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE support_messages (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK (kind IN ('contact', 'grievance')),
            category TEXT CHECK (category IS NULL OR char_length(category) <= 60),
            message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
            reply_email TEXT CHECK (reply_email IS NULL OR char_length(reply_email) <= 254),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX ix_support_messages_created_at ON support_messages (created_at)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS support_messages")
