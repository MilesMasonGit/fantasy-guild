// Throwaway (brief 380 M1): the world map mock-ups, drawn from a real generated world (`world.json`)
// and each cell's real mat ground (`ground/*.png`, from `dump_world.mjs`).
// mock.html?hex=A|B|C|none&world=D|E|F&pulse=0|1
// Everything is drawn on an art grid of 960 x 540 (1 art px = 2 screen px), then the sprites at 1x.

const params = new URLSearchParams(location.search);
const HEX = params.get('hex') || 'A';
const WORLD = params.get('world') || 'E';
const PULSE = Number(params.get('pulse') || 0);
const PULSE_ALL = params.get('pulseAll') === '1';

const SW = 1920, SH = 1080, S = 2;
const AW = SW / S, AH = SH / S;
const R = 42; // hex radius in art px (84 screen px; the book's map was about 50)
const CX = 380, CY = 270; // the Hall's cell, in art px
const SQ3 = Math.sqrt(3);
const SHOWN_RINGS = 3;

const GOLD = [251, 191, 36], GOLD_PALE = [253, 230, 138], WHITE = [255, 255, 255];

// ---------------------------------------------------------------- data
const base = '/docs/active/research/world_hexes/_tools/';
const world = await (await fetch(base + 'world.json')).json();
const cells = world.cells;
const byId = new Map(cells.map(c => [c.id, c]));
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
const pixelsOf = (img) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height);
};
await document.fonts.load('16px SilkPixel');

const timings = {};
const tick = (k, t0) => { timings[k] = +(performance.now() - t0).toFixed(1); };

// The play state shown: ring 2's star bought, ring 3's not. The guild stands on -2,1.
const SETTLED = new Set(['0,0', '-1,0', '0,1', '-1,1', '-2,1']);
const HERE = '-2,1';
const READY = new Set(['0,-1', '-2,2']); // can be settled right now
const RING_STAR = 2; // the highest ring the guild's stars open
const HOVER = '2,-1'; // a far cell under the pointer
const axial = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const neighbourIds = (c) => axial.map(([dq, dr]) => `${c.q + dq},${c.r + dr}`);
for (const c of cells) {
    if (SETTLED.has(c.id)) c.state = 'settled';
    else if (neighbourIds(c).some(id => SETTLED.has(id))) c.state = (READY.has(c.id) && c.ring <= RING_STAR) ? 'ready' : 'dark';
    else c.state = 'grey';
    c.shown = c.ring <= SHOWN_RINGS; // no ring beyond the third unless accessible (none is, here)
    if (c.id === HOVER) c.hover = true;
}

// ---------------------------------------------------------------- geometry
const centreOf = (c) => ({ x: CX + 1.5 * c.q * R, y: CY + SQ3 * (c.r + c.q / 2) * R });
function cellAt(x, y) {
    const dx = x - CX, dy = y - CY;
    const qf = (2 / 3) * dx / R, rf = (-dx / 3 + SQ3 / 3 * dy) / R, sf = -qf - rf;
    let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
    const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    return byId.get(`${q},${r}`) || null;
}

// Smooth value noise for the wobbly borders and the painted tones.
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.1;

// The exact cell of every art pixel, and each pixel's distance in from its cell's edge.
const N = AW * AH;
const cellIdx = new Int32Array(N).fill(-1);
const idx = new Map(cells.map((c, i) => [c, i]));
for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const c = cellAt(x + 0.5, y + 0.5);
    cellIdx[y * AW + x] = c ? idx.get(c) : -1;
}
const dist = new Int16Array(N).fill(-1);
{
    const queue = [];
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const i = y * AW + x, me = cellIdx[i];
        if ((x + 1 < AW && cellIdx[i + 1] !== me) || (x > 0 && cellIdx[i - 1] !== me) ||
            (y + 1 < AH && cellIdx[i + AW] !== me) || (y > 0 && cellIdx[i - AW] !== me)) { dist[i] = 0; queue.push(i); }
    }
    for (let h = 0; h < queue.length; h++) {
        const i = queue[h], x = i % AW, y = (i - x) / AW;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
            if (nx < 0 || ny < 0 || nx >= AW || ny >= AH) continue;
            const j = ny * AW + nx;
            if (dist[j] < 0 && cellIdx[j] === cellIdx[i]) { dist[j] = dist[i] + 1; queue.push(j); }
        }
    }
}

