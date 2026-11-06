// Throwaway (brief 390 G1): the three comparison pictures from raw/*.png, with large letters, and the
// full-size option pictures copied up beside them. node contact.mjs
import sharp from 'sharp';
import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = (n) => path.join(here, 'raw', n);
const outDir = path.join(here, '..');
const P = { ...JSON.parse(readFileSync(path.join(here, 'positions_panel.json'), 'utf8')), ...JSON.parse(readFileSync(path.join(here, 'positions_sky.json'), 'utf8')) };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (w, h, lines, extra = '') => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${extra}${lines.map(l =>
    `<text x="${l.x}" y="${l.y}" font-family="Arial, Helvetica, sans-serif" font-size="${l.size}" font-weight="${l.bold ? 700 : 400}" fill="${l.fill || '#f2ead8'}">${esc(l.t)}</text>`).join('')}</svg>`);
const BG = '#1a1612';
const LETTER = '#c4b5fd';
const NOTE = '#b9b0a0';
const crop = (file, left, top, width, height, zoom = 1) => {
    let s = sharp(raw(file)).extract({ left, top, width, height });
    if (zoom !== 1) s = s.resize(width * zoom, height * zoom, { kernel: 'nearest' });
    return s.png().toBuffer();
};

async function starsSheet() {
    const opts = [
        ['A', 'Plain star (today)', 'the owner’s star sprite alone'],
        ['B', 'Faint picture behind', 'the item’s outline, big and faint, behind the star'],
        ['C', 'Outline over the star', 'the item’s outline drawn bright over the star'],
        ['D', 'Dotted figure', 'the outline as a ring of dots, like a constellation']
    ];
    const G = 24, CW = 640, HEAD = 200, A1 = 480, A2 = 480, ZS = 160, FOOT = 120;
    const W = G + 4 * (CW + G), H = HEAD + A1 + G + A2 + G + ZS + 40 + FOOT;
    const comps = [], lines = [];
    const singles = ['star_forestry_speed', 'star_forestry_camp_reach', 'star_forestry_yield', 'star_mining_vein_rest'];
    const singleLabels = ['gold: top rank', 'blue: can buy', 'grey: bought', 'locked'];
    for (let k = 0; k < 4; k++) {
        const [L, name, what] = opts[k];
        const x = G + k * (CW + G);
        const s = P[`sky_${L}`];
        const file = `sky_${L}.png`;
        lines.push({ x, y: 128, size: 130, bold: true, t: L, fill: LETTER });
        lines.push({ x: x + 112, y: 84, size: 36, bold: true, t: name });
        lines.push({ x: x + 112, y: 122, size: 20, t: what });
        const [fx, fy] = s.stars.star_forestry_speed;
        comps.push({ input: await crop(file, fx - 120, fy - 260, CW, A1), left: x, top: HEAD });
        const [wx, wy] = s.stars.star_well_oak_wood;
        comps.push({ input: await crop(file, wx - 200, wy - 150, CW, A2), left: x, top: HEAD + A1 + G });
        for (let j = 0; j < 4; j++) {
            const [cx, cy] = s.stars[singles[j]];
            const tx = x + j * ZS;
            comps.push({ input: await crop(file, cx - 40, cy - 40, 80, 80, 2), left: tx, top: HEAD + A1 + G + A2 + G });
            lines.push({ x: tx + 4, y: HEAD + A1 + G + A2 + G + ZS + 24, size: 15, fill: NOTE, t: singleLabels[j] });
        }
    }
    lines.push({ x: G, y: 172, size: 22, fill: NOTE, t: 'All four at the new spacing (titles under the star, no rank numbers until the pointer is on a star). Top: Forestry and Mining. Middle: the Well. Bottom: single stars at 2x.' });
    lines.push({ x: G, y: H - 70, size: 22, fill: NOTE, t: 'B, C and D are drawn by code from the item sprites already in the game (no new art). Which item each star shows is a suggestion: tools for speed, the product for yield, a quill for lore, a torch for camp reach.' });
    lines.push({ x: G, y: H - 36, size: 22, fill: NOTE, t: 'Pick a letter for the stars. A keeps today’s look.' });
    await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
        .composite([...comps, { input: text(W, H, lines), left: 0, top: 0 }])
        .png().toFile(path.join(outDir, 'contact_stars.png'));
}

async function panelSheet() {
    const opts = [
        ['E', 'Standard frame (today)', 'the bronze studs frame of every big panel'],
        ['F', 'Purple line', 'the same frame shape, drawn in purple'],
        ['G', 'Purple night panel', 'a double purple edge and a deep purple fill']
    ];
    const [px, py, pw, ph] = P.panel;
    const G = 24, ZW = 240, CW = pw + G + ZW, HEAD = 200, FOOT = 110;
    const W = G + 3 * (CW + G + 20), H = HEAD + ph + FOOT;
    const comps = [], lines = [];
    for (let k = 0; k < 3; k++) {
        const [L, name, what] = opts[k];
        const x = G + k * (CW + G + 20);
        const file = `panel_${L}.png`;
        lines.push({ x, y: 128, size: 130, bold: true, t: L, fill: LETTER });
        lines.push({ x: x + 112, y: 84, size: 34, bold: true, t: name });
        lines.push({ x: x + 112, y: 122, size: 20, t: what });
        comps.push({ input: await crop(file, px, py, Math.min(pw, 1920 - px), ph), left: x, top: HEAD });
        // The frames' corners at 4x, to see the pixels.
        comps.push({ input: await crop(file, px, py, 60, 60, 4), left: x + pw + G, top: HEAD });
        comps.push({ input: await crop(file, px, py + 58, 60, 60, 4), left: x + pw + G, top: HEAD + 260 });
        lines.push({ x: x + pw + G, y: HEAD + 525, size: 18, fill: NOTE, t: 'corners at 4x' });
    }
    lines.push({ x: G, y: 172, size: 22, fill: NOTE, t: 'The Hall’s right column with a star pinned. Only the two outer frames change: the Upgrade button and the words stay as they are (their own look comes in G3).' });
    lines.push({ x: G, y: H - 66, size: 22, fill: NOTE, t: 'F and G are drawn by code, like the gold and red frames already in the game (no new art). The full screens are panel_E.png, panel_F.png and panel_G.png.' });
    lines.push({ x: G, y: H - 32, size: 22, fill: NOTE, t: 'Pick a letter for the panel. E keeps today’s look.' });
    await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
        .composite([...comps, { input: text(W, H, lines), left: 0, top: 0 }])
        .png().toFile(path.join(outDir, 'contact_panel.png'));
}

async function skySheet() {
    const Z = 0.5;
    const items = [
        ['H', 'sky_today.png', 'Today', 'today’s spacing, titles on the side, rank numbers on'],
        ['I', 'sky_A.png', 'New spacing', '1.4 times as spread out, titles under, no rank numbers, plain stars'],
        ['I + B', 'sky_B.png', 'I with star look B', 'faint pictures behind'],
        ['I + C', 'sky_C.png', 'I with star look C', 'outlines over the stars'],
        ['I + D', 'sky_D.png', 'I with star look D', 'dotted figures']
    ];
    const G = 30, HEAD = 190, LBL = 120, FOOT = 120;
    const sz = {};
    for (const [, f] of items) { const m = await sharp(raw(f)).metadata(); sz[f] = [Math.round(m.width * Z), Math.round(m.height * Z)]; }
    const rowH = Math.max(...Object.values(sz).map(s => s[1]));
    const rows = [[0, 1, 2], [3, 4]];
    const rowW = (r) => r.reduce((a, i) => a + sz[items[i][1]][0] + G, G);
    const W = Math.max(...rows.map(rowW)), H = HEAD + rows.length * (LBL + rowH + G) + FOOT;
    const comps = [], lines = [];
    let rects = '';
    rows.forEach((r, ri) => {
        let x = G;
        const top = HEAD + ri * (LBL + rowH + G);
        for (const i of r) {
            const [L, f, name, what] = items[i];
            const [w, h] = sz[f];
            const big = L.length === 1;
            lines.push({ x, y: top + (big ? 100 : 80), size: big ? 110 : 70, bold: true, t: L, fill: LETTER });
            const tx = x + (big ? 100 : 230);
            lines.push({ x: tx, y: top + 58, size: 32, bold: true, t: name });
            lines.push({ x: tx, y: top + 92, size: 20, t: what });
            comps.push({ f, left: x, top: top + LBL, w, h });
            // One 1920 x 1080 screen, centred on the Hall.
            const [hx, hy] = P[f.replace('.png', '')].stars.hall;
            const rw = 1920 * Z, rh = 1080 * Z;
            const rx0 = Math.max(x, x + hx * Z - rw / 2), ry0 = Math.max(top + LBL, top + LBL + hy * Z - rh / 2);
            const rx1 = Math.min(x + w, x + hx * Z + rw / 2), ry1 = Math.min(top + LBL + h, top + LBL + hy * Z + rh / 2);
            rects += `<rect x="${rx0 + 2}" y="${ry0 + 2}" width="${rx1 - rx0 - 4}" height="${ry1 - ry0 - 4}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="14 10"/>`;
            x += w + G;
        }
    });
    const inputs = await Promise.all(comps.map(async c => ({ input: await sharp(raw(c.f)).resize(c.w, c.h, { kernel: 'lanczos3' }).png().toBuffer(), left: c.left, top: c.top })));
    lines.push({ x: G, y: 76, size: 44, bold: true, t: 'The whole sky, every constellation (half size)' });
    lines.push({ x: G, y: 120, size: 22, fill: NOTE, t: 'The real stars from the game’s content, a guild some way in. Dashed gold box: one 1920 x 1080 screen around the Hall (today the sky is narrower still, between the nav bubbles and the panel; in H the box is the whole sky’s width). The rest is reached by dragging.' });
    lines.push({ x: G, y: 152, size: 22, fill: NOTE, t: 'Full-size pictures: sky_H_today.png, sky_I.png, sky_I_B.png, sky_I_C.png, sky_I_D.png. In I, the pointer is on Heartwood, so its rank (1/2) shows.' });
    lines.push({ x: G, y: H - 70, size: 22, fill: NOTE, t: 'The new spacing is a scale in code (no change to the star places in the CMS). At 1.4 no title touches another title, star or constellation name; today 7 do.' });
    lines.push({ x: G, y: H - 36, size: 22, fill: NOTE, t: 'Pick H or I for the sky; the I + B, C, D pictures are there to judge each star look across the whole sky.' });
    await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
        .composite([...inputs, { input: text(W, H, lines, rects), left: 0, top: 0 }])
        .png().toFile(path.join(outDir, 'contact_sky.png'));
}

await starsSheet();
await panelSheet();
await skySheet();
for (const [from, to] of [['sky_today.png', 'sky_H_today.png'], ['sky_A.png', 'sky_I.png'], ['sky_B.png', 'sky_I_B.png'], ['sky_C.png', 'sky_I_C.png'], ['sky_D.png', 'sky_I_D.png'],
    ['panel_E.png', 'panel_E.png'], ['panel_F.png', 'panel_F.png'], ['panel_G.png', 'panel_G.png']]) copyFileSync(raw(from), path.join(outDir, to));
console.log('done');
