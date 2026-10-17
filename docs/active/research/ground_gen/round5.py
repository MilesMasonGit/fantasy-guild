import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
def kinds(thr):
    base = {"seed": 3, "grass": [0.26, 0.44, 0.60], "earth": [0.06, 0.38, 0.32], "clump": 16, "tint_scale": 96, "tint": 0.09,
            "earth_scale": 40, "earth_thr": thr, "blades": 0.035, "cluster": 4, "tufts": 0.8, "body": [2, 2],
            "encroach": 0.85, "encroach_scale": 9, "encroach_depth": 2.2, "earth_tufts": 0.012, "earth_tuft_max": 6,
            "mounds": 14, "mound_light": 0.6, "dirt_style": "clods_middle", "middle": 0.3, "sunken": True}
    tall = dict(base, grass=[0.30, 0.38, 0.55], blades=0.06, cluster=5, heights=[3, 3, 4], blade_shadow=0.8, body=[1, 1], mounds=10)
    dry = dict(base, grass=[0.13, 0.50, 0.45], blades=0.02, cluster=3, heights=[1, 2], tips=0.3, mounds=18)
    return [tall, base, dry]
amounts = [(0.65, 'A  a little less earth'), (0.68, 'B  less'), (0.71, 'C  much less')]
imgs = [mixed(W, H, kinds(t), zone_scale=70) for t, _ in amounts]
board_imgs(imgs, 'round_5.png', [l for _, l in amounts])
Z = Image.new('RGB', (140 * 4 * 3 + 24, 90 * 4), (40, 40, 40))
for i, im in enumerate(imgs): Z.paste(im.crop((160, 50, 300, 140)).resize((560, 360), Image.NEAREST).convert('RGB'), (i * 572, 0))
Z.save(os.path.join(S, 'round_5_zoom.png')); print('ok')
