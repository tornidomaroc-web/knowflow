#!/usr/bin/env python3
"""Every app icon in the repo, derived from the one approved master.

    python scripts/brand/gen-app-icons.py          # write every asset
    python scripts/brand/gen-app-icons.py --check  # exit 1 if any asset differs

THE MASTER is assets/brand/AppIcon-1024.png, the owner's approved icon
(1024x1024, RGB, no alpha): a clay gold ring around a cream folded page on a
warm dark ground. It is the ONLY hand-made file. Everything below is written
by this script, so a new icon is a new master plus one run; nothing is edited
by hand. Pillow is the single dependency (pip install pillow).

WHAT IS WRITTEN, AND THE GEOMETRY BEHIND IT. The ring's outer edge sits at
72% of the master's width (measured on the luminance profile, radius 370 of
512). That number decides every derived shape:

  iOS AppIcon (1024, opaque)      the master byte for byte; iOS rounds the
                                  corners itself, the ring sits well inside.
  Android legacy ic_launcher      the master resized (48 to 192 px); the round
                                  variant under an anti-aliased circle.
  Android adaptive foreground     the master at 80% of the 108 dp layer, so the
                                  ring (58% of the layer) stays inside the
                                  66 dp safe zone (61%) under every launcher
                                  mask; its edge fades to transparent between
                                  80% and 97% of the scaled master's radius,
                                  so no square seam shows on the background.
  Android adaptive background     a flat colour: the median of the master's
                                  own ground in the ring where the fade ends,
                                  written to values/ic_launcher_background.xml.
  Splash (iOS 2732 square; Android the eleven drawable sizes)
                                  the app's dark ground (--background of the
                                  dark theme, #14110d) with the faded mark
                                  centred. The iOS storyboard fills the screen
                                  with scaleAspectFill, so on a 19.5:9 phone
                                  only the central 46% of the square's width
                                  is visible: the mark is kept inside that.
  Web favicon.ico (16, 32, 48), icon.png (192), apple-icon.png (180)
                                  the master resized with Lanczos; the .ico
                                  carries its own 16 and 32 so browsers never
                                  downsample a 192 themselves.
  src/app/_brand/app-icon-mark.png (512, RGBA)
                                  the faded mark the Open Graph card embeds.

The derived PNGs are deterministic for a given Pillow version; --check is what
a reviewer runs to prove no asset was edited by hand.
"""
import argparse
import hashlib
import io
import math
import os
import statistics
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MASTER = os.path.join(ROOT, 'assets', 'brand', 'AppIcon-1024.png')
GROUND = (0x14, 0x11, 0x0d)      # --background, dark theme (src/app/globals.css); BRAND.ground
RING_EDGE = 0.72                 # the ring's outer edge, as a fraction of the master's width
FADE_FROM, FADE_TO = 0.80, 0.97  # the faded mark: opaque inside, transparent beyond (fractions of the half width)
ADAPTIVE_SCALE = 0.80            # the master inside the 108 dp adaptive layer: ring at 0.72*0.80 = 58% < 61% safe zone
IOS = os.path.join(ROOT, 'ios', 'App', 'App', 'Assets.xcassets')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
WEB = os.path.join(ROOT, 'src', 'app')

ANDROID_DPI = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
ANDROID_SPLASH = {  # Capacitor's drawable set, (width, height)
    'drawable': (480, 320),
    'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480), 'drawable-land-xhdpi': (1280, 720),
    'drawable-land-xxhdpi': (1600, 960), 'drawable-land-xxxhdpi': (1920, 1280),
    'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800), 'drawable-port-xhdpi': (720, 1280),
    'drawable-port-xxhdpi': (960, 1600), 'drawable-port-xxxhdpi': (1280, 1920),
}
IOS_SPLASH = ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']  # 3x, 2x, 1x in Contents.json


def load_master():
    im = Image.open(MASTER)
    if im.size != (1024, 1024) or im.mode != 'RGB':
        sys.exit(f'FAIL: the master must be 1024x1024 RGB, found {im.size} {im.mode}')
    return im


def ground_colour(master):
    """The master's own ground where the fade ends: the median colour in the ring 0.85 to 0.97 of the half width."""
    px, c = master.load(), 512
    samples = [px[x, y] for x in range(0, 1024, 4) for y in range(0, 1024, 4) if 0.85 * c <= math.hypot(x - c, y - c) <= 0.97 * c]
    return tuple(int(statistics.median(s[i] for s in samples)) for i in range(3))


def radial_alpha(size, inner, outer):
    """An L mask: 255 inside `inner`, 0 beyond `outer`, linear between (fractions of the half width)."""
    c = size / 2
    data = []
    for y in range(size):
        for x in range(size):
            r = math.hypot(x + 0.5 - c, y + 0.5 - c) / c
            data.append(255 if r <= inner else 0 if r >= outer else int(round(255 * (outer - r) / (outer - inner))))
    m = Image.new('L', (size, size))
    m.putdata(data)
    return m