// ---------------------------------------------------------------- the cells' ground (their real mats)
const t0g = performance.now();
const grounds = new Map();
await Promise.all(cells.map(async (c) => {
    const img = await loadImg(`${base}ground/${c.id.replace(',', '_')}.png`);
    if (img) grounds.set(c.id, pixelsOf(img));
}));
// Each cell's window onto its mat: the most varied spot away from the mat's rim (water, stone, grass).
for (const c of cells) {
    const g = grounds.get(c.id);
    if (!g) continue;
    let best = null;
    for (let y = 56; y <= g.height - 56; y += 10) for (let x = 60; x <= g.width - 60; x += 12) {
        let s = 0, s2 = 0, n = 0;
        for (let yy = -30; yy <= 30; yy += 4) for (let xx = -36; xx <= 36; xx += 4) {
            const k = ((y + yy) * g.width + (x + xx)) * 4;
            const l = g.data[k] * 0.3 + g.data[k + 1] * 0.5 + g.data[k + 2] * 0.2; s += l; s2 += l * l; n++;
        }
        const varc = s2 / n - (s / n) ** 2 - 0.02 * ((x - g.width / 2) ** 2 + (y - g.height / 2) ** 2) / 10;
        if (!best || varc > best.v) best = { v: varc, x, y };
    }
    c.crop = c.ring === 0 ? { x: g.width / 2, y: g.height / 2 + 14 } : best;
}
tick('loadGround', t0g);
const groundRGB = (c, dx, dy) => {
    const g = grounds.get(c.id);
    if (!g || !c.crop) return [60, 60, 60];
    const x = Math.max(4, Math.min(g.width - 5, Math.round(c.crop.x + dx)));
    const y = Math.max(4, Math.min(g.height - 5, Math.round(c.crop.y + dy)));
    const k = (y * g.width + x) * 4;
    return [g.data[k], g.data[k + 1], g.data[k + 2]];
};

// ---------------------------------------------------------------- the world picture (D, E, F)
const worldArt = new Uint8ClampedArray(N * 4);
const put = (buf, i, [r, g, b]) => { buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255; };
const get = (buf, i) => [buf[i * 4], buf[i * 4 + 1], buf[i * 4 + 2]];
const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const WARP = WORLD === 'D' ? 14 : 7;
const WF = WORLD === 'D' ? 34 : 23;
const warped = (x, y) => [x + (fbm(x / WF, y / WF, 1) - 0.5) * 2 * WARP, y + (fbm(x / WF, y / WF, 2) - 0.5) * 2 * WARP];

const PAINT = {
    highland: { tones: ['#8f8778', '#7a7366', '#655f54'] },
    woodland: { tones: ['#55803f', '#47703a', '#3a5f31'] },
    plains: { tones: ['#aeaa5c', '#9b984f', '#878544'] },
    wetland: { tones: ['#5d8264', '#4e7258', '#41624b'] },
    riverside: { tones: ['#4a83b0', '#3f76a2', '#356993'], water: true },
    hall: { tones: ['#a8865a', '#987750', '#876946'] }
};
const kitOf = (c) => (c.ring === 0 ? 'hall' : c.kit || 'plains');

