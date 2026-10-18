# Visual style V5, on the owner's pick (Clean ground at 2x pixel size, the game's hard shadow under Tokens): a worn
# clearing round the Hall, footpaths to the groves, quieter ground decorations, and two mat edges. Each step adds one
# thing, so each can be judged alone. Real in-game captures (capture_biomes.mjs); everything stays hard-edged pixels.
import os, sys, math, random
from PIL import Image, ImageFilter, ImageChops, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, 'style4.py')).read().split(chr(10) + 'for b in BIOMES:')[0])
sys.path.insert(0, HERE)
from gen import vnoise
OUT = os.path.join(HERE, 'style5')
os.makedirs(OUT, exist_ok=True)
W, H = 880, 563
HX, HY = 440, 282
rnd = random.Random(4); nz = vnoise(14, rnd); nz2 = vnoise(5, rnd); wig = vnoise(40, rnd)


def earth_colour(g):
    px = [p for p in g.getdata() if p[0] > p[1] + 6 and p[1] >= p[2] - 4 and p[0] > p[2] + 25]
    if len(px) < 200: return (120, 98, 76)
    px.sort(key=sum); m = px[len(px) // 2]
    return m if max(m) - min(m) < 90 else (127, 88, 65)   # a ground with no soil of its own (the cherry grove's red specks)


def groves(mask):
    """Centres of the Token clumps: blobs of the Token mask on a coarse grid, the Hall's left out."""
    k = 8; sw, sh = W // k, H // k
    small = mask.resize((sw, sh), Image.BOX).point(lambda v: 1 if v > 20 else 0); sp = small.load()
    seen = set(); out = []
    for y in range(sh):
        for x in range(sw):
            if sp[x, y] and (x, y) not in seen:
                stack = [(x, y)]; seen.add((x, y)); cells = []
                while stack:
                    cx, cy = stack.pop(); cells.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                        n = (cx + dx, cy + dy)
                        if 0 <= n[0] < sw and 0 <= n[1] < sh and sp[n] and n not in seen: seen.add(n); stack.append(n)
                if len(cells) >= 6:
                    gx = sum(c[0] for c in cells) / len(cells) * k + k / 2; gy = sum(c[1] for c in cells) / len(cells) * k + k / 2
                    if math.hypot(gx - HX, gy - HY) > 90 and 24 < gy < H - 24: out.append((gx, gy, len(cells)))
    out.sort(key=lambda g: -g[2])
    return out[:5]


def worn(g, earth, area, density):
    """Trampled ground where `area(x, y)` > 0: grass a little lighter and drier, earth showing through in specks."""
    out = g.copy(); op = out.load(); gp = g.load()
    for y in range(H):
        for x in range(W):
            a = area(x, y)
            if a <= 0: continue
            r, gg, b = gp[x, y]
            if nz(x * 2.3, y * 2.3) < density * min(1.0, a):
                op[x, y] = earth
            else:
                op[x, y] = (min(255, int(r * 1.10 + 6)), min(255, int(gg * 1.03)), int(b * 0.92))
    return out


def clearing_area(x, y):
    d = math.hypot((x - HX) / 1.35, y - HY + 6)
    return (78 + (nz2(x, y) - 0.5) * 40 - d) / 18


def path_area_fn(gs):
    lines = []
    for gx, gy, _ in gs:
        ang = math.atan2(gy - HY, gx - HX); L = math.hypot(gx - HX, gy - HY) - 30; pts = []
        for i in range(0, 41):
            t = i / 40; px_ = HX + math.cos(ang) * L * t; py_ = HY + math.sin(ang) * L * t
            off = (wig(px_, py_) - 0.5) * 60 * math.sin(math.pi * t)
            pts.append((px_ - math.sin(ang) * off, py_ + math.cos(ang) * off, t))
        lines.append(pts)
    def f(x, y):
        best = 0
        for pts in lines:
            for (x1, y1, t1), (x2, y2, t2) in zip(pts, pts[1:]):
                if abs(x - x1) > 30 or abs(y - y1) > 30: continue
                dx, dy = x2 - x1, y2 - y1; u = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy or 1)))
                d = math.hypot(x - x1 - u * dx, y - y1 - u * dy); t = t1 + (t2 - t1) * u
                half = 8 * (1 - 0.5 * t) + (nz(x, y) - 0.5) * 3
                best = max(best, (half - d) / 3)
        return best
    return f


