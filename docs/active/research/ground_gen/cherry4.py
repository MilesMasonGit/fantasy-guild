import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
petal = lambda col, blades: dict(strokes=col, stroke_tone=2, blades=blades, cluster=3, heights=[1, 1, 2], tips=0.35)
BODY = [0.88, 0.62, 0.38]
nodirt = dict(earth_thr=1.5)
pink = mixed(W, H, [k('dry', grass=BODY, **petal([0.92, 0.55, 0.75], 0.06), **nodirt),
                    k('lawn', grass=BODY, strokes=[0.86, 0.70, 0.35], blades=0.03, **nodirt),
                    k('dry', grass=BODY, **petal([0.0, 0.92, 0.20], 0.05), **nodirt)], zone_scale=55)
green = ground(W, H, k('lawn', grass=[0.30, 0.45, 0.55], blades=0.045, **nodirt))
gp = ramp(0.30, 0.45, 0.55)
rnd = random.Random(31); n = vnoise(40, rnd); n2 = vnoise(10, rnd); jag = vnoise(4, rnd)
M = [[(n(x, y) * 0.8 + n2(x, y) * 0.2) + (jag(x, y) - 0.5) * 0.06 > 0.64 for x in range(W)] for y in range(H)]
out = pink.copy(); op = out.load(); gpx = green.load()
for y in range(H):
    for x in range(W):
        if M[y][x]: op[x, y] = gpx[x, y]
# green blades reaching over the patch edge into the pink, a soft shadow under the patch's top edge
for y in range(2, H - 1):
    for x in range(1, W - 1):
        if M[y][x] and not M[y - 1][x] and rnd.random() < 0.55:
            for i in range(rnd.choice((1, 2, 2, 3))):
                if y - i >= 0: op[x, y - i] = gp[3] if i == 0 else gp[2]
        elif not M[y][x] and M[y - 1][x] and rnd.random() < 0.7:
            op[x, y] = lighten(op[x, y], 0.88)
board_imgs([out], 'cherry_4.png', ['Cherry grove: B with grass-textured green patches'])
out.crop((150, 40, 290, 130)).resize((560, 360), Image.NEAREST).save(os.path.join(S, 'cherry_4_zoom.png'))
out.save(os.path.join(S, 'cherry_final.png')); print('ok')
