# Placement round P3: biome layouts. A meadow + forest + mountain Region; groves placed by P1/P2's rules into the
# layout's zones, then the ground drawn from the placed nodes (the game's rule: a cell takes the biome of the nearest
# node in reach, else the main biome), each biome's water carved into its own ground after placing.
import os, sys, math, random, glob
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'world6.py')).read().split("# A: core and rim")[0])
H = 563
art = {}
def sprite(name):
    if name not in art:
        f = [p for p in glob.glob('public/assets/tokens/**/' + name + '.png', recursive=True)][0]
        art[name] = Image.open(f).convert('RGBA')
    return art[name]


# Main meadow (apple trees, redberry bushes), a forest map (oaks, two birches as its next tier), a mountain map (copper).
KINDS = [('t_tree_oak', 'forest', 12), ('t_tree_birch', 'forest', 2), ('t_ore_vein_copper', 'mountain', 7),
         ('t_tree_apple', 'meadow', 6), ('t_bush_redberry', 'meadow', 8)]
MAIN = 'meadow'
HX, HY = W // 2, H // 2
HALL_R, MIN_GAP, EDGE, REACH = 144, 30, 32, 128


def band(x, y): return max(abs(x - HX) / (HX - 32), abs(y - HY) / (HY - 32))


def legal(x, y, placed, gap=MIN_GAP):
    if not (EDGE <= x <= W - EDGE and EDGE <= y <= H - EDGE): return False
    if (x - HX) ** 2 + (y - HY) ** 2 < HALL_R ** 2: return False
    return all((x - px) ** 2 + (y - py) ** 2 >= gap * gap for _, _, px, py in placed)


def grow(rnd, name, biome, count, cx, cy, sig, aspect, ang, placed, ok):
    ca, sa = math.cos(ang), math.sin(ang); got = tries = 0
    while got < count and tries < 4000:
        tries += 1
        u, v = rnd.gauss(0, sig * aspect), rnd.gauss(0, sig)
        x, y = cx + u * ca - v * sa, cy + u * sa + v * ca
        r = math.hypot(u / aspect, v) / sig
        if ok(x, y) and legal(x, y, placed, MIN_GAP + 6 + 14 * min(1.5, r)):
            placed.append((name, biome, x, y)); got += 1
    return got


def spot(rnd, placed, ok, lo=110):
    while lo > 30:
        for _ in range(600):
            x, y = rnd.uniform(EDGE, W - EDGE), rnd.uniform(EDGE, H - EDGE)
            if ok(x, y) and legal(x, y, placed, lo): return x, y
        lo *= 0.7
    return None


def clumps(rnd, placed, name, biome, count, where):
    strag = max(0, round(count * 0.12)) if count > 4 else 0; left = count - strag
    while left > 0:
        size = min(left, rnd.choice((3, 4, 6, 8)))
        p = spot(rnd, placed, where)
        if not p: break
        got = grow(rnd, name, biome, size, p[0], p[1], rnd.uniform(28, 40) * math.sqrt(size / 6), rnd.uniform(1.0, 2.0), rnd.uniform(0, 3.14), placed, where)
        left -= got or size
    for _ in range(strag):
        p = spot(rnd, placed, where, 70)
        if p: placed.append((name, biome, p[0], p[1]))


def zone_today(biome):
    return lambda x, y: True


def zone_core_rim(rnd):
    """The main biome in the core round the Hall, each other biome an arc of the rim."""
    a0 = rnd.uniform(0, 6.28)
    arcs = {'forest': (a0, a0 + 3.4), 'mountain': (a0 + 3.4, a0 + 6.28)}
    def zone(biome):
        if biome == MAIN: return lambda x, y: band(x, y) < 0.6
        lo, hi = arcs[biome]
        def ok(x, y):
            a = math.atan2(y - HY, x - HX) % 6.283
            return band(x, y) > 0.55 and any(lo <= a + k * 6.283 <= hi for k in (0, 1))
        return ok
    return zone


