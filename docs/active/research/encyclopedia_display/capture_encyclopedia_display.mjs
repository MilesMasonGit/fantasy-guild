// Captures the encyclopedia display plan's mock-ups (spike/encyclopedia-display):
//   node capture_encyclopedia_display.mjs <url> <outDir>
// Needs a dev server of the spike branch (its chart reads `window.__codexStyle`, the prototype's
// display options; `{}` is the chart as built on feat/encyclopedia-e3). Plays a New Game in slot 1
// of a throwaway headless Chrome profile (no bench fixtures), adds one hero with every skill at 15
// (Construction 6) and a few Bank items so have/need and the red "no hero has it" both show, stops
// the loop, then opens each chart with the encyclopedia's own look-up, clicks the boxes named, and
// saves the chart window at 1920 x 1040. `18_`/`19_` are the text before/after, put together here.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [base = 'http://localhost:5297', out = '.'] = process.argv.slice(2);
const W = 1920;
const H = 1040;
fs.mkdirSync(out, { recursive: true });

/** The recommended design. */
const R = { fold: true, bare: 'hide', foundation: true, stationsExact: true, req: 'line', text: 'ink', box: 'lean' };
const without = (k) => { const o = { ...R }; delete o[k]; return o; };
const LEFT_OF_INGOT = ['item:item_coal', 'token:token_fire_elemental_chief', 'item:item_iron_ingot', 'item:item_iron_ore']
    .map(k => `[data-codex-key="${k}"]`);

const SHOTS = [
    { name: '01_today_iron_ingot', key: 'item:item_iron_ingot', style: {} },
    { name: '02_recommended_iron_ingot', key: 'item:item_iron_ingot', style: R },
    { name: '03_recommended_tree_chain_oak_wood', key: 'item:item_oak_wood', clicks: ['token:token_oak_tree', 'token:token_oak_forest'], style: R },
    { name: '04_option_every_stage_tree_chain_oak_wood', key: 'item:item_oak_wood', clicks: ['token:token_oak_tree', 'token:token_oak_sapling', 'token:token_oak_forest'], style: without('fold') },
    { name: '05_recommended_rare_drop_volcano_map', key: 'item:map_volcano', style: R },
    { name: '06_recommended_rare_drop_bird_nest', key: 'item:item_bird_nest', clicks: ['recipe:recipe_search_bird_nest'], style: R },
    { name: '07_recommended_crop_wheat', key: 'item:item_wheat', style: R },
    { name: '08_recommended_building_iron_furnace', key: 'token:token_iron_furnace', style: R },
    { name: '09_option_station_grows_to_every_station_of_its_skill_iron_furnace', key: 'token:token_iron_furnace', clicks: ['station:construction'], style: without('stationsExact') },
    { name: '10_option_stations_on_the_line_iron_ingot', key: 'item:item_iron_ingot', style: { ...R, foldStations: true } },
    { name: '11_option_requirement_in_the_box_iron_ingot', key: 'item:item_iron_ingot', style: { ...R, req: 'badge' } },
    { name: '12_option_requirement_above_the_box_iron_ingot', key: 'item:item_iron_ingot', style: { ...R, req: 'above' } },
    { name: '13_option_text_on_dark_tags_iron_ingot', key: 'item:item_iron_ingot', style: { ...R, text: 'tag' } },
    { name: '14_recommended_hover_details_iron_ore', key: 'item:item_iron_ingot', style: R, hover: '[data-codex-key="item:item_iron_ore"]' },
    { name: '15_recommended_hover_regrow_oak_tree', key: 'token:token_oak_tree', style: R, hover: '[data-glyph="regrow"]' },
    { name: '16_recommended_hover_requirement_iron_ingot', key: 'item:item_iron_ingot', style: R, hover: '[data-codex-line-label="s<0@"]' },
    { name: '17_recommended_station_grown_iron_ingot', key: 'item:item_iron_ingot', clicks: ['station:smithing|token:token_furnace,token:token_iron_furnace'], style: R },
    { name: '20_today_full_screen_iron_ingot', key: 'item:item_iron_ingot', style: {}, full: true },
    { name: '21_recommended_full_screen_iron_ingot', key: 'item:item_iron_ingot', style: R, full: true },
    { name: '_txt_now', key: 'item:item_iron_ingot', style: {}, cropSel: LEFT_OF_INGOT },
    { name: '_txt_ink', key: 'item:item_iron_ingot', style: { text: 'ink' }, cropSel: LEFT_OF_INGOT },
    { name: '_txt_tag', key: 'item:item_iron_ingot', style: { text: 'tag' }, cropSel: LEFT_OF_INGOT }
];

