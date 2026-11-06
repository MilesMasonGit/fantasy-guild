// the world map's pictures: the painted world beneath the tiles, the rope along the ring lines and the tiles' stand-ins (pure)

import { HEX_R, TILE_LIFT, TILE_W, TILE_H, TILE_TOP_H, TILE_MID } from './worldMapLayout.js';

/**
 * Everything here is drawn on the map's art grid (`worldMapLayout.js`), into plain RGBA buffers
 * that the map puts on a canvas once and keeps: nothing here runs per frame.
 *
 * **The painted world** ({@link paintWorld}) is a colour field per kind of land, read from each
 * cell's kit alone: wobbly borders (each art pixel takes the land of a point nudged by smooth
 * noise), a darker ink line where two lands meet, sand on the shores of the Riverside's water,
 * tiny pixel symbols (trees, peaks, field rows, reeds, waves), the tiles' shadows, and fog past the
 * rings shown.
 */

const SQRT3 = Math.sqrt(3);

/** The fog the world fades into past the rings shown, and the colour beyond the picture's edge. */
export const FOG_RGB = Object.freeze([22, 27, 38]);
export const FOG_CSS = `rgb(${FOG_RGB.join(' ')})`;

/** How many rings past the rings shown the picture reaches; the fog is whole by its edge. */
export const PICTURE_RINGS_PAST = 2.4;
/** The fog starts half a ring past the rings shown and is whole this many rings further out (give or take its wobble). */
const FOG_RAMP = 1.5;
const FOG_WOBBLE = 0.35;

/** Each land's three tones, light to dark; the Riverside is water. */
export const PAINT = Object.freeze({
    highland: { tones: ['#8f8778', '#7a7366', '#655f54'], side: '#4d463d' },
    woodland: { tones: ['#55803f', '#47703a', '#3a5f31'], side: '#4a3a24' },
    plains: { tones: ['#aeaa5c', '#9b984f', '#878544'], side: '#6b5a33' },
    wetland: { tones: ['#5d8264', '#4e7258', '#41624b'], side: '#3f4a36' },
    riverside: { tones: ['#4a83b0', '#3f76a2', '#356993'], side: '#5d5340', water: true },
    hall: { tones: ['#a8865a', '#987750', '#876946'], side: '#5a4028' }
});
const LANDS = Object.freeze(Object.keys(PAINT));
const SAND = [200, 178, 124];
const SHORE_WATER = [143, 192, 220];
const OUTLINE = [16, 12, 8];
const LIGHT = [255, 240, 200];

const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const TONES = Object.fromEntries(LANDS.map(l => [l, PAINT[l].tones.map(rgb)]));

/** The land a cell is painted as: the Hall's cell is `hall`, an unknown kit plains. */
export function landOf(cell) {
    if (cell.ring === 0) return 'hall';
    return PAINT[cell.kit] ? cell.kit : 'plains';
}

// ------------------------------------------------------------------ noise

function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s);
    const b = hash(xi + 1, yi, s);
    const c = hash(xi, yi + 1, s);
    const d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.1;

// ------------------------------------------------------------------ hexes

/** The axial cell holding art point `(x, y)` from the Hall's middle, written to {@link HEX}. */
const HEX = { q: 0, r: 0 };
function hexAt(x, y) {
    const qf = (2 / 3) * x / HEX_R;
    const rf = (-x / 3 + (SQRT3 / 3) * y) / HEX_R;
    const sf = -qf - rf;
    let q = Math.round(qf);
    let r = Math.round(rf);
    const s = Math.round(sf);
    const dq = Math.abs(q - qf);
    const dr = Math.abs(r - rf);
    const ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    HEX.q = q;
    HEX.r = r;
    return HEX;
}

/** A point's distance from the Hall in rings, as a smooth number (a cell's middle is its ring). */
function ringsOut(x, y) {
    const qf = (2 / 3) * x / HEX_R;
    const rf = (-x / 3 + (SQRT3 / 3) * y) / HEX_R;
    return Math.max(Math.abs(qf), Math.abs(rf), Math.abs(qf + rf));
}

