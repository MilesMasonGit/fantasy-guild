import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
def kinds(extra):
    base = {"seed": 3, "grass": [0.26, 0.44, 0.60], "earth": [0.06, 0.38, 0.32], "clump": 16, "tint_scale": 96, "tint": 0.06,
            "earth_scale": 40, "earth_thr": 0.68, "blades": 0.035 * 0.6, "cluster": 4, "tufts": 0.8, "body": [2, 2],
            "encroach": 0.85, "encroach_scale": 9, "encroach_depth": 2.2, "earth_tufts": 0.012, "earth_tuft_max": 6,
            "mounds": 22, "mound_light": 0.35, "dirt_style": "clods_middle", "middle": 0.3, "sunken": True}
    base.update(extra)
    tall = dict(base, grass=[0.29, 0.415, 0.55], blades=0.06 * 0.6, cluster=5, heights=[3, 3, 4], blade_shadow=0.4,
                body=[1, 1], stroke_tone=2, mounds=16)
    return [tall, base, base]
variants = [
  ('A  B as chosen, no patches', {}),
  ('B  texture in patches, busy between', {'blade_mask': 0.55, 'blade_mask_scale': 40, 'blade_mask_floor': 0.6, 'blades': 0.035 * 0.85}),
  ('C  texture in patches, quieter between', {'blade_mask': 0.55, 'blade_mask_scale': 40, 'blade_mask_floor': 0.35, 'blades': 0.035 * 0.85}),
]
imgs = [mixed(W, H, kinds(e), zone_scale=55) for _, e in variants]
board_imgs(imgs, 'round_7.png', [l for l, _ in variants])
print('ok')