function buildPainted() {
    const t0 = performance.now();
    const kitAt = new Array(N);
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const [wx, wy] = warped(x, y);
        const c = cellAt(wx, wy);
        kitAt[y * AW + x] = c ? kitOf(c) : null;
    }
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const i = y * AW + x, k = kitAt[i];
        if (!k) { put(worldArt, i, [24, 30, 40]); continue; }
        const p = PAINT[k];
        const n = fbm(x / 9, y / 9, 5) + (hash(x, y, 9) - 0.5) * 0.18;
        const tone = n < 0.42 ? 2 : n < 0.6 ? 1 : 0;
        let col = hex2rgb(p.tones[tone]);
        // shores: land touching water gets a sand fringe, water touching land a pale edge
        const near = (dx, dy) => kitAt[Math.min(N - 1, Math.max(0, i + dy * AW + dx))];
        if (!p.water && [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => PAINT[near(dx, dy)]?.water)) col = hex2rgb('#c8b27c');
        if (p.water && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => near(dx, dy) && !PAINT[near(dx, dy)]?.water)) col = hex2rgb('#8fc0dc');
        // a dark ink line where two kinds of land meet
        if (!p.water && [[1, 0], [0, 1]].some(([dx, dy]) => near(dx, dy) && near(dx, dy) !== k && !PAINT[near(dx, dy)]?.water)) col = scale(col, 0.72);
        put(worldArt, i, col);
    }
    // glyphs, scattered per cell on a jittered grid
    const px = (x, y, col) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < AW && y < AH) put(worldArt, y * AW + x, hex2rgb(col)); };
    const glyph = {
        woodland: (x, y) => { // a round canopy and trunk
            px(x, y + 2, '#4a3220'); px(x, y + 3, '#4a3220');
            for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1]]) px(x + dx, y + dy, '#2b5427');
            for (const [dx, dy] of [[-1, -2], [-1, -1], [0, -2], [-2, -1]]) px(x + dx, y + dy, '#6c9c4c');
        },
        highland: (x, y) => { // a peak, lit from the top left, snow on top
            for (let h = 0; h < 6; h++) for (let w = -h; w <= h; w++) px(x + w, y - 5 + h, w < 0 ? '#b3ab9b' : '#4a453c');
            px(x, y - 5, '#ecebe6'); px(x - 1, y - 4, '#ecebe6'); px(x, y - 4, '#d5d3cc');
        },
        plains: (x, y) => { for (let w = -3; w <= 3; w++) { px(x + w, y, '#c6c072'); px(x + w, y + 2, '#6f6d38'); } },
        wetland: (x, y) => { px(x, y, '#a7bf6c'); px(x, y - 1, '#a7bf6c'); px(x + 2, y, '#a7bf6c'); px(x + 2, y - 2, '#a7bf6c'); px(x + 2, y - 1, '#a7bf6c'); px(x - 2, y + 1, '#2f5560'); px(x - 1, y + 1, '#2f5560'); px(x + 3, y + 1, '#2f5560'); },
        riverside: (x, y) => { px(x - 1, y, '#9cc8e4'); px(x, y - 1, '#9cc8e4'); px(x + 1, y, '#9cc8e4'); },
        hall: () => {}
    };
    for (let gy = 4; gy < AH; gy += 9) for (let gx = 4; gx < AW; gx += 9) {
        const x = gx + hash(gx, gy, 3) * 6, y = gy + hash(gx, gy, 4) * 6;
        const k = kitAt[Math.round(y) * AW + Math.round(x)];
        if (!k || hash(gx, gy, 6) > ({ woodland: 0.8, highland: 0.45, plains: 0.35, wetland: 0.4, riverside: 0.35, hall: 0 })[k]) continue;
        // keep glyphs off the shore
        if (k !== 'riverside' && [[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => kitAt[Math.round(y + dy) * AW + Math.round(x + dx)] === 'riverside')) continue;
        glyph[k](x, y);
    }
    // the Hall: a little keep
    const h = centreOf(byId.get('0,0'));
    for (let yy = -4; yy <= 4; yy++) for (let xx = -5; xx <= 5; xx++) px(h.x + xx, h.y + yy, yy < -1 ? '#7a2f22' : '#d7c7a0');
    tick('worldPicture', t0);
}

function buildPatchwork() {
    const t0 = performance.now();
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const [wx, wy] = warped(x, y);
        const c = cellAt(wx, wy);
        const i = y * AW + x;
        if (!c) { put(worldArt, i, [24, 30, 40]); continue; }
        const o = centreOf(c);
        put(worldArt, i, groundRGB(c, x - o.x, y - o.y));
    }
    tick('worldPicture', t0);
}

// Beyond the third ring the world fades into a night fog.
function fog(buf) {
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const dx = x - CX, dy = y - CY;
        const qf = (2 / 3) * dx / R, rf = (-dx / 3 + SQ3 / 3 * dy) / R;
        const ringf = Math.max(Math.abs(qf), Math.abs(rf), Math.abs(qf + rf)) + (fbm(x / 30, y / 30, 8) - 0.5) * 0.7;
        const t = Math.min(1, Math.max(0, (ringf - 3.5) / 1.8)) * 0.82;
        if (t <= 0) continue;
        const i = y * AW + x;
        const f = [22 + hash(x, y, 11) * 6, 28, 40];
        put(buf, i, mix(get(buf, i), f, t));
    }
}

if (WORLD === 'D') buildPainted(); else buildPatchwork();
fog(worldArt);

