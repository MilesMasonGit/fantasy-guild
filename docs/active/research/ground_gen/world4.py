import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'world2.py')).read().split("rnd = random.Random(12)")[0])
rnd = random.Random(12); edge = vnoise(70, rnd); c3 = vnoise(3, rnd); c5 = vnoise(5, rnd)
fp = forest.load(); mp = mountain.load()
def side(x, y): return (x - W * 0.55) / W + (edge(x, y) - 0.5) * 0.30
BAND = 0.16
def make(style):
    out = forest.copy(); op = out.load()
    for y in range(H):
        for x in range(W):
            t = (side(x, y) + BAND / 2) / BAND
            if t <= 0: continue
            if t >= 1: op[x, y] = mp[x, y]; continue
            if style == 'fade':
                if c3(x, y) * 0.7 + c5(x, y) * 0.3 < t: op[x, y] = mp[x, y]
            elif style == 'steps':
                k = min(3, int(t * 4)) / 3.0
                a, b = fp[x, y], mp[x, y]
                op[x, y] = tuple(int(a[i] * (1 - k) + b[i] * k) for i in range(3)) + (255,)
            else:
                k = min(3, int(t * 4)) / 3.0
                pick_m = c3(x, y) * 0.7 + c5(x, y) * 0.3 < t
                a, b = (mp[x, y], fp[x, y]) if pick_m else (fp[x, y], mp[x, y])
                kk = 0.35 * (1 - abs(k - 0.5) * 2)   # a little of the other ground's colour in the middle steps
                op[x, y] = tuple(int(a[i] * (1 - kk) + b[i] * kk) for i in range(3)) + (255,)
    return out
toks = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k_ in f for k_ in ('t_tree_oak.png', 't_sawmill', 't_campfire', 't_mineshaft_copper')))
spots = [(110, 120), (470, 190), (560, 470), (760, 260)]
for n, st in {'A': 'fade', 'B': 'steps', 'C': 'both'}.items():
    img = make(st)
    for f, (x, y) in zip(toks, spots): img.alpha_composite(Image.open(f).convert('RGBA'), (x, y))
    img.save(os.path.join(S, f'world_4_{n}.png')); img.crop((250, 100, 750, 420)).save(os.path.join(S, f'world_4_{n}_crop.png'))
ims = [Image.open(os.path.join(S, f'world_4_{n}_crop.png')) for n in 'ABC']
P = Image.new('RGB', (500 * 3 + 24, 320), (40, 40, 40))
for i, im in enumerate(ims): P.paste(im.convert('RGB'), (i * 512, 0))
P.save(os.path.join(S, 'world_4_strip.png')); print('ok')
