// Throwaway (brief 380 M1): the two comparison pictures from raw/*.png, with large letters.
// node contact.mjs
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = (n) => path.join(here, 'raw', n);
const outDir = path.join(here, '..');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (w, h, lines) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines.map(l =>
    `<text x="${l.x}" y="${l.y}" font-family="Arial, Helvetica, sans-serif" font-size="${l.size}" font-weight="${l.bold ? 700 : 400}" fill="${l.fill || '#f2ead8'}">${esc(l.t)}</text>`).join('')}</svg>`);
const crop = (file, left, top, width, height) => sharp(raw(file)).extract({ left, top, width, height }).png().toBuffer();
const BG = '#1a1612';

async function hexes() {
    const G = 24, CW = 960, HEAD = 190, MAIN = 1080, STRIP = 300, FOOT = 120;
    const W = G + 3 * (CW + G), H = HEAD + MAIN + G + STRIP + FOOT;
    const opts = [
        ['A', 'Clear glass', 'the world picture is the hex; a fine line between cells, a gold ring line with diamonds'],
        ['B', 'Framed tiles', 'each hex its own window on its mat, bevelled, a gap; a bronze ring inlay with studs'],
        ['C', 'Board tiles', 'thick tiles standing on the world, each with its main Token; a rope ring line with knots']
    ];
    const comps = [];
    const lines = [];
    for (let k = 0; k < 3; k++) {
        const [L, name, what] = opts[k];
        const x = G + k * (CW + G);
        lines.push({ x, y: 120, size: 130, bold: true, t: L, fill: '#fbbf24' });
        lines.push({ x: x + 110, y: 82, size: 40, bold: true, t: name });
        lines.push({ x: x + 110, y: 122, size: 22, t: what });
        comps.push({ input: await crop(`${L}_E.png`, 280, 0, CW, MAIN), left: x, top: HEAD });
        // the settle-now cells close up: steady gold, then the pulse's two frames
        const sy = HEAD + MAIN + G;
        const lift = L === 'C' ? 10 : 0;
        const tiles = [
            [`${L}_E.png`, 760, 395, 'settle now: steady gold'],
            [`${L}_E.png`, 508, 685, 'settle now: pulse, frame 1'],
            [`${L}_E_p1.png`, 508, 685, 'pulse, frame 2']
        ];
        for (let j = 0; j < 3; j++) {
            const [f, cx, cy, label] = tiles[j];
            const tx = x + j * 320;
            comps.push({ input: await crop(f, cx - 150, cy - 130 - lift, 300, 250), left: tx, top: sy });
            lines.push({ x: tx, y: sy + 278, size: 20, t: label });
        }
    }
    lines.push({ x: G, y: 168, size: 22, fill: '#b9b0a0', t: 'One world, one moment: ring 2 star bought, ring 3 not. Full colour = settled. Gold = can settle now. Darkened = next to you but too costly, or behind a ring star (the ring-3 cells by the flag). Black and white = not next to anything you hold. White outline = under the pointer. Flag = where the guild is.' });
    lines.push({ x: G, y: H - 70, size: 22, fill: '#b9b0a0', t: 'Under every look: world picture E (the cells’ real mat ground). Hex radius 84 px (the book’s was about 50); no hexes past ring 3. The full screens (hex_A/B/C.png) show the thinner panel (M3) as a stand-in on the right.' });
    lines.push({ x: G, y: H - 36, size: 22, fill: '#b9b0a0', t: 'Pick a letter for the hexes, and say steady gold or pulse for the cells you can settle now.' });
    await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
        .composite([...comps, { input: text(W, H, lines), left: 0, top: 0 }])
        .png().toFile(path.join(outDir, 'contact_hexes.png'));
}

async function worlds() {
    const G = 24, CW = 750, HEAD = 190, TOP = 540, DETAIL = 420, FOOT = 110;
    const W = G + 3 * (CW + G), H = HEAD + TOP + G + DETAIL + 40 + FOOT;
    const opts = [
        ['D', 'Painted map', 'code-drawn colour fields per kind of land, tiny symbols; cheapest'],
        ['E', 'Real ground', 'each cell’s own mat ground, stitched with wobbly seams'],
        ['F', 'Miniature world', 'E plus each cell’s own Tokens standing on it (half the mat’s size)']
    ];
    const comps = [];
    const lines = [];
    for (let k = 0; k < 3; k++) {
        const [L, name, what] = opts[k];
        const x = G + k * (CW + G);
        lines.push({ x, y: 120, size: 130, bold: true, t: L, fill: '#7dd3fc' });
        lines.push({ x: x + 110, y: 82, size: 36, bold: true, t: name });
        lines.push({ x: x + 110, y: 120, size: 20, t: what });
        comps.push({ input: await sharp(raw(`A_${L}.png`)).extract({ left: 0, top: 0, width: 1500, height: 1080 }).resize(CW, TOP, { kernel: 'nearest' }).png().toBuffer(), left: x, top: HEAD });
        comps.push({ input: await crop(`none_${L}.png`, 470, 300, CW, DETAIL), left: x, top: HEAD + TOP + G });
        lines.push({ x, y: HEAD + TOP + G + DETAIL + 28, size: 20, t: 'close up, at full size, without the hexes' });
    }
    lines.push({ x: G, y: 168, size: 22, fill: '#b9b0a0', t: 'The picture the view pans down to, under the hexes and panels. Top: the whole screen at half size, under hex look A. Bottom: full size, no hexes. Beyond ring 3 the world fades into fog.' });
    lines.push({ x: G, y: H - 66, size: 22, fill: '#b9b0a0', t: 'All three are generated from the world’s own data (each cell’s kind of land; E and F its mat’s ground; F its Tokens), once per world, then kept as one picture.' });
    lines.push({ x: G, y: H - 32, size: 22, fill: '#b9b0a0', t: 'Pick a letter for the world picture.' });
    await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
        .composite([...comps, { input: text(W, H, lines), left: 0, top: 0 }])
        .png().toFile(path.join(outDir, 'contact_world_picture.png'));
}

await hexes();
await worlds();
console.log('done');
