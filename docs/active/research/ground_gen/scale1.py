# Pixel-size rounds S1 (fractional fits, superseded) and S2 (whole-number scales): the same Region on smaller mats, each scaled up to fill the same 1600 x 1024 screen area, so
# each art pixel takes more screen pixels. Layout by the game's own Layout.js (place_today.mjs) for each mat size;
# ground the settled meadow; Tokens at their art size (1 art px = 2 mat units); the whole mat scaled nearest-neighbour
# like the game's CSS transform with crisp pixels.
import os, sys, json, subprocess, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
HERE = os.path.dirname(os.path.abspath(__file__))
SCREEN_W = 1600
spec = json.load(open(os.path.join(HERE, 'final_spec.json')))
art = {}
def sprite(name):
    if name not in art:
        f = [p for p in glob.glob('public/assets/tokens/**/' + name + '.png', recursive=True)][0]
        art[name] = Image.open(f).convert('RGBA')
    return art[name]


BUDGET = [('t_tree_oak', 'node', 12), ('t_tree_birch', 'node', 6), ('t_tree_apple', 'node', 6), ('t_bush_redberry', 'node', 7),
          ('t_ore_vein_copper', 'node', 5), ('t_camp_goblin', 'camp', 1), ('t_chest_copper', 'treasure', 1)]
entries = [{'typeId': n, 'role': r, 'count': c, 'biome': 'meadow'} for n, r, c in BUDGET]
# Each art pixel shown as exactly k screen pixels on a 1600-pixel-wide mat area: the mat is 1600 / k art pixels wide
# (2 mat units per art pixel, as the game).
for k_int, clearing, label in ((2, None, '2x'), (3, None, '3x'), (4, None, '4x'), (4, 112, '4x_small_ring')):
    W = 1600 // k_int; H = round(W * 0.64); mw = W * 2; mh = H * 2
    res = subprocess.run(['node', os.path.join(HERE, 'place_today.mjs'), json.dumps(entries), '7', str(mw)] + ([str(clearing)] if clearing else []), capture_output=True, text=True)
    out = json.loads(res.stdout)
    img = mixed(W, H, [spec['tall'], spec['lawn'], spec['dry']], zone_scale=spec['zone_scale'])
    items = [(n['typeId'], n['x'] / 2, n['y'] / 2) for n in out['nodes']] + [('t_guildhall', W / 2, H / 2)]
    for name, x, y in sorted(items, key=lambda t: t[2]):
        img.alpha_composite(sprite(name), (int(x - 32), int(y - 40)))
    img = img.resize((W * k_int, H * k_int), Image.NEAREST)
    img.save(os.path.join(HERE, f'scale_2_{label}.png'))
    print(label, 'mat', mw, 'x', mh, 'u; placed', len(out['nodes']), 'unplaced', out['unplaced'])
