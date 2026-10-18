# Placement round P1: how groves look. Same budget, same meadow ground; today's layout (the game's own code via
# place_today.mjs) against three ways of growing groves. 1 px = 2 mat units; Tokens drawn at their art size, sorted by y.
import os, sys, json, math, random, subprocess, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import *
W, H = 880, 563
HERE = os.path.dirname(os.path.abspath(__file__))
cache = os.path.join(HERE, 'place_ground.png')
if not os.path.exists(cache):
    spec = json.load(open(os.path.join(HERE, 'final_spec.json')))
    mixed(W, H, [spec['tall'], spec['lawn'], spec['dry']], zone_scale=spec['zone_scale']).save(cache)
GROUND = Image.open(cache).convert('RGBA')
art = {}
def sprite(name):
    if name not in art:
        f = [p for p in glob.glob('public/assets/tokens/**/' + name + '.png', recursive=True)][0]
        art[name] = Image.open(f).convert('RGBA')
    return art[name]
BUDGET = [('t_tree_oak', 'node', 14), ('t_tree_birch', 'node', 8), ('t_tree_apple', 'node', 6), ('t_bush_redberry', 'node', 7),
          ('t_ore_vein_copper', 'node', 5), ('t_camp_goblin', 'camp', 1), ('t_chest_copper', 'treasure', 1)]
HX, HY = W // 2, H // 2
HALL_R = 144            # no generated Token's centre within the Hall's clearing plus its art
MIN_GAP = 30            # the game's own gap between centres (hitbox 80 %, overlap 40 %)
EDGE = 32


def legal(x, y, placed, gap=MIN_GAP):
    if not (EDGE <= x <= W - EDGE and EDGE <= y <= H - EDGE): return False
    if (x - HX) ** 2 + (y - HY) ** 2 < HALL_R ** 2: return False
    return all((x - px) ** 2 + (y - py) ** 2 >= gap * gap for _, px, py in placed)


def compose(placed, label):
    img = GROUND.copy()
    items = placed + [('t_guildhall', HX, HY)]
    for name, x, y in sorted(items, key=lambda t: t[2]):
        img.alpha_composite(sprite(name), (int(x - 32), int(y - 40)))
    img.save(os.path.join(HERE, f'place_1_{label}.png'))


def finish(placed, rnd):
    """Camp in the outer band's most open spot, the chest in the most open spot left (as the game)."""
    for name, band in (('t_camp_goblin', 0.7), ('t_chest_copper', 0.0)):
        best, bd = None, -1
        for _ in range(400):
            x, y = rnd.uniform(EDGE, W - EDGE), rnd.uniform(EDGE, H - EDGE)
            if max(abs(x - HX) / (HX - 32), abs(y - HY) / (HY - 32)) < band or not legal(x, y, placed, 60): continue
            d = min(((x - px) ** 2 + (y - py) ** 2 for _, px, py in placed), default=1e9)
            if d > bd: best, bd = (name, x, y), d
        if best: placed.append(best)
    return placed


entries = [{'typeId': n, 'role': r, 'count': c, 'biome': 'meadow'} for n, r, c in BUDGET]
res = subprocess.run(['node', os.path.join(HERE, 'place_today.mjs'), json.dumps(entries), '7'], capture_output=True, text=True)
out = json.loads(res.stdout)
compose([(n['typeId'], n['x'] / 2, n['y'] / 2) for n in out['nodes']], 'today')
nodes = [(n, c) for n, r, c in BUDGET if r == 'node']


def grow(rnd, name, count, cx, cy, sig, aspect, ang, placed):
    """A grove: stretched, tight in the middle and looser towards the rim."""
    ca, sa = math.cos(ang), math.sin(ang); got = 0; tries = 0
    while got < count and tries < 3000:
        tries += 1
        u, v = rnd.gauss(0, sig * aspect), rnd.gauss(0, sig)
        x, y = cx + u * ca - v * sa, cy + u * sa + v * ca
        r = math.hypot(u / aspect, v) / sig
        if legal(x, y, placed, MIN_GAP + 6 + 14 * min(1.5, r)):
            placed.append((name, x, y)); got += 1
    return got


def far_spot(rnd, placed, lo=110):
    for _ in range(500):
        x, y = rnd.uniform(EDGE, W - EDGE), rnd.uniform(EDGE, H - EDGE)
        if legal(x, y, placed, lo): return x, y
    return rnd.uniform(EDGE, W - EDGE), rnd.uniform(EDGE, H - EDGE)


