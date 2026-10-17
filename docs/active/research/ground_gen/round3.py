import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
def kinds(g_lawn, g_tall, g_dry, earth):
    base = {"seed": 3, "grass": g_lawn, "earth": earth, "clump": 16, "tint_scale": 96, "tint": 0.09,
            "earth_scale": 40, "earth_thr": 0.73, "blades": 0.035, "cluster": 4, "tufts": 0.7, "body": [2, 2],
            "encroach": 0.55, "encroach_scale": 7, "earth_tufts": 0.004, "mounds": 14, "mound_light": 0.6}
    tall = dict(base, grass=g_tall, blades=0.06, cluster=5, heights=[3, 3, 4], blade_shadow=0.8, body=[1, 1], mounds=10)
    dry = dict(base, grass=g_dry, blades=0.02, cluster=3, heights=[1, 2], tips=0.3, mounds=18)
    return [tall, base, dry]
palettes = {
  'A  as round 2':       kinds([0.24, 0.47, 0.55], [0.27, 0.42, 0.55], [0.17, 0.52, 0.50], [0.08, 0.40, 0.30]),
  'B  deeper, warmer dry': kinds([0.26, 0.44, 0.60], [0.30, 0.38, 0.55], [0.13, 0.50, 0.45], [0.06, 0.38, 0.32]),
  'C  strong hue shift':  kinds([0.23, 0.47, 0.65], [0.29, 0.40, 0.60], [0.15, 0.53, 0.55], [0.05, 0.40, 0.35]),
}
imgs = [mixed(W, H, k, zone_scale=70) for k in palettes.values()]
board_imgs(imgs, 'round_3.png', list(palettes.keys()))
print('ok')
crops = []
for im in imgs:
    c = im.crop((160, 50, 300, 140)).resize((140 * 4, 90 * 4), Image.NEAREST); crops.append(c)
Z = Image.new('RGB', (140 * 4 * 3 + 24, 90 * 4), (40, 40, 40))
for i, c in enumerate(crops): Z.paste(c.convert('RGB'), (i * (140 * 4 + 12), 0))
Z.save(os.path.join(S, 'round_3_zoom.png')); print('zoom ok')
