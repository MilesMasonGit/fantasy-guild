import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
def kinds(calm):
    base = {"seed": 3, "grass": [0.26, 0.44, 0.60], "earth": [0.06, 0.38, 0.32], "clump": 16, "tint_scale": 96, "tint": 0.09,
            "earth_scale": 40, "earth_thr": 0.68, "blades": 0.035, "cluster": 4, "tufts": 0.8, "body": [2, 2],
            "encroach": 0.85, "encroach_scale": 9, "encroach_depth": 2.2, "earth_tufts": 0.012, "earth_tuft_max": 6,
            "mounds": 14, "mound_light": 0.6, "dirt_style": "clods_middle", "middle": 0.3, "sunken": True}
    tall = dict(base, grass=[0.30, 0.38, 0.55], blades=0.06, cluster=5, heights=[3, 3, 4], blade_shadow=0.8, body=[1, 1], mounds=10)
    dry = dict(base, grass=[0.13, 0.50, 0.45], blades=0.02, cluster=3, heights=[1, 2], tips=0.3, mounds=18)
    ks = [tall, base, dry]
    for k in ks:
        k.update(calm.get('all', {}))
    tall.update(calm.get('tall', {})); dry.update(calm.get('dry', {}))
    return ks, calm.get('zone_scale', 70), calm.get('drop_dry', False)
variants = [
  ('A  everything at half', {'all': {'blades_f': 0.5, 'tint': 0.06, 'mounds': 22, 'mound_light': 0.35, 'earth_tufts': 0.006}, 'zone_scale': 100}),
  ('B  calmer kinds: lawn + soft tall', {'all': {'blades_f': 0.6, 'tint': 0.06, 'mounds': 22, 'mound_light': 0.35}, 'tall': {'stroke_tone': 2, 'blade_shadow': 0.4}, 'zone_scale': 110, 'drop_dry': True}),
  ('C  texture in patches, calm between', {'all': {'blade_mask': 0.55, 'blade_mask_scale': 40, 'tint': 0.06, 'mounds': 22, 'mound_light': 0.35}, 'zone_scale': 100}),
]
imgs = []
for label, calm in variants:
    ks, zs, drop = kinds(calm)
    for k in ks:
        if 'blades_f' in k: k['blades'] = k['blades'] * k.pop('blades_f')
    if drop: ks = [ks[0], ks[1], ks[1]]
    imgs.append(mixed(W, H, ks, zone_scale=zs))
board_imgs(imgs, 'round_6.png', [l for l, _ in variants])
print('ok')
