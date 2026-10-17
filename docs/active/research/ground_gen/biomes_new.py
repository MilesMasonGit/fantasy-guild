import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
def flowers_kind(base_grass, hue, l=0.66, s=0.55, blades=0.06):
    return k('dry', grass=base_grass, strokes=[hue, l, s], stroke_tone=2, blades=blades, cluster=4, heights=[1, 2], tips=0.25,
             blade_mask=0.5, blade_mask_scale=26, blade_mask_floor=0.15)
# 1 flower meadow: bright lawn, drifts of pink, white, purple and soft yellow flowers
FG = [0.25, 0.47, 0.62]
fm = mixed(W, H, [flowers_kind(FG, 0.92), flowers_kind(FG, 0.12, 0.85, 0.15), flowers_kind(FG, 0.78, 0.62, 0.5), flowers_kind(FG, 0.15, 0.62, 0.65)],
           zone_scale=45)
# 2 cherry grove: cool green, pink petal litter, dense petal carpets in places, moss
CG = [0.30, 0.42, 0.45]
petal = dict(strokes=[0.94, 0.74, 0.55], stroke_tone=2, cluster=3, heights=[1, 1, 2], tips=0.3)
cg = mixed(W, H, [k('dry', grass=CG, blades=0.10, **petal), k('lawn', grass=CG, blades=0.025), k('dry', grass=CG, blades=0.04, **petal)], zone_scale=55)
# 3 volcano: dark warm basalt, ash zones, glowing lava cracks
basalt = [0.04, 0.24, 0.10]
rock = k('lawn', grass=basalt, earth=[0.0, 0.30, 0.05], strokes=[0.04, 0.16, 0.10], stroke_tone=1, heights=[1, 2], blades=0.02, cluster=2,
         blade_shadow=0.0, tips=0.0, mounds=12, mound_light=0.7, earth_thr=0.72, dirt_style='clods_middle', tint=0.06, encroach=0.4)
ash = dict(rock, grass=[0.06, 0.38, 0.05], strokes=[0.06, 0.48, 0.05], stroke_tone=3, heights=[1], blades=0.03, cluster=4)
lava = dict(rock, grass=[0.04, 0.45, 0.95], strokes=[0.12, 0.62, 1.0], stroke_tone=3, heights=[1, 2], blades=0.08, cluster=2, mounds=0, body=[2, 3])
vol = banded(W, H, [rock, lava, rock, ash], [0.475, 0.525, 0.68], zone_scale=50, stretch=(2.2, 1.0), gap=(1, 7, 0.38, 0))
# 4 yellowstone: pale mineral crust, sparse dry grass, hot pools with rings, runoff
crust = [0.11, 0.78, 0.25]
land = mixed(W, H, [k('dry', grass=crust, earth=crust, earth_thr=1.5, strokes=[0.10, 0.62, 0.35], stroke_tone=1, blades=0.02, heights=[1], cluster=3),
                    k('lawn', grass=crust, earth=crust, earth_thr=1.5, strokes=[0.08, 0.68, 0.30], stroke_tone=1, blades=0.015, heights=[1]),
                    k('dry', grass=[0.13, 0.72, 0.30], earth=crust, earth_thr=1.5, strokes=[0.20, 0.45, 0.40], blades=0.02, heights=[1, 2])], zone_scale=55)
ys = pools(W, H, land, {'count': 3, 'radius': (24, 38), 'rings': [
    (0.38, (26, 74, 140)), (0.58, (36, 130, 160)), (0.72, (90, 180, 170)), (0.80, (214, 196, 90)), (0.90, (214, 140, 60)), (0.98, (150, 92, 58)), (1.03, (232, 222, 196))]})
board_imgs([fm, cg], 'new_1a.png', ['Flower meadow', 'Pink cherry grove'])
board_imgs([vol, ys], 'new_1b.png', ['Volcano', 'Yellowstone'])
print('ok')
