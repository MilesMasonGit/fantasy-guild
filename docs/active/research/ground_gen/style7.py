# Visual style V7: animation. On the settled look (Clean ground at 2x, quieter decorations, darker rim, hard shadows),
# short loops at the game's 8 frames a second: wind in the grass, water shimmer, cloud shadows, birds, butterflies,
# and a particle per biome (leaves, petals, embers). Each effect alone, then the meadow with all of them.
import os, sys, math, random
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'style6.py')).read().split('\nfor b in PIECES:')[0])
from PIL import ImageChops
OUT7 = os.path.join(HERE, 'style7')
os.makedirs(OUT7, exist_ok=True)
N = 48                     # frames: 6 s at 8 fps
TAU = 2 * math.pi


def setup(b):
    ground = Image.open(os.path.join(CAP, f'{b}_ground.png')).convert('RGB')
    full = Image.open(os.path.join(CAP, f'{b}_full.png')).convert('RGB')
    mask = tokens_mask(ground, full)
    sat, tex, dh, bc, bm = P[b]
    g = colour_only(chunky(quiet_decor(ground), 2), sat, dh, bc)
    gp = g.load(); mp = mask.load()
    water = Image.new('L', (W, H), 0); grass = Image.new('L', (W, H), 0); lava = Image.new('L', (W, H), 0)
    wp, sp, lp = water.load(), grass.load(), lava.load()
    for y in range(H):
        for x in range(W):
            r, gg, bb = gp[x, y]
            if mp[x, y]: continue
            if bb > r + 25 and bb > 90: wp[x, y] = 255
            elif gg > r - 6 and gg > bb + 15: sp[x, y] = 255
            elif r > 170 and r > gg + 50 and bb < 90: lp[x, y] = 255
    return g, full, mask, water, grass, lava


