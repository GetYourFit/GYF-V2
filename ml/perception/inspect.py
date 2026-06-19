"""Manual perception check — run the real model on your own image.

    python -m perception.inspect path/to/garment.jpg [--json]

Loads the configured Marqo-FashionSigLIP encoder (weights download on first run)
and prints the attributes, color, and embedding summary the pipeline would store.
Requires the perception extra: ``pip install -e ".[perception]"``.
"""

from __future__ import annotations

import argparse
import json
import sys

from PIL import Image

from common.config import settings

from .model import default_encoder
from .perceive import Perceptor


def inspect(image_path: str) -> dict[str, object]:
    """Perceive one image and return the model-tagged attribute/color block."""
    perceptor = Perceptor(default_encoder())
    with Image.open(image_path) as image:
        result = perceptor.perceive(image.convert("RGB"))
    block = result.attributes_block(settings.perception_model_version)["perception"]
    return {"embedding_dim": len(result.embedding), **block}  # type: ignore[dict-item]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Perceive a garment image (real model).")
    parser.add_argument("image", help="Path to a garment image (jpg/png).")
    parser.add_argument("--json", action="store_true", help="Emit raw JSON only.")
    args = parser.parse_args(argv)

    block = inspect(args.image)
    if args.json:
        print(json.dumps(block, indent=2))
        return 0

    attrs = block["attributes"]  # type: ignore[index]
    color = block["color"]  # type: ignore[index]
    print(f"model:      {block['model_version']}")
    print(f"embedding:  {block['embedding_dim']}-d (L2-normalized)")
    print("attributes:")
    for name, pred in attrs.items():  # type: ignore[union-attr]
        print(f"  {name:10} {pred['value']:14} (confidence {pred['confidence']:.2f})")
    print(f"color:      {color['hue_name']}  LCh={[round(x, 1) for x in color['lch']]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
