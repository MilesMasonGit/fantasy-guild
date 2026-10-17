import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
petal = lambda col, blades: dict(strokes=col, stroke_tone=2, blades=blades, cluster=3, heights=[1, 1, 2], tips=0.35)
BODY = [0.88, 0.62, 0.38]; GREEN = [0.30, 0.45, 0.50]
def grove(thr):
    patch = dict(earth=GREEN, earth_thr=thr, dirt_style=None, sunken=False, earth_tufts=0.02, earth_tuft_max=5, encroach=0.7)
    ks = [k('dry', grass=BODY, **petal([0.92, 0.55, 0.75], 0.06), **patch),
          k('lawn', grass=BODY, strokes=[0.86, 0.70, 0.35], blades=0.03, **patch),
          k('dry', grass=BODY, **petal([0.0, 0.92, 0.20], 0.05), **patch)]
    return mixed(W, H, ks, zone_scale=55)
imgs = [grove(0.70), grove(0.64), grove(0.58)]
board_imgs(imgs, 'cherry_3.png', ['A  a few green patches', 'B  more green', 'C  green and pink about even'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate(imgs): Z.paste(im.crop((150, 40, 290, 130)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'cherry_3_zoom.png')); print('ok')