/** One hero (every skill 15, Construction 6) and a few Bank items; the arrival banner dismissed. */
const SETUP = `(async () => {
    const HM = await import('/src/systems/hero/HeroManager.js');
    const { generateHero } = await import('/src/systems/hero/HeroGenerator.js');
    const { GuildUpgradeManager } = await import('/src/systems/progression/GuildUpgradeManager.js');
    const { xpForLevel } = await import('/src/utils/XPCurve.js');
    const ranks = GuildUpgradeManager.getRanks();
    ranks.roster_size = Math.max(ranks.roster_size || 0, (HM.getAllHeroes() || []).length + 1);
    GuildUpgradeManager.recompute();
    const hero = generateHero({ name: 'Mock Hero' });
    for (const id of Object.keys(hero.skills || {})) {
        const level = id === 'construction' ? 6 : 15;
        hero.skills[id] = { ...hero.skills[id], level, xp: xpForLevel(level) };
    }
    HM.addHero(hero);
    const inv = window.Game.InventoryManager;
    for (const [id, n] of [['item_coal', 4], ['item_iron_ore', 2], ['item_oak_seedling', 2], ['item_stone', 12], ['item_wheat_seed', 3], ['item_fir_wood', 5]]) inv.addItem(id, n);
    await new Promise(r => setTimeout(r, 500));
    (await import('/src/systems/core/NotificationSystem.js')).dismissAll();
    const B = await import('/src/systems/notifications/banners.js');
    for (const b of B.getAll()) B.dismiss(b.id);
    return window.GameState.heroes.length;
})()`;