def faded_mark(master, size, fade=None):
    """The master at `size`, RGBA, its edge faded to transparent so it sits on any dark ground."""
    fade = fade or radial_alpha(1024, FADE_FROM, FADE_TO)
    out = master.convert('RGBA')
    out.putalpha(fade)
    return out.resize((size, size), Image.LANCZOS)


def round_icon(master, size):
    big = size * 4
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
    out = master.resize((big, big), Image.LANCZOS).convert('RGBA')
    out.putalpha(mask)
    return out.resize((size, size), Image.LANCZOS)


def on_ground(mark, width, height, mark_px):
    canvas = Image.new('RGB', (width, height), GROUND)
    m = mark.resize((mark_px, mark_px), Image.LANCZOS)
    canvas.paste(m, ((width - mark_px) // 2, (height - mark_px) // 2), m)
    return canvas


def png_bytes(im, **kw):
    buf = io.BytesIO()
    im.save(buf, format='PNG', optimize=True, **kw)
    return buf.getvalue()


def ico_bytes(master):
    sizes = [(48, 48), (32, 32), (16, 16)]
    imgs = [master.resize(s, Image.LANCZOS) for s in sizes]
    buf = io.BytesIO()
    imgs[0].save(buf, format='ICO', sizes=sizes, append_images=imgs[1:])
    return buf.getvalue()


def build():
    """Every output as {path: bytes}."""
    master = load_master()
    fade = radial_alpha(1024, FADE_FROM, FADE_TO)
    mark1024 = faded_mark(master, 1024, fade)
    bg = ground_colour(master)
    out = {}
    # iOS
    out[os.path.join(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png')] = open(MASTER, 'rb').read()
    splash = png_bytes(on_ground(mark1024, 2732, 2732, 1024))
    for name in IOS_SPLASH:
        out[os.path.join(IOS, 'Splash.imageset', name)] = splash
    # Android launcher icons
    for dpi, k in ANDROID_DPI.items():
        d = os.path.join(RES, f'mipmap-{dpi}')
        n = int(48 * k)
        out[os.path.join(d, 'ic_launcher.png')] = png_bytes(master.resize((n, n), Image.LANCZOS))
        out[os.path.join(d, 'ic_launcher_round.png')] = png_bytes(round_icon(master, n))
        layer = int(108 * k)
        inner = int(round(layer * ADAPTIVE_SCALE))
        fg = Image.new('RGBA', (layer, layer), (0, 0, 0, 0))
        m = mark1024.resize((inner, inner), Image.LANCZOS)
        fg.paste(m, ((layer - inner) // 2, (layer - inner) // 2), m)
        out[os.path.join(d, 'ic_launcher_foreground.png')] = png_bytes(fg)
    out[os.path.join(RES, 'values', 'ic_launcher_background.xml')] = (
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <!-- Written by scripts/brand/gen-app-icons.py: the ground of assets/brand/AppIcon-1024.png where the foreground fades out. -->\n'
        f'    <color name="ic_launcher_background">#{bg[0]:02X}{bg[1]:02X}{bg[2]:02X}</color>\n</resources>\n').encode()
    # Android splash drawables
    for folder, (w, h) in ANDROID_SPLASH.items():
        out[os.path.join(RES, folder, 'splash.png')] = png_bytes(on_ground(mark1024, w, h, int(min(w, h) * 0.5)))
    # Web
    out[os.path.join(WEB, 'favicon.ico')] = ico_bytes(master)
    out[os.path.join(WEB, 'icon.png')] = png_bytes(master.resize((192, 192), Image.LANCZOS))
    out[os.path.join(WEB, 'apple-icon.png')] = png_bytes(master.resize((180, 180), Image.LANCZOS))
    out[os.path.join(WEB, '_brand', 'app-icon-mark.png')] = png_bytes(faded_mark(master, 512, fade))
    return out, bg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true', help='compare instead of writing; exit 1 on any difference')
    a = ap.parse_args()
    out, bg = build()
    print(f"master sha256 {hashlib.sha256(open(MASTER, 'rb').read()).hexdigest()}; adaptive background #{bg[0]:02x}{bg[1]:02x}{bg[2]:02x}")
    bad = 0
    for path in sorted(out):
        rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
        data = out[path]
        cur = open(path, 'rb').read() if os.path.exists(path) else None
        if a.check:
            same = cur == data
            bad += 0 if same else 1
            print(('ok   ' if same else 'DIFF ') + rel)
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(data)
            print(('same ' if cur == data else 'wrote') + f' {rel} ({len(data)} bytes)')
    if a.check and bad:
        sys.exit(f'FAIL: {bad} asset(s) differ from the master; run the script and commit')


if __name__ == '__main__':
    main()
