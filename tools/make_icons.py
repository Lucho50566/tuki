"""Genera los iconos de Tuki (192, 512 y maskable)."""
from PIL import Image, ImageDraw, ImageFont
import os, math

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
BG1 = (26, 16, 32)
BG2 = (14, 9, 18)
GOLD = (233, 184, 114)
CREAM = (247, 240, 227)


def font(size):
    for path in (r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\times.ttf",
                 r"C:\Windows\Fonts\DejaVuSerif.ttf"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def make(size, maskable=False):
    img = Image.new("RGB", (size, size), BG1)
    d = ImageDraw.Draw(img)

    # degradé vertical
    for y in range(size):
        t = y / max(1, size - 1)
        c = tuple(int(BG1[i] * (1 - t) + BG2[i] * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)

    # glow central
    cx, cy = size * 0.5, size * 0.46
    for r in range(int(size * 0.62), 0, -1):
        a = 1 - r / (size * 0.62)
        col = tuple(int(BG1[i] + (78 - BG1[i]) * a * 0.55) for i in range(3))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)

    # marco
    pad = size * (0.14 if maskable else 0.075)
    lw = max(2, int(size * 0.008))
    d.rounded_rectangle([pad, pad, size - pad, size - pad], radius=size * 0.17,
                        outline=GOLD + (255,), width=lw)

    # letra
    f = font(int(size * 0.56))
    letter = "t"
    bbox = d.textbbox((0, 0), letter, font=f)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((cx - w / 2 - bbox[0], cy - h / 2 - bbox[1] - size * 0.015), letter,
           font=f, fill=CREAM)

    # punto dorado (el "comodín")
    r = size * 0.022
    d.ellipse([cx - r, size - pad * 1.75 - r, cx + r, size - pad * 1.75 + r], fill=GOLD)
    return img


if __name__ == "__main__":
    make(192).save(os.path.join(OUT, "icon-192.png"))
    make(512).save(os.path.join(OUT, "icon-512.png"))
    make(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
    print("iconos listos")
