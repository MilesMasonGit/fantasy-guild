import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'world2.py')).read().split("rnd = random.Random(12)")[0])
meadow = mixed(W, H, [spec['tall'], spec['lawn'], spec['dry']], zone_scale=spec['zone_scale'])
grounds = {'meadow': meadow.load(), 'forest': forest.load(), 'mountain': mountain.load()}
rnd = random.Random(21); warp = vnoise(60, rnd); warp2 = vnoise(60, rnd); c3 = vnoise(3, rnd); c5 = vnoise(5, rnd)
BAND = 40.0
def render(centres, water):
    out = Image.new('RGBA', (W, H)); op = out.load()
    names = sorted(set(b for _, _, b in centres))
    for y in range(H):
        for x in range(W):
            wx = x + (warp(x, y) - 0.5) * 120; wy = y + (warp2(x, y) - 0.5) * 120
            best = {}
            for cx, cy, b in centres:
                d = math.hypot(wx - cx, wy - cy)
                if d < best.get(b, 1e9): best[b] = d
            order = sorted(best.items(), key=lambda kv: kv[1])
            (b1, d1), (b2, d2) = order[0], order[1]
            gap = d2 - d1
            pick = b1
            if gap < BAND:   # gradient C: clumped fade with a touch of the other's colour in the middle
                t = 0.5 - gap / BAND / 2
                if c3(x, y) * 0.7 + c5(x, y) * 0.3 < t: pick = b2
            a = grounds[pick][x, y]
            if gap < BAND:
                other = grounds[b2 if pick == b1 else b1][x, y]; kk = 0.35 * max(0, 1 - gap / (BAND * 0.6))
                a = tuple(int(a[i] * (1 - kk) + other[i] * kk) for i in range(3)) + (255,)
            op[x, y] = a
    return water_field(out, water, {'sea': [0.50, 0.44, 0.52], 'bank': [0.08, 0.34, 0.30]})
nz = vnoise(30, rnd); nz2 = vnoise(9, rnd)
def lake(cx, cy, r, stream=None):
    def f(x, y):
        v = r - math.hypot(x - cx, (y - cy) * 1.15) + (nz(x, y) - 0.5) * r * 0.6 + (nz2(x, y) - 0.5) * 4
        if stream:
            best = 1e9
            for (x1, y1), (x2, y2) in zip(stream, stream[1:]):
                dx, dy = x2 - x1, y2 - y1; t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
                best = min(best, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
            v = max(v, 8 - best + (nz2(x, y) - 0.5) * 3)
        return v
    return f
def lakes(*fs): return lambda x, y: max(f(x, y) for f in fs)
A = render([(120, y, 'forest') for y in (80, 300, 520)] + [(440, y, 'meadow') for y in (100, 300, 500)] + [(760, y, 'mountain') for y in (90, 290, 500)],
           lakes(lake(440, 330, 70, [(440, 330), (520, 440), (600, 576)]), lake(760, 120, 26)))
B = render([(440, 290, 'meadow'), (430, 300, 'meadow')] + [(80, 60, 'forest'), (60, 400, 'forest'), (300, 560, 'forest'), (250, 20, 'forest')] +
           [(820, 80, 'mountain'), (850, 450, 'mountain'), (600, 570, 'mountain'), (640, 10, 'mountain')],
           lakes(lake(450, 300, 64, [(450, 300), (350, 420), (300, 576)])))
pts = [(rnd.uniform(0, W), rnd.uniform(0, H)) for _ in range(14)]
C = render([(x, y, ['meadow', 'forest', 'mountain'][i % 3]) for i, (x, y) in enumerate(pts)],
           lakes(*[lake(x, y, 30) for i, (x, y) in enumerate(pts) if i % 3 == 0][:3]))
toks = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k_ in f for k_ in ('t_tree_oak.png', 't_sawmill', 't_campfire', 't_mineshaft_copper')))
spots = [(110, 160), (300, 120), (560, 200), (760, 300)]
for n, img in zip('ABC', (A, B, C)):
    for f, (x, y) in zip(toks, spots): img.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    img.save(os.path.join(S, f'world_5_{n}.png'))
ims = [Image.open(os.path.join(S, f'world_5_{n}.png')) for n in 'ABC']
P = Image.new('RGB', (W * 3 + 24, H), (40, 40, 40))
for i, im in enumerate(ims): P.paste(im.convert('RGB'), (i * (W + 12), 0))
P.resize((P.width // 2, P.height // 2), Image.NEAREST).save(os.path.join(S, 'world_5_strip.png')); print('ok')
