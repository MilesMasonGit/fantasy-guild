import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'world2.py')).read().split("rnd = random.Random(12)")[0])
WATER = {'sea': [0.50, 0.42, 0.50], 'bank': [0.08, 0.32, 0.30]}
rnd = random.Random(12); edge = vnoise(70, rnd); clump = vnoise(7, rnd); fing = vnoise(40, rnd); rk = vnoise(9, rnd)
meadow = ground(W, H, k('lawn', earth_thr=1.5))
def side(x, y): return (x - W * 0.55) / W + (edge(x, y) - 0.5) * 0.35
fp = forest.load(); mp = mountain.load(); gp_ = meadow.load()
def make(style):
    out = forest.copy(); op = out.load()
    fr = ramp(0.29, 0.40, 0.55)
    for y in range(H):
        for x in range(W):
            s = side(x, y)
            if style == 'fingers':
                s2 = s + (fing(x / 5.0, y) - 0.5) * 0.28
                if s2 > 0: op[x, y] = mp[x, y]
            elif style == 'transition':
                if s > 0.07: op[x, y] = mp[x, y]
                elif s > -0.05:
                    op[x, y] = mp[x, y] if rk(x, y) > 0.66 - (s + 0.05) * 1.5 else gp_[x, y]
            elif style == 'cliff':
                if s > 0: op[x, y] = mp[x, y]
                elif s > -0.014:   # rock face: dark grey with vertical strokes
                    op[x, y] = (70, 74, 86, 255) if (x + int(rk(x, y) * 7)) % 3 else (54, 57, 68, 255)
                elif s > -0.026: op[x, y] = lighten(fp[x, y], 0.72)   # shadow cast onto the forest
            elif style == 'river':
                if s > 0: op[x, y] = mp[x, y]
    if style == 'river':
        out = water_field(out, lambda x, y: 10 - abs(side(x, y) * W) + (rk(x, y) - 0.5) * 3, WATER)
    return out
toks = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k_ in f for k_ in ('t_tree_oak.png', 't_sawmill', 't_campfire', 't_mineshaft_copper')))
spots = [(110, 120), (470, 190), (560, 470), (760, 260)]
labels = {'A': 'fingers', 'B': 'transition', 'C': 'river', 'D': 'cliff'}
for n, st in labels.items():
    img = make(st)
    for f, (x, y) in zip(toks, spots): img.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    img.save(os.path.join(S, f'world_3_{n}.png'))
    img.crop((250, 100, 750, 420)).save(os.path.join(S, f'world_3_{n}_crop.png'))
print('ok')
