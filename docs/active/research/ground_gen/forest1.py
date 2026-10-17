import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
# A: deep meadow - the meadow rules, darker and cooler, more tall grass, little dry
A = [k('tall', grass=[0.30, 0.38, 0.55], strokes=[0.32, 0.31, 0.55]),
     k('lawn', grass=[0.30, 0.38, 0.55], earth=[0.05, 0.32, 0.30]),
     k('tall', grass=[0.30, 0.38, 0.55], strokes=[0.32, 0.31, 0.55], earth=[0.05, 0.32, 0.30])]
for d in A: d['earth'] = [0.05, 0.32, 0.30]
# B: forest floor - moss, leaf litter instead of dry grass, darker earth, dappled shade
leaf = dict(strokes=[0.07, 0.42, 0.62], stroke_tone=2, blades=0.05, cluster=3, heights=[1, 1, 2], tips=0.25)
B = [k('tall', grass=[0.31, 0.36, 0.50], strokes=[0.33, 0.30, 0.55]),
     k('lawn', grass=[0.31, 0.36, 0.50], blades=0.02),
     k('dry', grass=[0.31, 0.36, 0.50], **leaf)]
for d in B: d.update(earth=[0.05, 0.30, 0.28], tint=0.12, earth_thr=0.66)
# C: mossy - calm deep-green moss body, fern-like long tufts in patches, litter sparse
C = [k('tall', grass=[0.34, 0.36, 0.50], strokes=[0.36, 0.30, 0.55], heights=[3, 4, 4], cluster=6, blades=0.03),
     k('lawn', grass=[0.34, 0.36, 0.50], blades=0.012, body_soft=0.75, mounds=26),
     k('dry', grass=[0.34, 0.36, 0.50], **dict(leaf, blades=0.025))]
for d in C: d.update(earth=[0.05, 0.30, 0.28], tint=0.10, earth_thr=0.70)
imgs = [mixed(W, H, A, zone_scale=55), mixed(W, H, B, zone_scale=55), mixed(W, H, C, zone_scale=65)]
board_imgs(imgs, 'forest_1.png', ['A  deep meadow', 'B  forest floor: moss, leaf litter, dappled shade', 'C  mossy, fern tufts, sparse litter'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate(imgs): Z.paste(im.crop((150, 0, 290, 90)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'forest_1_zoom.png')); print('ok')