def field(fn, step=2):
    """A value per 2x2 ground cell, 0-255, shown on the ground's grid."""
    small = Image.new('L', (W // step + 1, H // step + 1)); p = small.load()
    for y in range(small.height):
        for x in range(small.width): p[x, y] = max(0, min(255, int(fn(x * step, y * step))))
    return small.resize((small.width * step, small.height * step), Image.NEAREST).crop((0, 0, W, H))


def brighten(img, f): return ImageEnhance.Brightness(img).enhance(f)


wn = vnoise(30, random.Random(11)); cl = vnoise(90, random.Random(12))


def wind(g, grass, t):
    """Gusts: pale streaks running through the grass from the west, on the ground's grid."""
    ph = t / N * TAU
    f = field(lambda x, y: 255 if math.sin(x * 0.045 - y * 0.012 - ph * 3 + wn(x, y) * 4) > 0.72 and wn(x * 2, y * 2) > 0.4 else 0)
    return Image.composite(brighten(g, 1.2), g, ImageChops.multiply(f, grass))


def shimmer(g, water, t, seed=5):
    """Water: a slow light swell and 2x2 sparkles that live three frames."""
    ph = t / N * TAU
    f = field(lambda x, y: 255 if math.sin(x * 0.03 + y * 0.05 + ph * 2 + wn(x, y) * 5) > 0.7 else 0)
    out = Image.composite(brighten(g, 1.07), g, ImageChops.multiply(f, water))
    r = random.Random(seed * 1000 + t // 3); wpx = water.load(); op = out.load()
    for _ in range(140):
        x, y = r.randrange(0, W - 2) // 2 * 2, r.randrange(0, H - 2) // 2 * 2
        if wpx[x, y] and wpx[x + 1, y + 1]:
            for yy in (y, y + 1):
                for xx in (x, x + 1): op[xx, yy] = (235, 250, 255)
    return out


def lava_glow(g, lava, t):
    k = 1.0 + 0.18 * (0.5 + 0.5 * math.sin(t / N * TAU * 3))
    return Image.composite(brighten(g, k), g, lava)


def clouds(img, t):
    """Cloud shadows: two hard steps of shade drifting east, wrapping round once a loop."""
    dx = t / N * W
    f = field(lambda x, y: cl((x - dx) % W, y) * 255, 4)
    a = f.point(lambda v: 255 if v > 182 else 0); b = f.point(lambda v: 255 if v > 168 else 0)
    out = Image.composite(brighten(img, 0.88), img, b)
    return Image.composite(brighten(img, 0.80), out, a)


BIRD_UP = ['X.....X', '.X...X.', '..X.X..', '...X...']
BIRD_DOWN = ['...X...', '..X.X..', '.X...X.', 'X.....X']


def stamp(img, rows, x, y, colour, k=1):
    p = img.load()
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == 'X':
                for yy in range(k):
                    for xx in range(k):
                        X, Y = int(x) + i * k + xx, int(y) + j * k + yy
                        if 0 <= X < W and 0 <= Y < H: p[X, Y] = colour


def birds(img, t):
    out = img.copy(); f = t / N
    for i, (ox, oy) in enumerate(((0, 0), (-14, -9), (-14, 9), (-28, -18), (-28, 18))):
        x = -60 + f * (W + 120) + ox; y = 130 + f * 160 + oy
        shape = BIRD_UP if (t + i) % 4 < 2 else BIRD_DOWN
        stamp(out, shape, x + 30, y + 70, (40, 52, 40))     # the shadow on the ground, far below
        stamp(out, shape, x, y, (30, 30, 34))
    return out


def butterflies(img, t):
    out = img.copy(); r = random.Random(8)
    for i in range(5):
        cx, cy = r.uniform(80, W - 80), r.uniform(60, H - 60); col = r.choice(((250, 240, 120), (255, 255, 255), (250, 170, 200), (150, 200, 255)))
        a = t / N * TAU + i
        x = cx + math.sin(a) * 40 + math.sin(a * 3) * 8; y = cy + math.sin(a * 2) * 18
        wing = ['X.X', '.X.'] if (t + i) % 2 else ['.X.', 'XXX']
        stamp(out, wing, x, y, col, 2)
    return out


def particles(img, t, kind, seed=3):
    """Falling leaves or petals, rising embers; each wraps round exactly once a loop, so the loop is seamless."""
    out = img.copy(); p = out.load(); r = random.Random(seed); f = t / N
    n = {'leaves': 26, 'petals': 60, 'embers': 45}[kind]
    for i in range(n):
        x0, y0 = r.uniform(0, W), r.uniform(0, H); ph = r.uniform(0, TAU)
        if kind == 'embers':
            x = x0 + math.sin(f * TAU * 2 + ph) * 6; y = (y0 - f * H) % H
            col = r.choice(((255, 200, 80), (255, 140, 40), (255, 90, 30))) if (t + i) % 5 else (255, 240, 170)
            size = 1
        else:
            x = (x0 + f * W) % W + math.sin(f * TAU * 3 + ph) * 10; y = (y0 + f * H) % H
            col = r.choice(((250, 190, 215), (255, 220, 235), (235, 150, 190))) if kind == 'petals' else r.choice(((190, 120, 40), (150, 160, 50), (200, 90, 40)))
            size = 2
        X, Y = int(x) // 2 * 2 if size == 2 else int(x), int(y) // 2 * 2 if size == 2 else int(y)
        cells = [(0, 0), (1, 0), (0, 1), (1, 1)] if size == 2 else [(0, 0)]
        if kind == 'leaves' and (t + i) % 4 < 2: cells = [(0, 0), (1, 0), (2, 1), (3, 1)]
        for dx, dy in cells:
            if 0 <= X + dx < W and 0 <= Y + dy < H: p[X + dx, Y + dy] = col
    return out


def save(frames, name):
    frames = [on_table(fr) for fr in frames]
    frames[0].save(os.path.join(OUT7, name + '.webp'), save_all=True, append_images=frames[1:], duration=125, loop=0, quality=88, method=4)
    print(name)


def run(b, effects, name):
    g, full, mask, water, grass, lava = setup(b)
    frames = []
    for t in range(N):
        gg = g
        if 'wind' in effects: gg = wind(gg, grass, t)
        if 'water' in effects: gg = shimmer(gg, water, t)
        if 'lava' in effects: gg = lava_glow(gg, lava, t)
        img = rim(shadowed(gg, full, mask))
        if 'clouds' in effects: img = clouds(img, t)
        for k in ('leaves', 'petals', 'embers'):
            if k in effects: img = particles(img, t, k)
        if 'butterflies' in effects: img = butterflies(img, t)
        if 'birds' in effects: img = birds(img, t)
        frames.append(img)
    save(frames, name)


JOBS = [('meadow', (), 'meadow_still'), ('meadow', ('wind',), 'meadow_wind'), ('meadow', ('water',), 'meadow_water'),
        ('meadow', ('clouds',), 'meadow_clouds'), ('meadow', ('birds',), 'meadow_birds'), ('meadow', ('butterflies',), 'meadow_butterflies'),
        ('meadow', ('wind', 'water', 'clouds', 'birds', 'butterflies'), 'meadow_all'),
        ('forest', ('leaves',), 'forest_leaves'), ('cherry_grove', ('petals',), 'cherry_petals'),
        ('volcano', ('embers', 'lava'), 'volcano_embers'), ('coast', ('water',), 'coast_water')]
only = sys.argv[1:]
for b, fx, name in JOBS:
    if not only or name in only: run(b, fx, name)
