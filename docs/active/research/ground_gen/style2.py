# Visual style V2: the owner liked B (quieter), C (darker) and E (olive); wants bright and clean, with a variety of
# colours across biomes; and the game's own hard shadow under resting Tokens, a further one for lifted ones.
# Works on real in-game captures (capture_biomes.mjs): the ground canvas alone and the whole mat, both at one pixel
# per art pixel; the Tokens are wherever the two differ.
import os, sys, colorsys
from PIL import Image, ImageEnhance, ImageFilter, ImageChops
HERE = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(HERE, 'capture')
OUT = os.path.join(HERE, 'style2')
os.makedirs(OUT, exist_ok=True)
BIOMES = ['meadow', 'flower_meadow', 'forest', 'cherry_grove', 'yellowstone', 'mountain', 'coast', 'volcano']
# per biome: colour strength, texture kept, hue nudge (fraction of the wheel), brightness in "clean", brightness in "mood"
P = {
    'meadow':        (0.72, 0.60, -0.022, 1.04, 1.04),
    'flower_meadow': (0.70, 0.60, -0.010, 1.06, 1.06),
    'forest':        (0.80, 0.70, +0.030, 1.00, 0.84),
    'cherry_grove':  (0.78, 0.60, 0.000, 1.04, 1.04),
    'yellowstone':   (0.80, 0.70, +0.020, 1.00, 0.86),
    'mountain':      (0.75, 0.60, +0.010, 1.04, 1.02),
    'coast':         (0.85, 0.65, 0.000, 1.03, 1.03),
    'volcano':       (0.85, 0.75, 0.000, 1.00, 0.88),
}


def tokens_mask(ground, full):
    """Where Tokens are: pixels the mat changed from the ground, in blobs big enough to be a Token (the ground's
    little flower props, drawn on their own layer, are dropped)."""
    diff = ImageChops.difference(ground.convert('RGB'), full.convert('RGB')).convert('L').point(lambda v: 255 if v > 6 else 0)
    big = diff.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(15))
    return ImageChops.multiply(diff, big)


def treat(ground, sat, tex, dh, bright):
    g = ground.convert('RGB')
    g = Image.blend(g, g.filter(ImageFilter.GaussianBlur(5)), 1 - tex)
    if dh:
        h, s, v = g.convert('HSV').split()
        g = Image.merge('HSV', (h.point(lambda p: (p + int(round(dh * 255))) % 256), s, v)).convert('RGB')
    g = ImageEnhance.Color(g).enhance(sat)
    return ImageEnhance.Brightness(g).enhance(bright)


def shadowed(base, full, mask, dx=2, dy=2, alpha=255):
    """The game's hard shadow: the Tokens' silhouette, black, dx/dy art pixels down-right, under the Tokens."""
    out = base.copy()
    sh = Image.new('L', mask.size, 0); sh.paste(mask, (dx, dy))
    sh = ImageChops.subtract(sh, mask).point(lambda v: alpha if v else 0)
    out.paste((0, 0, 0), (0, 0), sh)
    out.paste(full.convert('RGB'), (0, 0), mask)
    return out


for b in BIOMES:
    ground = Image.open(os.path.join(CAP, f'{b}_ground.png')).convert('RGB')
    full = Image.open(os.path.join(CAP, f'{b}_full.png')).convert('RGB')
    mask = tokens_mask(ground, full)
    sat, tex, dh, bc, bm = P[b]
    variants = {
        'today': full,
        'clean': shadowed(treat(ground, sat, tex, dh, bc), full, mask),
        'bright': shadowed(treat(ground, min(1.0, sat + 0.16), tex * 0.7, dh * 0.4, bc + 0.06), full, mask),
        'mood': shadowed(treat(ground, sat, tex, dh, bm), full, mask),
    }
    for k, im in variants.items():
        im.save(os.path.join(OUT, f'{b}_{k}.webp'), lossless=True, method=4)
    print(b)

# the lifted Token: one oak on the clean meadow, resting (2 art px shadow) and lifted (raised 4, shadow 6 art px, softer)
oak = Image.open([os.path.join(r, f) for r, _, fs in os.walk('public/assets/tokens') for f in fs if f == 't_tree_oak.png'][0]).convert('RGBA')
g = treat(Image.open(os.path.join(CAP, 'meadow_ground.png')).convert('RGB'), *P['meadow'][:3], P['meadow'][3]).crop((120, 300, 420, 420)).convert('RGBA')
sil = Image.new('RGBA', oak.size, (0, 0, 0, 0)); sil.putalpha(oak.split()[3].point(lambda a: 255 if a > 0 else 0))
for label, x, lift, off, alpha in (('resting', 40, 0, 2, 255), ('lifted today', 120, 4, 2, 255), ('lifted, further shadow', 200, 4, 6, 150)):
    s = sil.copy(); s.putalpha(s.split()[3].point(lambda a: alpha if a else 0))
    g.alpha_composite(s, (x + off, 40 + off)); g.alpha_composite(oak, (x, 40 - lift))
g.resize((g.width * 4, g.height * 4), Image.NEAREST).save(os.path.join(OUT, 'lifted.webp'), lossless=True)
print('lifted')
