"""Support — contact and grievance submissions, stored where an operator can read them.

The forms on /contact and /grievance submit here. Behind a
:class:`SupportRepository` protocol like every other surface; unit-testable in
memory.
"""

from __future__ import annotations

import uuid
from typing import Literal, Protocol

from pydantic import BaseModel, Field

_CREATE = """
INSERT INTO support_messages (id, user_id, kind, category, message, reply_email)
VALUES (%s, %s, %s, %s, %s, %s)
"""


class SupportMessageRequest(BaseModel):
    kind: Literal["contact", "grievance"]
    category: str | None = Field(default=None, max_length=60)
    message: str = Field(min_length=1, max_length=4000)
    # ponytail: shape check only (user@host.tld), avoids the email-validator dep;
    # the reply address is operator-read, never machine-routed.
    reply_email: str | None = Field(
        default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )


class SupportRepository(Protocol):
    def create(self, user_id: str, req: SupportMessageRequest) -> str: ...


class PostgresSupportRepository:
    def __init__(self, dsn: str, pool: object | None = None) -> None:
        if pool is None:
            from psycopg_pool import ConnectionPool  # lazy: only when used

            pool = ConnectionPool(dsn, min_size=0, max_size=4, open=True)
        self._pool = pool

    def create(self, user_id: str, req: SupportMessageRequest) -> str:
        message_id = str(uuid.uuid4())
        with self._pool.connection() as conn:  # type: ignore[attr-defined]
            conn.execute(
                _CREATE,
                (message_id, user_id, req.kind, req.category, req.message, req.reply_email),
            )
        return message_id
