#!/usr/bin/env python3
"""Generate PWA calendar icons (any + maskable) with Pillow."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

INDIGO_TOP = (109, 110, 245)
INDIGO_BOT = (67, 56, 202)
RED = (239, 68, 68)
WHITE = (255, 255, 255)
GRAY = (203, 213, 225)
ACCENT = (79, 70, 229)
RING = (51, 41, 168)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make(final, maskable):
    SS = 4
    S = final * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ---- background (indigo vertical gradient, clipped to rounded square) ----
    if maskable:
        bg_box = (0, 0, S - 1, S - 1)
        radius = 0
    else:
        pad = int(S * 0.06)
        bg_box = (pad, pad, S - 1 - pad, S - 1 - pad)
        radius = int(S * 0.225)

    grad = Image.new("RGB", (S, S), INDIGO_TOP)
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        gd.line((0, y, S, y), fill=lerp(INDIGO_TOP, INDIGO_BOT, y / (S - 1)))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(bg_box, radius=radius, fill=255)
    img.paste(grad, (0, 0), mask)

    # ---- calendar card (centred within the safe zone) ----
    cw = int(S * (0.54 if maskable else 0.60))
    ch = int(S * (0.52 if maskable else 0.58))
    cx, cy = S // 2, int(S * 0.55)
    left, top = cx - cw // 2, cy - ch // 2
    right, bottom = cx + cw // 2, cy + ch // 2
    crad = int(cw * 0.10)
    band_h = int(ch * 0.24)

    # soft shadow under the card
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left, top + int(S * 0.02), right, bottom + int(S * 0.02)),
        radius=crad, fill=(15, 23, 42, 70))
    shadow = shadow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(S * 0.012))
    img.alpha_composite(shadow)

    draw.rounded_rectangle((left, top, right, bottom), radius=crad, fill=WHITE)
    # red header band with rounded top corners only
    draw.rounded_rectangle((left, top, right, top + band_h + crad), radius=crad, fill=RED)
    draw.rectangle((left, top + band_h, right, top + band_h + crad + 1), fill=WHITE)

    # binder rings
    ring_w = int(cw * 0.055)
    ring_h = int(ch * 0.16)
    for rx in (left + int(cw * 0.30), right - int(cw * 0.30)):
        draw.rounded_rectangle(
            (rx - ring_w // 2, top - int(ring_h * 0.45), rx + ring_w // 2, top + int(ring_h * 0.55)),
            radius=ring_w // 2, fill=RING)

    # date grid (4 cols x 3 rows), one cell highlighted
    cols, rows = 4, 3
    gx0, gx1 = left + int(cw * 0.15), right - int(cw * 0.15)
    gy0, gy1 = top + band_h + int(ch * 0.16), bottom - int(ch * 0.13)
    dot = int(cw * 0.085)
    for r in range(rows):
        for c in range(cols):
            ux = gx0 + (gx1 - gx0) * (c / (cols - 1))
            uy = gy0 + (gy1 - gy0) * (r / (rows - 1))
            color = ACCENT if (r == 1 and c == 1) else GRAY
            draw.rounded_rectangle(
                (ux - dot, uy - dot, ux + dot, uy + dot),
                radius=int(dot * 0.45), fill=color)

    img = img.resize((final, final), Image.LANCZOS)
    name = f"icon-{'maskable-' if maskable else ''}{final}.png"
    img.save(os.path.join(OUT, name))
    return name


created = []
for size in (192, 512):
    created.append(make(size, False))
    created.append(make(size, True))
print("Generated:", ", ".join(created))
