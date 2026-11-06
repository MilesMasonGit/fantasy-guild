// Throwaway (brief 470 E1): the one comparison page from raw/*.png (four real chart pages, the four
// options side by side, a large letter each), and the full-size pictures copied up beside it.
// node contact.mjs
import sharp from 'sharp';
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = (n) => path.join(here, 'raw', n);
const outDir = path.join(here, '..');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (w, h, lines) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines.map(l =>
    `<text x="${l.x}" y="${l.y}" font-family="Arial, Helvetica, sans-serif" font-size="${l.size}" font-weight="${l.bold ? 700 : 400}" fill="${l.fill || '#f2ead8'}">${esc(l.t)}</text>`).join('')}</svg>`);
const BG = '#1a1612', LETTER = '#c4b5fd', NOTE = '#b9b0a0';

const OPTS = [
    ['A', 'Today', 'every line the same: solid ink, an arrow'],
    ['B', 'Line styles', 'used up solid; needed and kept dashed, hollow arrow; comes out of doubled'],
    ['C', 'Words on the line', 'today’s lines; a small ink word on each line that is not used up'],
    ['D', 'Styles in colour', 'B, with blue ink for kept and green ink for comes out of']
];
const PAGES = [
    ['woodaxe', 'Iron Woodaxe, with the Oak Tree opened: the axe is a TOOL for the trees; the Oak Tree GIVES Oak Wood'],
    ['oakwood', 'Oak Wood, with the Oak Tree opened: the tree gives it, the forest spawns the tree, seedlings are used up'],
    ['ingot', 'Iron Ingot (a busy page): made at a Smithing Station from ore and coal, or dropped, or found in a chest'],
    ['raredrop', 'Smoking Crater Map (a rare drop, 2%): the crater spawns the Chief, the Chief drops the map']
];
const Z = 0.62, CW = Math.round(1436 * Z), CH = Math.round(724 * Z);
const G = 24, HEAD = 230, ROWLBL = 44, FOOT = 150;
const ZW = 836, ZH = 300, ZOOM = ROWLBL + ZH + G;
const W = G + OPTS.length * (CW + G), H = HEAD + ZOOM + PAGES.length * (ROWLBL + CH + G) + FOOT;
const comps = [], lines = [];
lines.push({ x: G, y: 56, size: 40, bold: true, t: 'What a line means: four looks on the same real chart pages' });
OPTS.forEach(([L, name, what], k) => {
    const x = G + k * (CW + G);
    lines.push({ x, y: 196, size: 120, bold: true, t: L, fill: LETTER });
    lines.push({ x: x + 100, y: 150, size: 32, bold: true, t: name });
    lines.push({ x: x + 100, y: 184, size: 17, t: what });
});
// The owner's own example at true size: the axe is a tool for the Oak Tree, the Oak Tree gives Oak Wood.
lines.push({ x: G, y: HEAD + 30, size: 22, fill: NOTE, t: 'Close-up at true size (Iron Woodaxe page): the axe to the Oak Tree, then the Oak Tree to Oak Wood' });
for (const [k, [L]] of OPTS.entries()) {
    comps.push({ input: await sharp(raw(`woodaxe_${L}.png`)).extract({ left: 600, top: 10, width: ZW, height: ZH }).png().toBuffer(), left: G + k * (CW + G), top: HEAD + ROWLBL });
}
for (const [r, [page, words]] of PAGES.entries()) {
    const top = HEAD + ZOOM + r * (ROWLBL + CH + G);
    lines.push({ x: G, y: top + 30, size: 22, fill: NOTE, t: words });
    for (const [k, [L]] of OPTS.entries()) {
        comps.push({ input: await sharp(raw(`${page}_${L}.png`)).resize(CW, CH, { kernel: 'lanczos3' }).png().toBuffer(), left: G + k * (CW + G), top: top + ROWLBL });
    }
}
lines.push({ x: G, y: H - 104, size: 22, fill: NOTE, t: 'Real charts drawn by the game (New Game, one hero at 15 in every skill); only the lines are redrawn per option. Shown at 62 %: the full-size pictures are <page>_<letter>.png beside this one.' });
lines.push({ x: G, y: H - 70, size: 22, fill: NOTE, t: 'All are drawn by code, no new art. In every option, resting the pointer on a line could name it in words (part of the build, not pictured).' });
lines.push({ x: G, y: H - 36, size: 22, fill: NOTE, t: 'Pick a letter. A keeps today’s look.' });
await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite([...comps, { input: text(W, H, lines), left: 0, top: 0 }])
    .png().toFile(path.join(outDir, 'contact_lines.png'));
for (const [page] of PAGES) for (const [L] of OPTS) copyFileSync(raw(`${page}_${L}.png`), path.join(outDir, `${page}_${L}.png`));
console.log('done', W, H);
