# Round W7: natural river shapes for the split-river Region (W6 C): wiggled paths, uneven arms, braids, springs.
import os
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'world6.py')).read().split("# A: core and rim")[0])
def smooth(pts, k=4):
    for _ in range(k):
        q = [pts[0]]
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]): q += [(x1 * .75 + x2 * .25, y1 * .75 + y2 * .25), (x1 * .25 + x2 * .75, y1 * .25 + y2 * .75)]
        pts = q + [pts[-1]]
    return pts
wig = vnoise(16, random.Random(5))
def wiggle(pts, amp, seed=0, ends=True):
    """Bends along the path's normal from noise over its length, so no two stretches curve alike; ends pinned."""
    pts = smooth(pts); out = []; s = 0; n = len(pts)
    for i, (x, y) in enumerate(pts):
        if i: s += math.hypot(x - pts[i - 1][0], y - pts[i - 1][1])
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]; L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        nx, ny = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
        pin = math.sin(math.pi * i / (n - 1)) if ends else 1
        o = ((wig(s * 0.32, seed * 37) - 0.5) * 5 * amp + (wig(s * 0.9, seed * 37 + 200) - 0.5) * amp * 0.6) * pin
        out.append((x + nx * o, y + ny * o))
    return smooth(out[::4], 3)
LAKE = big_lake([(430, 340, 75), (380, 380, 45), (480, 310, 40)], islands=[(430, 350, 14)])
POND = pond(120, 120, 28)
# A: an uneven split: a wide main arm and a thin side channel round a teardrop island; one outflow forking into a small delta near the edge
A = render(CORE, lakes(LAKE, POND,
    river(wiggle([(770, -20), (730, 70), (650, 140)], 18, 1), 8, 10),
    river(wiggle([(650, 140), (600, 190), (560, 250), (515, 300)], 14, 2), 9),
    river(wiggle([(650, 140), (690, 200), (650, 260), (590, 280), (530, 300)], 10, 3), 4),
    river(wiggle([(380, 395), (340, 470), (300, 520)], 22, 4), 9, 11),
    river(wiggle([(300, 520), (250, 560), (230, 600)], 10, 5), 7), river(wiggle([(300, 520), (330, 570), (350, 600)], 8, 6), 5)))
# B: braided: the mountain river runs wide and shallow, several channels weaving round gravel bars, then one outflow
braid = [river(wiggle([(770, -20), (720, 60), (700 + dx, 110 + dy), (640 + dx, 190 + dy), (580, 260), (520, 300)], 14, sd), hw)
         for dx, dy, sd, hw in ((-14, -4, 7, 7), (14, 6, 8, 6), (0, 12, 9, 5), (-6, 0, 14, 4))]
B = render(CORE, lakes(LAKE, POND, *braid, river(wiggle([(380, 395), (330, 480), (250, 600)], 26, 10), 9, 12)))
# C: springs: a spring pool in the meadow sends a thin stream that joins the mountain river (a confluence) before the lake;
#    a second spring stream runs from the forest pond into the lake; one outflow
spring = big_lake([(250, 170, 18)])
C = render(CORE, lakes(LAKE, POND, spring,
    river(wiggle([(770, -20), (700, 90), (600, 200), (515, 300)], 24, 11), 8, 10),
    river(wiggle([(250, 170), (400, 190), (560, 230)], 16, 12), 2, 5),
    river(wiggle([(140, 140), (250, 260), (370, 330)], 18, 13), 2.5, 4),
    river(wiggle([(380, 395), (330, 480), (250, 600)], 26, 10), 9, 12)))
toks = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k_ in f for k_ in ('t_tree_oak.png', 't_sawmill', 't_campfire', 't_mineshaft_copper')))
spots = [(110, 300), (240, 60), (680, 420), (790, 300)]
for n, img in zip('ABC', (A, B, C)):
    for f, (x, y) in zip(toks, spots): img.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    img.save(os.path.join(S, f'world_7_{n}.png'))
print('ok')
