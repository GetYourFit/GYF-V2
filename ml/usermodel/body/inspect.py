"""Eyeball the body-type pipeline on one real photo.

    python -m usermodel.body.inspect <image.jpg>

Prints the derived shape ratio, silhouette class, and per-field
confidence — the honest, auditable trace behind a photo onboarding result. Needs
the ``bodyshape`` extra (RTMW + ONNX Runtime) installed for the real model to run.
"""

from __future__ import annotations

import sys

from PIL import Image

from .estimate import estimate_body
from .estimator import RTMWBodyEstimator


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    image = Image.open(argv[1])
    estimator = RTMWBodyEstimator()
    shape = estimator.estimate(image)
    est = estimate_body(image, estimator)

    print(f"image:        {argv[1]}  ({image.width}x{image.height})")
    if shape.shape_ratios:
        print(f"ratios:       {shape.shape_ratios}")
    print(f"body_type:    {est.body_type}   (conf {est.field_confidence.get('body_type', 0):.2f})")
    print(f"model:        {est.model_version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
