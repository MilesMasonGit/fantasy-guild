import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 880, 576     # a whole Region: 55 x 36 cells of 16 plan pixels
spec = json.load(open(os.path.join(S, 'final_spec.json')))
base = mixed(W, H, [spec['tall'], spec['lawn'], spec['dry']], zone_scale=spec['zone_scale'])
WATER = {'sea': [0.50, 0.46, 0.52], 'bank': [0.08, 0.36, 0.30]}
rnd = random.Random(5); nz = vnoise(30, rnd); nz2 = vnoise(9, rnd)
def blob(cx, cy, r):
    return lambda x, y: r - math.hypot(x - cx, (y - cy) * 1.15) + (nz(x, y) - 0.5) * r * 0.6 + (nz2(x, y) - 0.5) * 4
def union(*fs):
    return lambda x, y: max(f(x, y) for f in fs)
def stream(points, width):
    def f(x, y):
        best = 1e9
        for (x1, y1), (x2, y2) in zip(points, points[1:]):
            dx, dy = x2 - x1, y2 - y1; t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
            best = min(best, math.hypot(x - x1 - t * dx, y - y1 - t * dy))
        return width - best + (nz2(x, y) - 0.5) * 3
    return f
A = water_field(base, union(blob(180, 140, 34), blob(640, 120, 26), blob(300, 430, 42), blob(720, 420, 30)), WATER)
B = water_field(base, union(blob(560, 300, 110), stream([(560, 300), (430, 360), (320, 470), (250, 576)], 9)), WATER)
C = water_field(base, union(blob(40, 60, 46), blob(860, 520, 52), blob(30, 540, 30), blob(870, 90, 28)), WATER)
def put(img):
    toks = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k in f for k in ('t_tree_oak.png', 't_sawmill', 't_campfire', 't_mineshaft_copper')))
    spots = [(120, 300), (420, 200), (500, 470), (780, 260)]
    for f, (x, y) in zip(toks, spots): img.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    return img
imgs = [put(i) for i in (A, B, C)]
for n, im in zip('ABC', imgs): im.save(os.path.join(S, f'world_1_{n}.png'))
P = Image.new('RGB', (W * 3 + 24, H + 22), (40, 40, 40)); d = ImageDraw.Draw(P)
for i, (im, lab) in enumerate(zip(imgs, ['A  scattered ponds', 'B  one lake and a stream', 'C  small water at the edges'])):
    P.paste(im.convert('RGB'), (i * (W + 12), 22)); d.text((i * (W + 12) + 4, 5), lab, fill=(255, 255, 255))
P.save(os.path.join(S, 'world_1.png')); print('ok')
