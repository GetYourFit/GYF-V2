"""Avatar object lifecycle: which URLs are legitimate, and how the bytes are erased.

The client uploads straight to Supabase Storage with its own user token, so the RLS
policies in migration ``0023`` are what stop one user writing another's bytes. Two things
those policies structurally cannot do, which is why this module exists:

1. **RLS protects the bytes; nothing protects the pointer.** ``PUT /profile`` accepts
   ``avatar_url`` as a free-form string, so without :func:`is_owned_avatar_url` a user
   could point their avatar at any URL on the internet — no upload, RLS never consulted —
   and every viewer of that profile would fetch attacker-chosen content. It would also
   silently break slot rotation, since a foreign URL owns neither slot.
2. **RLS is scoped to ``auth.uid()``.** Once an account is erased there is no token that
   can delete its objects, and the bucket is public, so the bytes would stay readable by
   anyone forever. Erasure therefore has to use the service-role key.

When that key is absent GYF cannot prove it can erase an avatar, so it must not ask for
one: :func:`avatar_uploads_available` reports false and the capability fails closed. This
is the F8 rule applied to a second surface — a status blip must never be the reason GYF
solicits a photo of someone's face.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from ..config import settings

log = logging.getLogger(__name__)

AVATAR_BUCKET = "avatars"
AVATAR_SLOTS = ("a", "b")
_DELETE_TIMEOUT_S = 10.0


def avatar_public_prefix(user_id: str) -> str:
    """The one URL prefix this user's avatars can legitimately have.

    Mirrors supabase-js ``getPublicUrl``: ``{supabase}/storage/v1/object/public/{bucket}/{key}``.
    """
    return f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/{AVATAR_BUCKET}/{user_id}/avatar-"


def is_owned_avatar_url(url: str, user_id: str) -> bool:
    """True only for this user's own two slot URLs, ignoring the cache-busting query.

    Fails closed when ``supabase_url`` is unconfigured: with no known origin there is no
    URL that can be proven to be an uploaded avatar, and guessing is how the check dies.
    """
    if not settings.supabase_url:
        return False
    prefix = avatar_public_prefix(user_id)
    if not url.startswith(prefix):
        return False
    return url[len(prefix) :].split("?", 1)[0] in AVATAR_SLOTS


def avatar_uploads_available() -> bool:
    """Whether GYF can accept an avatar *and* erase it later. Both, or neither."""
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def delete_avatar_objects(user_id: str) -> bool:
    """Erase both avatar slots for ``user_id``. True only when erasure is proven.

    Returns False rather than raising so a purge run can keep the tombstone and retry on
    the next pass — a user whose bytes could not be erased must not lose the row that
    records they asked. Deleting a slot that was never uploaded is a no-op, so this is
    idempotent and safe to re-run.
    """
    if not avatar_uploads_available():
        log.error(
            "avatar erasure unavailable for %s: GYF_SUPABASE_SERVICE_ROLE_KEY is unset, "
            "so the account's avatar bytes stay readable. Purge deferred.",
            user_id,
        )
        return False

    endpoint = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{AVATAR_BUCKET}"
    body = json.dumps({"prefixes": [f"{user_id}/avatar-{slot}" for slot in AVATAR_SLOTS]})
    request = urllib.request.Request(  # noqa: S310 — scheme is our own configured https origin
        endpoint,
        data=body.encode(),
        method="DELETE",
        headers={
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=_DELETE_TIMEOUT_S) as response:  # noqa: S310
            response.read()
        return True
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        # Never log the key or the response body; the user id is enough to retry.
        log.error("avatar erasure failed for %s (%s); purge deferred", user_id, type(exc).__name__)
        return False