def zone_patchwork(rnd):
    """Patches: a handful of seeds over the mat, each a biome; a spot belongs to the nearest seed's biome."""
    seeds = []
    order = ['forest', 'mountain', 'meadow', 'forest', 'mountain', 'meadow', 'forest']
    while len(seeds) < len(order):
        x, y = rnd.uniform(60, W - 60), rnd.uniform(60, H - 60)
        if all((x - a) ** 2 + (y - b) ** 2 > 190 ** 2 for a, b, _ in seeds) and (x - HX) ** 2 + (y - HY) ** 2 > 150 ** 2:
            seeds.append((x, y, order[len(seeds)]))
    def zone(biome):
        def ok(x, y):
            wx = x + (warp(x, y) - 0.5) * 100; wy = y + (warp2(x, y) - 0.5) * 100
            return min(seeds, key=lambda s: (wx - s[0]) ** 2 + (wy - s[1]) ** 2)[2] == biome
        return ok
    return zone


def lay(zone, rnd):
    placed = []
    # P2 C: the camp first, at the edge, in the forest's ground if it can, wrapped in its grove
    camp_ok = lambda x, y: 0.78 < band(x, y) < 0.9 and zone('forest')(x, y)
    p = spot(rnd, placed, camp_ok, 200) or spot(rnd, placed, lambda x, y: band(x, y) > 0.78, 200)
    placed.append(('t_camp_goblin', 'forest', *p))
    toward = math.atan2(HY - p[1], HX - p[0]); ring = 0
    for i in range(9):
        a = toward + (i - 4) * 0.4
        for d in (58, 70, 85, 100):
            x, y = p[0] + math.cos(a) * d, p[1] + math.sin(a) * d
            if ring < 5 and legal(x, y, placed, 34): placed.append(('t_tree_oak', 'forest', x, y)); ring += 1; break
    for name, biome, count in KINDS:
        count -= sum(1 for n, *_ in placed if n == name)
        where = zone(biome)
        if name == 't_tree_birch':                       # P2 B: the next tier further out
            base = where; where = lambda x, y, base=base: base(x, y) and band(x, y) > 0.75
        clumps(rnd, placed, name, biome, count, where)
    return placed


def ground_and_water(placed, rnd, label):
    nodes = [(x, y, b) for n, b, x, y in placed if n != 't_camp_goblin']
    centres = list(nodes)
    for gy in range(0, H + 1, 64):                       # beyond any node's reach, the main biome
        for gx in range(0, W + 1, 64):
            if all((gx - x) ** 2 + (gy - y) ** 2 > REACH ** 2 for x, y, _ in nodes): centres.append((gx, gy, MAIN))
    ws = []
    # each biome's water in its own ground, in the most open spot there: the meadow a lake, the forest a pond, the mountain a tarn
    def biome_of(x, y): return min(centres, key=lambda c: (x - c[0]) ** 2 + (y - c[1]) ** 2)[2]
    for biome, r in (('meadow', 58), ('forest', 26), ('mountain', 22)):
        best, bd = None, -1
        for _ in range(500):
            x, y = rnd.uniform(60, W - 60), rnd.uniform(60, H - 60)
            if biome_of(x, y) != biome or (x - HX) ** 2 + (y - HY) ** 2 < (HALL_R + r + 30) ** 2: continue
            if any((x - wx) ** 2 + (y - wy) ** 2 < (r + wr + 40) ** 2 for wx, wy, wr in ws): continue
            d = min((x - px) ** 2 + (y - py) ** 2 for _, _, px, py in placed)
            if d > bd: best, bd = (x, y), d
        if best:
            rr = min(r, math.sqrt(bd) - 34)
            if rr > 12: ws.append((best[0], best[1], rr))
    water = lakes(*[big_lake([(x, y, r), (x + r * 0.4, y - r * 0.25, r * 0.6)]) for x, y, r in ws]) if ws else (lambda x, y: -99)
    img = render(centres, water).crop((0, 0, W, H))
    for name, x, y in sorted([(n, x, y) for n, _, x, y in placed] + [('t_guildhall', HX, HY)], key=lambda t: t[2]):
        img.alpha_composite(sprite(name), (int(x - 32), int(y - 40)))
    img.save(os.path.join(HERE, f'place_3_{label}.png'))


for label, make, seed in (('today', lambda r: zone_today, 31), ('A', zone_core_rim, 32), ('B', zone_patchwork, 33)):
    rnd = random.Random(seed)
    ground_and_water(lay(make(rnd), rnd), rnd, label)
print('ok')