def quiet_decor(g):
    """Ground decorations (flowers, pebbles) pulled halfway to the ground round them, water left alone."""
    soft = g.filter(ImageFilter.GaussianBlur(6)); out = g.copy(); op = out.load(); gp = g.load(); sp = soft.load()
    for y in range(H):
        for x in range(W):
            p, s = gp[x, y], sp[x, y]
            if abs(p[0] - s[0]) + abs(p[1] - s[1]) + abs(p[2] - s[2]) > 90 and not (p[2] > p[0] + 25 and p[2] > 110):
                op[x, y] = tuple((a + b) // 2 for a, b in zip(p, s))
    return out


TABLE = Image.open('public/assets/ui/u_table_wood_planks_oak.png').convert('RGB').resize((256, 256), Image.NEAREST)
M = 20


def on_table(mat):
    t = Image.new('RGB', (W + 2 * M, H + 2 * M))
    for y in range(0, t.height, 256):
        for x in range(0, t.width, 256): t.paste(TABLE, (x, y))
    t = Image.blend(t, Image.new('RGB', t.size, (0, 0, 0)), 0.45)
    t.paste(mat, (M, M)); return t


def rim(mat):
    """A darker rim of the mat's own ground, in two hard steps, ragged."""
    out = mat.copy(); op = out.load(); mp = mat.load()
    for y in range(H):
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y) + (nz(x * 3, y * 3) - 0.5) * 6
            f = 0.62 if d < 4 else 0.80 if d < 11 else 1
            if f < 1: r, g, b = mp[x, y]; op[x, y] = (int(r * f), int(g * f), int(b * f))
    return out


def map_edge(mat):
    """A ragged, torn edge: the mat cut a few pixels in, a dark line along the cut, its shadow on the table."""
    t = on_table(Image.new('RGB', (W, H)))
    keep = Image.new('L', (W, H), 0); kp = keep.load()
    for y in range(H):
        for x in range(W):
            d = min(x, y, W - 1 - x, H - 1 - y)
            if d > 3 + nz(x * 1.7 + y * 0.3, y * 1.7 + x * 0.3) * 9: kp[x, y] = 255
    line = ImageChops.subtract(keep.filter(ImageFilter.MaxFilter(3)), keep)
    shadow = Image.new('L', (W + 2 * M, H + 2 * M), 0); shadow.paste(keep.filter(ImageFilter.MaxFilter(3)), (M + 3, M + 3))
    t.paste((0, 0, 0), (0, 0), shadow.point(lambda v: 150 if v else 0))
    full = Image.new('L', (W + 2 * M, H + 2 * M), 0); full.paste(keep, (M, M))
    big = Image.new('RGB', t.size); big.paste(mat, (M, M)); t.paste(big, (0, 0), full)
    ln = Image.new('L', t.size, 0); ln.paste(line, (M, M)); t.paste((30, 22, 16), (0, 0), ln)
    return t


STEPS = 'steps' in sys.argv
for b in (('meadow', 'forest', 'mountain', 'cherry_grove') if STEPS else ()):
    ground = Image.open(os.path.join(CAP, f'{b}_ground.png')).convert('RGB')
    full = Image.open(os.path.join(CAP, f'{b}_full.png')).convert('RGB')
    mask = tokens_mask(ground, full)
    sat, tex, dh, bc, bm = P[b]
    earth = earth_colour(ground)
    gs = groves(mask)
    paths = path_area_fn(gs)
    finish = lambda g: shadowed(colour_only(chunky(g, 2), sat, dh, bc), full, mask)
    g_clear = worn(ground, earth, clearing_area, 0.35)
    g_paths = worn(g_clear, earth, paths, 0.75)
    g_quiet = quiet_decor(g_paths)
    steps = {
        '1_base': finish(ground),
        '2_clearing': finish(g_clear),
        '3_paths': finish(g_paths),
        '4_quiet': finish(g_quiet),
    }
    steps['5_rim'] = rim(steps['4_quiet'])
    for k, im in steps.items():
        on_table(im).save(os.path.join(OUT, f'{b}_{k}.png'))
    map_edge(steps['4_quiet']).save(os.path.join(OUT, f'{b}_6_map_edge.png'))
    print(b, 'groves', [(int(x), int(y)) for x, y, _ in gs], 'earth', earth)


