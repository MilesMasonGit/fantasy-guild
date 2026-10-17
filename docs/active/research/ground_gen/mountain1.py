import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
def mountain(body, grass_strokes, gravel, grass_amount, alpine=False):
    common = dict(grass=body, earth=gravel, dirt_style='clods_middle', earth_thr=0.70, tint=0.07, encroach=0.6)
    rock = k('lawn', strokes=[body[0], body[1] - 0.10, body[2] + 0.04], stroke_tone=1, heights=[1, 2], blades=0.03, cluster=2,
             blade_shadow=0.0, tips=0.0, mounds=12, mound_light=0.7, **common)
    scree = k('lawn', strokes=[gravel[0], gravel[1] + 0.12, gravel[2]], stroke_tone=3, heights=[1], blades=0.06, cluster=3,
              blade_shadow=0.7, tips=0.0, mounds=18, **common)
    grassy = k('tall', strokes=grass_strokes, heights=[2, 3], blades=0.02 * grass_amount, cluster=4, **common)
    if alpine: grassy.update(grass=[0.27, 0.42, 0.45])
    return [grassy, rock, scree]
imgs = [mixed(W, H, mountain([0.60, 0.46, 0.10], [0.26, 0.40, 0.45], [0.60, 0.56, 0.08], 1.0), zone_scale=60),
        mixed(W, H, mountain([0.07, 0.44, 0.12], [0.24, 0.40, 0.40], [0.08, 0.56, 0.12], 0.6), zone_scale=60),
        mixed(W, H, mountain([0.60, 0.46, 0.10], [0.27, 0.36, 0.50], [0.60, 0.56, 0.08], 1.5, alpine=True), zone_scale=60)]
board_imgs(imgs, 'mountain_1.png', ['A  cool grey rock, sparse grass', 'B  warm brown stone, more scree', 'C  alpine: grass meets rock'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate(imgs): Z.paste(im.crop((150, 0, 290, 90)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'mountain_1_zoom.png')); print('ok')