const centreOf = (page, selector) => page.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`);
const lookUp = (page, key) => page.evaluate(`(async () => {
    (await import('/src/ui/components/encyclopedia/encyclopediaLink.js')).lookUp(${JSON.stringify(key)});
    return true;
})()`);

const chrome = await launchChrome({ width: W, height: H, headless: true });
try {
    const page = await chrome.newPage();
    await page.navigate(`${base}/`);
    await page.waitFor(`!!document.querySelector('[data-save-slot="1"] button')`, { timeoutMs: 180000, intervalMs: 500, what: 'the slot picker' });
    await sleep(800);
    const slot = await centreOf(page, '[data-save-slot="1"] button');
    await page.click(slot.x, slot.y);
    await page.waitFor(`!document.querySelector('[data-save-slot]') && !!window.Game`, { timeoutMs: 120000, intervalMs: 500, what: 'the new game' });
    await sleep(4000);
    console.log('heroes after set-up:', await page.evaluate(SETUP));
    await sleep(3000);
    await page.evaluate(`(() => { try { window.__perf?.stop?.(); window.__perf?.hideHud?.(); } catch {} return true; })()`);

    for (const shot of SHOTS) {
        await page.mouse('mouseMoved', 5, H - 5);
        await sleep(300);
        await page.evaluate(`(() => { window.__codexStyle = ${JSON.stringify(shot.style)}; return true; })()`);
        // Another entry first: a look-up of the entry already open keeps what was grown.
        await lookUp(page, 'item:item_bones');
        await page.waitFor(`!!document.querySelector('[data-codex-chart]')`, { timeoutMs: 10000, what: 'the chart' });
        await sleep(500);
        await lookUp(page, shot.key);
        await sleep(900);
        for (const key of shot.clicks || []) {
            const at = await page.evaluate(`(() => {
                const el = document.querySelector('[data-codex-node][data-codex-key=${JSON.stringify(key)}]');
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.left + 30), y: Math.round(r.top + r.height / 2) };
            })()`);
            if (!at) { console.error(`no box ${key} in ${shot.name}`); continue; }
            await page.click(at.x, at.y);
            await sleep(700);
        }
        await page.mouse('mouseMoved', 5, H - 5);
        await sleep(500);
        if (shot.hover) {
            const at = await centreOf(page, shot.hover);
            if (at) { await page.mouse('mouseMoved', at.x, at.y); await sleep(900); } else console.error(`nothing to rest on: ${shot.hover}`);
        }
        let clip = null;
        if (shot.cropSel) {
            const u = await page.evaluate(`(() => {
                let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
                for (const s of ${JSON.stringify(shot.cropSel)}) for (const el of document.querySelectorAll(s)) {
                    const q = el.getBoundingClientRect(); if (!q.width) continue;
                    l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
                }
                return Number.isFinite(l) ? { l, t, r, b } : null;
            })()`);
            const pad = 48;
            if (u) clip = { x: Math.max(0, Math.floor(u.l - pad)), y: Math.max(0, Math.floor(u.t - pad)), width: Math.ceil(u.r - u.l + 2 * pad), height: Math.ceil(u.b - u.t + 2 * pad), scale: 1 };
        } else if (!shot.full) {
            const r = await page.evaluate(`(() => { const r = document.querySelector('[data-codex-chart]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
            clip = { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 };
        }
        const res = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
        fs.writeFileSync(path.join(out, `${shot.name}.png`), Buffer.from(res.data, 'base64'));
        console.log('saved', shot.name);
    }
    if (page.consoleErrors.length) console.log('page errors:', page.consoleErrors.slice(0, 5));
    await page.close();
} finally {
    await chrome.close();
}

// The text before / after: the same patch three ways, true size, then 2x.
const COLS = [['_txt_now', 'TODAY: small ink, black outline'], ['_txt_ink', 'A (recommended): body size, ink, no outline'], ['_txt_tag', 'B: white words on dark tags']];
const heading = (w, words) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="40"><rect width="100%" height="100%" fill="#1a1d24"/><text x="12" y="27" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${words}</text></svg>`);
{
    const w = 600, h = 344, tiles = [];
    for (const [i, [name, words]] of COLS.entries()) {
        const img = await sharp(path.join(out, `${name}.png`)).extract({ left: 0, top: 0, width: w, height: h }).toBuffer();
        tiles.push({ input: heading(w, words), left: i * (w + 8), top: 0 }, { input: img, left: i * (w + 8), top: 40 });
    }
    await sharp({ create: { width: 3 * w + 16, height: h + 40, channels: 3, background: '#000' } }).composite(tiles).png().toFile(path.join(out, '18_text_before_after.png'));
}
{
    const w = 440, h = 170, tiles = [];
    for (const [i, [name, words]] of COLS.entries()) {
        const meta = await sharp(path.join(out, `${name}.png`)).metadata();
        const img = await sharp(path.join(out, `${name}.png`)).extract({ left: Math.min(meta.width - w, 170), top: 120, width: w, height: h }).resize(w * 2, h * 2, { kernel: 'nearest' }).toBuffer();
        tiles.push({ input: heading(w * 2, `${words} (shown 2x)`), left: 0, top: i * (h * 2 + 48) }, { input: img, left: 0, top: i * (h * 2 + 48) + 40 });
    }
    await sharp({ create: { width: w * 2, height: 3 * (h * 2 + 48), channels: 3, background: '#000' } }).composite(tiles).png().toFile(path.join(out, '19_text_before_after_zoomed.png'));
}
for (const [name] of COLS) fs.rmSync(path.join(out, `${name}.png`));
console.log('done');
