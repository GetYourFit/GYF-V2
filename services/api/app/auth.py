"""Authentication scaffold — verifies Supabase-issued JWTs.

Supabase Auth mints access tokens a request presents as ``Authorization: Bearer
<token>``; we verify the signature + audience and expose the principal (user id,
email) to handlers. Modern projects sign asymmetrically (**ES256**): we verify
against the project's public JWKS (``settings.jwks_url``), which needs no shared
secret and supports key rotation. Older projects sign **HS256** with a shared
secret (``settings.supabase_jwt_secret``); we honour that as a fallback, picking
the path from the token's own ``alg`` header.

In local dev (``settings.auth_is_open``) a missing/invalid token resolves to a
deterministic dev principal so the service runs with no auth provider wired.
This bypass is gated to the ``local`` env and never applies once a JWKS source
or JWT secret is configured.
"""

from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel

from .config import settings

# auto_error=False: we decide how to handle a missing token (dev bypass vs 401).
_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    """Cached JWKS client — fetches and caches the project's public signing keys."""
    return PyJWKClient(settings.jwks_url)


class Principal(BaseModel):
    """The authenticated caller derived from a verified token."""

    user_id: str
    email: str | None = None


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _decode(token: str) -> Principal:
    # Pick the verification path from the token's own algorithm header: ES256 is
    # verified against the project's public JWKS; HS256 against the shared secret.
    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise _unauthorized(f"Malformed token: {exc}") from exc

    alg = header.get("alg")
    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise _unauthorized("HS256 token presented but no JWT secret configured")
            key: object = settings.supabase_jwt_secret
        else:
            if not settings.supabase_url:
                raise _unauthorized(f"{alg} token presented but no JWKS source configured")
            key = _jwks_client().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["ES256", "HS256"],
            audience=settings.jwt_audience,
        )
    except jwt.PyJWKClientError as exc:
        raise _unauthorized(f"Unable to resolve signing key: {exc}") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized(f"Invalid token: {exc}") from exc

    subject = claims.get("sub")
    if not subject:
        raise _unauthorized("Token missing subject (sub) claim")
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
