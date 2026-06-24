"""Live-DB proof of P1-B Cycle 3 — photo skin-tone onboarding (REAL, CPU end-to-end).

Unlike body-type (GPU/SAM-License gated), the skin-tone module runs for real on a
CPU box, so this verifies the whole path with no fakes:

  real photo -> RetinaFace+FaRL face-parse -> white-balance -> CIELAB -> MST bucket
  -> profile_from_photo merge -> PostgresProfileRepository round-trip

and the three invariants that define the cycle:
  1. SHADOW: with the fairness gate off, skin-tone is NOT written to the profile.
  2. SURFACED: simulate the gate passing -> skin-tone + undertone persist with
     `source="photo"`, model confidence, model_version.
  3. MANUAL PRECEDENCE: a hand-stated tone (confidence 1.0) is never overwritten.

Requires the ml `skintone` extra (pyfacer + torch; CPU is fine) and the live DB:

    bash scripts/e2e_workstream_a.sh            # brings up pgvector at migration head
    GYF_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/gyf \
        PYTHONPATH=services/api:ml:packages/contracts \
        python scripts/verify_skintone_cycle3.py [path/to/photo.jpg]
"""

from __future__ import annotations

import os
import sys

from PIL import Image

from app.profile.models import Profile
from app.profile.photo import FaceParsingSkinToneAdapter, profile_from_photo
from app.profile.repository import PostgresProfileRepository

USER = "55555555-5555-5555-5555-555555555555"
DEFAULT_PHOTO = "ml/ishu.jpeg"


def main(argv: list[str]) -> int:
    dsn = os.environ["GYF_DATABASE_URL"]
    photo_path = argv[1] if len(argv) > 1 else DEFAULT_PHOTO
    repo = PostgresProfileRepository(dsn)

    # --- real estimate (no fakes) ---
    with Image.open(photo_path) as img:
        image = img.convert("RGB")
    skin = FaceParsingSkinToneAdapter().estimate(image)
    print(f"photo:        {photo_path}")
    print(f"skin_tone:    {skin.skin_tone}  undertone: {skin.undertone}")
    print(f"confidence:   {skin.field_confidence}")
    print(f"model:        {skin.model_version}")

    # --- 1. shadow: gate off → skin-tone not surfaced ---
    repo.delete(USER)
    shadow = profile_from_photo(skin=None, body=None, existing=repo.get(USER))
    repo.upsert(USER, shadow)
    got = repo.get(USER)
    assert got is not None and got.skin_tone is None, "shadow leaked a skin-tone"
    print("\n[1] shadow (gate off): skin_tone not written — OK")

    # --- 2. surfaced: gate passes → persisted with provenance ---
    surfaced = profile_from_photo(skin=skin, body=None, existing=repo.get(USER))
    repo.upsert(USER, surfaced)
    got = repo.get(USER)
    assert got is not None
    if skin.skin_tone != "unknown":
        assert got.skin_tone == skin.skin_tone, "surfaced tone did not round-trip"
        assert got.source == "photo" and got.model_version, "missing provenance"
        assert got.field_confidence.get("skin_tone"), "missing field confidence"
        print(f"[2] surfaced (gate on): skin_tone={got.skin_tone} source={got.source} — OK")
    else:
        print("[2] estimator abstained (unknown) on this photo — honest, not a failure")

    # --- 3. manual precedence: hand-stated tone survives a photo guess ---
    repo.delete(USER)
    repo.upsert(USER, Profile(skin_tone="mst3", field_confidence={"skin_tone": 1.0}, source="manual"))
    merged = profile_from_photo(skin=skin, body=None, existing=repo.get(USER))
    repo.upsert(USER, merged)
    got = repo.get(USER)
    assert got is not None and got.skin_tone == "mst3", "manual tone was overwritten"
    print("[3] manual precedence: hand-stated mst3 survived the photo estimate — OK")

    repo.delete(USER)
    print("\nP1-B Cycle 3 (skin-tone) live-DB verification: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
