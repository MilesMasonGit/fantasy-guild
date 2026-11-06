// Throwaway (brief 470 E1): open the real game on the throwaway server (port 5409), start a New Game
// with one hero at 15 in every skill (as the display plan's pictures did), open each chart page with
// the encyclopedia's own look-up, grow the boxes named, then redraw the lines per option (inject.js)
// and save the chart window to raw/<page>_<option>.png.   node capture.mjs [page,page] [A,B,C,D]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'raw');
fs.mkdirSync(out, { recursive: true });
const W = Number(process.env.E1W || 1920), H = Number(process.env.E1H || 1040);
const inject = fs.readFileSync(path.join(here, 'inject.js'), 'utf8');

export const PAGES = [
    { name: 'woodaxe', key: 'item:item_iron_woodaxe', clicks: ['token:token_oak_tree'] },
    { name: 'oakwood', key: 'item:item_oak_wood', clicks: ['token:token_oak_tree'] },
    { name: 'ingot', key: 'item:item_iron_ingot', clicks: [] },
    { name: 'raredrop', key: 'item:item_fire_elemental_chief_banner', clicks: ['token:token_fire_elemental_chief'] },
];
const pick = (process.argv[2] || PAGES.map(p => p.name).join(',')).split(',');
const opts = (process.argv[3] || 'A,B,C,D').split(',');

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
    for (const [id, n] of [['item_coal', 4], ['item_iron_ore', 2], ['item_oak_seedling', 2], ['item_oak_wood', 30]]) inv.addItem(id, n);
    await new Promise(r => setTimeout(r, 500));
    (await import('/src/systems/core/NotificationSystem.js')).dismissAll();
    const B = await import('/src/systems/notifications/banners.js');
    for (const b of B.getAll()) B.dismiss(b.id);
    return window.GameState.heroes.length;
})()`;

const centreOf = (page, sel) => page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
const lookUp = (page, key) => page.evaluate(`(async () => { (await import('/src/ui/components/encyclopedia/encyclopediaLink.js')).lookUp(${JSON.stringify(key)}); return true; })()`);

const chrome = await launchChrome({ width: W, height: H, headless: true });
const log = {};
try {
    const page = await chrome.newPage();
    await page.navigate('http://localhost:5409/');
    await page.waitFor(`!!document.querySelector('[data-save-slot="1"] button')`, { timeoutMs: 180000, intervalMs: 500, what: 'the slot picker' });
    await sleep(800);
    const slot = await centreOf(page, '[data-save-slot="1"] button');
    await page.click(slot.x, slot.y);
    await page.waitFor(`!document.querySelector('[data-save-slot]') && !!window.Game`, { timeoutMs: 120000, intervalMs: 500, what: 'the new game' });
    await sleep(4000);
    console.log('heroes:', await page.evaluate(SETUP));
    await sleep(2500);
    await page.evaluate(`(() => { try { window.__perf?.stop?.(); window.__perf?.hideHud?.(); } catch {} return true; })()`);
    await page.evaluate(inject);

    for (const p of PAGES.filter(p => pick.includes(p.name))) {
        await page.mouse('mouseMoved', 5, H - 5);
        await lookUp(page, 'item:item_bones');
        await page.waitFor(`!!document.querySelector('[data-codex-chart]')`, { timeoutMs: 10000, what: 'the chart' });
        await sleep(500);
        await lookUp(page, p.key);
        await sleep(900);
        const shown = await page.evaluate(`document.querySelector('[data-codex-node="s"]')?.dataset.codexKey`);
        if (shown !== p.key) { console.error(`${p.name}: the chart shows ${shown}, not ${p.key}`); continue; }
        for (const key of p.clicks) {
            const at = await page.evaluate(`(() => { const el = document.querySelector('[data-codex-node][data-codex-key=${JSON.stringify(key)}]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + 30), y: Math.round(r.top + r.height / 2) }; })()`);
            if (!at) { console.error(`no box ${key} on ${p.name}`); continue; }
            await page.click(at.x, at.y);
            await sleep(800);
        }
        // Frame the whole chart in the window (centred, or one side kept when it is wider), panned
        // with the wheel the chart itself listens to.
        const fit = await page.evaluate(`(() => {
            const ch = document.querySelector('[data-codex-chart]'), svg = ch.querySelector('svg[data-codex-links]');
            const [vx, vy] = ch.dataset.codexView.split(',').map(Number);
            const x0 = parseFloat(svg.style.left), y0 = parseFloat(svg.style.top), w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
            const vw = ch.clientWidth, vh = ch.clientHeight, side = ${JSON.stringify(p.frame || 'centre')};
            const wx = w <= vw || side === 'centre' ? Math.round((vw - w) / 2 - x0) : side === 'left' ? 8 - x0 : vw - 8 - (x0 + w);
            const wy = Math.round((vh - h) / 2 - y0);
            const r = ch.getBoundingClientRect();
            return { dx: vx - wx, dy: vy - wy, cx: Math.round(r.left + 40), cy: Math.round(r.top + 40), w, h, vw, vh };
        })()`);
        console.log(p.name, 'chart', fit.w, 'x', fit.h, 'in', fit.vw, 'x', fit.vh);
        await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: fit.cx, y: fit.cy, deltaX: fit.dx, deltaY: fit.dy });
        await sleep(300);
        await page.mouse('mouseMoved', 5, H - 5);
        await sleep(600);
        const r = await page.evaluate(`(() => { const r = document.querySelector('[data-codex-chart]').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })()`);
        for (const o of opts) {
            const rep = await page.evaluate(`window.E1.apply(${JSON.stringify(o)})`);
            if (o === 'A') { log[p.name] = rep; console.log(p.name, JSON.stringify(rep)); }
            await sleep(250);
            const res = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
            fs.writeFileSync(path.join(out, `${p.name}_${o}.png`), Buffer.from(res.data, 'base64'));
        }
        await page.evaluate(`window.E1.reset()`);
        console.log('saved', p.name);
    }
    if (page.consoleErrors?.length) console.log('page errors:', page.consoleErrors.slice(0, 5));
    fs.writeFileSync(path.join(here, `kinds_${pick.join('_')}.json`), JSON.stringify(log, null, 1));
} finally {
    await chrome.close();
}