# The owner's idea (V5 follow-up): instead of a drop shadow, a scatter of the Token's own colours round its base
# (leaves under a tree, stone chips round ore), on the ground's 2x pixel grid.
def blobs(mask):
    mp = mask.load(); seen = bytearray(W * H); out = []
    for y in range(H):
        for x in range(W):
            if mp[x, y] and not seen[y * W + x]:
                stack = [(x, y)]; seen[y * W + x] = 1; pts = []
                while stack:
                    cx, cy = stack.pop(); pts.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx_, ny_ = cx + dx, cy + dy
                        if 0 <= nx_ < W and 0 <= ny_ < H and mp[nx_, ny_] and not seen[ny_ * W + nx_]:
                            seen[ny_ * W + nx_] = 1; stack.append((nx_, ny_))
                if len(pts) > 250: out.append(pts)
    return out


def scatter(base, full, mask, seed=9):
    r = random.Random(seed); out = base.copy(); op = out.load(); fp = full.load(); mp = mask.load()
    for pts in blobs(mask):
        ymax = max(p[1] for p in pts)
        if ymax < 20: continue                                   # the capture's top edge, not a Token
        foot = [p for p in pts if p[1] >= ymax - 5]
        bx = sum(p[0] for p in foot) / len(foot); by = ymax - 3
        xs = [p[0] for p in pts]; width = max(xs) - min(xs)
        cols = []
        for p in pts:
            c = fp[p]
            if 60 < sum(c) < 600: cols.append(c)                 # the art's own colours, not its outline or highlights
        if not cols: continue
        rx = max(14, width * 0.5); ry = rx * 0.32
        cols.sort(key=sum); cols = cols[:max(1, len(cols) // 2)]   # the darker half: reads against the ground
        for _ in range(int(rx * 2.4)):
            a = r.uniform(0, 6.283); d = math.sqrt(r.random()) * (0.55 + r.random() * 0.6)
            x = int(bx + math.cos(a) * rx * d) // 2 * 2; y = int(by + math.sin(a) * ry * d) // 2 * 2
            c = r.choice(cols)
            for yy in (y, y + 1):
                for xx in (x, x + 1):
                    if 0 <= xx < W and 0 <= yy < H and not mp[xx, yy]: op[xx, yy] = c
    return out


def plain(ground_img, full, mask, sat, dh, bc):
    g = colour_only(chunky(ground_img, 2), sat, dh, bc); g.paste(full, (0, 0), mask); return g


for b in ('meadow', 'forest', 'mountain', 'cherry_grove'):
    ground = Image.open(os.path.join(CAP, f'{b}_ground.png')).convert('RGB')
    full = Image.open(os.path.join(CAP, f'{b}_full.png')).convert('RGB')
    mask = tokens_mask(ground, full)
    sat, tex, dh, bc, bm = P[b]
    g = quiet_decor(worn(worn(ground, earth_colour(ground), clearing_area, 0.35), earth_colour(ground), path_area_fn(groves(mask)), 0.75))
    no_shadow = plain(g, full, mask, sat, dh, bc)
    with_shadow = shadowed(colour_only(chunky(g, 2), sat, dh, bc), full, mask)
    sc = scatter(no_shadow, full, mask)
    on_table(sc).save(os.path.join(OUT, f'{b}_7_scatter.png'))
    sc2 = scatter(with_shadow, full, mask)
    on_table(sc2).save(os.path.join(OUT, f'{b}_8_scatter_shadow.png'))
    for k, im in (('4_quiet', with_shadow), ('7_scatter', sc), ('8_scatter_shadow', sc2)):
        im.crop((180, 20, 460, 220)).resize((840, 600), Image.NEAREST).save(os.path.join(OUT, f'zoom_{b}_{k}.png'))
    print(b, 'scatter')
