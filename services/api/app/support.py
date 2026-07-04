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
    def __init__(self, database_url: str) -> None:
        self._url = database_url

    def create(self, user_id: str, req: SupportMessageRequest) -> str:
        import psycopg

        message_id = str(uuid.uuid4())
        with psycopg.connect(self._url) as conn:
            conn.execute(
                _CREATE,
                (message_id, user_id, req.kind, req.category, req.message, req.reply_email),
            )
        return message_id