// ---------------------------------------------------------------- state filters
const grey = ([r, g, b]) => { const l = r * 0.3 + g * 0.55 + b * 0.15; return [l, l, l]; };
function stateCol(c, col) {
    if (c.hover || c.state === 'settled' || c.state === 'ready') return col;
    if (c.state === 'dark') return scale(col, 0.5);
    return scale(grey(col), 0.8); // grey: not next to anything you hold
}
const iconFilter = (c) => (c.hover || c.state === 'settled' || c.state === 'ready') ? 'none'
    : c.state === 'dark' ? 'brightness(0.62)' : 'grayscale(1) brightness(0.85)';

// ---------------------------------------------------------------- the hex looks
const out = new Uint8ClampedArray(worldArt);
const shownAt = (i) => { const k = cellIdx[i]; return k >= 0 && cells[k].shown ? cells[k] : null; };
const t0h = performance.now();

// The ring lines: every edge where a shown cell meets a cell of another ring (the outer edge too).
const ringEdges = [];
for (const c of cells) {
    if (!c.shown || c.ring === 0) continue;
    axial.forEach(([dq, dr], k) => {
        const n = byId.get(`${c.q + dq},${c.r + dr}`);
        if (!n || n.ring <= c.ring || n.ring === 0) return;
        // the shared edge: the two corners of c facing n
        const o = centreOf(c);
        const ang = Math.atan2(SQ3 * (dr + dq / 2), 1.5 * dq);
        const a1 = ang - Math.PI / 6, a2 = ang + Math.PI / 6;
        ringEdges.push({ ax: o.x + R * Math.cos(a1), ay: o.y + R * Math.sin(a1), bx: o.x + R * Math.cos(a2), by: o.y + R * Math.sin(a2), outer: n.ring > SHOWN_RINGS });
    });
}
const ringPixel = (i) => {
    const k = cellIdx[i]; if (k < 0) return false;
    const me = cells[k];
    if (dist[i] !== 0) return false;
    const x = i % AW, y = (i - x) / AW;
    for (const j of [i + 1, i - 1, i + AW, i - AW]) {
        if (j < 0 || j >= N) continue;
        const o = cellIdx[j]; if (o < 0) continue;
        const them = cells[o];
        if (them === me || me.ring === them.ring) continue;
        if (Math.min(me.ring, them.ring) === 0) continue;
        if (Math.min(me.ring, them.ring) > SHOWN_RINGS) continue;
        return true;
    }
    return false;
};
const vertices = [];
{
    const seen = new Set();
    for (const e of ringEdges) for (const [x, y] of [[e.ax, e.ay], [e.bx, e.by]]) {
        const key = `${Math.round(x)},${Math.round(y)}`;
        if (!seen.has(key)) { seen.add(key); vertices.push({ x, y }); }
    }
}
const stamp = (buf, cx, cy, pattern, colours, dy = 0) => {
    const h = pattern.length, w = pattern[0].length;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const ch = pattern[yy][xx]; if (ch === '.') continue;
        const x = Math.round(cx) - (w >> 1) + xx, y = Math.round(cy) - (h >> 1) + yy + dy;
        if (x >= 0 && y >= 0 && x < AW && y < AH) put(buf, y * AW + x, colours[ch]);
    }
};
const DIAMOND = ['...k...', '..kgk..', '.kglgk.', 'kglwlgk', '.kglgk.', '..kgk..', '...k...'];
const KNOT = ['.kkk.', 'klllk', 'kldlk', 'klllk', '.kkk.'];
const STUD = ['kkk', 'klk', 'kkk'];

function outlineAt(i, c, d, col) { if (dist[i] === d) put(out, i, col); }

if (HEX === 'A') {
    // Clear glass: the world picture is the hex; a fine dark line between cells.
    for (let i = 0; i < N; i++) {
        const c = shownAt(i); if (!c) continue;
        put(out, i, stateCol(c, get(worldArt, i)));
        if (dist[i] === 0) put(out, i, scale(get(out, i), 0.45));
    }
    for (let i = 0; i < N; i++) {
        if (!ringPixel(i)) continue;
        put(out, i, hex2rgb('#d9b25a'));
        const x = i % AW;
        for (const j of [i + 1, i - 1, i + AW, i - AW]) if (j >= 0 && j < N && !ringPixel(j) && dist[j] === 1) put(out, j, hex2rgb('#2a1d0c'));
    }
    for (const v of vertices) stamp(out, v.x, v.y, DIAMOND, { k: hex2rgb('#2a1d0c'), g: hex2rgb('#b88a2e'), l: hex2rgb('#f0cf74'), w: hex2rgb('#fff4cf') });
}

