// Lays the before/after crops of `capture_round2.mjs` out as a few contact sheets for the owner's
// phone: node sheet_round2.mjs <rawDir> <outDir>
// Each row: the surface before and after (scaled as named), then each one's close-up at 2x with no
// smoothing, so the art pixels show. A row with no "before" shows the after only.
import { mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const sharp = createRequire(import.meta.url)('sharp');
const [raw = '.', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const GAP = 12;
const HEAD = 40;
const LAB = 26;
const BG = '#16120e';
const INK = '#f3e6c8';

const SHEETS = [
    { file: 'sheet_1_bank.png', title: 'Bank tiles and loadout slots: before | after | close-ups 2x', rows: [
        { name: '2_bank', label: 'Bank (yellow orb), half size', scale: 0.5, zoom: { x: 166, y: 56, w: 250, h: 150 } },
        { name: '3_bank_tile_hover', label: 'A Bank tile, hovered' },
        { name: '4_bank_selected', label: 'A Bank tile, chosen in Select mode' },
        { name: '5_loadout', label: 'A hero’s loadout (click a hero)' }
    ] },
    { file: 'sheet_2_settings.png', title: 'Settings and Typography: before | after | close-ups 2x', rows: [
        { name: '10_settings_access', label: 'Settings, Accessibility (red orb)', scale: 0.6, zoom: { x: 420, y: 130, w: 300, h: 260 } },
        { name: '11_settings_gameplay', label: 'Settings, Gameplay', scale: 0.6, zoom: { x: 420, y: 380, w: 300, h: 200 } },
        { name: '12_typography', label: 'Typography scale (Accessibility, Adjust scale)', scale: 0.5, zoom: { x: 20, y: 190, w: 300, h: 130 } }
    ] },
    { file: 'sheet_3_windows.png', title: 'Inside the windows: before | after | close-ups 2x', rows: [
        { name: '15_save_slots', label: 'Save slots (the first screen)', scale: 0.7, zoom: { x: 420, y: 150, w: 260, h: 140 } },
        { name: '13_promotion', label: 'Promotion (a Promotes Token)', scale: 0.5, zoom: { x: 20, y: 740, w: 280, h: 140 } },
        { name: '6_hero_edit', label: 'Edit hero (the quill on the hero panel)', scale: 0.5, zoom: { x: 20, y: 110, w: 280, h: 200 } },
        { name: '7_job_change', label: 'Change job (from Edit hero)', scale: 0.6, zoom: { x: 30, y: 200, w: 300, h: 140 } }
    ] },
    { file: 'sheet_4_small.png', title: 'A button and a switch: before | after | close-ups 2x', rows: [
        { name: '14_catch_up', label: 'While you were away: the buttons', zoom: { x: 0, y: 0, w: 200, h: 70 } },
        { name: '8_rules_toggle', label: 'Work Permissions: the Priorities switch', scale: 0.7, zoom: { x: 140, y: 6, w: 120, h: 34 } },
    ] }
];

const text = (s, w, h, size = 18, weight = 'normal') => Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="0" y="${h - 7}" font-family="sans-serif" font-size="${size}" font-weight="${weight}" fill="${INK}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`
);

async function piece(file, zoomFile, row) {
    if (!existsSync(file)) return null;
    const meta = await sharp(file).metadata();
    const k = row.scale ?? 1;
    const w = Math.round(meta.width * k), h = Math.round(meta.height * k);
    const whole = await sharp(file).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    // The close-up: a region of the crop when the row names one, else the capture's own zoom.
    const z = row.zoom;
    const zsrc = z ? sharp(file).extract({ left: z.x, top: z.y, width: Math.min(z.w, meta.width - z.x), height: Math.min(z.h, meta.height - z.y) }) : sharp(zoomFile);
    const zbuf = await zsrc.png().toBuffer();
    const zm = await sharp(zbuf).metadata();
    const zoom = await sharp(zbuf).resize(zm.width * 2, zm.height * 2, { kernel: 'nearest' }).png().toBuffer();
    return { whole, w, h, zoom, zw: zm.width * 2, zh: zm.height * 2 };
}

for (const sheet of SHEETS) {
    const rows = [];
    for (const row of sheet.rows) {
        const p = (label, z = '') => path.join(raw, `${label}_${row.name}${z}.png`);
        const after = await piece(p('after'), p('after', '_zoom'), row);
        if (!after) { console.log('missing', row.name); continue; }
        rows.push({ row, before: await piece(p('before'), p('before', '_zoom'), row), after });
    }
    const rowW = (r) => (r.before ? r.before.w + GAP : 0) + r.after.w + GAP + (r.before ? r.before.zw + GAP : 0) + r.after.zw + 2 * GAP;
    const rowH = (r) => Math.max(r.before?.h || 0, r.after.h, r.before?.zh || 0, r.after.zh);
    const width = Math.max(...rows.map(rowW), 900);
    const height = HEAD + rows.reduce((s, r) => s + LAB + rowH(r) + GAP, 0) + GAP;
    const layers = [{ input: text(sheet.title, width - 2 * GAP, HEAD, 22, 'bold'), left: GAP, top: 0 }];
    let y = HEAD;
    for (const r of rows) {
        layers.push({ input: text(r.row.label, width - 2 * GAP, LAB), left: GAP, top: y });
        y += LAB;
        let x = GAP;
        if (r.before) { layers.push({ input: r.before.whole, left: x, top: y }); x += r.before.w + GAP; }
        layers.push({ input: r.after.whole, left: x, top: y }); x += r.after.w + GAP;
        if (r.before) { layers.push({ input: r.before.zoom, left: x, top: y }); x += r.before.zw + GAP; }
        layers.push({ input: r.after.zoom, left: x, top: y });
        y += rowH(r) + GAP;
    }
    const png = await sharp({ create: { width, height, channels: 3, background: BG } }).composite(layers).png().toBuffer();
    await sharp(png).png({ palette: true, colors: 128, effort: 10 }).toFile(path.join(out, sheet.file));
    console.log('wrote', sheet.file, `${width}x${height}`);
}