const ringOf = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));

/** A lookup of each cell's land index by axial coordinates, -1 off the world. */
function landGrid(cells) {
    let reach = 1;
    for (const c of cells) reach = Math.max(reach, Math.abs(c.q), Math.abs(c.r));
    const size = 2 * reach + 1;
    const grid = new Int8Array(size * size).fill(-1);
    for (const c of cells) grid[(c.q + reach) * size + (c.r + reach)] = LANDS.indexOf(landOf(c));
    return (q, r) => (Math.abs(q) > reach || Math.abs(r) > reach ? -1 : grid[(q + reach) * size + (r + reach)]);
}

/** The picture's size and where the Hall's middle lies in it, for `rings` rings shown. */
export function pictureFrame(rings) {
    const out = rings + PICTURE_RINGS_PAST;
    const halfW = Math.ceil((1.5 * out + 1) * HEX_R);
    const halfH = Math.ceil(SQRT3 * (out + 0.5) * HEX_R);
    return { width: 2 * halfW, height: 2 * halfH, originX: halfW, originY: halfH };
}

// ------------------------------------------------------------------ the painted world

/**
 * A slow smooth field sampled every `step` pixels (a power of two) and read back between, so the
 * noise is not worked out for every pixel.
 */
function coarseField(width, height, step, fn) {
    const cols = Math.ceil(width / step) + 2;
    const rows = Math.ceil(height / step) + 2;
    const values = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) values[j * cols + i] = fn(i * step, j * step);
    const shift = Math.log2(step);
    const mask = step - 1;
    return (x, y) => {
        const i = x >> shift;
        const j = y >> shift;
        const tx = (x & mask) / step;
        const ty = (y & mask) / step;
        const k = j * cols + i;
        const a = values[k];
        const b = values[k + 1];
        const top = a + (b - a) * tx;
        const c = values[k + cols];
        const bottom = c + (values[k + cols + 1] - c) * tx;
        return top + (bottom - top) * ty;
    };
}

/** The small symbol each land scatters, as art pixels around a point: `[dx, dy, colour]`. */
const SYMBOLS = Object.freeze({
    woodland: [[0, 2, '#4a3220'], [0, 3, '#4a3220'],
        ...[[-1, -2], [0, -2], [1, -2], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1]]
            .map(([x, y]) => [x, y, '#2b5427']),
        ...[[-1, -2], [-1, -1], [0, -2], [-2, -1]].map(([x, y]) => [x, y, '#6c9c4c'])],
    highland: (() => {
        const out = [];
        for (let h = 0; h < 6; h++) for (let w = -h; w <= h; w++) out.push([w, h - 5, w < 0 ? '#b3ab9b' : '#4a453c']);
        out.push([0, -5, '#ecebe6'], [-1, -4, '#ecebe6'], [0, -4, '#d5d3cc']);
        return out;
    })(),
    plains: [...[-3, -2, -1, 0, 1, 2, 3].map(w => [w, 0, '#c6c072']), ...[-3, -2, -1, 0, 1, 2, 3].map(w => [w, 2, '#6f6d38'])],
    wetland: [[0, 0, '#a7bf6c'], [0, -1, '#a7bf6c'], [2, 0, '#a7bf6c'], [2, -2, '#a7bf6c'], [2, -1, '#a7bf6c'],
        [-2, 1, '#2f5560'], [-1, 1, '#2f5560'], [3, 1, '#2f5560']],
    riverside: [[-1, 0, '#9cc8e4'], [0, -1, '#9cc8e4'], [1, 0, '#9cc8e4']],
    hall: []
});
const SYMBOL_RGB = Object.fromEntries(Object.entries(SYMBOLS).map(([k, list]) => [k, list.map(([x, y, c]) => [x, y, rgb(c)])]));
/** How often each land's jittered grid point holds a symbol. */
const SYMBOL_ODDS = Object.freeze({ woodland: 0.8, highland: 0.45, plains: 0.35, wetland: 0.4, riverside: 0.35, hall: 0 });