if (HEX === 'B') {
    // Framed terrain tiles: each hex its own window on its mat, bevelled, a gap and a hard shadow.
    for (let i = 0; i < N; i++) { const c = shownAt(i); if (c && dist[i] <= 1) put(out, i, scale(get(worldArt, i), 0.55)); }
    // hard shadow: 2 art px down-right
    for (let i = 0; i < N; i++) {
        const c = shownAt(i); if (!c || dist[i] < 2) continue;
        const x = i % AW, y = (i - x) / AW;
        if (x + 2 < AW && y + 2 < AH) { const j = i + 2 * AW + 2; if (!(shownAt(j) && dist[j] >= 2)) put(out, j, scale(get(worldArt, j), 0.3)); }
    }
    for (let i = 0; i < N; i++) {
        const c = shownAt(i); if (!c || dist[i] < 2) continue;
        const x = i % AW, y = (i - x) / AW, o = centreOf(c);
        let col = groundRGB(c, x - o.x, y - o.y);
        if (dist[i] === 2) col = [16, 12, 8];
        else if (dist[i] === 3) { const nx = x - o.x, ny = y - o.y; col = (-nx * 0.6 - ny) > 0 ? mix(col, [255, 240, 200], 0.45) : scale(col, 0.55); }
        put(out, i, stateCol(c, col));
    }
    // ring lines: the bronze inlay in the gap, a stud at every corner and mid-edge
    for (let i = 0; i < N; i++) if (ringPixel(i)) { put(out, i, hex2rgb('#c79a3a')); }
    for (let i = 0; i < N; i++) if (ringPixel(i)) for (const j of [i + 1, i - 1, i + AW, i - AW]) if (j >= 0 && j < N && dist[j] === 1) put(out, j, hex2rgb('#8a6420'));
    const studCols = { k: hex2rgb('#2a1d0c'), l: hex2rgb('#f3d27a'), d: hex2rgb('#b07f26') };
    for (const v of vertices) stamp(out, v.x, v.y, ['.kkk.', 'kllldk'.slice(0, 5), 'kldlk', 'kdddk', '.kkk.'], studCols);
    for (const e of ringEdges) stamp(out, (e.ax + e.bx) / 2, (e.ay + e.by) / 2, STUD, studCols);
}

const LIFT = 5; // look C: a tile's thickness in art px
if (HEX === 'C') {
    // Board-game tiles: thick hex tiles standing on the world, their side in the kit's earth.
    const SIDE = { highland: '#4d463d', woodland: '#4a3a24', plains: '#6b5a33', wetland: '#3f4a36', riverside: '#5d5340', hall: '#5a4028' };
    // shadow on the world, 3 art px down-right of the footprint
    for (let i = 0; i < N; i++) {
        const c = shownAt(i); if (!c || dist[i] < 1) continue;
        const x = i % AW, y = (i - x) / AW;
        if (x + 3 < AW && y + 1 < AH) { const j = i + AW + 3; put(out, j, scale(get(worldArt, j), 0.45)); }
    }
    const order = cells.filter(c => c.shown).sort((a, b) => centreOf(a).y - centreOf(b).y);
    const pixelsOfCell = new Map(order.map(c => [c, []]));
    for (let i = 0; i < N; i++) { const c = shownAt(i); if (c && dist[i] >= 1) pixelsOfCell.get(c).push(i); }
    for (const c of order) {
        const o = centreOf(c);
        const side = hex2rgb(SIDE[kitOf(c)]);
        for (const i of pixelsOfCell.get(c)) {
            const x = i % AW, y = (i - x) / AW;
            // the side: the footprint, shaded darker to the right
            const shade = 0.75 + 0.35 * (0.5 - (x - o.x) / (2 * R));
            let sc = scale(side, shade);
            if (dist[i] === 1) sc = [16, 12, 8];
            put(out, i, stateCol(c, sc));
        }
        for (const i of pixelsOfCell.get(c)) {
            const x = i % AW, y = (i - x) / AW;
            const j = i - LIFT * AW; if (j < 0) continue;
            let col = groundRGB(c, x - o.x, y - o.y);
            if (dist[i] === 1) col = [16, 12, 8];
            else if (dist[i] === 2) { const nx = x - o.x, ny = y - o.y; col = (-nx * 0.6 - ny) > 0 ? mix(col, [255, 240, 200], 0.4) : col; }
            put(out, j, stateCol(c, col));
        }
    }
    // ring lines: a rope over the seams, a knot at each corner
    const rope = (i) => { const x = i % AW, y = (i - x) / AW; return ((x + y) & 3) < 2 ? hex2rgb('#e2c48a') : hex2rgb('#8a6431'); };
    for (let i = 0; i < N; i++) if (ringPixel(i)) { const j = i - LIFT * AW; if (j >= 0) put(out, j, rope(i)); }
    for (const v of vertices) stamp(out, v.x, v.y, KNOT, { k: hex2rgb('#3a2610'), l: hex2rgb('#e2c48a'), d: hex2rgb('#8a6431') }, -LIFT);
}

