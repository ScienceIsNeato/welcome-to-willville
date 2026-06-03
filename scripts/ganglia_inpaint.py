#!/usr/bin/env python3
"""Mask-based image inpaint via OpenAI gpt-image-1 (images.edit).

Drop-in replacement for ganglia-studio's removed `insert-glyph` command. The
current ganglia-studio checkout only exposes text->image generation and
seamless-tile, so the per-site glyph repaint (input crop + editable mask +
prompt -> repainted crop) is done directly against the OpenAI image-edit API.

Transparent pixels in --mask mark the region to repaint; opaque pixels are
preserved. The crop is round-tripped through the nearest gpt-image-1 supported
size and the result is resized back to the original crop dimensions so it stays
aligned with the on-map sprite.

Requires OPENAI_API_KEY in the environment (loaded via the ganglia-studio
.envrc / direnv by the caller).
"""

import argparse
import base64
import io

from openai import OpenAI
from PIL import Image, ImageFilter


def target_size(width: int, height: int) -> str:
    aspect = width / height if height else 1.0
    if aspect < 0.8:
        return "1024x1536"
    if aspect > 1.25:
        return "1536x1024"
    return "1024x1024"


def png_bytes(image: Image.Image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description="gpt-image-1 mask inpaint")
    parser.add_argument("--input", required=True)
    parser.add_argument("--mask", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="gpt-image-1")
    parser.add_argument("--quality", default="high")
    parser.add_argument("--feather", type=float, default=0.0)
    args = parser.parse_args()

    src = Image.open(args.input).convert("RGBA")
    width, height = src.size

    mask = Image.open(args.mask).convert("RGBA")
    if mask.size != (width, height):
        mask = mask.resize((width, height), Image.Resampling.LANCZOS)
    if args.feather and args.feather > 0:
        alpha = mask.split()[3].filter(ImageFilter.GaussianBlur(float(args.feather)))
        mask.putalpha(alpha)

    size = target_size(width, height)
    tw, th = (int(part) for part in size.split("x"))
    src_up = src.resize((tw, th), Image.Resampling.LANCZOS)
    mask_up = mask.resize((tw, th), Image.Resampling.LANCZOS)

    quality = args.quality if args.quality in ("low", "medium", "high", "auto") else "high"

    client = OpenAI()
    edit_kwargs = dict(
        model=args.model,
        image=("input.png", png_bytes(src_up), "image/png"),
        mask=("mask.png", png_bytes(mask_up), "image/png"),
        prompt=args.description,
        size=size,
        n=1,
    )
    try:
        response = client.images.edit(quality=quality, **edit_kwargs)
    except TypeError:
        # Older/newer SDKs may not accept `quality` on edits.
        response = client.images.edit(**edit_kwargs)

    datum = response.data[0]
    b64 = getattr(datum, "b64_json", None)
    if not b64:
        raise RuntimeError("gpt-image-1 returned no base64 image data")
    data = base64.b64decode(b64)

    result = Image.open(io.BytesIO(data)).convert("RGBA").resize(
        (width, height), Image.Resampling.LANCZOS
    )

    # gpt-image-1 regenerates the entire frame (it does not pixel-preserve the
    # kept region the way a classic inpainter does). Clip the result back to the
    # editable region with the mask: take painted pixels only where the mask is
    # transparent (editable), keep the original crop everywhere else. Without
    # this the downstream diff sees the whole crop as changed and the overlay
    # renders as a big unclipped rectangle.
    edit_region = mask.split()[3].point(lambda a: 255 - a)  # 255 where editable
    composited = src.copy()
    composited.paste(result, (0, 0), edit_region)
    composited.save(args.output, format="PNG")
    print(f"inpainted -> {args.output} ({width}x{height} via {size}, q={quality})")


if __name__ == "__main__":
    main()
