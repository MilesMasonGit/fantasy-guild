// Throwaway (brief 460 P1): the before/after sheet from raw/*.png, with large words, one row per soft
// effect, plus each row saved on its own. node contact.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = (n) => path.join(here, 'raw', `${n}.png`);
const outDir = path.join(here, '..');
const P = (job, w) => JSON.parse(readFileSync(path.join(here, `positions_${job}_${w}.json`), 'utf8'));
const camp = P('camp', 1920), camp13 = P('camp', 1366), busy = P('busy', 1920), ghost = P('ghost', 1920);

const BG = '#1a1612', INK = '#f2ead8', NOTE = '#c9bfae', GOLD = '#facc15', HEAD = '#c4b5fd';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = (w, h, items) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${items.map(l =>
    l.rect ? `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" fill="${l.fill}"/>`
        : `<text x="${l.x}" y="${l.y}" font-family="Arial, Helvetica, sans-serif" font-size="${l.size}" font-weight="${l.bold ? 700 : 400}" fill="${l.fill || INK}">${esc(l.t)}</text>`).join('')}</svg>`);

/** A crop around a box [x, y, w, h], `pad` out each side, zoomed with hard pixels. */
const around = (box, padX, padY, z) => ({ left: Math.max(0, box[0] - padX), top: Math.max(0, box[1] - padY), width: box[2] + 2 * padX, height: box[3] + 2 * padY, z });
async function crop(file, c) {
    return sharp(raw(file)).extract({ left: c.left, top: c.top, width: c.width, height: c.height })
        .resize(c.width * c.z, c.height * c.z, { kernel: 'nearest' }).png().toBuffer();
}
/** Several crops of one picture side by side, as one cell. */
async function strip(file, crops, gap = 12) {
    const parts = await Promise.all(crops.map(c => crop(file, c)));
    const w = crops.reduce((s, c) => s + c.width * c.z, 0) + gap * (crops.length - 1);
    const h = Math.max(...crops.map(c => c.height * c.z));
    let x = 0;
    const comp = parts.map((input, i) => { const at = x; x += crops[i].width * crops[i].z + gap; return { input, left: at, top: 0 }; });
    return { buf: await sharp({ create: { width: w, height: h, channels: 4, background: BG } }).composite(comp).png().toBuffer(), w, h };
}

const tb = (b) => [b[0], b[1], b[2], b[3]];
const ROWS = [
    {
        id: 'name_light', title: 'Token name, light grass', legible: true,
        notes: ['1366 x 768, a new game. The name a Token shows', 'under the pointer. Soft: a dark smudge under', 'the letters. A: the game’s own 1 px outline only.', 'B: a hard 2 px outline (the Region-name one).'],
        base: 'camp_1366_hover2', crops: [around(camp13.name2, 30, 22, 4)], cols: ['before', 'after', 'afterB']
    },
    {
        id: 'name_busy', title: 'Name and −1, busy mat', legible: true,
        notes: ['1920 x 1080, the S2 stress board: the name', 'over a forest, the −1 over the trees.', 'The −1 is switched off in the game today', '(its markup drawn here to show it).'],
        base: 'busy_1920_hover', crops: [{ left: busy.name[0] - 30, top: busy.floater[1] - 22, width: busy.name[2] + 60, height: busy.name[1] + busy.name[3] - busy.floater[1] + 34, z: 3 }], cols: ['before', 'after', 'afterB']
    },
    {
        id: 'floater_light', title: 'The −1 number, light grass', legible: true,
        notes: ['1366 x 768. Amber on light green is the', 'hardest case: the soft shadow is what', 'separates them today.'],
        base: 'camp_1366_hover', crops: [around(camp13.floater, 26, 18, 5)], cols: ['before', 'after', 'afterB']
    },
    {
        id: 'badges', title: 'State badges', legible: false,
        notes: ['1920. Disallow mark on a tree, the gold recipe', 'gear (a station), the demolition mark.', 'Soft: a dark cloud below. Hard: a black copy', 'one art pixel down-right, like the problem mark.'],
        base: 'camp_1920_still', crops: [around(camp.disallow, 22, 22, 3), around(camp.gear, 20, 20, 3), around(camp.marked, 22, 22, 3)], cols: ['before', 'after']
    },
    {
        id: 'summary', title: 'Token Summary lights a type', legible: false,
        notes: ['Hovering a row of the Token Summary lights', 'every Token of that type. Soft: a yellow haze.', 'Hard: the gold attention outline, 2 px', '(UI_STYLE: attention is a gold one).'],
        base: 'camp_1920_still', crops: [{ left: camp.coal[0].box[0] - 16, top: camp.coal[0].box[1] + 10, width: camp.coal[1].box[0] + camp.coal[1].box[2] - camp.coal[0].box[0] + 32, height: 110, z: 2 }], cols: ['before', 'after']
    },
    {
        id: 'nav', title: 'Nav bubbles', legible: false,
        notes: ['The icon on each orb. Soft: a blurred shadow.', 'Hard: one orb pixel straight down.', 'Second orb: carrying an item over a bubble', 'that takes it. Soft green haze; hard: ring only.'],
        base: 'camp_1920_still', crops: [{ left: 4, top: 20, width: 146, height: 284, z: 2 }], cols: ['before', 'after']
    },
    {
        id: 'ghost', title: 'Drag ghost refusal mark', legible: false,
        notes: ['The Guild Hall carried off the mat. Soft: a red', 'glow, and it bounces. Hard: a black copy down-', 'right, and still (UI_STYLE: no bobbing).'],
        base: 'ghost_1920_ghost', crops: [around(ghost.ghost, 40, 30, 4)], cols: ['before', 'after']
    },
    {
        id: 'ribbon', title: 'Item grown on hover (Shop)', legible: false,
        notes: ['Hovering an item in a ribbon doubles it. Soft:', 'a big shadow cloud, almost invisible on the', 'dark panel. Hard: a black copy down-right.', 'Either way it barely shows: could just go.'],
        base: 'shop_1920_ribbon', crops: [{ left: 150, top: 150, width: 180, height: 100, z: 3 }], cols: ['before', 'after']
    }
];

const COL_HEAD = { before: 'BEFORE (today)', after: 'AFTER A: hard', afterB: 'AFTER B: hard + 2 px outline' };
const LEFT = 560, GAP = 32, PAD = 28;

async function rowImage(row) {
    const cells = [];
    for (const col of row.cols) cells.push(await strip(`${row.base}_${col}`, row.crops));
    const cw = Math.max(...cells.map(c => c.w));
    const ch = Math.max(...cells.map(c => c.h));
    const W = LEFT + row.cols.length * (cw + GAP) + PAD;
    const H = Math.max(ch, 40 + row.notes.length * 30 + (row.legible ? 50 : 0)) + 70 + PAD;
    const text = [
        { x: PAD, y: 54, size: 36, bold: true, t: row.title },
        ...row.notes.map((t, i) => ({ x: PAD, y: 100 + i * 30, size: 22, fill: NOTE, t })),
        ...(row.legible ? [{ rect: true, x: PAD, y: 100 + row.notes.length * 30, w: 300, h: 38, fill: GOLD }, { x: PAD + 12, y: 127 + row.notes.length * 30, size: 22, bold: true, fill: '#1a1612', t: 'DOING A JOB: legibility' }] : []),
        ...row.cols.map((c, i) => ({ x: LEFT + i * (cw + GAP), y: 44, size: 26, bold: true, fill: c === 'before' ? INK : HEAD, t: COL_HEAD[c] }))
    ];
    const comp = [{ input: svg(W, H, text), left: 0, top: 0 }, ...cells.map((c, i) => ({ input: c.buf, left: LEFT + i * (cw + GAP), top: 64 }))];
    return { buf: await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(comp).png().toBuffer(), W, H };
}

const rows = [];
for (const row of ROWS) {
    const img = await rowImage(row);
    await sharp(img.buf).toFile(path.join(outDir, `pair_${row.id}.png`));
    rows.push(img);
    console.log('row', row.id, img.W, img.H);
}
const TITLE_H = 150;
const W = Math.max(...rows.map(r => r.W));
const H = TITLE_H + rows.reduce((s, r) => s + r.H + 6, 0);
const comp = [{ input: svg(W, TITLE_H, [
    { x: PAD, y: 70, size: 54, bold: true, t: 'Soft glows and shadows: before and after (brief 460)' },
    { x: PAD, y: 118, size: 26, fill: NOTE, t: 'Real game, zoomed with hard pixels. A = soft effect removed, hard version in its place. B (words only) = A plus a hard 2 px black outline.' }
]), left: 0, top: 0 }];
let y = TITLE_H;
for (const r of rows) {
    comp.push({ input: svg(W, 6, [{ rect: true, x: 0, y: 0, w: W, h: 6, fill: '#3a3128' }]), left: 0, top: y });
    comp.push({ input: r.buf, left: 0, top: y + 6 });
    y += r.H + 6;
}
await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(comp).png().toFile(path.join(outDir, 'sheet_before_after.png'));
console.log('sheet', W, H);
