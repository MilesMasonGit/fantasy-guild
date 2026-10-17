import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
def land(sand_body, dune=0.0, shells=0.04):
    common = dict(grass=sand_body, earth=sand_body, earth_thr=1.5, tint=0.05, mounds=20, mound_light=0.4, body_soft=0.7)
    ripples = k('lawn', strokes=[sand_body[0], sand_body[1] - 0.08, sand_body[2]], stroke_tone=1, heights=[1], blades=0.03, cluster=3,
                blade_shadow=0.0, tips=0.0, **common)
    shell = k('lawn', strokes=[0.05, 0.62, 0.35], stroke_tone=3, heights=[1], blades=shells, cluster=2, blade_shadow=0.6, tips=0.0,
              blade_mask=0.6, blade_mask_scale=20, blade_mask_floor=0.0, **common)
    grassy = k('tall', strokes=[0.22, 0.42, 0.45], heights=[2, 3, 3], blades=0.05 * dune, cluster=5, **common) if dune else ripples
    return mixed(W, H, [grassy, ripples, shell], zone_scale=60)
A = coast(W, H, land([0.11, 0.58, 0.42]), {'sea': [0.47, 0.46, 0.55], 'sand': [0.11, 0.58, 0.42]})
B = coast(W, H, land([0.10, 0.62, 0.25], shells=0.07), {'sea': [0.58, 0.40, 0.50], 'sand': [0.10, 0.62, 0.25], 'foam': 0.006, 'dash': 0.78})
C = coast(W, H, land([0.11, 0.58, 0.38], dune=1.0), {'sea': [0.50, 0.42, 0.50], 'sand': [0.11, 0.58, 0.38]})
board_imgs([A, B, C], 'coast_1.png', ['A  golden sand, turquoise sea', 'B  pale cool sand, deep blue, more shells', 'C  dune grass, teal sea'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate([A, B, C]): Z.paste(im.crop((150, 40, 290, 130)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'coast_1_zoom.png')); print('ok')
