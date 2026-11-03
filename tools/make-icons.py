#!/usr/bin/env python3
"""Regenerate the StudyDesk app icons (icons/*.png).

Design: rising book spines on ruled note paper, in the app's own colours
(note paper #fdfcf7, note-line blue #7faed0, ink #18181b, accent red #b91c1c).
Books grow left to right (books you manage, progress you can see); the tallest
one is the red accent.

At tab sizes (<= 64 px) the ruled lines are left out: they only add noise there.

Usage (from the repository root, needs Pillow):
    python3 tools/make-icons.py
"""
import pathlib
from PIL import Image, ImageDraw

S = 4                       # draw at 4x and downscale for clean anti-aliasing
W = 512 * S

PAPER = (253, 252, 247)     # #fdfcf7  note paper
RULE = (207, 224, 236)      # #cfe0ec  faint note-line blue
BLUE = (127, 174, 208)      # #7faed0  note-line blue
SLATE = (62, 90, 114)       # #3e5a72  deep blue
INK = (24, 24, 27)          # #18181b  app ink
RED = (185, 28, 28)         # #b91c1c  app accent red

SPINES = [INK, SLATE, BLUE, RED]               # left -> right
XS = (112, 182, 252, 322)                      # spine x positions (512 grid)
TOPS = (300, 248, 192, 128)                    # spine tops: rising
OUT = pathlib.Path(__file__).resolve().parent.parent / 'icons'


def u(v):
    return int(round(v * S))


def rrect(d, box, r, fill):
    d.rounded_rectangle([u(box[0]), u(box[1]), u(box[2]), u(box[3])], radius=u(r), fill=fill)


def bar(d, a, b, w, fill):
    """Straight line with round caps (horizontal only)."""
    (x1, y), (x2, _) = a, b
    rrect(d, (x1 - w / 2, y - w / 2, x2 + w / 2, y + w / 2), w / 2, fill)


def artwork(d, small):
    if not small:
        for y in range(92, 404, 52):
            bar(d, (72, y), (440, y), 6, RULE)
    for x, top, colour in zip(XS, TOPS, SPINES):
        rrect(d, (x, top, x + 60, 404), 12, colour)
        bar(d, (x + 18, top + 32), (x + 42, top + 32), 10, PAPER)   # spine label
    bar(d, (96, 424), (416, 424), 16, BLUE)                          # shelf


def render(size, full_bleed):
    """full_bleed=False: the icon's own rounded tile ('any' purpose).
    full_bleed=True: square background, artwork kept inside the 80 % safe zone
    (maskable / apple-touch, where the platform applies its own mask)."""
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rrect(d, (0, 0, 512, 512), 0 if full_bleed else 112, PAPER)
    if full_bleed:
        layer = Image.new('RGBA', (W, W), (0, 0, 0, 0))
        artwork(ImageDraw.Draw(layer), size <= 64)
        k = 0.84
        small = layer.resize((int(W * k), int(W * k)), Image.LANCZOS)
        off = (W - small.width) // 2
        img.alpha_composite(small, (off, off))
    else:
        artwork(d, size <= 64)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    render(512, False).save(OUT / 'icon-512.png', optimize=True)
    render(192, False).save(OUT / 'icon-192.png', optimize=True)
    render(32, False).save(OUT / 'favicon-32.png', optimize=True)
    render(512, True).convert('RGB').save(OUT / 'icon-maskable-512.png', optimize=True)
    render(180, True).convert('RGB').save(OUT / 'apple-touch-icon.png', optimize=True)
    print('icons written to', OUT)


if __name__ == '__main__':
    main()
