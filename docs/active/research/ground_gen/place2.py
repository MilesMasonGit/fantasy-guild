# Placement round P2: how groves relate to the world. P1's settled natural clumps on a Region with a lake (with an
# island), a river and a rocky corner; one idea per picture against the clumps placed with no regard for the world.
import os, sys, math, random, glob
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'world6.py')).read().split("# A: core and rim")[0])
H = 563
CENTRES = [(300, 260, 'meadow'), (480, 330, 'meadow'), (200, 470, 'meadow'), (560, 500, 'meadow'), (420, 90, 'meadow'),
           (800, 60, 'mountain'), (860, 230, 'mountain'), (690, 20, 'mountain')]
LAKE = big_lake([(170, 400, 80), (250, 440, 45)], islands=[(170, 400, 16)])
RIVER = river([(110, 330), (90, 260), (40, 200), (-20, 160)], 9, 12)
WATER = lakes(LAKE, RIVER)
cache = os.path.join(HERE, 'place2_ground.png')
if not os.path.exists(cache):
    render(CENTRES, WATER).crop((0, 0, W, H)).save(cache)
GROUND = Image.open(cache).convert('RGBA')


def biome_at(x, y):
    wx = x + (warp(x, y) - 0.5) * 120; wy = y + (warp2(x, y) - 0.5) * 120
    return min(CENTRES, key=lambda c: (wx - c[0]) ** 2 + (wy - c[1]) ** 2)[2]


WF = {}
def wet(x, y):
    k = (min(W - 1, max(0, int(x))), min(H - 1, max(0, int(y))))
    if k not in WF: WF[k] = WATER(*k)
    return WF[k]


art = {}
def sprite(name):
    if name not in art:
        f = [p for p in glob.glob('public/assets/tokens/**/' + name + '.png', recursive=True)][0]
        art[name] = Image.open(f).convert('RGBA')
    return art[name]


# A map giving this tier's trees and bushes, one or two of the next tier's tree (maple), some ore.
NODES = [('t_tree_oak', 16), ('t_bush_redberry', 8), ('t_ore_vein_copper', 5), ('t_tree_maple', 2)]
HX, HY = W // 2, H // 2
HALL_R, MIN_GAP, EDGE = 144, 30, 32


def legal(x, y, placed, gap=MIN_GAP):
    if not (EDGE <= x <= W - EDGE and EDGE <= y <= H - EDGE): return False
    if (x - HX) ** 2 + (y - HY) ** 2 < HALL_R ** 2: return False
    if wet(x, y) > -4: return False
    return all((x - px) ** 2 + (y - py) ** 2 >= gap * gap for _, px, py in placed)


def band(x, y):
    return max(abs(x - HX) / (HX - 32), abs(y - HY) / (HY - 32))


def grow(rnd, name, count, cx, cy, sig, aspect, ang, placed, ok=lambda x, y: True):
    ca, sa = math.cos(ang), math.sin(ang); got = tries = 0
    while got < count and tries < 4000:
        tries += 1
        u, v = rnd.gauss(0, sig * aspect), rnd.gauss(0, sig)
        x, y = cx + u * ca - v * sa, cy + u * sa + v * ca
        r = math.hypot(u / aspect, v) / sig
        if ok(x, y) and legal(x, y, placed, MIN_GAP + 6 + 14 * min(1.5, r)):
            placed.append((name, x, y)); got += 1
    return got


def spot(rnd, placed, ok=lambda x, y: True, lo=110, draws=600):
    for _ in range(draws):
        x, y = rnd.uniform(EDGE, W - EDGE), rnd.uniform(EDGE, H - EDGE)
        if ok(x, y) and legal(x, y, placed, lo): return x, y
    return spot(rnd, placed, ok, lo * 0.7) if lo > 40 else (rnd.uniform(EDGE, W - EDGE), rnd.uniform(EDGE, H - EDGE))


def clumps(rnd, placed, name, count, where=lambda x, y: True, grove_ok=None):
    """P1 A: uneven groves, stretched, a straggler or two."""
    strag = max(0, round(count * 0.12)) if count > 4 else 0; left = count - strag
    while left > 0:
        size = min(left, rnd.choice((3, 4, 6, 8)))
        cx, cy = spot(rnd, placed, where)
        got = grow(rnd, name, size, cx, cy, rnd.uniform(28, 40) * math.sqrt(size / 6), rnd.uniform(1.0, 2.0), rnd.uniform(0, 3.14), placed, grove_ok or (lambda x, y: True))
        left -= got or size
    for _ in range(strag):
        x, y = spot(rnd, placed, where, 70); placed.append((name, x, y))


