# Visual style investigation V1: measure the colour of the Tokens against the ground on today's 2x screen (the busy
# mid-game scene from scale_full.py), then try fixes on the ground and under the Tokens, the Tokens' art untouched.
import os, sys, math, json, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from scale_full import scene, sprites_on, frame_screen, Image
from PIL import ImageEnhance, ImageFilter, ImageDraw

K = 2
ground, draw, W, H, *_ = scene(K)


def lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(float(v)) for v in rgb[:3])
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    L = 116 * f(y) - 16; a = 500 * (f(x) - f(y)); bb = 200 * (f(y) - f(z))
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def stats(pixels):
    ls = sorted(p[0] for p in pixels); cs = sorted(p[1] for p in pixels)
    n = len(ls); q = lambda arr, f: arr[min(n - 1, int(n * f))]
    mean = sum(ls) / n; sd = math.sqrt(sum((v - mean) ** 2 for v in ls) / n)
    greens = sum(1 for p in pixels if 90 <= p[2] <= 160 and p[1] > 15) / n
    return {'L_mean': round(mean, 1), 'L_10': round(q(ls, .1), 1), 'L_90': round(q(ls, .9), 1), 'L_sd': round(sd, 1),
            'C_mean': round(sum(cs) / n, 1), 'C_90': round(q(cs, .9), 1), 'green_share': round(greens, 2)}


def measure(ground_img, label):
    layer = sprites_on(Image.new('RGBA', (W, H)), draw)
    gp, tp = ground_img.load(), layer.load()
    rnd = random.Random(1); g, t = [], []
    for _ in range(60000):
        x, y = rnd.randrange(W), rnd.randrange(H)
        if tp[x, y][3] > 200: t.append(lab(tp[x, y]))
        else: g.append(lab(gp[x, y]))
    # per Token: its own pixels against the ground in a ring round its base
    deltas = []
    for spr, sx, sy in draw:
        ox, oy = int(sx - spr.width / 2), int(sy - spr.height + 24); sp = spr.load(); own = []
        for yy in range(0, spr.height, 2):
            for xx in range(0, spr.width, 2):
                if sp[xx, yy][3] > 200: own.append(lab(sp[xx, yy])[0])
        ring = []
        for a in range(0, 360, 15):
            rx, ry = int(sx + math.cos(math.radians(a)) * spr.width * 0.6), int(sy + math.sin(math.radians(a)) * spr.width * 0.35)
            if 0 <= rx < W and 0 <= ry < H and tp[rx, ry][3] < 50: ring.append(lab(gp[rx, ry])[0])
        if own and ring: deltas.append(sum(own) / len(own) - sum(ring) / len(ring))
    out = {'ground': stats(g), 'tokens': stats(t), 'token_minus_ground_L_median': round(sorted(deltas)[len(deltas) // 2], 1)}
    print(label, json.dumps(out)); return out


def quiet(img, sat=0.7, texture=0.55):
    """Less colour and less texture: blend towards a blurred copy (keeps the shapes, softens the speckle)."""
    soft = img.filter(ImageFilter.GaussianBlur(5))
    out = Image.blend(img.convert('RGB'), soft.convert('RGB'), 1 - texture)
    return ImageEnhance.Color(out).enhance(sat).convert('RGBA')


def value(img, f, sat=1.0):
    return ImageEnhance.Color(ImageEnhance.Brightness(img.convert('RGB')).enhance(f)).enhance(sat).convert('RGBA')


def hue_shift(img, dh, sat=1.0):
    h, s, v = img.convert('RGB').convert('HSV').split()
    h = h.point(lambda p: (p + int(dh * 255)) % 256)
    out = Image.merge('HSV', (h, s, v)).convert('RGB')
    return ImageEnhance.Color(out).enhance(sat).convert('RGBA')


def shadows(img):
    """A stepped pixel-art contact shadow under every Token and hero."""
    sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
    for spr, x, y in draw:
        w = spr.width * 0.62; h = max(5, w * 0.24); by = y + 19
        d.ellipse((x - w / 2, by - h / 2, x + w / 2, by + h / 2), fill=70)
        d.ellipse((x - w * 0.32, by - h * 0.32, x + w * 0.32, by + h * 0.32), fill=105)
    return _shade(img, sh)


def _shade(img, mask):
    px = img.copy(); pp = px.load(); mp = mask.load()
    for yy in range(H):
        for xx in range(W):
            m = mp[xx, yy]
            if m:
                r, g, b, a = pp[xx, yy]; k = 1 - m / 255
                pp[xx, yy] = (int(r * k + 10 * (1 - k)), int(g * k + 20 * (1 - k)), int(b * k + 24 * (1 - k)), a)
    return px


VARIANTS = {
    'A_today': lambda g: g,
    'B_quiet': lambda g: quiet(g),
    'C_darker': lambda g: value(quiet(g, 0.85, 0.8), 0.82, 0.85),
    'D_lighter': lambda g: value(quiet(g, 0.6, 0.6), 1.12, 0.9),
    'E_olive': lambda g: hue_shift(quiet(g, 0.9, 0.8), -0.035, 0.85),
    'F_shadows': lambda g: shadows(g),
    'G_quiet_shadows': lambda g: shadows(quiet(g)),
}
results = {}
for name, fx in VARIANTS.items():
    gimg = fx(ground)
    results[name] = measure(gimg, name)
    mat = sprites_on(gimg, draw)
    frame_screen(mat, K).save(os.path.join(HERE, f'style_1_{name}.png'))
    if name in ('A_today', 'G_quiet_shadows'):
        frame_screen(mat.convert('L').convert('RGBA'), K).save(os.path.join(HERE, f'style_1_{name}_grey.png'))
json.dump(results, open(os.path.join(HERE, 'style_1_measure.json'), 'w'), indent=1)