// The settle-now outline (gold, 1 art px in from the edge) and the hover (white).
const lift = HEX === 'C' ? LIFT : 0;
const inset = HEX === 'A' ? 1 : HEX === 'B' ? 3 : 2;
for (let i = 0; i < N; i++) {
    const c = shownAt(i); if (!c) continue;
    if (HEX === 'none') continue;
    const j = i - lift * AW; if (j < 0) continue;
    if (c.hover && dist[i] === inset) put(out, j, WHITE);
    if (c.state === 'ready') {
        const pulsed = PULSE_ALL || c.id === '-2,2';
        if (!pulsed && dist[i] === inset) put(out, j, GOLD);
        if (pulsed && (dist[i] === inset || dist[i] === inset + 1)) put(out, j, PULSE ? GOLD_PALE : GOLD);
    }
}
tick('hexLayer', t0h);

// ---------------------------------------------------------------- to the screen
const screen = document.getElementById('screen');
const ctx = screen.getContext('2d');
ctx.imageSmoothingEnabled = false;
{
    const art = document.createElement('canvas'); art.width = AW; art.height = AH;
    art.getContext('2d').putImageData(new ImageData(HEX === 'none' ? worldArt : out, AW, AH), 0, 0);
    ctx.drawImage(art, 0, 0, SW, SH);
}

const sprites = new Map();
const sprite = async (p) => { if (!p) return null; if (!sprites.has(p)) sprites.set(p, await loadImg('/' + p)); return sprites.get(p); };
// A sprite with the house's hard black shadow, 2 px down-right.
const shadowed = new Map();
function withShadow(img, off = 2) {
    if (shadowed.has(img)) return shadowed.get(img);
    const c = document.createElement('canvas'); c.width = img.width + off; c.height = img.height + off;
    const x = c.getContext('2d');
    x.drawImage(img, off, off); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over'; x.drawImage(img, 0, 0);
    shadowed.set(img, c); return c;
}
const toScreen = (p) => ({ x: Math.round(p.x * S), y: Math.round(p.y * S) });

// World picture F: the cells' own Tokens stand on the world, a few per cell (the commonest kinds).
function tokensOf(c, max) {
    const counts = new Map();
    for (const n of c.nodes) { if (!n.sprite || n.role === 'hall') continue; counts.set(n.sprite, (counts.get(n.sprite) || 0) + 1); }
    if (c.ring === 0) return ['assets/tokens/upgrade/t_guildhall.png'];
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([s]) => s);
}
if (WORLD === 'F') {
    const t0 = performance.now();
    const spots = [[-17, -4], [15, -8], [-2, 16], [19, 14]];
    const draws = [];
    for (const c of cells) {
        if (HEX !== 'A' && HEX !== 'none' && c.shown) continue; // under a tile
        const o = centreOf(c);
        const list = tokensOf(c, c.shown ? 3 : 4);
        list.forEach((s, k) => { const [dx, dy] = c.ring === 0 ? [0, 2] : spots[k]; draws.push({ c, s, x: o.x + dx + (hash(c.q, c.r, k) - 0.5) * 6, y: o.y + dy }); });
    }
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) {
        const img = await sprite(d.s); if (!img) continue;
        const p = toScreen(d);
        const fade = d.c.shown ? 1 : Math.max(0, 1 - (d.c.ring - 3.4) / 1.6);
        if (fade <= 0.05) continue;
        ctx.save();
        ctx.globalAlpha = fade;
        if (HEX === 'A' && d.c.shown) ctx.filter = iconFilter(d.c);
        else if (!d.c.shown) ctx.filter = 'brightness(0.5) saturate(0.6)';
        ctx.drawImage(img, p.x - img.width / 2, p.y - img.height + 8);
        ctx.restore();
    }
    tick('tokensF', t0);
}