const put = (data, i, c) => {
    const k = i * 4;
    data[k] = c[0];
    data[k + 1] = c[1];
    data[k + 2] = c[2];
    data[k + 3] = 255;
};

/**
 * Paint the world beneath the tiles.
 *
 * @param {object} args
 * @param {Array<{q: number, r: number, ring: number, kit?: string}>} args.cells every cell of the world
 * @param {number} args.rings the rings shown: their tiles cast shadows, and the fog starts past them
 * @param {Record<string, {width: number, height: number, data: ArrayLike<number>}>} [args.symbols]
 *   the owner's 8 x 8 symbol per land, drawn in place of the code's
 * @returns {{width: number, height: number, originX: number, originY: number, data: Uint8ClampedArray}}
 */
export function paintWorld({ cells, rings, symbols = {} }) {
    const frame = pictureFrame(rings);
    const { width, height, originX, originY } = frame;
    const n = width * height;
    const data = new Uint8ClampedArray(n * 4);
    // ⚠️ One 32-bit store per pixel (little-endian RGBA): several times faster than four bytes.
    const out32 = new Uint32Array(data.buffer);
    const pack = (c, k = 1) => ((255 << 24) | (Math.round(c[2] * k) << 16) | (Math.round(c[1] * k) << 8) | Math.round(c[0] * k)) >>> 0;
    // Each land's tones, sand and shore, at full light, on an ink line, in shadow and both.
    const DIMS = [1, 0.72, 0.45, 0.72 * 0.45];
    const toneOf = LANDS.map(l => TONES[l].map(c => DIMS.map(k => pack(c, k))));
    const sandOf = DIMS.map(k => pack(SAND, k));
    const shoreOf = DIMS.map(k => pack(SHORE_WATER, k));

    const landAt = landGrid(cells);
    const warp = 14;
    const wobble = 34;
    const warpX = coarseField(width, height, 4, (x, y) => (fbm(x / wobble, y / wobble, 1) - 0.5) * 2 * warp);
    const warpY = coarseField(width, height, 4, (x, y) => (fbm(x / wobble, y / wobble, 2) - 0.5) * 2 * warp);
    const fogNoise = coarseField(width, height, 4, (x, y) => (fbm(x / 30, y / 30, 8) - 0.5) * 2 * FOG_WOBBLE);
    const toneNoise = coarseField(width, height, 4, (x, y) => fbm(x / 9, y / 9, 5));
    const isWater = Uint8Array.from(LANDS, l => (PAINT[l].water ? 1 : 0));
    const fogFrom = rings + 0.5 - FOG_WOBBLE;
    const fogAll = rings + 0.5 + FOG_RAMP + FOG_WOBBLE;

    // Each art pixel's land, from a point nudged by the warp: the wobbly borders. Beside it, whether
    // the unnudged point lies under a shown tile, for the shadows. Past the fog, nothing.
    const land = new Int8Array(n).fill(-1);
    const under = new Uint8Array(n);
    const wet = new Uint8Array(n);
    const near = new Float32Array(n);
    for (let y = 0; y < height; y++) {
        const py = y - originY + 0.5;
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const px = x - originX + 0.5;
            const out = ringsOut(px, py);
            near[i] = out;
            if (out > fogAll) continue;
            let at = hexAt(px + warpX(x, y), py + warpY(x, y));
            const k = landAt(at.q, at.r);
            land[i] = k;
            if (k >= 0 && isWater[k]) wet[i] = 1;
            if (out < rings - 0.7) under[i] = 1;
            else if (out <= rings + 0.7) {
                at = hexAt(px, py);
                if (ringOf(at.q, at.r) <= rings && landAt(at.q, at.r) >= 0) under[i] = 1;
            }
        }
    }
    // Land within 2 px (across or down) of water is sand.
    const nearWet = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        if (!wet[i]) continue;
        const x = i % width;
        for (let d = -2; d <= 2; d++) {
            if (x + d >= 0 && x + d < width) nearWet[i + d] = 1;
            const j = i + d * width;
            if (j >= 0 && j < n) nearWet[j] = 1;
        }
    }

    const fog = FOG_RGB;
    /** How far into the fog an art pixel lies, 0 to 1. */
    const fogT = (x, y, i) => (near[i] < fogFrom ? 0 : Math.min(1, Math.max(0, (near[i] + fogNoise(x, y) - (rings + 0.5)) / FOG_RAMP)));
    const fogged = (x, y, i, c) => {
        const t = fogT(x, y, i);
        if (t <= 0) return c;
        const f0 = fog[0] + hash(x, y, 11) * 6;
        const r = c & 255;
        const g = (c >>> 8) & 255;
        const b = (c >>> 16) & 255;
        return ((255 << 24) | (Math.round(b + (fog[2] - b) * t) << 16) | (Math.round(g + (fog[1] - g) * t) << 8) | Math.round(r + (f0 - r) * t)) >>> 0;
    };
    const FOGS = [0, 1, 2, 3, 4, 5, 6].map(d => pack([fog[0] + d, fog[1], fog[2]]));
    const fogPixel = (x, y) => FOGS[Math.floor(hash(x, y, 11) * 7)];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            const k = land[i];
            if (k < 0) {
                out32[i] = fogPixel(x, y);
                continue;
            }
            const right = x + 1 < width ? land[i + 1] : -1;
            const below = y + 1 < height ? land[i + width] : -1;
            // The tiles' hard shadows: 3 art px right and 1 down of each shown cell's foot.
            const shade = x >= 3 && y >= 1 && under[i - width - 3] ? 2 : 0;
            let c;
            if (isWater[k]) {
                const left = x > 0 ? land[i - 1] : -1;
                const above = y > 0 ? land[i - width] : -1;
                c = ((right >= 0 && !isWater[right]) || (left >= 0 && !isWater[left])
                    || (below >= 0 && !isWater[below]) || (above >= 0 && !isWater[above]))
                    ? shoreOf[shade]
                    : null;
            } else if (nearWet[i]) {
                c = sandOf[shade];
            } else {
                c = null;
            }
            if (c === null) {
                const tone = toneNoise(x, y) + (hash(x, y, 9) - 0.5) * 0.18;
                const ink = !isWater[k] && ((right >= 0 && right !== k) || (below >= 0 && below !== k)) ? 1 : 0;
                c = toneOf[k][tone < 0.42 ? 2 : tone < 0.6 ? 1 : 0][ink + shade];
            }
            out32[i] = near[i] < fogFrom ? c : fogged(x, y, i, c);
        }
    }

    // The small symbols, on a jittered grid, kept off the shores and out from under the tiles.
    const landNear = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? -1 : land[y * width + x]);
    const water = (k) => k >= 0 && isWater[k] === 1;
    const stamp = (px, py, c) => {
        if (px < 0 || py < 0 || px >= width || py >= height) return;
        const i = py * width + px;
        out32[i] = fogged(px, py, i, pack(c));
    };
    for (let gy = 4; gy < height; gy += 9) {
        for (let gx = 4; gx < width; gx += 9) {
            const x = Math.round(gx + hash(gx, gy, 3) * 6);
            const y = Math.round(gy + hash(gx, gy, 4) * 6);
            const k = landNear(x, y);
            if (k < 0 || under[y * width + x]) continue;
            const name = LANDS[k];
            if (hash(gx, gy, 6) > SYMBOL_ODDS[name]) continue;
            if (!water(k) && (water(landNear(x + 3, y)) || water(landNear(x - 3, y)) || water(landNear(x, y + 3)) || water(landNear(x, y - 3)))) continue;
            const art = symbols[name];
            if (art) {
                for (let sy = 0; sy < art.height; sy++) {
                    for (let sx = 0; sx < art.width; sx++) {
                        const a = (sy * art.width + sx) * 4;
                        if (art.data[a + 3] < 128) continue;
                        stamp(x - (art.width >> 1) + sx, y - (art.height >> 1) + sy, [art.data[a], art.data[a + 1], art.data[a + 2]]);
                    }
                }
            } else {
                for (const [dx, dy, c] of SYMBOL_RGB[name]) stamp(x + dx, y + dy, c);
            }
        }
    }
    return { ...frame, data };
}

