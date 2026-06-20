"""Authentication scaffold — verifies Supabase-issued JWTs.

Supabase Auth mints HS256 access tokens signed with the project JWT secret.
A request presents it as ``Authorization: Bearer <token>``; we verify the
signature + audience and expose the principal (user id, email) to handlers.

In local dev (``settings.auth_is_open``) a missing/invalid token resolves to a
deterministic dev principal so the service runs with no auth provider wired.
This bypass is gated to the ``local`` env and never applies once a JWT secret
is configured in staging/production.
"""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from .config import settings

# auto_error=False: we decide how to handle a missing token (dev bypass vs 401).
_bearer = HTTPBearer(auto_error=False)


class Principal(BaseModel):
    """The authenticated caller derived from a verified token."""

    user_id: str
    email: str | None = None


def _decode(token: str) -> Principal:
    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    subject = claims.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject (sub) claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Principal(user_id=subject, email=claims.get("email"))


def get_current_principal(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    """FastAPI dependency: the verified caller, or a dev principal in local mode.

    When auth is open (local dev with no JWT secret wired) we resolve to the dev
    principal regardless of whether a token is presented. A stale Supabase token
    left in the client must not be verified against an empty secret — doing so
    raises and would surface as a 500.
    """
    if settings.auth_is_open:
        return Principal(user_id=settings.dev_user_id, email="dev@local")
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode(creds.credentials)
