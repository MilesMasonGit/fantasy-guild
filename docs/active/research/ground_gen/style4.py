# Visual style V4: the ground at a bigger pixel size than the Tokens (owner's idea), on the owner's pick (Clean ground,
# the game's hard shadow). Each n x n block of the captured ground takes its most common colour (no new blended colours,
# still sharp), then is shown n times bigger; the Tokens keep their own pixel size.
import os, sys
from collections import Counter
from PIL import Image, ImageEnhance
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'style2.py')).read().split('for b in BIOMES:')[0])
OUT = os.path.join(HERE, 'style4')
os.makedirs(OUT, exist_ok=True)


def chunky(img, n):
    W, H = img.size; px = img.load()
    small = Image.new('RGB', ((W + n - 1) // n, (H + n - 1) // n)); sp = small.load()
    for by in range(small.height):
        for bx in range(small.width):
            c = Counter(px[x, y] for y in range(by * n, min(H, by * n + n)) for x in range(bx * n, min(W, bx * n + n)))
            sp[bx, by] = c.most_common(1)[0][0]
    return small.resize((small.width * n, small.height * n), Image.NEAREST).crop((0, 0, W, H))


def colour_only(img, sat, dh, bright):
    """Clean's colour (weaker, hue nudged, brightness) without its softening: the bigger pixels calm the texture."""
    g = img
    if dh:
        h, s, v = g.convert('HSV').split()
        g = Image.merge('HSV', (h.point(lambda p: (p + int(round(dh * 255))) % 256), s, v)).convert('RGB')
    return ImageEnhance.Brightness(ImageEnhance.Color(g).enhance(sat)).enhance(bright)


for b in BIOMES:
    ground = Image.open(os.path.join(CAP, f'{b}_ground.png')).convert('RGB')
    full = Image.open(os.path.join(CAP, f'{b}_full.png')).convert('RGB')
    mask = tokens_mask(ground, full)
    sat, tex, dh, bc, bm = P[b]
    shots = {
        'clean': shadowed(treat(ground, sat, tex, dh, bc), full, mask),
        'clean_x2': shadowed(colour_only(chunky(ground, 2), sat, dh, bc), full, mask),
        'clean_x3': shadowed(colour_only(chunky(ground, 3), sat, dh, bc), full, mask),
        'today_x2': shadowed(chunky(ground, 2), full, mask),
    }
    for k, im in shots.items():
        im.save(os.path.join(OUT, f'{b}_{k}.png'))
    # a 3x zoom of the middle, so the pixel sizes can be seen
    for k, im in shots.items():
        im.crop((340, 180, 620, 380)).resize((840, 600), Image.NEAREST).save(os.path.join(OUT, f'zoom_{b}_{k}.png'))
    print(b)
