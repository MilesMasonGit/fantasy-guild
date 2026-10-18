# Mat scale: a full 1920 x 1080 screen mock-up of a busy mid-game Region at 3x (and 2x for comparison). The play area
# is measured from the game at 1920 x 1080 (left bar 152, top bar 30, area 1740 x 986); the mat fits its height. Nodes by
# the game's own Layout.js (place_today.mjs); buildings round the Hall, 8 heroes at work, goblins at their camp, a pond
# carved into the most open gap after placing (as the game's small waters). The side bar and top bar are approximate.
import os, sys, json, math, random, subprocess, glob
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen import *
spec = json.load(open(os.path.join(HERE, 'final_spec.json')))
art = {}
def load(path):
    if path not in art: art[path] = Image.open(path).convert('RGBA')
    return art[path]
def token(name):
    return load([p for p in glob.glob('public/assets/tokens/**/' + name + '.png', recursive=True)][0])
def frame(sheet, col, row, size=64):
    return load(sheet).crop((col * size, row * size, col * size + size, row * size + size))


BUDGET = [('t_tree_oak', 'node', 12), ('t_tree_birch', 'node', 4), ('t_tree_apple', 'node', 6), ('t_bush_redberry', 'node', 6),
          ('t_ore_vein_copper', 'node', 5), ('t_camp_goblin', 'camp', 1), ('t_chest_copper', 'treasure', 1)]
BUILDINGS = ['t_sawmill', 't_workbench', 't_anvil_copper', 't_forge', 't_campfire', 't_cooking_pot', 't_kiln', 't_alembic_small',
             't_windmill', 't_foundation_wood', 't_foundation_stone']
HEROES = ['hn_fighter', 'hn_ranger', 'hn_rogue', 'hn_wizard', 'hn_recruit', 'hn_fighter', 'hn_ranger', 'hn_recruit']
AREA_X, AREA_Y, AREA_W, AREA_H = 152, 30, 1740, 986


def mock(k, dense=1.0, label=None):
    W = int(min(AREA_W, AREA_H / 0.64) // k); H = int(W * 0.64)       # the mat in art pixels
    entries = [{'typeId': n, 'role': r, 'count': c if r != 'node' else round(c * dense), 'biome': 'meadow'} for n, r, c in BUDGET]
    out = json.loads(subprocess.run(['node', os.path.join(HERE, 'place_today.mjs'), json.dumps(entries), '11', str(W * 2)], capture_output=True, text=True).stdout)
    nodes = [(n['typeId'], n['x'] / 2, n['y'] / 2) for n in out['nodes']]
    hx, hy = W / 2, H / 2
    rnd = random.Random(5)
    items = list(nodes) + [('t_guildhall', hx, hy)]
    # player buildings in a loose ring round the Hall (inside its clearing, where the player builds)
    placed = [(x, y, token(n).width > 64) for n, x, y in items]
    for i, b in enumerate(BUILDINGS + (['t_kitchen_cozy', 't_forge_major', 't_lumberpile', 't_market_fish'] if dense > 1 else [])):
        for _ in range(400):
            a = rnd.uniform(0, 6.283); d = rnd.uniform(44, 120)
            x, y = hx + math.cos(a) * d * 1.25, hy + math.sin(a) * d
            big = token(b).width > 64
            gap = 72 if big else 40; edge = 64 if big else 32
            if edge < x < W - edge and edge < y < H - 16 and all((x - px) ** 2 + (y - py) ** 2 > (gap + (24 if pb else 0)) ** 2 for px, py, pb in placed):
                items.append((b, x, y)); placed.append((x, y, big)); break
    # heroes at work: beside a Token of the kind they work
    jobs = ['t_tree_oak', 't_tree_oak', 't_ore_vein_copper', 't_anvil_copper', 't_campfire', 't_bush_redberry', 't_tree_apple', 't_camp_goblin']
    sprites = []
    for hero, job in zip(HEROES, jobs):
        cands = [(x, y) for n, x, y in items if n == job]
        if not cands: continue
        x, y = rnd.choice(cands); side = rnd.choice((-1, 1))
        f = frame(f'public/assets/heroes/{hero}_sheet.png', rnd.randrange(8), 0)
        if side > 0: f = f.transpose(Image.FLIP_LEFT_RIGHT)
        sprites.append((f, min(W - 30, max(30, x - side * 26)), min(H - 20, y + 6)))
    camp = [(x, y) for n, x, y in items if n == 't_camp_goblin']
    if camp:
        for dx, dy in ((22, 18), (-24, 20)):
            sprites.append((frame('public/assets/enemies/goblin/e_goblin_sheet.png', 0, 0), camp[0][0] + dx, camp[0][1] + dy))
    # ground and a pond in the most open gap
    img = mixed(W, H, [spec['tall'], spec['lawn'], spec['dry']], zone_scale=spec['zone_scale'])
    best, bd = None, 0
    pts = [(x, y) for _, x, y in items] + [(x, y) for _, x, y in sprites]
    for _ in range(1500):
        x, y = rnd.uniform(40, W - 40), rnd.uniform(40, H - 40)
        d = min(math.hypot(x - px, y - py) for px, py in pts)
        if d > bd: best, bd = (x, y), d
    if best and bd > 40:
        r = min(26, bd - 22); cx, cy = best; nz_ = vnoise(9, random.Random(3))
        img = water_field(img, lambda x, y: r - math.hypot(x - cx, (y - cy) * 1.2) + (nz_(x, y) - 0.5) * 8, {'sea': [0.50, 0.44, 0.52], 'bank': [0.08, 0.34, 0.30]})
    draw = [(token(n), x, y) for n, x, y in items] + sprites
    for spr, x, y in sorted(draw, key=lambda t: t[2]):
        img.alpha_composite(spr, (int(x - spr.width / 2), int(y - spr.height + 24)))
    mat = img.resize((W * k, H * k), Image.NEAREST)
    # the screen: the wood table under a dark veil, the side bar with its orbs, the top bar
    screen = Image.new('RGBA', (1920, 1080))
    tile = load('public/assets/ui/u_table_wood_planks_oak.png').resize((256, 256), Image.NEAREST)
    for ty in range(0, 1080, 256):
        for tx in range(0, 1920, 256): screen.alpha_composite(tile, (tx, ty))
    screen.alpha_composite(Image.new('RGBA', (1920, 1080), (0, 0, 0, 115)))
    bar = Image.new('RGBA', (AREA_X, 1080), (24, 20, 18, 235)); screen.alpha_composite(bar, (0, 0))
    for i, orb in enumerate(['u_orb_purple', 'u_orb_yellow', 'u_orb_green', 'u_orb_lblu', 'u_orb_red']):
        o = load(f'public/assets/ui/{orb}.png').resize((96, 96), Image.NEAREST); screen.alpha_composite(o, (28, 40 + i * 140))
    screen.alpha_composite(Image.new('RGBA', (1920 - AREA_X, AREA_Y), (24, 20, 18, 235)), (AREA_X, 0))
    mx = AREA_X + (AREA_W - W * k) // 2; my = AREA_Y + (AREA_H - H * k) // 2
    screen.alpha_composite(mat, (mx, my))
    count = len(items) + len(sprites)
    screen.convert('RGB').save(os.path.join(HERE, f'scale_full_{label or str(k) + "x"}.png'))
    print(k, 'x: mat', W * 2, 'x', H * 2, 'u;', len(nodes), 'nodes,', len(items) - len(nodes) - 1, 'buildings,', len(sprites), 'heroes and goblins; unplaced', out['unplaced'])


mock(3); mock(3, 1.5, '3x_dense'); mock(2)
