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
sea = {'sea': [0.47, 0.46, 0.55], 'sand': SB, 'shore': 0.38}
A = coast2(W, H, land, dict(sea, waves=0.010, wave_mask=0.45, wave_grad=[(0.06, (1, 1, 2)), (0.12, (2, 3)), (0.20, (4, 5, 6, 7)), (0.28, (6, 7, 8, 9))], wave_gap=3))
B = coast2(W, H, land, dict(sea, waves=0.010, wave_mask=0.45, wave_grad=[(0.06, (1, 1, 2)), (0.12, (2, 3)), (0.20, (4, 5, 6, 7)), (0.28, (6, 7, 8, 9))], wave_gap=3, far_thick=0.24))
C = coast2(W, H, land, dict(sea, waves=0.007, wave_mask=0.40, wave_grad=[(0.06, (1, 1, 2)), (0.12, (2, 3)), (0.20, (4, 5, 6, 7)), (0.28, (6, 7, 8, 9))], wave_gap=5, far_thick=0.24))
board_imgs([A, B, C], 'coast_4.png', ['A  strong waves, fewer, spaced', 'B  A with rolling swells', 'C  fewest, widest spacing, swells'])
Z = Image.new('RGB', (1716, 360), (40, 40, 40))
for i, im in enumerate([A, B, C]): Z.paste(im.crop((90, 40, 230, 130)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 578, 0))
Z.save(os.path.join(S, 'coast_4_zoom.png')); print('ok')
