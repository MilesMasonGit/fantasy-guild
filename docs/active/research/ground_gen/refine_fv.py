import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
FG = [0.25, 0.47, 0.62]
def fl(hue, l=0.66, s=0.55, blades=0.06, mask=0.5, mscale=26, floor=0.15, heights=(1, 2)):
    return k('dry', grass=FG, strokes=[hue, l, s], stroke_tone=2, blades=blades, cluster=4, heights=list(heights), tips=0.25,
             blade_mask=mask, blade_mask_scale=mscale, blade_mask_floor=floor)
lawn = k('lawn', grass=FG)
tall = k('tall', grass=FG)
# flower meadow
FA = mixed(W, H, [fl(0.92, mask=0.6, mscale=40, floor=0.05), fl(0.12, 0.85, 0.15, mask=0.6, mscale=40, floor=0.05),
                  fl(0.78, 0.62, 0.5, mask=0.6, mscale=40, floor=0.05), fl(0.15, 0.62, 0.65, mask=0.6, mscale=40, floor=0.05)], zone_scale=70)
FB = mixed(W, H, [fl(0.92), lawn, fl(0.78, 0.62, 0.5), lawn, fl(0.12, 0.85, 0.15), lawn], zone_scale=55)
FC = mixed(W, H, [fl(0.92, blades=0.05, heights=(2, 3)), tall, fl(0.78, 0.62, 0.5, blades=0.05, heights=(2, 3)), lawn, fl(0.15, 0.62, 0.65, blades=0.05, heights=(2, 3))], zone_scale=55)
board_imgs([FA, FB, FC], 'flower_2.png', ['A  fewer, larger drifts', 'B  drifts with calm lawn between', 'C  taller flowers among tall grass'])
# volcano
def volcano(body, ash_c, lava_body, lava_stroke, embers=0.0, crust=None, crack_blades=0.02, gap_thr=0.38):
    rock = k('lawn', grass=body, earth=[0.0, 0.30, 0.05], strokes=[body[0], max(0.1, body[1] - 0.10), body[2]], stroke_tone=1, heights=[1, 2],
             blades=crack_blades, cluster=2, blade_shadow=0.0, tips=0.0, mounds=12, mound_light=0.7, earth_thr=1.5, tint=0.06)
    ash = dict(rock, grass=ash_c, strokes=[ash_c[0], ash_c[1] + 0.10, ash_c[2]], stroke_tone=3, heights=[1], blades=0.03, cluster=4)
    lava = dict(rock, grass=lava_body, strokes=lava_stroke, stroke_tone=3, heights=[1, 2], blades=0.08, cluster=2, mounds=0, body=[2, 3])
    kinds = [rock, lava, rock, ash]
    if crust: kinds = [rock, crust, lava, crust, rock, ash]; cuts = [0.465, 0.48, 0.52, 0.535, 0.68]
    else: cuts = [0.475, 0.525, 0.68]
    img = banded(W, H, kinds, cuts, zone_scale=50, stretch=(2.2, 1.0), gap=(2 if crust else 1, 7, gap_thr, 0))
    if embers:
        rnd = random.Random(41); px = img.load(); lp = ramp(*lava_stroke)
        for _ in range(int(W * H * embers)):
            x, y = rnd.randrange(1, W - 1), rnd.randrange(1, H - 1)
            r, g, b, a = px[x, y]
            if r > 180 and g > 80:   # near lava: scatter a few embers around
                for _ in range(2):
                    xx, yy = x + rnd.randrange(-6, 7), y + rnd.randrange(-6, 4)
                    if 0 <= xx < W and 0 <= yy < H: px[xx, yy] = lp[4]
    return img
VA = volcano([0.04, 0.24, 0.10], [0.06, 0.38, 0.05], [0.09, 0.50, 0.95], [0.13, 0.62, 1.0], crack_blades=0.012, gap_thr=0.45)
VB = volcano([0.05, 0.40, 0.06], [0.06, 0.50, 0.05], [0.09, 0.52, 0.95], [0.13, 0.64, 1.0], crack_blades=0.012, gap_thr=0.45)
crust = None
VC_crust = k('lawn', grass=[0.02, 0.26, 0.45], strokes=[0.02, 0.20, 0.45], stroke_tone=1, blades=0.02, heights=[1], earth_thr=1.5, mounds=0, tint=0.06)
VC = volcano([0.05, 0.40, 0.06], [0.06, 0.50, 0.05], [0.09, 0.52, 0.95], [0.13, 0.64, 1.0], embers=0.03, crust=VC_crust, crack_blades=0.012, gap_thr=0.45)
board_imgs([VA, VB, VC], 'volcano_2.png', ['A  first run, yellower glow, fewer cracks', 'B  lighter ash ground, dark rock', 'C  B with cooled crust and embers'])
print('ok')
