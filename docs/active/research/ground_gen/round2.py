import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
base = {"seed": 3, "grass": [0.24, 0.47, 0.55], "earth": [0.08, 0.40, 0.30], "clump": 16, "tint_scale": 96, "tint": 0.09,
        "earth_scale": 40, "earth_thr": 0.75, "blades": 0.035, "cluster": 4, "tufts": 0.6, "body": [2, 2]}
lawn = dict(base)
tall = dict(base, grass=[0.27, 0.42, 0.55], blades=0.06, cluster=5, heights=[3, 3, 4], blade_shadow=0.8, body=[1, 1])
dry = dict(base, grass=[0.17, 0.52, 0.50], blades=0.02, cluster=3, heights=[1, 2], tips=0.3, body=[2, 2])
W, H = 320, 200
a = ground(W, H, base)
b = mixed(W, H, [tall, lawn, lawn], zone_scale=70)
c = mixed(W, H, [tall, lawn, dry], zone_scale=70)
board_imgs([a, b, c], 'round_2.png', ['A  tufts on a calm body', 'B  + tall grass zones', 'C  + tall and dry grass zones'])
json.dump({'2': {'base': base, 'tall': tall, 'dry': dry}}, open(os.path.join(S, 'round2.json'), 'w'), indent=1)
print('ok')
