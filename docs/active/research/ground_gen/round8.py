import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
LAWN = [0.26, 0.44, 0.60]
def kinds(body_diff, dry_amount):
    base = {"seed": 3, "grass": LAWN, "earth": [0.06, 0.38, 0.32], "clump": 16, "tint_scale": 96, "tint": 0.06,
            "earth_scale": 40, "earth_thr": 0.68, "blades": 0.035 * 0.85, "cluster": 4, "tufts": 0.8, "body": [2, 2],
            "encroach": 0.85, "encroach_scale": 9, "encroach_depth": 2.2, "earth_tufts": 0.012, "earth_tuft_max": 6,
            "mounds": 22, "mound_light": 0.35, "dirt_style": "clods_middle", "middle": 0.3, "sunken": True,
            "blade_mask": 0.55, "blade_mask_scale": 40, "blade_mask_floor": 0.6}
    mix = lambda a, b, t: [a[i] + (b[i] - a[i]) * t for i in range(3)]
    tall = dict(base, grass=mix(LAWN, [0.29, 0.415, 0.55], body_diff), strokes=[0.30, 0.40, 0.58], blades=0.06 * 0.6, cluster=5,
                heights=[3, 3, 4], blade_shadow=0.4, stroke_tone=2, mounds=16)
    dry = dict(base, grass=mix(LAWN, [0.15, 0.50, 0.48], body_diff), strokes=[0.16, 0.50, 0.62], stroke_tone=2, blades=0.03 * dry_amount,
               cluster=3, heights=[1, 2, 2], tips=0.2, mounds=18)
    return [tall, base, dry]
variants = [('A  one base colour, kinds by strokes only', 0.0, 1.0),
            ('B  kinds differ a little in colour too', 0.35, 1.0),
            ('C  one base colour, stronger dry grass', 0.0, 1.8)]
imgs = [mixed(W, H, kinds(d, a), zone_scale=55) for _, d, a in variants]
board_imgs(imgs, 'round_8.png', [v[0] for v in variants])
Z = Image.new('RGB', (140 * 4 * 3 + 24, 90 * 4), (40, 40, 40))
for i, im in enumerate(imgs): Z.paste(im.crop((150, 0, 290, 90)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 572, 0))
Z.save(os.path.join(S, 'round_8_zoom.png')); print('ok')
