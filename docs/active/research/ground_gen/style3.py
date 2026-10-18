# Visual style V3: on the owner's pick (Clean ground with the game's hard shadow), balance the biomes into one colour
# family (a shared brightness band and colour strength, each biome keeping its own hue), then light each biome with
# a faint colour wash over the whole mat. Real in-game captures from capture_biomes.mjs.
import os, sys, math, json
from PIL import Image, ImageChops, ImageCms
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'style2.py')).read().split('for b in BIOMES:')[0])
P['meadow'] = (0.72, 0.60, -0.008, 1.04, 1.04)   # less olive: the meadow had turned yellow
OUT = os.path.join(HERE, 'style3')
os.makedirs(OUT, exist_ok=True)

SRGB = ImageCms.createProfile('sRGB'); LAB = ImageCms.createProfile('LAB')
TO_LAB = ImageCms.buildTransformFromOpenProfiles(SRGB, LAB, 'RGB', 'LAB')
TO_RGB = ImageCms.buildTransformFromOpenProfiles(LAB, SRGB, 'LAB', 'RGB')

# The family: every biome's ground mean brightness (0-100) and colour strength, within a narrow band; the dark woods
# and the volcano a step lower so light and dark biomes still differ, but no longer by a gulf.
TARGET = {   # mean L, L spread (texture), mean chroma
    'meadow': (61, 7.5, 38), 'flower_meadow': (62, 7.5, 38), 'cherry_grove': (63, 7.5, 32), 'coast': (66, 7.0, 30),
    'mountain': (55, 7.5, 10), 'forest': (49, 7.5, 34), 'yellowstone': (46, 8.0, 26), 'volcano': (37, 9.0, 12),
}
LIGHT = {    # the mood wash: colour, strength
    'meadow': ((255, 240, 200), 0.14), 'flower_meadow': ((255, 232, 205), 0.14), 'cherry_grove': ((255, 215, 230), 0.14),
    'coast': ((255, 236, 190), 0.14), 'mountain': ((195, 212, 240), 0.16), 'forest': ((185, 228, 205), 0.14),
    'yellowstone': ((185, 215, 235), 0.16), 'volcano': ((255, 165, 120), 0.16),
}


def measure(img):
    lab = ImageCms.applyTransform(img.convert('RGB'), TO_LAB)
    px = list(lab.getdata())[::7]
    ls = [p[0] * 100 / 255 for p in px]; cs = [math.hypot(p[1] - 128, p[2] - 128) for p in px]
    hs = [math.degrees(math.atan2(p[2] - 128, p[1] - 128)) % 360 for p in px if math.hypot(p[1] - 128, p[2] - 128) > 6]
    m = sum(ls) / len(ls); sd = math.sqrt(sum((v - m) ** 2 for v in ls) / len(ls))
    hx = sum(math.cos(math.radians(h)) for h in hs); hy = sum(math.sin(math.radians(h)) for h in hs)
    return {'L': round(m, 1), 'L_sd': round(sd, 1), 'C': round(sum(cs) / len(cs), 1), 'hue': round(math.degrees(math.atan2(hy, hx)) % 360) if hs else None}


def balance(img, now, target):
    """Move a ground to its target brightness band and colour strength in Lab, keeping each pixel's hue. Pixels far
    more colourful than the ground (water, lava, flowers) keep more of their own colour."""
    tL, tsd, tC = target
    k = tsd / max(1.0, now['L_sd']); cs = tC / max(1.0, now['C'])
    lab = ImageCms.applyTransform(img.convert('RGB'), TO_LAB); px = lab.load(); W, H = lab.size
    for y in range(H):
        for x in range(W):
            L, a, b = px[x, y]
            l = L * 100 / 255; l2 = tL + (l - now['L']) * k
            ca, cb = a - 128, b - 128; c = math.hypot(ca, cb)
            s = cs if c < now['C'] * 1.8 else 1 + (cs - 1) * 0.3
            px[x, y] = (max(0, min(255, round(l2 * 255 / 100))), max(0, min(255, round(128 + ca * s))), max(0, min(255, round(128 + cb * s))))
    return ImageCms.applyTransform(lab, TO_RGB)


def light(img, tint, strength):
    wash = Image.new('RGB', img.size, tint)
    return Image.blend(img, ImageChops.soft_light(img, wash), strength * 2)


def lit_scene(ground, full, mask, tint, strength):
    """The light falls on everything, but the Tokens take a third of it, so their art keeps its own colours."""
    base = shadowed(light(ground, tint, strength), light(full, tint, strength / 3), mask)
    return base


report = {}
for b in BIOMES:
    ground = Image.open(os.path.join(CAP, f'{b}_ground.png')).convert('RGB')
    full = Image.open(os.path.join(CAP, f'{b}_full.png')).convert('RGB')
    mask = tokens_mask(ground, full)
    sat, tex, dh, bc, bm = P[b]
    clean = treat(ground, sat, tex, dh, bc)
    before = measure(clean)
    bal = balance(clean, before, TARGET[b])
    after = measure(bal)
    report[b] = {'today': measure(ground), 'clean': before, 'balanced': after}
    shots = {
        'clean': shadowed(clean, full, mask),
        'balanced': shadowed(bal, full, mask),
        'lit': lit_scene(bal, full, mask, *LIGHT[b]),
    }
    for k, im in shots.items():
        im.save(os.path.join(OUT, f'{b}_{k}.webp'), quality=92, method=6)
    for k, g in (('today', ground), ('clean', clean), ('balanced', bal), ('lit', light(bal, *LIGHT[b]))):
        g.crop((260, 150, 620, 410)).save(os.path.join(OUT, f'swatch_{b}_{k}.png'))
    print(b, json.dumps(report[b]))
json.dump(report, open(os.path.join(OUT, 'measure.json'), 'w'), indent=1)

# the family sheet: each biome's ground, side by side, per stage
for k in ('today', 'clean', 'balanced', 'lit'):
    sheet = Image.new('RGB', (360 * 4 + 30, 260 * 2 + 10), (30, 30, 30))
    for i, b in enumerate(BIOMES):
        sheet.paste(Image.open(os.path.join(OUT, f'swatch_{b}_{k}.png')), ((i % 4) * 370, (i // 4) * 270))
    sheet.save(os.path.join(OUT, f'family_{k}.webp'), quality=92, method=6)
print('ok')
