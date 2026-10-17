import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 320, 200
spec = json.load(open(os.path.join(S, 'final_spec.json')))
fspec = json.load(open(os.path.join(S, 'forest_spec.json')))
def k(name, **kw):
    d = dict(spec[name]); d.update(kw); return d
# --- Yellowstone: dark forest floor (needles, ferns), milky light-blue sulphur springs with pale yellow crust rims
def dark_forest(GR, earth):
    fern = k('tall', grass=GR, strokes=[GR[0] + 0.04, GR[1] - 0.06, 0.50], heights=[3, 4, 4], cluster=6, blades=0.03)
    needles = k('dry', grass=GR, strokes=[0.07, GR[1] - 0.02, 0.35], stroke_tone=2, blades=0.07, cluster=3, heights=[1, 2], tips=0.1)
    moss = k('lawn', grass=GR, blades=0.015)
    ks = [fern, moss, needles]
    for d in ks: d.update(earth=earth, tint=0.10, earth_thr=0.72)
    return mixed(W, H, ks, zone_scale=60)
spring_rings = lambda halo: [(0.42, (150, 214, 228)), (0.62, (122, 196, 214)), (0.74, (176, 222, 226)), (0.82, (226, 214, 120)), (0.88, (200, 186, 96))] + ([(1.0, (196, 196, 180))] if halo else [])
YA = pools(W, H, dark_forest([0.40, 0.28, 0.40], [0.06, 0.26, 0.25]), {'count': 4, 'radius': (14, 24), 'rings': spring_rings(False), 'seed': 21})
YB = pools(W, H, dark_forest([0.40, 0.28, 0.40], [0.06, 0.26, 0.25]), {'count': 2, 'radius': (40, 60), 'rings': spring_rings(False), 'seed': 22})
YC = pools(W, H, dark_forest([0.42, 0.25, 0.35], [0.06, 0.24, 0.22]), {'count': 3, 'radius': (22, 34), 'rings': spring_rings(True), 'seed': 23})
board_imgs([YA, YB, YC], 'new_2_ys.png', ['A  dark forest, small springs', 'B  big sulphur lakes', 'C  moodier, with pale crust halos'])
# --- Cherry grove: pink and fantasy
petal = lambda col, blades: dict(strokes=col, stroke_tone=2, blades=blades, cluster=3, heights=[1, 1, 2], tips=0.35)
CA_body = [0.36, 0.44, 0.45]   # mint grass under a pink petal carpet
CA = mixed(W, H, [k('dry', grass=CA_body, **petal([0.93, 0.72, 0.70], 0.22)), k('dry', grass=CA_body, **petal([0.95, 0.80, 0.55], 0.12)),
                  k('dry', grass=CA_body, **petal([0.90, 0.62, 0.70], 0.16))], zone_scale=50)
CB_body = [0.88, 0.62, 0.38]   # pink-lavender moss ground, magenta and white petals
CB = mixed(W, H, [k('dry', grass=CB_body, earth=[0.05, 0.40, 0.30], **petal([0.92, 0.55, 0.75], 0.06)),
                  k('lawn', grass=CB_body, earth=[0.05, 0.40, 0.30], strokes=[0.86, 0.70, 0.35], blades=0.03),
                  k('dry', grass=CB_body, earth=[0.05, 0.40, 0.30], **petal([0.0, 0.92, 0.20], 0.05))], zone_scale=55)
CC_body = [0.80, 0.50, 0.40]   # deep fantasy: violet-pink ground, glowing white and hot-pink petals
CC = mixed(W, H, [k('dry', grass=CC_body, earth=[0.75, 0.32, 0.25], **petal([0.93, 0.62, 0.85], 0.08)),
                  k('tall', grass=CC_body, earth=[0.75, 0.32, 0.25], strokes=[0.78, 0.40, 0.45], blades=0.03),
                  k('dry', grass=CC_body, earth=[0.75, 0.32, 0.25], **petal([0.55, 0.92, 0.25], 0.05))], zone_scale=55)
board_imgs([CA, CB, CC], 'new_2_cg.png', ['A  mint grass under a pink petal carpet', 'B  pink-lavender moss, magenta and white petals', 'C  violet-pink ground, glowing petals'])
print('ok')
