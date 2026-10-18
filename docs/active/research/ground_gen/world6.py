# Round W6: water shapes on layouts B (core and rim) and C (patchwork):
# lobed lakes with bays and islands, rivers across the mat, a river that splits.
import os
from PIL import ImageDraw
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'world5.py')).read().split("A = render(")[0])
wx_ = vnoise(70, rnd); wy_ = vnoise(70, rnd); fine = vnoise(12, rnd); wid = vnoise(90, rnd)
def warped(x, y, amp=70):
    return x + (wx_(x, y) - 0.5) * amp, y + (wy_(x, y) - 0.5) * amp
def big_lake(lobes, islands=()):
    """Lobes (cx, cy, r) merged, the shore warped twice; islands (cx, cy, r) left as land."""
    def f(x, y):
        u, v = warped(x, y)
        val = max(r - math.hypot(u - cx, (v - cy) * 1.1) for cx, cy, r in lobes)
        val += (nz(x, y) - 0.5) * 22 + (fine(x, y) - 0.5) * 7
        for cx, cy, r in islands:
            val = min(val, math.hypot(u - cx, v - cy) - r + (fine(x, y) - 0.5) * 6)
        return val
    return f
def meander(p0, p1, n=48, amp=40, waves=2.5, seed=0):
    (x0, y0), (x1, y1) = p0, p1; L = math.hypot(x1 - x0, y1 - y0); nx, ny = -(y1 - y0) / L, (x1 - x0) / L
    r = random.Random(seed); ph = r.uniform(0, 6.28); pts = []
    for i in range(n + 1):
        t = i / n; s = math.sin(t * waves * 6.28 + ph) * amp * math.sin(t * 3.14) ** 0.5 + (wx_(t * 500, seed * 40) - 0.5) * amp
        pts.append((x0 + (x1 - x0) * t + nx * s, y0 + (y1 - y0) * t + ny * s))
    return pts
def river(pts, hw0, hw1=None):
    """Distance to the path drawn as nested thick lines (no numpy here); half width hw0 -> hw1 along it."""
    hw1 = hw0 if hw1 is None else hw1
    D = Image.new('L', (W, H), 80); d = ImageDraw.Draw(D)
    for rr in range(80, 0, -1): d.line(pts, fill=rr, width=2 * rr, joint='curve')
    Dp = D.load(); (xa, ya), (xb, yb) = pts[0], pts[-1]; L2 = (xb - xa) ** 2 + (yb - ya) ** 2
    def f(x, y):
        t = max(0, min(1, ((x - xa) * (xb - xa) + (y - ya) * (yb - ya)) / L2))
        hw = hw0 + (hw1 - hw0) * t + (wid(x, y) - 0.5) * hw0 * 0.6
        return hw - Dp[x, y] + (fine(x, y) - 0.5) * 3
    return f
def pond(cx, cy, r): return big_lake([(cx, cy, r), (cx + r * 0.5, cy - r * 0.3, r * 0.6)])
CORE = [(440, 290, 'meadow'), (430, 300, 'meadow'), (80, 60, 'forest'), (60, 400, 'forest'), (300, 560, 'forest'), (250, 20, 'forest'),
        (820, 80, 'mountain'), (850, 450, 'mountain'), (600, 570, 'mountain'), (640, 10, 'mountain')]
def smooth(pts, k=4):
    for _ in range(k):
        q = [pts[0]]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]): q += [(x1 * .75 + x2 * .25, y1 * .75 + y2 * .25), (x1 * .25 + x2 * .75, y1 * .25 + y2 * .75)]
        pts = q + [pts[-1]]
    return pts
# A: core and rim, one big lake in the meadow with a bay, a peninsula and an island; outflow to the edge; forest pond, mountain tarn
A = render(CORE, lakes(
    big_lake([(430, 290, 110), (560, 250, 65), (340, 360, 60)], islands=[(470, 280, 20), (600, 330, 40)]),
    river(smooth([(380, 380), (360, 450), (300, 500), (310, 600)]), 6, 9),
    pond(110, 450, 30), big_lake([(800, 130, 30)])))
# B: patchwork, a river crossing the whole mat, widening downstream, a pool on the way; ponds by biome
pts = [(rnd.uniform(0, W), rnd.uniform(0, H)) for _ in range(14)]
cent = [(x, y, ['meadow', 'forest', 'mountain'][i % 3]) for i, (x, y) in enumerate(pts)]
B = render(cent, lakes(
    river(meander((-20, 120), (900, 470), amp=55, waves=2.2, seed=2), 8, 15),
    big_lake([(420, 300, 55), (470, 330, 40)]),
    *[pond(x, y, 26) for x, y, b in cent if b == 'forest'][:1], *[big_lake([(x, y, 20)]) for x, y, b in cent if b == 'mountain'][:1]))
# C: core and rim, a river from the mountains splits round a long island, rejoins, feeds a lake, and leaves in two mouths
C = render(CORE, lakes(
    river(smooth([(770, -20), (740, 60), (680, 110), (640, 150)]), 9, 11),
    river(smooth([(640, 150), (580, 170), (540, 230), (520, 290)]), 7),
    river(smooth([(640, 150), (660, 210), (630, 270), (560, 300), (520, 290)]), 6),
    big_lake([(430, 340, 75), (380, 380, 45), (480, 310, 40)], islands=[(430, 350, 14)]),
    river(smooth([(370, 400), (330, 460), (260, 500), (230, 600)]), 9, 12), river(smooth([(440, 420), (470, 500), (540, 540), (560, 600)]), 6, 8),
    pond(120, 120, 28)))
toks = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k_ in f for k_ in ('t_tree_oak.png', 't_sawmill', 't_campfire', 't_mineshaft_copper')))
spots = [(110, 300), (240, 120), (680, 420), (790, 300)]
for n, img in zip('ABC', (A, B, C)):
    for f, (x, y) in zip(toks, spots): img.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    img.save(os.path.join(S, f'world_6_{n}.png'))
print('ok')
