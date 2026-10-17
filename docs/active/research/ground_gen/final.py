import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
LAWN = [0.26, 0.44, 0.60]
base = {"seed": 3, "grass": LAWN, "earth": [0.06, 0.38, 0.32], "clump": 16, "tint_scale": 96, "tint": 0.06,
        "earth_scale": 40, "earth_thr": 0.68, "blades": 0.035 * 0.85, "cluster": 4, "tufts": 0.8, "body": [1, 2],
        "encroach": 0.85, "encroach_scale": 9, "encroach_depth": 2.2, "earth_tufts": 0.012, "earth_tuft_max": 6,
        "mounds": 16, "mound_light": 0.5, "dirt_style": "clods_middle", "middle": 0.3, "sunken": True,
        "blade_mask": 0.55, "blade_mask_scale": 40, "blade_mask_floor": 0.6}
tall = dict(base, strokes=[0.30, 0.36, 0.58], blades=0.06 * 0.6, cluster=5, heights=[3, 3, 4], blade_shadow=0.55, stroke_tone=2, mounds=12)
dry = dict(base, strokes=[0.16, 0.50, 0.62], stroke_tone=2, blades=0.03 * 1.8, cluster=3, heights=[1, 2, 2], tips=0.2, mounds=18)
img = mixed(W, H, [tall, base, dry], zone_scale=55)
imgs = [img, mixed(W, H, [dict(tall, seed=7), dict(base, seed=7), dict(dry, seed=7)], zone_scale=55, seed=17)]
board_imgs(imgs, 'final.png', ['Final prototype', 'Same rules, another Region seed'])
Z = img.crop((150, 0, 290, 90)).resize((560, 360), Image.NEAREST); Z2 = img.crop((150, 100, 290, 190)).resize((560, 360), Image.NEAREST)
Q = Image.new('RGB', (1132, 360), (40, 40, 40)); Q.paste(Z.convert('RGB'), (0, 0)); Q.paste(Z2.convert('RGB'), (572, 0)); Q.save(os.path.join(S, 'final_zoom.png'))
json.dump({'lawn': base, 'tall': tall, 'dry': dry, 'zone_scale': 55, 'zone_ragged': 0.35}, open(os.path.join(S, 'final_spec.json'), 'w'), indent=1)
print('ok')
