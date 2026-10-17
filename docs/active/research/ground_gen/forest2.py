import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
GR = [0.31, 0.36, 0.50]
def variant(leaf_l, leaf_blades, fern_strokes, fern_blades, zone_scale):
    leaf = dict(strokes=[0.085, leaf_l, 0.45], stroke_tone=2, blades=leaf_blades, cluster=3, heights=[1, 1, 2], tips=0.15)
    fern = k('tall', grass=GR, strokes=fern_strokes, heights=[3, 4, 4], cluster=6, blades=fern_blades)
    ks = [fern, k('lawn', grass=GR, blades=0.02), k('dry', grass=GR, **leaf)]
    for d in ks: d.update(earth=[0.05, 0.30, 0.28], tint=0.12, earth_thr=0.66)
    return mixed(W, H, ks, zone_scale=zone_scale)
imgs = [variant(0.36, 0.05, [0.36, 0.30, 0.55], 0.03, 55),
        variant(0.36, 0.05, [0.33, 0.40, 0.60], 0.04, 55),
        variant(0.38, 0.08, [0.36, 0.30, 0.55], 0.03, 75)]
board_imgs(imgs, 'forest_2.png', ['A  brown leaves, C ferns', 'B  ferns brighter and more', 'C  leaves in bigger drifts'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate(imgs): Z.paste(im.crop((150, 0, 290, 90)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'forest_2_zoom.png')); print('ok')
