// The options, loaded into the page as globalThis.__TRX. Everything here is research code: hooks in
// patches.mjs call it only while globalThis.__TR names an option.

function hash(x, y, salt) {
    let h = Math.imul(x + 0x632be5ab, 0x9e3779b1) ^ Math.imul(y + 0x85157af5, 0x85ebca77) ^ salt;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
}
const smooth = (t) => t * t * (3 - 2 * t);
const corner = (gx, gy, salt) => (hash(gx, gy, salt) >>> 8) / 16777216;
function vnoise(x, y, cell, salt) {
    const tx = x / cell;
    const ty = y / cell;
    const gx = Math.floor(tx);
    const gy = Math.floor(ty);
    const fx = smooth(tx - gx);
    const fy = smooth(ty - gy);
    const c00 = corner(gx, gy, salt);
    const c01 = corner(gx, gy + 1, salt);
    const top = c00 + (corner(gx + 1, gy, salt) - c00) * fx;
    const bottom = c01 + (corner(gx + 1, gy + 1, salt) - c01) * fx;
    return top + (bottom - top) * fy;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const roll = (x, y, salt) => hash(x, y, salt) / 4294967296;

// ---------------------------------------------------------------------------------------------
// Rivers: a new course and a width that changes along it, stored as whole numbers. Only + - x / and
// sqrt and integer-hash noise, as WaterShapes' determinism warning asks.

export function river(maker, points, hw0, hw1, H) {
    const T = globalThis.__TR;
    const { dist, foldsBack, simplify, smoothPath, flat, SHAPE, CHANNEL_HW, FOLD_WIDTHS } = H;
    const salt = hash(Math.round(points[0][0]), Math.round(points[0][1]), 0x7123);
    const n = points.length;
    const along = new Float64Array(n);
    for (let i = 1; i < n; i++) along[i] = along[i - 1] + dist(points[i][0], points[i][1], points[i - 1][0], points[i - 1][1]);
    const len = along[n - 1];
    const source = T.river === 'source' && len > 600;
    const s0 = source ? len * (0.16 + 0.10 * roll(1, 0, salt)) : 0;
    const share = (s) => clamp((s - s0) / (len - s0), 0, 1);
    const baseAt = (s) => {
        const t = share(s);
        if (source) return 6 + (hw1 * 1.05 - 6) * Math.sqrt(t) * (0.4 + 0.6 * t);
        return hw0 + (hw1 - hw0) * t;
    };

    // The bends: one knot a half-wave, each to the other side, the half-wave longer where the river is
    // wider, as real rivers' are; offsets eased between knots.
    const knots = (ampK) => {
        const out = [];
        let s = -40 * roll(2, 0, salt);
        let side = roll(3, 0, salt) < 0.5 ? 1 : -1;
        let k = 0;
        while (s < len + 200) {
            const hw = baseAt(clamp(s, 0, len));
            const half = clamp((T.wave ?? 6.2) * 2 * hw * (0.75 + 0.5 * roll(k, 4, salt)), 90, 460);
            out.push([s, side * ampK * half * (0.55 + 0.6 * roll(k, 5, salt))]);
            s += half;
            side = -side;
            k++;
        }
        return out;
    };
    const offsetAt = (K, s) => {
        let j = 0;
        while (j + 2 < K.length && K[j + 1][0] < s) j++;
        const [sa, a] = K[j];
        const [sb, b] = K[j + 1] || K[j];
        const t = sb > sa ? clamp((s - sa) / (sb - sa), 0, 1) : 0;
        return a + (b - a) * smooth(t);
    };

    const build = (ampK) => {
        const K = knots(ampK);
        const amax = Math.max(1, ...K.map((k) => Math.abs(k[1])));
        const pts = [];
        const hws = [];
        for (let i = 0; i < n; i++) {
            const s = along[i];
            if (s < s0) continue;
            const a = points[Math.max(0, i - 3)];
            const b = points[Math.min(n - 1, i + 3)];
            const L = dist(a[0], a[1], b[0], b[1]) || 1;
            const nx = -(b[1] - a[1]) / L;
            const ny = (b[0] - a[0]) / L;
            const edge = Math.min(1, (s - s0) / 160 + (source ? 0.25 : 0), (len - s) / 160);
            const o = offsetAt(K, s);
            const small = (vnoise(s, 7.5, 70, salt) - 0.5) * 14;
            const off = o * clamp(edge, 0, 1) + small;
            pts.push([points[i][0] + nx * off, points[i][1] + ny * off]);
            // Pools in the bends, riffles where it crosses from one bend to the next.
            const apex = Math.abs(o) / amax;
            const wander = 1 + 0.5 * (vnoise(s, 19.5, 170, salt) - 0.5);
            let hw = baseAt(s) * (0.72 + (T.pool ?? 0.56) * apex) * wander;
            if (source) hw += 5 * Math.max(0, 1 - (s - s0) / 46);
            hw = source ? Math.max(5, Math.min(hw1 * 1.6, hw)) : clamp(hw, CHANNEL_HW, hw1 * 1.5);
            hws.push(hw);
        }
        // A few gentle passes, the ends kept, so no join between offsets shows as a corner.
        let eased = pts;
        for (let pass = 0; pass < 6; pass++) {
            const next = eased.map((p) => [p[0], p[1]]);
            for (let i = 1; i + 1 < eased.length; i++) {
                next[i][0] = (eased[i - 1][0] + 2 * eased[i][0] + eased[i + 1][0]) / 4;
                next[i][1] = (eased[i - 1][1] + 2 * eased[i][1] + eased[i + 1][1]) / 4;
            }
            eased = next;
        }
        const R = maker.clear.r + hw1 * 1.3 + 24;
        const moved = maker.repel(eased, R);
        return { pts: moved, hws };
    };

    let ampK = T.bend ?? 0.27;
    let best = null;
    for (let tries = 0; tries < 6; tries++) {
        const made = build(ampK);
        const mean = made.hws.reduce((p, q) => p + q, 0) / made.hws.length;
        if (!foldsBack(made.pts, FOLD_WIDTHS * 2 * mean)) { best = made; break; }
        ampK *= 0.75;
    }
    if (!best) best = build(0);
    const smoothed = best.pts;
    const index = new Map(smoothed.map((p, i) => [p, i]));
    const kept = simplify(smoothed, 1);
    return {
        k: SHAPE.RIVER,
        p: flat(kept),
        w: [Math.round(hw0), Math.round(hw1)],
        hw: kept.map((p) => Math.max(1, Math.round(best.hws[index.get(p)])))
    };
}

/** The field of a river with a width per point, and which side of each bend the land by it lies on. */
export function riverInto(out, lattice, shape, L, H) {
    const { span, STYLE, RIVER } = H;
    const T = globalThis.__TR || {};
    const pts = shape.points;
    const hws = shape.hw;
    const pad = 30;
    const reach = Math.max(...hws) + 12 + pad;
    const { step, nx, ny } = lattice;
    const total = nx * ny;
    const best = new Float64Array(total).fill(-Infinity);
    const seg = new Int32Array(total).fill(-1);
    const touched = [];
    const m = pts.length;
    for (let k = 0; k + 1 < m; k++) {
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        const wa = hws[k];
        const wb = hws[k + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const L2 = dx * dx + dy * dy || 1;
        const { i0, i1, j0, j1 } = span(lattice, Math.min(ax, bx) - reach, Math.min(ay, by) - reach, Math.max(ax, bx) + reach, Math.max(ay, by) + reach);
        for (let j = j0; j <= j1; j++) {
            const y = lattice.y0 + j * step;
            for (let i = i0; i <= i1; i++) {
                const x = lattice.x0 + i * step;
                let t = ((x - ax) * dx + (y - ay) * dy) / L2;
                t = t < 0 ? 0 : t > 1 ? 1 : t;
                const ex = x - (ax + dx * t);
                const ey = y - (ay + dy * t);
                const v = wa + (wb - wa) * t - Math.sqrt(ex * ex + ey * ey);
                const p = j * nx + i;
                if (v > best[p]) {
                    if (best[p] === -Infinity) touched.push(p);
                    best[p] = v;
                    seg[p] = k;
                }
            }
        }
    }
    // Each vertex's bend: the turn between the headings a stretch before and after it.
    const curve = new Float64Array(m);
    const headingAt = (k, back) => {
        let j = k;
        let s = 0;
        while (j + (back ? -1 : 1) >= 0 && j + (back ? -1 : 1) < m && s < 70) {
            const q = j + (back ? -1 : 1);
            s += Math.sqrt((pts[q][0] - pts[j][0]) ** 2 + (pts[q][1] - pts[j][1]) ** 2);
            j = q;
        }
        const ax = pts[back ? j : k][0];
        const ay = pts[back ? j : k][1];
        const bx = pts[back ? k : j][0];
        const by = pts[back ? k : j][1];
        const l = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2) || 1;
        return [(bx - ax) / l, (by - ay) / l];
    };
    for (let k = 0; k < m; k++) {
        const [hx0, hy0] = headingAt(k, true);
        const [hx1, hy1] = headingAt(k, false);
        curve[k] = hx0 * hy1 - hy0 * hx1;
    }
    const wantBars = lattice.step === 2 && T.bank;
    if (wantBars && !out.trBar) out.trBar = new Float32Array(total);
    const { f, style } = out;
    const bankAmp = T.bankNoise ?? 10;
    for (const p of touched) {
        const i = p % nx;
        const j = (p - i) / nx;
        const x = lattice.x0 + i * step;
        const y = lattice.y0 + j * step;
        const val = best[p] + (L.riverFine(x, y) - 0.5) * RIVER.fine + (L.width(x, y) - 0.5) * bankAmp;
        if (val > f[p]) {
            f[p] = val;
            style[p] = STYLE.LAKE;
            if (wantBars) {
                const k = seg[p];
                const [ax, ay] = pts[k];
                const [bx, by] = pts[k + 1];
                const side = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
                const c = (curve[k] + curve[k + 1]) / 2;
                out.trBar[p] = side * c > 0 ? clamp((Math.abs(c) - 0.07) / 0.3, 0, 1) : -clamp((Math.abs(c) - 0.07) / 0.3, 0, 1);
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Banks

const LAND = Object.freeze({ MUD_DARK: 100, MUD: 101, BAR_LIGHT: 102, BAR: 103, BAR_DARK: 104, REED: 105, REED_TIP: 106 });
const code = (colour) => 230 + colour - 100;

export function bankCode(ctx, i, px, py, f) {
    const out = -f;
    const bar = ctx.trWater?.trBar ? ctx.trWater.trBar[i] : 0;
    const n = vnoise(px, py, 9, 0x51a7);
    const n2 = vnoise(px, py, 22, 0x51a8);
    const speck = roll(px, py, 0x51a9);
    if (bar > 0) {
        const W = bar * (18 + 28 * n2);
        if (out < W) {
            if (out < 2.5) return code(LAND.MUD_DARK);
            return code(speck < 0.16 ? LAND.BAR_DARK : n > 0.52 ? LAND.BAR_LIGHT : LAND.BAR);
        }
    }
    // A ragged wet bank, wider here and there, broken where the grass comes down to the water.
    const wet = 2.5 + (n2 > 0.5 ? (n2 - 0.5) * 22 : 0) + (bar < 0 ? -bar * 3 : 0);
    if (out < wet) return code(out < 2.5 ? LAND.MUD_DARK : n > 0.45 ? LAND.MUD : LAND.MUD_DARK);
    return 0;
}

// ---------------------------------------------------------------------------------------------
// Extra colours in a look's table

export function extraColours(lookId, rules, { cleanOf, cleanColour, ramp }) {
    const T = globalThis.__TR;
    const clean = cleanOf(lookId);
    const c = (rgb) => (clean ? cleanColour(rgb, clean) : rgb);
    const out = [];
    if (!rules.water && T.bank) {
        const mud = ramp(0.08, 0.34, 0.30, 5, 0.02, 0.06);
        const bar = ramp(...(T.barColour || [0.105, 0.50, 0.24]), 5, 0.02, 0.05);
        out.push([LAND.MUD_DARK, c(mud[0])], [LAND.MUD, c(mud[1])], [LAND.BAR_LIGHT, c(bar[2])], [LAND.BAR, c(bar[1])], [LAND.BAR_DARK, c(bar[0])]);
        const reed = rules.kinds[0]?.grass || rules.grass;
        const r = ramp(...reed);
        out.push([LAND.REED, c(r[0])], [LAND.REED_TIP, c(r[3])]);
    }
    if (rules.water && lookId === 'lake' && T.waterTable) {
        T.waterTable.forEach((rgb, k) => out.push([8 + k, rgb]));
    }
    return out.length ? out : null;
}

// ---------------------------------------------------------------------------------------------
// The water's fill: lakes and rivers only; the sea keeps its own drawing in every option.

const SEA = 0;
const DEEPEST = 8;
const BED = 9;
const BED_DARK = 10;
const MID = 11;

export function waterColour(ctx, grass, seed, c, r, p, slot) {
    if (grass.looks[slot] !== 'lake') return -1;
    const T = globalThis.__TR;
    const width = grass.trWidth;
    const f = grass.trWater.f[p] / 2;
    if (f < 1.2) return -1;
    const px = p % width;
    const py = (p - px) / width;
    const salt = hash(seed | 0, 0x77, 0x2545f491);
    const wob = vnoise(px, py, 12, salt);
    if (T.water === 'bands') {
        const e = f + (wob - 0.5) * 11 * Math.min(1, f / 6);
        if (e < 4) return SEA + (roll(c, r, salt) < 0.28 ? 4 : 3);
        if (e < 8) return SEA + (wob > 0.62 && roll(c, r, salt + 1) < 0.4 ? 3 : 2);
        if (e < 13) return SEA + 1;
        if (e < 20) return MID;
        if (e < 31) return SEA;
        return DEEPEST;
    }
    if (T.water === 'bed') {
        const e = f + (wob - 0.5) * 9 * Math.min(1, f / 5);
        if (e < 3) return SEA + (roll(c, r, salt) < 0.35 ? 4 : 3);
        if (e < 12) {
            const clump = vnoise(px, py, 7, salt + 3);
            if (clump > 0.62 && roll(c, r, salt + 2) < 0.65) return BED_DARK;
            return BED;
        }
        if (e < 17) return roll(c, r, salt + 4) < 0.3 ? BED : SEA + 2;
        if (e < 25) return SEA + 1;
        if (e < 38) return MID;
        return SEA;
    }
    return -1;
}

/** Runs after the banks: the reeds, and the still frame of the moving water. */
export function afterAll(ctx, grass, seed, { base }) {
    const T = globalThis.__TR;
    if (T.reeds) reeds(ctx, grass, seed, base);
    if (T.movement) movement(ctx, grass, seed, T.phase || 0);
}

function reeds(ctx, grass, seed, base) {
    const { colour, shape, kinds, pieceAt, cols, rows, planCol, planRow } = ctx;
    const salt = hash(seed | 0, 0x78, 0x2545f491);
    const f = grass.trWater?.f;
    if (!f) return;
    for (let r = 3; r < rows; r++) {
        const pr = planRow[r];
        for (let c = 0, i = r * cols; c < cols; c++, i++) {
            if (!shape[i]) continue;
            const v = f[pr + planCol[c]];
            if (v > 0 || v < -14) continue;
            const clump = vnoise(c, r, 11, salt);
            if (clump < 0.54 || roll(c, r, salt + 1) > 0.5) continue;
            const h = 1 + (hash(c, r, salt + 2) % 3);
            for (let t = 0; t < h; t++) {
                const j = i - t * cols;
                if (!shape[j]) continue;
                colour[j] = t === h - 1 ? LAND.REED_TIP : LAND.REED;
                pieceAt[j] = 0;
            }
        }
    }
}

// The moving water, drawn at one phase: the current's streaks along each river's own course, a slow lap
// line near the shore. `phase` is what would step, once per sprite frame, on the ambient layer.
function riverFrames(grass) {
    if (grass.trFlow) return grass.trFlow;
    const water = grass.trWater;
    const { lattice, f, style } = water;
    const { nx, ny, step } = lattice;
    const along = new Float32Array(nx * ny).fill(-1);
    const off = new Float32Array(nx * ny);
    const lobes = (water.trRecord?.shapes || []).filter((s) => s.k === 'lake').flatMap((s) => s.lobes);
    for (const shape of water.trRecord?.shapes || []) {
        if (shape.k !== 'river') continue;
        const pts = shape.points;
        let s0 = 0;
        for (let k = 0; k + 1 < pts.length; k++) {
            const [ax, ay] = pts[k];
            const [bx, by] = pts[k + 1];
            const dx = bx - ax;
            const dy = by - ay;
            const L = Math.sqrt(dx * dx + dy * dy) || 1;
            const reach = 110;
            const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach) / step));
            const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + reach) / step));
            const j0 = Math.max(0, Math.floor((Math.min(ay, by) - reach) / step));
            const j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by) + reach) / step));
            for (let j = j0; j <= j1; j++) {
                const y = lattice.y0 + j * step;
                for (let i = i0; i <= i1; i++) {
                    const p = j * nx + i;
                    if (!(f[p] > 0)) continue;
                    const x = lattice.x0 + i * step;
                    if (lobes.some(([cx, cy, cr]) => (x - cx) * (x - cx) + (y - cy) * (y - cy) < cr * cr * 2.2)) continue;
                    let t = ((x - ax) * dx + (y - ay) * dy) / (L * L);
                    t = t < 0 ? 0 : t > 1 ? 1 : t;
                    const ex = x - (ax + dx * t);
                    const ey = y - (ay + dy * t);
                    const d = ex * ex + ey * ey;
                    if (along[p] < 0 || d < off[p]) {
                        along[p] = s0 + t * L;
                        off[p] = d;
                    }
                }
            }
            s0 += L;
        }
    }
    grass.trFlow = { along, off, sideOf: null };
    return grass.trFlow;
}