def variant_a(seed=3):
    """Natural clumps: groves of uneven sizes, stretched, a few stragglers between."""
    rnd = random.Random(seed); placed = []
    for name, count in nodes:
        strag = max(0, round(count * 0.12)); left = count - strag
        while left > 0:
            size = min(left, rnd.choice((3, 4, 6, 8, 10, 12)))
            cx, cy = far_spot(rnd, placed)
            got = grow(rnd, name, size, cx, cy, rnd.uniform(28, 42) * math.sqrt(size / 6), rnd.uniform(1.0, 2.2), rnd.uniform(0, 3.14), placed)
            left -= got or size
        for _ in range(strag):
            x, y = far_spot(rnd, placed, 70); placed.append((name, x, y))
    return finish(placed, rnd)


COMPANION = {'t_tree_oak': 't_tree_birch', 't_tree_birch': 't_tree_oak', 't_tree_apple': 't_bush_redberry'}


def variant_b(seed=4):
    """Mixed edges: a main kind with its companion mixed in towards the rim; bushes as an understory along tree edges."""
    rnd = random.Random(seed); placed = []; want = dict(nodes); groves = []
    for name in ('t_tree_oak', 't_tree_birch', 't_tree_apple'):
        while want[name] > 0:
            size = min(want[name], rnd.choice((5, 7, 9)))
            cx, cy = far_spot(rnd, placed, 130); sig = 34 * math.sqrt(size / 6); asp = rnd.uniform(1.0, 1.8); ang = rnd.uniform(0, 3.14)
            groves.append((cx, cy, sig)); ca, sa = math.cos(ang), math.sin(ang); got = tries = 0
            while got < size and tries < 3000 and want[name] > 0:
                tries += 1
                u, v = rnd.gauss(0, sig * asp), rnd.gauss(0, sig); x, y = cx + u * ca - v * sa, cy + u * sa + v * ca
                r = math.hypot(u / asp, v) / sig
                kind = name; comp = COMPANION.get(name)
                if comp and r > 0.9 and want.get(comp, 0) > 0 and rnd.random() < 0.5: kind = comp
                if legal(x, y, placed, MIN_GAP + 6 + 14 * min(1.5, r)):
                    placed.append((kind, x, y)); want[kind] -= 1
                    if kind == name: got += 1
    tries = 0
    while want['t_bush_redberry'] > 0 and tries < 5000:
        tries += 1; cx, cy, sig = rnd.choice(groves); a = rnd.uniform(0, 6.28); d = sig * rnd.uniform(1.6, 2.4)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        if legal(x, y, placed, 34): placed.append(('t_bush_redberry', x, y)); want['t_bush_redberry'] -= 1
    cx, cy = far_spot(rnd, placed, 140); grow(rnd, 't_ore_vein_copper', want['t_ore_vein_copper'], cx, cy, 30, 1.6, rnd.uniform(0, 3), placed)
    return finish(placed, rnd)


def drift(rnd, name, count, placed, length, jitter, gap):
    """A grove along a wandering line: a belt of trees or a hedgerow of bushes."""
    x0, y0 = far_spot(rnd, placed, 120); ang = rnd.uniform(0, 6.28); pts = []
    for i in range(int(length / 6)):
        ang += rnd.uniform(-0.25, 0.25); x0 += math.cos(ang) * 6; y0 += math.sin(ang) * 6; pts.append((x0, y0))
    got = tries = 0
    while got < count and tries < 3000:
        tries += 1; px, py = rnd.choice(pts); x, y = px + rnd.gauss(0, jitter), py + rnd.gauss(0, jitter)
        if legal(x, y, placed, gap): placed.append((name, x, y)); got += 1


def variant_c(seed=5):
    """Drifts: belts of trees, hedgerows of bushes, ore in one outcrop."""
    rnd = random.Random(seed); placed = []
    for name, count in nodes:
        if name == 't_ore_vein_copper':
            cx, cy = far_spot(rnd, placed, 140); grow(rnd, name, count, cx, cy, 26, 1.3, 0, placed); continue
        parts = [count] if count <= 7 else [count // 2, count - count // 2]
        for c in parts:
            if 'bush' in name: drift(rnd, name, c, placed, 50 * c, 6, 34)
            else: drift(rnd, name, c, placed, 38 * c, 20, 40)
    return finish(placed, rnd)


compose(variant_a(), 'A'); compose(variant_b(), 'B'); compose(variant_c(), 'C')
print('ok, today unplaced:', out['unplaced'])
