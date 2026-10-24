// Lays the before/after crops of `capture_pixel_frames.mjs` out as a few contact sheets for the
// owner's phone: node sheet_pixel_frames.mjs <rawDir> <outDir>
// Each row: the window before and after (1x, drawers at half size), then one corner of each at 2x
// with no smoothing, so the pixel frame's art pixels show.
import { mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const sharp = createRequire(import.meta.url)('sharp');
const [raw = '.', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const CORNER = 64;
const GAP = 12;
const HEAD = 40;
const LAB = 26;
const BG = '#16120e';
const INK = '#f3e6c8';

// corner: which corner to zoom, and where the window starts inside its crop (its margin).
const SHEETS = [
    { file: 'sheet_1_tooltips.png', title: 'Tooltips and pop-ups: before | after | corners 2x', rows: [
        { name: '2_tooltip', label: 'Tooltip (hover Work Permissions)', margin: 12 },
        { name: '6_item_tooltip', label: 'Item tooltip (hover a Bank tile)', margin: 12 },
        { name: '3_token_summary', label: 'Token Summary (click the Token count)', margin: 12 },
        { name: '9_catch_up', label: 'While you were away', margin: 12 }
    ] },
    { file: 'sheet_2_windows.png', title: 'Windows: before | after | corners 2x', rows: [
        { name: '1_modal_slots', label: 'Save slots (the first screen)', margin: 12 },
        { name: '4_modal_settings', label: 'Settings (the red orb)', margin: 12 }
    ] },
    { file: 'sheet_3_drawers.png', title: 'Drawers and the hero panel (half size): before | after | corners 2x', rows: [
        { name: '5_bank', label: 'Bank (yellow orb); top-right corner', margin: 0, scale: 0.5, corner: 'tr' },
        { name: '8_shop', label: 'Shop (green orb); top-right corner', margin: 0, scale: 0.5, corner: 'tr' },
        { name: '7_hero_panel', label: 'Hero panel (click a hero); top-left corner', margin: 0, scale: 0.5, corner: 'tl' }
    ] }
];

const text = (s, w, h, size = 18, weight = 'normal') => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="0" y="${h - 7}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${INK}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`
);

async function piece(file, row) {
    const meta = await sharp(file).metadata();
    const k = row.scale ?? 1;
    const whole = await sharp(file).resize(Math.round(meta.width * k), Math.round(meta.height * k), { kernel: 'lanczos3' }).png().toBuffer();
    const inset = Math.max(0, row.margin - 6);
    const left = row.corner === 'tr' ? Math.max(0, meta.width - CORNER) : inset;
    const corner = await sharp(file).extract({ left, top: inset, width: Math.min(CORNER, meta.width - left), height: Math.min(CORNER, meta.height - inset) })
        .resize(CORNER * 2, CORNER * 2, { kernel: 'nearest' }).png().toBuffer();
    return { whole, w: Math.round(meta.width * k), h: Math.round(meta.height * k), corner };
}

for (const sheet of SHEETS) {
    const rows = [];
    for (const row of sheet.rows) {
        const b = path.join(raw, `before_${row.name}.png`);
        const a = path.join(raw, `after_${row.name}.png`);
        if (!existsSync(b) || !existsSync(a)) { console.log('missing', row.name); continue; }
        rows.push({ row, before: await piece(b, row), after: await piece(a, row) });
    }
    const width = Math.max(...rows.map(r => r.before.w + r.after.w + 4 * CORNER + 5 * GAP), 900);
    const height = HEAD + rows.reduce((s, r) => s + LAB + Math.max(r.before.h, r.after.h, 2 * CORNER) + GAP, 0) + GAP;
    const layers = [{ input: text(sheet.title, width - 2 * GAP, HEAD, 22, 'bold'), left: GAP, top: 0 }];
    let y = HEAD;
    for (const r of rows) {
        layers.push({ input: text(r.row.label, width - 2 * GAP, LAB), left: GAP, top: y });
        y += LAB;
        let x = GAP;
        layers.push({ input: r.before.whole, left: x, top: y }); x += r.before.w + GAP;
        layers.push({ input: r.after.whole, left: x, top: y }); x += r.after.w + GAP;
        layers.push({ input: r.before.corner, left: x, top: y }); x += 2 * CORNER + GAP;
        layers.push({ input: r.after.corner, left: x, top: y });
        y += Math.max(r.before.h, r.after.h, 2 * CORNER) + GAP;
    }
    const png = await sharp({ create: { width, height, channels: 3, background: BG } }).composite(layers).png().toBuffer();
    await sharp(png).png({ palette: true, colors: 128, effort: 10 }).toFile(path.join(out, sheet.file));
    console.log('wrote', sheet.file, `${width}x${height}`);
}
