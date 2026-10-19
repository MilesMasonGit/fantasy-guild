# Visual style V6: edge scenery. On the settled look (Clean ground at 2x, quieter decorations, darker rim, hard
# shadows), big pieces poking in from beyond the mat's edge: tree canopies, boulders. Stand-ins are Token art at 2x
# pixel size (the ground's grid), darkened, never over a Token. Two densities: corners only, and along every edge.
import os, sys, math, random, glob
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'style5.py')).read().split("STEPS = 'steps' in sys.argv")[0])
from PIL import ImageEnhance
OUT6 = os.path.join(HERE, 'style6')
os.makedirs(OUT6, exist_ok=True)


def art(name, k=2):
    f = [p for p in glob.glob('public/assets/tokens/**/' + name + '.png', recursive=True)][0]
    a = Image.open(f).convert('RGBA'); a = a.resize((a.width * k, a.height * k), Image.NEAREST)
    rgb = ImageEnhance.Brightness(a.convert('RGB')).enhance(0.6); rgb = ImageEnhance.Color(rgb).enhance(0.8)
    out = rgb.convert('RGBA'); out.putalpha(a.split()[3]); return out


PIECES = {
    'meadow': ['t_tree_oak', 't_tree_oak', 't_tree_birch'],
    'forest': ['t_tree_oak', 't_tree_fir', 't_tree_fir', 't_tree_maple'],
    'mountain': ['t_vein_granite', 't_vein_basalt', 't_vein_granite', 't_tree_fir'],
    'cherry_grove': ['t_tree_cherry', 't_tree_cherry', 't_tree_peach', 't_tree_oak'],
}


def edge_scenery(mat, mask, names, corners_only, seed=3):
    r = random.Random(seed); out = mat.copy().convert('RGBA'); mp = mask.load(); placed = []
    spots = []
    step = 150 if corners_only else 52
    per = []
    for x in range(0, W + 1, step): per += [(x, 0, 0, -1), (x, H, 0, 1)]
    for y in range(step, H, step): per += [(0, y, -1, 0), (W, y, 1, 0)]
    if corners_only: per = [p for p in per if (p[0] in (0, W) or p[0] < 160 or p[0] > W - 160) and (p[1] in (0, H) or p[1] < 140 or p[1] > H - 140)]
    for x, y, dx, dy in per:
        out_by = r.uniform(18, 46)
        spots.append((x + dx * out_by + r.uniform(-14, 14) * (dy != 0), y + dy * out_by + r.uniform(-14, 14) * (dx != 0)))
    for sx, sy in spots:
        piece = art(r.choice(names), r.choice((2, 3)))
        if r.random() < 0.5: piece = piece.transpose(Image.FLIP_LEFT_RIGHT)
        x0, y0 = int(sx - piece.width / 2), int(sy - piece.height / 2)
        # never over a Token: skip a piece whose opaque pixels would touch one
        pa = piece.split()[3].load(); hit = False
        for yy in range(0, piece.height, 3):
            for xx in range(0, piece.width, 3):
                X, Y = x0 + xx, y0 + yy
                if pa[xx, yy] and 0 <= X < W and 0 <= Y < H and mp[X, Y]: hit = True; break
            if hit: break
        if hit or any(abs(sx - px) < 34 and abs(sy - py) < 34 for px, py in placed): continue
        placed.append((sx, sy)); layer = Image.new('RGBA', out.size); layer.paste(piece, (x0, y0), piece); out.alpha_composite(layer)
    return out.convert('RGB')


for b in PIECES:
    ground = Image.open(os.path.join(CAP, f'{b}_ground.png')).convert('RGB')
    full = Image.open(os.path.join(CAP, f'{b}_full.png')).convert('RGB')
    mask = tokens_mask(ground, full)
    sat, tex, dh, bc, bm = P[b]
    base = shadowed(colour_only(chunky(quiet_decor(ground), 2), sat, dh, bc), full, mask)
    on_table(rim(base)).save(os.path.join(OUT6, f'{b}_0_settled.png'))
    for label, corners in (('1_corners', True), ('2_edges', False)):
        on_table(rim(edge_scenery(base, mask, PIECES[b], corners))).save(os.path.join(OUT6, f'{b}_{label}.png'))
    print(b)
