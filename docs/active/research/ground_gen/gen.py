"""Ground generator, design loop. Renders whole scenes with no repeating sheet (as the in-game route would)."""
from PIL import Image, ImageOps, ImageDraw
import random, colorsys, os, glob, sys, json
S = os.path.dirname(os.path.abspath(__file__))
os.chdir(r"C:\Users\16048\Projects\fantasy_guild_v2")

def ramp(h, l_mid, s, n=5, hue_shift=0.035, step=0.075):
    out = []
    for i in range(n):
        k = i - (n - 1) / 2
        r, g, b = colorsys.hls_to_rgb((h - k * hue_shift) % 1, l_mid + k * step, min(1, s * (1 - abs(k) * 0.08)))
        out.append((int(r * 255), int(g * 255), int(b * 255), 255))
    return out

def vnoise(cell, rnd, gw=64, gh=64):
    g = [[rnd.random() for _ in range(gw)] for _ in range(gh)]
    def at(x, y):
        fx, fy = x / cell, y / cell; x0, y0 = int(fx), int(fy); tx, ty = fx - x0, fy - y0
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty)
        a = g[y0 % gh][x0 % gw]; b = g[y0 % gh][(x0 + 1) % gw]; c = g[(y0 + 1) % gh][x0 % gw]; d = g[(y0 + 1) % gh][(x0 + 1) % gw]
        return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
    return at

def lighten(c, f):
    h, l, s = colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
    r, g, b = colorsys.hls_to_rgb(h, min(1, l * f), s); return (int(r * 255), int(g * 255), int(b * 255), 255)