def camp_and_chest(rnd, placed, camp_ok=lambda x, y: True, chest_ok=lambda x, y: True, open_spot=True):
    for name, b, ok in (('t_camp_goblin', 0.7, camp_ok), ('t_chest_copper', 0.0, chest_ok)):
        best, bd = None, -1
        for _ in range(600):
            x, y = rnd.uniform(EDGE, W - EDGE), rnd.uniform(EDGE, H - EDGE)
            if band(x, y) < b or not ok(x, y) or not legal(x, y, placed, 50): continue
            d = min(((x - px) ** 2 + (y - py) ** 2 for _, px, py in placed), default=1e9)
            score = d if open_spot else -d
            if score > bd: best, bd = (name, x, y), score
        if best: placed.append(best)


def compose(placed, label):
    img = GROUND.copy()
    for name, x, y in sorted(placed + [('t_guildhall', HX, HY)], key=lambda t: t[2]):
        img.alpha_composite(sprite(name), (int(x - 32), int(y - 40)))
    img.save(os.path.join(HERE, f'place_2_{label}.png'))


def base(seed=21):
    """The clumps with no regard for the world: any dry spot."""
    rnd = random.Random(seed); placed = []
    for name, c in NODES: clumps(rnd, placed, name, c)
    camp_and_chest(rnd, placed); return placed


def near_water(x, y): return -50 < wet(x, y) < -10   # the river field bottoms out near -70 far away
def rocky(x, y): return biome_at(x, y) == 'mountain'
def grassy(x, y): return biome_at(x, y) != 'mountain'


def affinity(seed=22):
    """A: each kind where it belongs: ore on the rock, berries along the water, trees on the grass."""
    rnd = random.Random(seed); placed = []
    clumps(rnd, placed, 't_ore_vein_copper', 5, rocky, rocky)
    clumps(rnd, placed, 't_bush_redberry', 8, near_water, lambda x, y: wet(x, y) > -55)
    clumps(rnd, placed, 't_tree_oak', 16, grassy, grassy)
    clumps(rnd, placed, 't_tree_maple', 2, grassy, grassy)
    camp_and_chest(rnd, placed); return placed


def rarity(seed=23):
    """B: the common tier near the Hall, the next tier's trees far out towards the edge."""
    rnd = random.Random(seed); placed = []
    inner = lambda x, y: band(x, y) < 0.7
    clumps(rnd, placed, 't_tree_maple', 2, lambda x, y: band(x, y) > 0.85, lambda x, y: band(x, y) > 0.8)
    clumps(rnd, placed, 't_tree_oak', 16, inner)
    clumps(rnd, placed, 't_bush_redberry', 8, inner)
    clumps(rnd, placed, 't_ore_vein_copper', 5, inner)
    camp_and_chest(rnd, placed); return placed


def purpose(seed=24):
    """C: the camp tucked into a grove at the mat's edge, the chest hidden on the lake's island or behind trees."""
    rnd = random.Random(seed); placed = []
    # the camp first, in the outer band; then an oak grove wrapped round its inner side
    cx, cy = spot(rnd, placed, lambda x, y: 0.78 < band(x, y) < 0.88 and grassy(x, y) and abs(x - HX) > 250, 200)
    placed.append(('t_camp_goblin', cx, cy))
    toward = math.atan2(HY - cy, HX - cx)
    for i in range(9):
        a = toward + (i - 4) * 0.4
        for d in (58, 70, 85, 100, 115):
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
            if legal(x, y, placed, 34): placed.append(('t_tree_oak', x, y)); break
    for name, c in NODES:
        c -= sum(1 for n, _, _ in placed if n == name)
        if c > 0: clumps(rnd, placed, name, c)
    # the chest: on the island if it is dry enough, else the spot most hidden by trees, far from the Hall
    if legal(170, 400, placed, 30): placed.append(('t_chest_copper', 170, 400))
    else: camp_and_chest(rnd, placed, lambda x, y: False, lambda x, y: band(x, y) > 0.6, open_spot=False)
    return placed


compose(base(), 'base'); compose(affinity(), 'A'); compose(rarity(), 'B'); compose(purpose(), 'C')
print('ok', wet(170, 400))
