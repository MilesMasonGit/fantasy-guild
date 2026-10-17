import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
SB = [0.11, 0.58, 0.42]
common = dict(grass=SB, earth=SB, earth_thr=1.5, tint=0.05, mounds=20, mound_light=0.4, body_soft=0.7)
ripples = k('lawn', strokes=[SB[0], SB[1] - 0.08, SB[2]], stroke_tone=1, heights=[1], blades=0.03, cluster=3, blade_shadow=0.0, tips=0.0, **common)
shell = k('lawn', strokes=[0.05, 0.62, 0.35], stroke_tone=3, heights=[1], blades=0.04, cluster=2, blade_shadow=0.6, tips=0.0,
          blade_mask=0.6, blade_mask_scale=20, blade_mask_floor=0.0, **common)
dune = k('tall', strokes=[0.22, 0.42, 0.45], heights=[2, 3, 3], blades=0.05, cluster=5, **common)
land = mixed(W, H, [dune, ripples, shell], zone_scale=60)
sea = {'sea': [0.47, 0.46, 0.55], 'sand': SB}
A = coast2(W, H, land, dict(sea, waves=0.015, wave_mask=0.45))
B = coast2(W, H, land, dict(sea, waves=0.03, wave_mask=0.5, wave_patch_scale=24))
C = coast2(W, H, land, dict(sea, waves=0.02, wave_mask=0.4, wave_len=(3, 4, 5, 6), foam=0.022, flecks=0.008))
board_imgs([A, B, C], 'coast_2.png', ['A  wave strokes, light', 'B  denser wave patches', 'C  longer crests, wider foam'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate([A, B, C]): Z.paste(im.crop((150, 40, 290, 130)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'coast_2_zoom.png')); print('ok')
