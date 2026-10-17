import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 880, 576
spec = json.load(open(os.path.join(S, 'final_spec.json')))
fspec = json.load(open(os.path.join(S, 'forest_spec.json')))
forest = mixed(W, H, [fspec['kinds'][k] for k in fspec['order']], zone_scale=fspec['zone_scale'])
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
body = [0.60, 0.46, 0.10]; gravel = [0.60, 0.52, 0.06]
common = dict(grass=body, earth=gravel, dirt_style='clods_middle', earth_thr=0.70, tint=0.07, encroach=0.6)
rock = k('lawn', strokes=[0.60, 0.36, 0.14], stroke_tone=1, heights=[1, 2], blades=0.012, cluster=2, blade_shadow=0.0, tips=0.0, mounds=12, mound_light=0.7, **common)
scree = k('lawn', strokes=[0.60, 0.50, 0.06], stroke_tone=3, heights=[1], blades=0.05, cluster=7, blade_shadow=0.8, tips=0.0, mounds=18,
          blade_mask=0.55, blade_mask_scale=14, blade_mask_floor=0.05, **common)
alpine = k('tall', grass=[0.27, 0.42, 0.50], strokes=[0.27, 0.36, 0.55], earth=gravel, heights=[2, 3, 3], blades=0.05, cluster=4,
           dirt_style='clods_middle', earth_thr=0.70, tint=0.07, encroach=0.6, mounds=12)
mountain = banded(W, H, [rock, alpine, rock, scree], [0.45, 0.55, 0.70], zone_scale=60, stretch=(3.0, 1.0), gap=(1, 9, 0.45, 0))
rnd = random.Random(12); edge = vnoise(70, rnd); clump = vnoise(7, rnd); isl = vnoise(28, rnd)
def side(x, y, amp):   # > 0 on the mountain side (right), the border wandering
    return (x - W * 0.55) / W + (edge(x, y) - 0.5) * amp
def blend(style):
    out = forest.copy(); op = out.load(); mp = mountain.load()
    for y in range(H):
        for x in range(W):
            s = side(x, y, 0.35)
            if style == 'edge': m = s + (clump(x, y) - 0.5) * 0.015 > 0
            elif style == 'band':
                t = max(0, min(1, (s + 0.09) / 0.18)); m = clump(x, y) < t
            else:
                m = s + (isl(x, y) - 0.5) * 0.30 > 0
            if m: op[x, y] = mp[x, y]
    return out
WATER = {'sea': [0.50, 0.42, 0.50], 'bank': [0.08, 0.32, 0.30]}
nz = vnoise(30, rnd); nz2 = vnoise(9, rnd)
def lake_stream(x, y):
    lake = 95 - math.hypot(x - 300, (y - 300) * 1.15) + (nz(x, y) - 0.5) * 57 + (nz2(x, y) - 0.5) * 4
    pts = [(300, 300), (200, 380), (150, 470), (90, 576)]
    best = 1e9
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        dx, dy = x2 - x1, y2 - y1; t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
    return max(lake, 9 - best + (nz2(x, y) - 0.5) * 3)
toks = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k in f for k in ('t_tree_oak.png', 't_sawmill', 't_campfire', 't_mineshaft_copper')))
spots = [(110, 120), (470, 190), (560, 470), (760, 260)]
for name, style in (('A', 'edge'), ('B', 'band'), ('C', 'islands')):
    img = water_field(blend(style), lake_stream, WATER)
    for f, (x, y) in zip(toks, spots): img.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    img.save(os.path.join(S, f'world_2_{name}.png'))
print('ok')
