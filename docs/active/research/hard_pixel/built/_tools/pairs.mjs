// Throwaway (brief 460 P2): before | after crops from raw/, zoomed with hard pixels, one PNG per row in
// built/, and all rows stacked as built/sheet_built.png. node pairs.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = (n) => path.join(here, 'raw', `${n}.png`);
const outDir = path.join(here, '..');
const P = (job, w) => JSON.parse(readFileSync(path.join(here, 'raw', `pos_before_${job}_${w}.json`), 'utf8'));
const BG = '#1a1612', INK = '#f2ead8';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (w, h, t, size = 22) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/><text x="8" y="${Math.round(h * 0.7)}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="700" fill="${INK}">${esc(t)}</text></svg>`);

const around = (b, px, py) => [Math.max(0, b[0] - px), Math.max(0, b[1] - py), b[2] + 2 * px, b[3] + 2 * py];
async function crop(file, [l, t, w, h], z) {
    const meta = await sharp(raw(file)).metadata();
    const W = Math.min(w, meta.width - l), H = Math.min(h, meta.height - t);
    return { buf: await sharp(raw(file)).extract({ left: l, top: t, width: W, height: H }).resize(W * z, H * z, { kernel: 'nearest' }).png().toBuffer(), w: W * z, h: H * z };
}

const rows = [];
const add = (id, title, base, boxes, z) => rows.push({ id, title, base, boxes, z });
for (const W of [1920, 1366]) {
    const camp = P('camp', W), busy = P('busy', W), ghost = P('ghost', W), shop = P('shop', W);
    const z = W === 1920 ? 3 : 4;
    add(`name_light_${W}`, `${W}: a Token's name on light grass (1 px outline)`, `camp_${W}_hover2`, [around(camp.name2, 24, 16)], z);
    add(`name_station_${W}`, `${W}: a station's name under the pointer`, `camp_${W}_hover`, [around(camp.name, 24, 16)], z);
    add(`name_busy_${W}`, `${W}: name and -1 on the busy mat (S2)`, `busy_${W}_hover`, [[busy.name[0] - 30, busy.floater[1] - 20, busy.name[2] + 60, busy.name[1] + busy.name[3] - busy.floater[1] + 34]], z);
    add(`floater_${W}`, `${W}: the -1 on light grass`, `camp_${W}_hover`, [around(camp.floater, 24, 16)], z + 1);
    add(`badges_${W}`, `${W}: disallow, recipe gear, demolition mark`, `camp_${W}_still`, [around(camp.disallow, 20, 20), around(camp.gear, 20, 20), around(camp.marked, 20, 20)], z);
    add(`summary_${W}`, `${W}: Token Summary lights a type (gold outline)`, `camp_${W}_still`, [around(camp.coal.box, 16, 16)], 2);
    add(`nav_${W}`, `${W}: nav orbs, icon shadow and the drop ring`, `camp_${W}_still`, [[0, camp.navRing[1] - 10, 160, camp.navRing[3] * 2 + 40]], 2);
    add(`ribbon_${W}`, `${W}: Shop ribbon item grown on hover`, `shop_${W}_ribbon`, [around([shop.ribbon[0] - 40, shop.ribbon[1] - 40, 80, 80], 20, 20)], 3);
    add(`ghost_${W}`, `${W}: Guild Hall carried off the mat`, `ghost_${W}_ghost`, [around(ghost.ghost, 40, 40)], 3);
    add(`mat_noground_${W}`, `${W}: mat edge with the ground off`, `camp_${W}_noground`, [[camp.mat[0] - 10, camp.mat[1] - 10, 360, 220]], 2);
}

const GAP = 16, HEAD = 40, LAB = 30;
const built = [];
for (const r of rows) {
    const cols = [];
    for (const side of ['before', 'after']) {
        const parts = await Promise.all(r.boxes.map(b => crop(`${side}_${r.base}`, b, r.z)));
        const w = parts.reduce((s, p) => s + p.w, 0) + GAP * (parts.length - 1);
        const h = Math.max(...parts.map(p => p.h));
        let x = 0;
        const comp = parts.map(p => { const at = x; x += p.w + GAP; return { input: p.buf, left: at, top: LAB }; });
        comp.push({ input: text(w, LAB, side, 18), left: 0, top: 0 });
        cols.push({ buf: await sharp({ create: { width: Math.max(w, 80), height: h + LAB, channels: 4, background: BG } }).composite(comp).png().toBuffer(), w: Math.max(w, 80), h: h + LAB });
    }
    const w = cols[0].w + cols[1].w + GAP * 3, h = HEAD + Math.max(cols[0].h, cols[1].h) + GAP;
    const buf = await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
        .composite([{ input: text(w, HEAD, r.title), left: 0, top: 0 }, { input: cols[0].buf, left: GAP, top: HEAD }, { input: cols[1].buf, left: GAP * 2 + cols[0].w, top: HEAD }])
        .png().toBuffer();
    await sharp(buf).toFile(path.join(outDir, `pair_${r.id}.png`));
    built.push({ buf, w, h });
    console.log('pair', r.id, w, h);
}
const SW = Math.max(...built.map(b => b.w)), SH = built.reduce((s, b) => s + b.h, 0);
let y = 0;
await sharp({ create: { width: SW, height: SH, channels: 4, background: BG } })
    .composite(built.map(b => { const at = y; y += b.h; return { input: b.buf, left: 0, top: at }; }))
    .png().toFile(path.join(outDir, 'sheet_built.png'));
console.log('sheet', SW, SH);
