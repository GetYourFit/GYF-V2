"""Eyeball the skin-tone pipeline on one real photo.

    python -m usermodel.skintone.inspect <image.jpg>

Prints the white-balanced skin Lab, the MST bucket, undertone, and per-field
confidence — the honest, auditable trace behind a photo onboarding result.
"""

from __future__ import annotations

import sys

from PIL import Image

from .estimate import estimate_skin_tone
from .estimator import FaceParsingSkinToneEstimator


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    image = Image.open(argv[1])
    estimator = FaceParsingSkinToneEstimator()
    readout = estimator.estimate(image)
    est = estimate_skin_tone(image, estimator)

    print(f"image:        {argv[1]}  ({image.width}x{image.height})")
    print(f"skin Lab:     L*={readout.lab[0]:.1f}  a*={readout.lab[1]:.1f}  b*={readout.lab[2]:.1f}")
    print(f"coverage:     {readout.coverage:.2f}  ({readout.skin_pixels} px)")
    print(f"face found:   {readout.face_confidence > 0}")
    print(f"skin_tone:    {est.skin_tone}   (conf {est.field_confidence.get('skin_tone', 0):.2f})")
    print(f"undertone:    {est.undertone}   (conf {est.field_confidence.get('undertone', 0):.2f})")
    print(f"model:        {est.model_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