def ground(W, H, p):
    """p: dict of rules. Returns an RGBA image W x H."""
    rnd = random.Random(p.get('seed', 3))
    gp = ramp(*p['grass']); ep = ramp(*p['earth'], hue_shift=0.02, step=0.06)
    sp = ramp(*p['strokes']) if p.get('strokes') else gp
    img = Image.new('RGBA', (W, H)); px = img.load()
    clump = vnoise(p['clump'], rnd); fine = vnoise(max(2, p['clump'] // 2), rnd)
    tint = vnoise(p['tint_scale'], rnd); wear = vnoise(p['earth_scale'], rnd); wear2 = vnoise(max(4, p['earth_scale'] // 4), rnd)
    lo, hi = p.get('body', (1, 2))
    enc = vnoise(p.get('encroach_scale', 7), rnd)
    def is_earth(x, y):
        w = wear(x, y) * 0.8 + wear2(x, y) * 0.2
        if w <= p['earth_thr']: return False
        # near the edge (w just above the threshold) grass fingers win more often
        depth = (w - p['earth_thr']) / max(1e-6, 1 - p['earth_thr'])
        return enc(x, y) > p.get('encroach', 0.0) * (1 - min(1, depth * p.get('encroach_depth', 3)))
    earth = [[is_earth(x, y) for x in range(W)] for y in range(H)]
    tf = p.get('tint', 0.07)
    for y in range(H):
        for x in range(W):
            if earth[y][x]:
                c = ep[2] if clump(x, y) > 0.5 else ep[1]
            else:
                v = clump(x, y) * 0.7 + fine(x, y) * 0.3
                if v > 0.5: c = gp[hi]
                elif p.get('body_soft'):
                    k = p['body_soft']; a, b = gp[lo], gp[hi]
                    c = tuple(int(a[i] * (1 - k) + b[i] * k) for i in range(3)) + (255,)
                else: c = gp[lo]
            t = tint(x, y)
            if t > 0.62: c = lighten(c, 1 + tf)
            elif t < 0.38: c = lighten(c, 1 - tf)
            px[x, y] = c
    if p.get('mounds'):
        mnd = vnoise(p['mounds'], rnd); fine2 = vnoise(max(2, p['mounds'] // 3), rnd)
        up = lambda x, y: (mnd(x, y) * 0.75 + fine2(x, y) * 0.25) > 0.52
        M = [[up(x, y) for x in range(W)] for y in range(H)]
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if earth[y][x]: continue
                if M[y][x] and not M[y + 1][x]:               # bottom edge of a mound: shadow
                    px[x, y + 1] = lighten(gp[1], 1 - tf) if tint(x, y) < 0.38 else gp[1]
                    if x + 1 < W and not M[y + 1][x + 1] and rnd.random() < 0.5: px[x + 1, y + 1] = gp[1]
                elif M[y][x] and not M[y - 1][x] and rnd.random() < p.get('mound_light', 0.6):  # top edge: light
                    px[x, y] = gp[3]
    def shade_at(x, y, col):
        t = tint(x, y)
        return lighten(col, 1 + tf) if t > 0.62 else lighten(col, 1 - tf) if t < 0.38 else col
    style = p.get('dirt_style')
    if style:
        dn = vnoise(5, rnd); streak = vnoise(3, rnd)
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                if not earth[y][x]: continue
                if style == 'clods' and dn(x, y) > 0.6:
                    px[x, y] = ep[3] if (earth[y + 1][x] and dn(x, y + 1) <= 0.68) is False else ep[3]
                    if earth[y + 1][x] and dn(x, y + 1) <= 0.6: px[x, y + 1] = ep[0]
                elif style == 'path':
                    # packed, lighter middle, faint streaks along the path
                    w = wear(x, y) * 0.8 + wear2(x, y) * 0.2
                    deep = (w - p['earth_thr']) / max(1e-6, 1 - p['earth_thr'])
                    if deep > 0.35: px[x, y] = ep[3] if streak(x * 0.3, y * 3) > 0.62 else ep[2]
                elif style == 'clods_middle':
                    w = wear(x, y) * 0.8 + wear2(x, y) * 0.2
                    deep = (w - p['earth_thr']) / max(1e-6, 1 - p['earth_thr'])
                    if deep > p.get('middle', 0.3): px[x, y] = lighten(ep[2], 1.08)
                    if dn(x, y) > 0.6:
                        px[x, y] = ep[3]
                        if earth[y + 1][x] and dn(x, y + 1) <= 0.6: px[x, y + 1] = ep[0]
                elif style == 'soil':
                    if dn(x, y) > 0.64: px[x, y] = ep[0]
                    elif dn(x, y) < 0.28: px[x, y] = ep[3]
        if style == 'soil':
            for _ in range(int(W * H * 0.004)):   # twigs and roots: short dark diagonal strokes
                x, y = rnd.randrange(2, W - 4), rnd.randrange(2, H - 4)
                if earth[y][x]:
                    for k in range(rnd.randrange(2, 4)):
                        if earth[y + k // 2][x + k]: px[x + k, y + k // 2] = ep[0]
    if p.get('sunken'):
        for y in range(2, H - 2):
            for x in range(2, W - 2):
                if not earth[y][x]: continue
                if not earth[y - 1][x] or not earth[y - 2][x] or not earth[y][x - 1]:   # top/left inside: shade cast by grass
                    px[x, y] = ep[0]
                elif not earth[y + 1][x] or not earth[y][x + 1]:                        # bottom/right inside: lit lip
                    px[x, y] = ep[4]
    # blades: clusters of strokes, light from top-left, shadow pixel under-right
    n = int(W * H * p['blades'])
    bmask = vnoise(p.get('blade_mask_scale', 48), rnd) if p.get('blade_mask') else None
    for _ in range(n):
        cx, cy = rnd.randrange(W), rnd.randrange(H)
        if bmask and bmask(cx, cy) < p['blade_mask'] and rnd.random() > p.get('blade_mask_floor', 0.0): continue
        for _ in range(p.get('cluster', 1)):
            x = cx + rnd.randrange(-1, 2) * (p.get('cluster', 1) > 1); y = cy + rnd.randrange(-1, 2) * (p.get('cluster', 1) > 1)
            if not (0 <= x < W and 0 <= y < H) or earth[y][x]: continue
            hgt = rnd.choice(p.get('heights', (2, 2, 3))); lean = rnd.random() < 0.4
            for i in range(hgt):
                xx = x + (1 if lean and i == 0 else 0); yy = y - i
                if 0 <= xx < W and 0 <= yy < H and not earth[yy][xx]:
                    col = sp[4] if (i == hgt - 1 and rnd.random() < p.get('tips', 0.15)) else sp[p.get('stroke_tone', 3)]
                    px[xx, yy] = shade_at(xx, yy, col)
            if x + 1 < W and y + 1 < H and not earth[y + 1][x + 1] and rnd.random() < p.get('blade_shadow', 0.5):
                px[x + 1, y + 1] = shade_at(x + 1, y + 1, gp[0])
    # pebbles on earth
    for _ in range(int(W * H * p.get('pebbles', 0.01))):
        x, y = rnd.randrange(W - 2), rnd.randrange(H - 2)
        if earth[y][x] and earth[y + 1][x + 1]:
            px[x, y] = ep[3]
            if rnd.random() < 0.5 and earth[y][x + 1]: px[x + 1, y] = ep[3]
            px[x + 1, y + 1] = ep[0]
    for _ in range(int(W * H * p.get('earth_tufts', 0.0))):
        x, y = rnd.randrange(1, W - 2), rnd.randrange(2, H - 2)
        if not earth[y][x]: continue
        for k in range(rnd.randrange(2, p.get('earth_tuft_max', 4))):
            xx = x + k - 1; hgt = rnd.choice((1, 2, 2, 3))
            if 0 <= xx < W and earth[y][xx]:
                for i in range(hgt):
                    if y - i >= 0: px[xx, y - i] = gp[3] if (i == hgt - 1 and rnd.random() < 0.6) else gp[2]
                if earth[y + 1][xx]: px[xx, y + 1] = ep[0]
    # earth edges: dark rim under grass, tufts hanging over the top edge, ragged sides
    for y in range(1, H - 2):
        for x in range(1, W - 1):
            if not earth[y][x]: continue
            if not earth[y - 1][x]:
                px[x, y] = ep[0]
                if rnd.random() < p.get('tufts', 0.5):
                    for i in range(rnd.choice((1, 2))):
                        px[x, y + i] = shade_at(x, y + i, gp[3] if i == 0 else gp[2])
            elif (not earth[y][x - 1] or not earth[y][x + 1]) and rnd.random() < p.get('ragged', 0.25):
                px[x, y] = shade_at(x, y, gp[2])
    return img

def put_tokens(base):
    tk = sorted(f for f in glob.glob('public/assets/tokens/**/*.png', recursive=True) if any(k in f for k in ('t_tree_oak.png', 't_sawmill', 't_campfire')))
    it = sorted(f for f in glob.glob('public/assets/items/**/*.png', recursive=True) if any(k in f for k in ('i_wood_oak.png', 'i_ore_copper.png', 'i_apple.png')))
    for n, f in enumerate(tk): base.alpha_composite(Image.open(f).convert('RGBA'), (40 + n * 100, 50 + (n % 2) * 60))
    for n, f in enumerate(it): base.alpha_composite(Image.open(f).convert('RGBA'), (90 + n * 90, 150))
    return base

def board(variants, out, W=320, H=200, s=2, labels=None):
    G = lambda im: ImageOps.grayscale(im.convert('RGB')).convert('RGB')
    n = len(variants); pad = 12; top = 22
    P = Image.new('RGB', (W * s * n + pad * (n - 1), H * s * 2 + pad + top), (40, 40, 40)); d = ImageDraw.Draw(P)
    for i, p in enumerate(variants):
        A = put_tokens(ground(W, H, p)).resize((W * s, H * s), Image.NEAREST)
        x = i * (W * s + pad)
        d.text((x + 4, 5), (labels or 'ABCDEFG')[i] if not labels else labels[i], fill=(255, 255, 255))
        P.paste(A.convert('RGB'), (x, top)); P.paste(G(A), (x, top + H * s + pad))
    P.save(os.path.join(S, out))

if __name__ == '__main__':
    rounds = json.load(open(os.path.join(S, 'rounds.json')))
    r = rounds[sys.argv[1]]
    board(r['variants'], f"round_{sys.argv[1]}.png", labels=r.get('labels'))
    print('ok')

def mixed(W, H, kinds, zone_scale=70, seed=11, ragged=0.35):
    """Several grass kinds in zones: each kind is a full ground() with the same earth and tint
    (same seed), composited by a large noise map cut into bands; zone borders get a ragged edge."""
    rnd = random.Random(seed); z = vnoise(zone_scale, rnd); j = vnoise(6, rnd)
    layers = [ground(W, H, k) for k in kinds]
    out = layers[0].copy(); op = out.load(); lps = [l.load() for l in layers]
    n = len(kinds)
    for y in range(H):
        for x in range(W):
            v = z(x, y) + (j(x, y) - 0.5) * ragged * 0.25
            idx = min(n - 1, max(0, int(v * n * 1.0)))
            op[x, y] = lps[idx][x, y]
    return out

def board_imgs(imgs, out, labels, W=320, H=200, s=2):
    G = lambda im: ImageOps.grayscale(im.convert('RGB')).convert('RGB')
    n = len(imgs); pad = 12; top = 22
    P = Image.new('RGB', (W * s * n + pad * (n - 1), H * s * 2 + pad + top), (40, 40, 40)); d = ImageDraw.Draw(P)
    for i, im in enumerate(imgs):
        A = put_tokens(im).resize((W * s, H * s), Image.NEAREST); x = i * (W * s + pad)
        d.text((x + 4, 5), labels[i], fill=(255, 255, 255))
        P.paste(A.convert('RGB'), (x, top)); P.paste(G(A), (x, top + H * s + pad))
    P.save(os.path.join(S, out))

def banded(W, H, layers_kinds, cuts, zone_scale=60, stretch=(1.0, 1.0), seed=11, ragged=0.35, gap=None):
    """Zones by thresholds on a stretched noise: kind i where cuts[i-1] <= v < cuts[i]. A narrow
    band between two cuts gives long thin stretches when the noise is stretched along one axis."""
    rnd = random.Random(seed); z = vnoise(zone_scale, rnd); j = vnoise(6, rnd)
    layers = [ground(W, H, k) for k in layers_kinds]; lps = [l.load() for l in layers]
    gn = vnoise(gap[1], rnd) if gap else None
    out = layers[0].copy(); op = out.load()
    for y in range(H):
        for x in range(W):
            v = z(x / stretch[0], y / stretch[1]) + (j(x, y) - 0.5) * ragged * 0.25
            idx = 0
            while idx < len(cuts) and v >= cuts[idx]: idx += 1
            if gap and idx == gap[0] and gn(x, y) < gap[2]: idx = gap[3]
            op[x, y] = lps[idx][x, y]
    return out

def coast(W, H, land, p):
    """Land image plus a sea on one side: the shore follows a noisy line; bands of wet sand,
    shallows and a foam line by distance from it; water with soft clustered wave dashes."""
    rnd = random.Random(p.get('seed', 5)); n = vnoise(p.get('shore_scale', 50), rnd); n2 = vnoise(12, rnd)
    sea = ramp(*p['sea'], hue_shift=0.02, step=0.06); sand = ramp(*p['sand'], hue_shift=0.02, step=0.06)
    out = land.copy(); px = out.load()
    wav = vnoise(p.get('wave_scale', 10), rnd); wsh = vnoise(40, rnd)
    for y in range(H):
        for x in range(W):
            f = x / W + (n(x, y) - 0.5) * p.get('shore_amp', 0.35) + (n2(x, y) - 0.5) * 0.04 - p.get('shore', 0.62)
            if f < -0.035: continue
            if f < -0.012: px[x, y] = sand[1]                                      # wet sand
            elif f < 0.0: px[x, y] = sand[0] if (x + y) % 3 else sand[1]           # waterline
            elif f < p.get('foam', 0.008): px[x, y] = sea[4] if n2(x * 2, y * 2) > 0.45 else sea[3]   # foam
            elif f < p.get('shallow', 0.05): px[x, y] = sea[3] if wsh(x, y) > 0.55 else sea[2]       # shallows
            else:
                c = sea[1] if wsh(x, y) > 0.5 else sea[0]
                if wav(x * 0.4, y * 2.2) > p.get('dash', 0.74): c = sea[2]       # soft horizontal wave clusters
                px[x, y] = c
    return out

def coast2(W, H, land, p):
    """Calm water with depth steps; waves drawn as strokes (lit crest over a darker trough) in
    patches, like grass; a stronger broken foam line; wet sand."""
    rnd = random.Random(p.get('seed', 5)); n = vnoise(p.get('shore_scale', 50), rnd); n2 = vnoise(12, rnd)
    sea = ramp(*p['sea'], hue_shift=0.02, step=0.06); sand = ramp(*p['sand'], hue_shift=0.02, step=0.06)
    out = land.copy(); px = out.load(); F = [[0.0] * W for _ in range(H)]
    patch = vnoise(p.get('wave_patch_scale', 30), rnd)
    foam_w = p.get('foam', 0.016)
    FOAM = lighten(sea[4], p.get('foam_light', 1.35)); FOAM2 = lighten(sea[4], 1.12)
    for y in range(H):
        for x in range(W):
            f = x / W + (n(x, y) - 0.5) * p.get('shore_amp', 0.35) + (n2(x, y) - 0.5) * 0.04 - p.get('shore', 0.62)
            F[y][x] = f
            if f < -0.035: continue
            if f < -0.010: px[x, y] = sand[1]
            elif f < 0.0: px[x, y] = sand[0] if (x + 2 * y) % 4 else sand[1]
            elif f < foam_w: px[x, y] = FOAM if (n2(x * 3, y * 3) > 0.35 or f < foam_w * 0.5) else FOAM2
            elif f < p.get('shallow', 0.06): px[x, y] = sea[3] if n2(x, y) > 0.6 else sea[2]
            elif f < p.get('deep', 0.22): px[x, y] = sea[1]
            else: px[x, y] = sea[0]
    # foam flecks just off the line
    for _ in range(int(W * H * p.get('flecks', 0.004))):
        x, y = rnd.randrange(W - 2), rnd.randrange(H)
        if foam_w < F[y][x] < foam_w * 3: px[x, y] = FOAM2
    # wave strokes: horizontal crest of 2-5 px in a light tone, trough one row below shifted right
    for _ in range(int(W * H * p.get('waves', 0.02))):
        x, y = rnd.randrange(W - 6), rnd.randrange(1, H - 1)
        f = F[y][x]
        if f < p.get('shallow', 0.06) or patch(x, y) < p.get('wave_mask', 0.45): continue
        L = rnd.choice(p.get('wave_len', (2, 3, 3, 4, 5)))
        if p.get('wave_grad'):
            for thr, lens in p['wave_grad']:
                if f >= thr: L = rnd.choice(lens)
        thick = p.get('far_thick') and f >= p['far_thick']
        crest = sea[3] if f < p.get('deep', 0.22) else sea[2]
        trough = sea[0] if f < p.get('deep', 0.22) else lighten(sea[0], 0.85)
        if x + L + 2 >= W or y + 2 >= H: continue
        for i in range(L):
            if F[y][x + i] > p.get('shallow', 0.06): px[x + i, y] = crest
            if i >= 1 and F[y + 1][x + i] > p.get('shallow', 0.06): px[x + i, y + 1] = trough
        if thick:   # far out: a second, shorter crest row above, offset, so big swells read as rolling
            for i in range(1, L - 1):
                if y - 1 >= 0 and F[y - 1][x + i + 1] > p.get('shallow', 0.06): px[x + i + 1, y - 1] = crest
    return out
