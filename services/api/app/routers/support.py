"""Support surface — the contact and grievance forms land here."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import Principal
from ..dependencies import get_support_repo, require_active_principal
from ..ratelimit import rate_limit
from ..support import SupportMessageRequest, SupportRepository

router = APIRouter(tags=["support"])


@router.post(
    "/support/messages",
    status_code=201,
    summary="Submit a contact or grievance message",
    dependencies=[Depends(rate_limit("support", "rate_limit_support"))],
)
def create_support_message(
    body: SupportMessageRequest,
    principal: Principal = Depends(require_active_principal),
    repo: SupportRepository = Depends(get_support_repo),
) -> dict[str, str]:
    """Persist the message attributed to the authenticated user.

    The success state the client shows is only earned by this 201 — the forms
    never fake a sent state (CLAUDE.md §7.1 #12).
    """
    return {"id": repo.create(principal.user_id, body), "status": "received"}
