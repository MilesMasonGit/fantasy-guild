import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
body = [0.60, 0.46, 0.10]; gravel = [0.60, 0.52, 0.06]
common = dict(grass=body, earth=gravel, dirt_style='clods_middle', earth_thr=0.70, tint=0.07, encroach=0.6)
rock = k('lawn', strokes=[0.60, 0.36, 0.14], stroke_tone=1, heights=[1, 2], blades=0.03, cluster=2, blade_shadow=0.0, tips=0.0,
         mounds=12, mound_light=0.7, **common)
scree = k('lawn', strokes=[0.60, 0.50, 0.06], stroke_tone=3, heights=[1], blades=0.05, cluster=7, blade_shadow=0.8, tips=0.0,
          mounds=18, blade_mask=0.55, blade_mask_scale=14, blade_mask_floor=0.05, **common)
alpine = k('tall', grass=[0.27, 0.42, 0.50], strokes=[0.27, 0.36, 0.55], earth=gravel, heights=[2, 3, 3], blades=0.05, cluster=4,
           dirt_style='clods_middle', earth_thr=0.70, tint=0.07, encroach=0.6, mounds=12)
# kinds: [alpine strip, rock, scree, rock]: alpine where v in a narrow band
def make(band, stretch):
    lo, hi = 0.5 - band / 2, 0.5 + band / 2
    return banded(W, H, [rock, alpine, rock, scree], [lo, hi, 0.70], zone_scale=60, stretch=stretch)
imgs = [make(0.06, (3.0, 1.0)), make(0.10, (3.0, 1.0)), make(0.08, (5.0, 1.0))]
board_imgs(imgs, 'mountain_2.png', ['A  thin grass stretches', 'B  wider stretches', 'C  longer stretches'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate(imgs): Z.paste(im.crop((150, 0, 290, 90)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'mountain_2_zoom.png')); print('ok')