// The contents: output icons (32 px at 1x), "+N" for the rest; look C also stands its signature Token.
ctx.font = '16px SilkPixel';
ctx.textBaseline = 'middle';
for (const c of cells) {
    if (!c.shown || HEX === 'none') continue;
    const o = toScreen(centreOf(c));
    const yLift = lift * S;
    const icons = c.outputs.slice(0, 3);
    const more = c.outputs.length - icons.length;
    ctx.save();
    ctx.filter = iconFilter(c);
    if (HEX === 'A') {
        // a dark pill below the middle, one frame (UI style), icons inside
        const w = icons.length * 34 + 8 + (more ? 26 : 0), h = 40, x0 = o.x - w / 2, y0 = o.y + 8;
        ctx.fillStyle = 'rgba(14,10,6,0.78)';
        ctx.beginPath(); ctx.moveTo(x0 + 4, y0); ctx.lineTo(x0 + w - 4, y0); ctx.lineTo(x0 + w, y0 + 4); ctx.lineTo(x0 + w, y0 + h - 4); ctx.lineTo(x0 + w - 4, y0 + h); ctx.lineTo(x0 + 4, y0 + h); ctx.lineTo(x0, y0 + h - 4); ctx.lineTo(x0, y0 + 4); ctx.closePath(); ctx.fill();
        for (let k = 0; k < icons.length; k++) { const img = await sprite(icons[k].sprite); if (img) ctx.drawImage(img, x0 + 4 + k * 34, y0 + 4, 32, 32); }
        if (more) { ctx.fillStyle = '#e8e2d0'; ctx.fillText(`+${more}`, x0 + 4 + icons.length * 34, y0 + h / 2 + 1); }
    } else if (HEX === 'B') {
        const w = icons.length * 34 - 2, x0 = o.x - w / 2 - (more ? 12 : 0), y0 = o.y - 4;
        for (let k = 0; k < icons.length; k++) { const img = await sprite(icons[k].sprite); if (img) ctx.drawImage(withShadow(img), x0 + k * 34, y0, 34, 34); }
        if (more) {
            ctx.fillStyle = '#000'; ctx.fillText(`+${more}`, x0 + w + 6, y0 + 18);
            ctx.fillStyle = '#f4efe0'; ctx.fillText(`+${more}`, x0 + w + 4, y0 + 16);
        }
    } else if (HEX === 'C') {
        const tok = tokensOf(c, 1)[0];
        const timg = await sprite(tok);
        if (timg) ctx.drawImage(withShadow(timg), o.x - 32, o.y - 64 - yLift + 8);
        const w = icons.length * 34 + 6 + (more ? 26 : 0), h = 38, x0 = o.x - w / 2, y0 = o.y + 14 - yLift;
        ctx.fillStyle = 'rgba(14,10,6,0.82)'; ctx.fillRect(x0, y0, w, h);
        for (let k = 0; k < icons.length; k++) { const img = await sprite(icons[k].sprite); if (img) ctx.drawImage(img, x0 + 3 + k * 34, y0 + 3, 32, 32); }
        if (more) { ctx.fillStyle = '#e8e2d0'; ctx.fillText(`+${more}`, x0 + 3 + icons.length * 34, y0 + h / 2 + 1); }
    }
    ctx.restore();
}

// The guild's flag, larger than before: the pixel banner at 1x on the current place.
if (HEX !== 'none') {
    const flag = await sprite('assets/ui/u_flag_redlite.png');
    const o = toScreen(centreOf(byId.get(HERE)));
    if (flag) ctx.drawImage(withShadow(flag), o.x - (HEX === 'C' ? 84 : 72), o.y - 92 - lift * S);
}

// The thin inspection panel (M3) on the right, as a stand-in.
{
    const x0 = 1520, y0 = 24, w = 376, h = 1032;
    ctx.fillStyle = '#000'; ctx.fillRect(x0 + 4, y0 + 4, w, h);
    ctx.fillStyle = '#17110c'; ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = '#977316'; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '16px SilkPixel';
    ctx.fillText('inspection panel (M3)', x0 + 24, y0 + 32);
}

window.__timings = timings;
window.__done = true;