function movement(ctx, grass, seed, phase) {
    const { colour, kinds, cols, water, wet, planCol, planRow, isWater } = ctx;
    if (!grass.trWater) return;
    const lakeSlots = grass.looks.map((id) => id === 'lake');
    const salt = hash(seed | 0, 0x79, 0x2545f491);
    const flow = riverFrames(grass);
    const width = grass.trWidth;
    const f = grass.trWater.f;
    for (let e = 0; e < wet; e++) {
        const i = water[e];
        if (!isWater[kinds[i]] || !lakeSlots[kinds[i] >> 4]) continue;
        const r = (i / cols) | 0;
        const c = i - r * cols;
        const p = planRow[r] + planCol[c];
        const v = f[p] / 2;
        if (v < 2) continue;
        const px = p % width;
        const py = (p - px) / width;
        const a = flow.along[p];
        if (a >= 0) {
            // In a river: lanes across it, broken dashes sliding down them.
            const d = Math.sqrt(flow.off[p]);
            const lane = Math.floor(d / 11);
            if (d % 11 >= 4) continue;
            const speed = 1 + (hash(lane, 3, salt) % 3) * 0.5;
            const q = (a - phase * 4 * speed + (hash(lane, 1, salt) % 200)) % 120;
            if ((q + 120) % 120 < 26 + (hash(lane, 2, salt) % 26)) colour[i] = Math.min(3, colour[i] + 1);
            continue;
        }
        // In a lake: a lap line near the shore that breathes in and out, and a few long slow glints.
        const w = vnoise(px, py, 16, salt + 5);
        const beat = (phase % 64) / 64;
        const lapAt = 6.5 + 3.2 * (beat < 0.5 ? beat * 2 : 2 - beat * 2);
        if (v + (w - 0.5) * 3 > lapAt && v + (w - 0.5) * 3 < lapAt + 1.1 && vnoise(px, py, 9, salt + 6) > 0.42) {
            colour[i] = Math.min(3, colour[i] + 1);
            continue;
        }
        if (v > 11) {
            // Cat's-paws: patches of short ripples that a slow breath of wind pushes across the lake.
            const patch = vnoise(px - phase * 0.6, py, 46, salt + 7);
            if (patch < 0.6) continue;
            if (r % 3 !== 0) continue;
            const run = Math.floor((c - phase * 0.3 + (hash(r, 9, salt) % 11)) / 7);
            if (hash(run, r, salt + 8) % 100 < 45) continue;
            if ((c - phase * 0.3 + (hash(r, 9, salt) % 11)) % 7 < 3.6) colour[i] = 1;
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Borders: a pixel in a cell beside another ground takes whichever of the four nearest cells' grounds
// scores most, each cell's score easing across a cell, then bent by noise. A cell's own middle always
// stays its own ground: the noise never reaches the whole margin there, so placement's cells still tell the
// truth to within half a cell, as today's strips do.

export function raggedEdges({ at, width, height, cells, cols, rows, cellPx, border, seed }) {
    const T = globalThis.__TR;
    const amp = T.edgeAmp ?? 0.85;
    const saltOf = (id) => hash(seed | 0, id + 11, 0x2545f491);
    const ids = new Int16Array(4);
    const scores = new Float64Array(4);
    for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
            if (!border[cy * cols + cx]) continue;
            const y0 = cy * cellPx;
            const y1 = Math.min(height, y0 + cellPx);
            const x0 = cx * cellPx;
            const x1 = Math.min(width, x0 + cellPx);
            for (let y = y0; y < y1; y++) {
                const v = (y + 0.5) / cellPx - 0.5;
                const gy = Math.floor(v);
                const fy = smooth(v - gy);
                for (let x = x0; x < x1; x++) {
                    const u = (x + 0.5) / cellPx - 0.5;
                    const gx = Math.floor(u);
                    const fx = smooth(u - gx);
                    let m = 0;
                    const add = (ci, cj, w) => {
                        if (w <= 0) return;
                        const c = cells[clamp(cj, 0, rows - 1) * cols + clamp(ci, 0, cols - 1)];
                        for (let q = 0; q < m; q++) if (ids[q] === c) { scores[q] += w; return; }
                        ids[m] = c;
                        scores[m] = w;
                        m++;
                    };
                    add(gx, gy, (1 - fx) * (1 - fy));
                    add(gx + 1, gy, fx * (1 - fy));
                    add(gx, gy + 1, (1 - fx) * fy);
                    add(gx + 1, gy + 1, fx * fy);
                    let top = ids[0];
                    if (m > 1) {
                        let bestScore = -Infinity;
                        for (let q = 0; q < m; q++) {
                            const s = saltOf(ids[q]);
                            const noise = 0.6 * vnoise(x, y, 19, s) + 0.28 * vnoise(x, y, 8, s + 1) + 0.12 * vnoise(x, y, 3, s + 2);
                            const score = scores[q] + (noise - 0.5) * amp;
                            if (score > bestScore) { bestScore = score; top = ids[q]; }
                        }
                    }
                    at[y * width + x] = top;
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// The dirt: ragged at the pixel, grass thinning into it, mottled inside. Hard pixels, no washes.

const E1 = 1;
const E2 = 2;
const E3 = 3;
const MIDDLE = 5;

export function afterEarth(ctx, seed, { base, kinds }) {
    const { shape, colour, pieceAt, earth, cols, rows, count } = ctx;
    const salt = hash(seed | 0, 0x7a, 0x2545f491);
    const ON = 64;
    const isEarth = (j) => (shape[j] & (ON | 1)) === (ON | 1);
    const isGrass = (j) => (shape[j] & (ON | 1)) === ON;
    // Inside: the flat middle broken up.
    for (let e = 0; e < count; e++) {
        const i = earth[e];
        const r = (i / cols) | 0;
        const c = i - r * cols;
        const h = roll(c, r, salt);
        const col = colour[i];
        if (col === MIDDLE || col === E1 || col === E2) {
            const big = vnoise(c, r, 7, salt + 1);
            if (big > 0.6 && h < 0.5) colour[i] = E3;
            else if (big < 0.42 && h < 0.5) colour[i] = E1;
            else if (h < 0.08) colour[i] = E2;
        }
    }
    // Out from the earth, three pixels: its colour showing through thinning grass.
    const total = cols * rows;
    const dist = ctx.trDist && ctx.trDist.length === total ? ctx.trDist : (ctx.trDist = new Uint8Array(total));
    dist.fill(0);
    let frontier = [];
    for (let e = 0; e < count; e++) frontier.push(earth[e]);
    const CHANCE = [0, 0.34, 0.12, 0];
    for (let d = 1; d <= 2; d++) {
        const next = [];
        for (const i of frontier) {
            const r = (i / cols) | 0;
            const c = i - r * cols;
            if (c > 0 && isGrass(i - 1) && !dist[i - 1]) { dist[i - 1] = d; next.push(i - 1); }
            if (c < cols - 1 && isGrass(i + 1) && !dist[i + 1]) { dist[i + 1] = d; next.push(i + 1); }
            if (r > 0 && isGrass(i - cols) && !dist[i - cols]) { dist[i - cols] = d; next.push(i - cols); }
            if (r < rows - 1 && isGrass(i + cols) && !dist[i + cols]) { dist[i + cols] = d; next.push(i + cols); }
        }
        for (const i of next) {
            const r = (i / cols) | 0;
            const c = i - r * cols;
            if (roll(c, r, salt + 2 + d) < CHANCE[d]) {
                colour[i] = roll(c, r, salt + 9) < 0.5 ? E2 : E1;
                pieceAt[i] = 0;
            }
        }
        frontier = next;
    }
    // In from the edge, two pixels: grass reaching in.
    for (let e = 0; e < count; e++) {
        const i = earth[e];
        const r = (i / cols) | 0;
        const c = i - r * cols;
        const edge = (c > 0 && isGrass(i - 1)) || (c < cols - 1 && isGrass(i + 1)) || (r > 0 && isGrass(i - cols)) || (r < rows - 1 && isGrass(i + cols));
        if (edge && roll(c, r, salt + 12) < 0.26) {
            colour[i] = base[kinds[i]] + 2;
            pieceAt[i] = 0;
        }
    }
    void isEarth;
}

// ---------------------------------------------------------------------------------------------
// Measures, read in the page after a build.

const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
function lab(r, g, b) {
    const R = lin(r); const G = lin(g); const B = lin(b);
    const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505;
    const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089;
    const ft = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * ft(y) - 16, 500 * (ft(x) - ft(y)), 200 * (ft(y) - ft(z))];
}
const lstar = (r, g, b) => lab(r, g, b)[0];

export function stats(plan, pass) {
    const { cols, rows, data, grass } = pass;
    const out = {};
    const looks = plan.grass?.looks || [];
    const lookAt = (i) => (grass.kinds[i] ? looks[grass.kinds[i] >> 4] : null);
    // Water: how flat, how bright.
    const hist = new Map();
    let waterN = 0;
    let waterL = 0;
    let lMin = 1e9;
    let lMax = -1e9;
    const words = new Uint32Array(data.buffer, data.byteOffset, cols * rows);
    let landN = 0;
    let landL = 0;
    let landC = 0;
    let differ = 0;
    let pairs = 0;
    let earthN = 0;
    let earthL = 0;
    let earthC = 0;
    let grassN = 0;
    let grassL = 0;
    let borderD = 0;
    let borderDE = 0;
    let borderN = 0;
    const planW = plan.width;
    const planH = plan.height;
    const ratioX = planW / cols;
    const ratioY = planH / rows;
    const isEarthAt = (c, r) => {
        const p = Math.min(planH - 1, Math.floor((r + 0.5) * ratioY)) * planW + Math.min(planW - 1, Math.floor((c + 0.5) * ratioX));
        return (plan.grass.bits[p] & 1) === 1 && !isWaterKind(p);
    };
    const waterKinds = new Set(looks.map((id, s) => [id, s]).filter(([id]) => ['lake', 'sea', 'sulphur'].includes(id)).map(([, s]) => (s << 4) | 1));
    const isWaterKind = (p) => waterKinds.has(plan.grass.kinds[p]);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            if (words[i] >>> 24 !== 255) continue;
            const d = i * 4;
            const look = lookAt(i);
            const [L, A, B] = lab(data[d], data[d + 1], data[d + 2]);
            if (look === 'lake') {
                waterN++;
                waterL += L;
                if (L < lMin) lMin = L;
                if (L > lMax) lMax = L;
                hist.set(words[i], (hist.get(words[i]) || 0) + 1);
                continue;
            }
            if (look === 'sea' || look === 'sulphur') continue;
            landN++;
            landL += L;
            landC += Math.sqrt(A * A + B * B);
            if (c + 1 < cols) { pairs++; if (words[i] !== words[i + 1]) differ++; }
            if (r + 1 < rows) { pairs++; if (words[i] !== words[i + cols]) differ++; }
            const earth = plan.grass ? isEarthAt(c, r) : false;
            if (earth) { earthN++; earthL += L; earthC += Math.sqrt(A * A + B * B); } else { grassN++; grassL += L; }
            if (c + 1 < cols && plan.grass && earth !== isEarthAt(c + 1, r)) {
                const e = d + 4;
                const [L2, A2, B2] = lab(data[e], data[e + 1], data[e + 2]);
                borderD += Math.abs(L - L2);
                borderDE += Math.sqrt((L - L2) ** 2 + (A - A2) ** 2 + (B - B2) ** 2);
                borderN++;
            }
        }
    }
    const tones = [...hist.values()].sort((a, b) => b - a);
    out.water = waterN ? {
        pixels: waterN,
        share: +(waterN / (cols * rows)).toFixed(3),
        topTone: +(tones[0] / waterN).toFixed(3),
        tones3pc: tones.filter((v) => v / waterN >= 0.03).length,
        L: +(waterL / waterN).toFixed(1), Lmin: +lMin.toFixed(1), Lmax: +lMax.toFixed(1)
    } : null;
    out.land = {
        L: +(landL / landN).toFixed(1), C: +(landC / landN).toFixed(1),
        differ: +(differ / pairs).toFixed(3),
        earthShare: +(earthN / landN).toFixed(3),
        earthL: earthN ? +(earthL / earthN).toFixed(1) : null,
        earthC: earthN ? +(earthC / earthN).toFixed(1) : null,
        grassL: grassN ? +(grassL / grassN).toFixed(1) : null,
        edgeDL: borderN ? +(borderD / borderN).toFixed(1) : null,
        edgeDE: borderN ? +(borderDE / borderN).toFixed(1) : null
    };
    out.borders = borderStats(plan);
    return out;
}

/** The land borders on the plan: how much of them runs in straight axis-aligned lines, and on the cells' lines. */
export function borderStats(plan) {
    const { width, height, terrainAt, palette } = plan;
    const isWater = palette.map((t) => String(t).startsWith('water'));
    const landPair = (a, b) => a !== b && !isWater[a] && !isWater[b];
    let total = 0;
    let longRuns = 0;
    let onGrid = 0;
    const LONG = 6;
    // Vertical edges: columns of pairs, run by run.
    for (let x = 0; x + 1 < width; x++) {
        let run = 0;
        for (let y = 0; y <= height; y++) {
            const yes = y < height && landPair(terrainAt[y * width + x], terrainAt[y * width + x + 1]);
            if (yes) {
                run++;
                total++;
                if ((x + 1) % 16 <= 1 || (x + 1) % 16 === 15) onGrid++;
            } else {
                if (run >= LONG) longRuns += run;
                run = 0;
            }
        }
    }
    for (let y = 0; y + 1 < height; y++) {
        let run = 0;
        for (let x = 0; x <= width; x++) {
            const yes = x < width && landPair(terrainAt[y * width + x], terrainAt[(y + 1) * width + x]);
            if (yes) {
                run++;
                total++;
                if ((y + 1) % 16 <= 1 || (y + 1) % 16 === 15) onGrid++;
            } else {
                if (run >= LONG) longRuns += run;
                run = 0;
            }
        }
    }
    return total ? { length: total, straightShare: +(longRuns / total).toFixed(3), onCellLines: +(onGrid / total).toFixed(3) } : null;
}

/** What the river measures on the drawn field: widths across it, how much it wanders. */
export function riverStats(plan, H) {
    const water = plan.grass?.trWater;
    const shapes = (water?.trRecord?.shapes || []).filter((s) => s.k === 'river');
    if (!shapes.length) return null;
    const { lattice, f } = water;
    const { nx, ny, step, x0, y0 } = lattice;
    const fieldAt = (x, y) => {
        const i = Math.round((x - x0) / step);
        const j = Math.round((y - y0) / step);
        if (i < 0 || j < 0 || i >= nx || j >= ny) return -1;
        return f[j * nx + i];
    };
    return shapes.map((shape) => {
        const pts = shape.points;
        const widths = [];
        let len = 0;
        let turning = 0;
        let bends = 0;
        let lastSign = 0;
        // Walk it at even steps of 24 units.
        const walk = [];
        for (let k = 0; k + 1 < pts.length; k++) {
            const [ax, ay] = pts[k];
            const [bx, by] = pts[k + 1];
            const L = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
            const n = Math.max(1, Math.round(L / 8));
            for (let q = 0; q < n; q++) walk.push([ax + (bx - ax) * q / n, ay + (by - ay) * q / n]);
            len += L;
        }
        const W = 96;
        const stepsAt = 8;
        for (let w = W; w + W < walk.length * stepsAt; w += 24) {
            const i = Math.floor(w / stepsAt);
            const a = walk[Math.max(0, i - 8)];
            const b = walk[Math.min(walk.length - 1, i + 8)];
            const hx = b[0] - a[0];
            const hy = b[1] - a[1];
            const L = Math.sqrt(hx * hx + hy * hy) || 1;
            const nxx = -hy / L;
            const nyy = hx / L;
            const [x, y] = walk[i];
            if (x < 8 || y < 8 || x > lattice.nx * step - 8 || y > lattice.ny * step - 8) continue;
            if (!(fieldAt(x, y) > 0)) continue;
            let d1 = 0;
            while (d1 < 240 && fieldAt(x + nxx * d1, y + nyy * d1) > 0) d1 += 2;
            let d2 = 0;
            while (d2 < 240 && fieldAt(x - nxx * d2, y - nyy * d2) > 0) d2 += 2;
            if (d1 >= 240 || d2 >= 240) continue;
            widths.push(d1 + d2);
        }
        // Heading changes along a 96-unit baseline.
        const headings = [];
        for (let i = 12; i + 12 < walk.length; i += 6) {
            const a = walk[i - 12];
            const b = walk[i + 12];
            const hx = b[0] - a[0];
            const hy = b[1] - a[1];
            const L = Math.sqrt(hx * hx + hy * hy) || 1;
            headings.push([hx / L, hy / L]);
        }
        for (let i = 1; i < headings.length; i++) {
            const c = headings[i - 1][0] * headings[i][1] - headings[i - 1][1] * headings[i][0];
            const t = headings[i - 1][0] * headings[i][0] + headings[i - 1][1] * headings[i][1];
            const ang = Math.atan2(c, t);
            turning += Math.abs(ang);
            if (Math.abs(ang) > 0.02) {
                const s = Math.sign(ang);
                if (lastSign && s !== lastSign) bends++;
                lastSign = s;
            }
        }
        const chord = Math.sqrt((pts[0][0] - pts[pts.length - 1][0]) ** 2 + (pts[0][1] - pts[pts.length - 1][1]) ** 2) || 1;
        widths.sort((a, b) => a - b);
        const mean = widths.reduce((a, b) => a + b, 0) / (widths.length || 1);
        const sd = Math.sqrt(widths.reduce((a, b) => a + (b - mean) ** 2, 0) / (widths.length || 1));
        const pick = (q) => widths[Math.min(widths.length - 1, Math.floor(q * widths.length))];
        return {
            length: Math.round(len), chord: Math.round(chord), sinuosity: +(len / chord).toFixed(2),
            bends, turningPer1000: +((turning * 57.3) / (len / 1000)).toFixed(0),
            widthMin: pick(0.02), widthP50: pick(0.5), widthMax: pick(0.98), widthCV: +(sd / (mean || 1)).toFixed(2),
            foldsBack: H.foldsBack(pts, 3 * 2 * (mean / 2))
        };
    });
}