// ------------------------------------------------------------------ the ring lines

const AXIAL = Object.freeze([[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]);

/** An edge's angle as the rope's pieces name it: flat, rising (/) or falling (\). */
function edgeKind(a, b) {
    if (Math.abs(a.y - b.y) < 1) return 'flat';
    return (b.y - a.y) * (b.x - a.x) > 0 ? 'fall' : 'rise';
}

/**
 * The ring lines: every edge where a shown cell meets a cell of a further ring (the outer edge of
 * the rings shown too), never round the Hall's cell; and the corners they meet at. In art px from
 * the Hall's middle, on the world (the rope is drawn lifted to the tiles' tops).
 *
 * @param {Array<{q: number, r: number, ring: number}>} cells
 * @param {number} rings the rings shown
 * @param {(cell: object) => {x: number, y: number}} centreOf a cell's middle in art px
 */
export function ringEdges(cells, rings, centreOf) {
    const edges = [];
    const corners = new Map();
    for (const cell of cells) {
        if (cell.ring === 0 || cell.ring > rings) continue;
        const o = centreOf(cell);
        for (const [dq, dr] of AXIAL) {
            if (ringOf(cell.q + dq, cell.r + dr) <= cell.ring) continue;
            const angle = Math.atan2(SQRT3 * (dr + dq / 2), 1.5 * dq);
            const [a, b] = [angle - Math.PI / 6, angle + Math.PI / 6]
                .map(t => ({ x: Math.round(o.x + HEX_R * Math.cos(t)), y: Math.round(o.y + HEX_R * Math.sin(t)) }));
            edges.push({ a, b, kind: edgeKind(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
            for (const p of [a, b]) corners.set(`${p.x},${p.y}`, p);
        }
    }
    return { edges, corners: [...corners.values()] };
}

const ROPE_LIGHT = rgb('#e2c48a');
const ROPE_DARK = rgb('#8a6431');
const ROPE_EDGE = rgb('#3a2610');
const KNOT = Object.freeze(['.kkk.', 'klllk', 'kldlk', 'klllk', '.kkk.']);
const KNOT_RGB = { k: ROPE_EDGE, l: ROPE_LIGHT, d: ROPE_DARK };

/**
 * The rope along the ring lines, lifted to the tiles' tops, on a clear picture the size of the
 * world's ({@link pictureFrame}). Edges of the kinds in `skip` and, with `skipKnots`, the knots are
 * left out: the owner's pieces are drawn there instead.
 */
export function paintRope({ edges, corners }, frame, { skip = [], skipKnots = false } = {}) {
    const { width, height, originX, originY } = frame;
    const data = new Uint8ClampedArray(width * height * 4);
    const plot = (x, y, c) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        put(data, y * width + x, c);
    };
    const lift = TILE_LIFT;
    for (const e of edges) {
        if (skip.includes(e.kind)) continue;
        const dx = e.b.x - e.a.x;
        const dy = e.b.y - e.a.y;
        const steps = Math.ceil(Math.hypot(dx, dy) * 2);
        for (let s = 0; s <= steps; s++) {
            const x = Math.round(originX + e.a.x + dx * s / steps);
            const y = Math.round(originY + e.a.y + dy * s / steps) - lift;
            const twist = (xx, yy) => (((xx + yy) & 3) < 2 ? ROPE_LIGHT : ROPE_DARK);
            if (e.kind === 'flat') {
                plot(x, y - 1, twist(x, y - 1));
                plot(x, y, twist(x, y));
                plot(x, y + 1, ROPE_EDGE);
            } else {
                plot(x - 1, y, twist(x - 1, y));
                plot(x, y, twist(x, y));
            }
        }
    }
    if (!skipKnots) {
        for (const p of corners) {
            for (let j = 0; j < KNOT.length; j++) {
                for (let i = 0; i < KNOT[j].length; i++) {
                    const ch = KNOT[j][i];
                    if (ch !== '.') plot(originX + p.x - 2 + i, originY + p.y - lift - 2 + j, KNOT_RGB[ch]);
                }
            }
        }
    }
    return { ...frame, data };
}

// ------------------------------------------------------------------ the tile stand-ins

/** Whether art point `(x, y)` of the tile picture lies on the top face. */
function onTop(x, y) {
    const dx = Math.abs(x + 0.5 - TILE_MID.x);
    const dy = Math.abs(y + 0.5 - (TILE_MID.y + 0.5));
    const h = (SQRT3 / 2) * HEX_R;
    return dy <= h && dx <= HEX_R - dy / SQRT3;
}

/**
 * A code-drawn board tile for `land` until the owner's (`worldMapArt.js`): the top face in the
 * land's colours with a few of its symbols, lit along its top-left edge, outlined; the side under
 * it in the land's earth, darker to the right.
 *
 * @returns {{width: number, height: number, data: Uint8ClampedArray}}
 */
export function tileStandIn(land) {
    const name = PAINT[land] ? land : 'plains';
    const width = TILE_W;
    const height = TILE_H;
    const data = new Uint8ClampedArray(width * height * 4);
    const top = (x, y) => x >= 0 && y >= 0 && x < width && y < TILE_TOP_H && onTop(x, y);
    const foot = (x, y) => top(x, y - TILE_LIFT);
    const side = rgb(PAINT[name].side);
    const seed = LANDS.indexOf(name) * 31 + 7;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (top(x, y)) {
                const edge = !top(x + 1, y) || !top(x - 1, y) || !top(x, y + 1) || !top(x, y - 1);
                if (edge) {
                    put(data, i, OUTLINE);
                    continue;
                }
                const tone = fbm(x / 6, y / 6, seed) + (hash(x, y, seed) - 0.5) * 0.2;
                let colour = TONES[name][tone < 0.42 ? 2 : tone < 0.6 ? 1 : 0];
                const nearEdge = !top(x + 2, y) || !top(x - 2, y) || !top(x, y + 2) || !top(x, y - 2);
                const lit = -(x - TILE_MID.x) * 0.6 - (y - TILE_MID.y) > 0;
                if (nearEdge && lit) colour = colour.map((c, j) => c + (LIGHT[j] - c) * 0.4);
                put(data, i, colour);
            } else if (foot(x, y)) {
                const edge = !foot(x, y + 1) || !foot(x + 1, y) || !foot(x - 1, y);
                const shade = 0.75 + 0.35 * (0.5 - (x - TILE_MID.x) / width);
                put(data, i, edge ? OUTLINE : side.map(c => c * shade));
            }
        }
    }
    // A few of the land's symbols, clear of the middle (its Token) and the foot (its plate).
    const spots = [[-28, -14], [24, -18], [-14, -26], [30, 2], [-32, 6]];
    for (const [sx, sy] of spots) {
        for (const [dx, dy, c] of SYMBOL_RGB[name]) {
            const x = TILE_MID.x + sx + dx;
            const y = TILE_MID.y + sy + dy;
            if (top(x, y) && top(x + 1, y) && top(x - 1, y) && top(x, y + 1) && top(x, y - 1)) put(data, y * width + x, c);
        }
    }
    return { width, height, data };
}
