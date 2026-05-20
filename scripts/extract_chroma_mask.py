#!/usr/bin/env python3
"""Extract a mask from flat #00ff00 animation lanes in a generated town image."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageFilter


def extract(source: Path, output: Path, key: tuple[int, int, int]) -> None:
    image = Image.open(source).convert("RGB")
    mask = Image.new("L", image.size, 0)
    src = image.load()
    dst = mask.load()

    kr, kg, kb = key
    for y in range(image.height):
        for x in range(image.width):
            r, g, b = src[x, y]
            if abs(r - kr) <= 22 and abs(g - kg) <= 22 and abs(b - kb) <= 22:
                dst[x, y] = 255

    mask = mask.filter(ImageFilter.MaxFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(0.35))
    output.parent.mkdir(parents=True, exist_ok=True)
    mask.save(output)
    print(f"wrote {output}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--key", default="00ff00")
    args = parser.parse_args()
    key = args.key.removeprefix("#")
    if len(key) != 6:
      raise SystemExit("--key must be a 6-digit hex color")
    rgb = tuple(int(key[i : i + 2], 16) for i in (0, 2, 4))
    extract(args.input, args.out, rgb)


if __name__ == "__main__":
    main()
