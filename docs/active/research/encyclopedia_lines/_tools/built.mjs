// Throwaway (brief 470 E2): the built chart, words on its lines, in the real game on the throwaway
// server (vite.e2.config.mjs, port 5427). Starts a New Game with one hero at 15 in every skill, opens
// each page with the encyclopedia's own look-up, grows the boxes named, frames the chart and saves
// ../built/<page>_<width>.png; checks every drawn word in the page against the boxes, marks, tabs and
// the other words, and that its letters fit the room the layout kept.
//   node built.mjs [1366,1920] [page,page]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'built');
fs.mkdirSync(out, { recursive: true });
const SIZES = { 1366: [1366, 768], 1920: [1920, 1080] };
const widths = (process.argv[2] || '1366,1920').split(',');

// clicks: a box by its key, or a tab `stem:<key>:in|out` beside it. frame: centre, left or right.
const PAGES = [
    { name: 'woodaxe', key: 'item:item_iron_woodaxe', clicks: ['token:token_oak_tree'], hover: 'item:item_oak_wood', tip: 'toolFor' },
    { name: 'oakwood', key: 'item:item_oak_wood', clicks: ['token:token_oak_tree'] },
    { name: 'ingot', key: 'item:item_iron_ingot', clicks: [], tip: 'madeAt' },
    { name: 'raredrop', key: 'item:item_fire_elemental_chief_banner', clicks: ['token:token_fire_elemental_chief'], hover: 'token:token_fire_elemental_chief' },
    {
        name: 'large', key: 'item:item_iron_ingot',
        clicks: ['station', 'item:item_iron_ore', 'item:item_coal', 'stem:item:item_iron_pickaxe:in', 'stem:item:item_iron_pickaxe:out'],
        frames: ['left', 'right'], hover: 'token:token_iron_furnace'
    },
    { name: 'forest', key: 'token:token_oak_forest', clicks: [] },
    { name: 'stump', key: 'token:token_oak_stump', clicks: [] },
    { name: 'ironfurnace', key: 'token:token_iron_furnace', clicks: [] },
    { name: 'trout', key: 'item:item_trout', clicks: [] },
    { name: 'birdnest', key: 'item:item_bird_nest', clicks: [] },
    { name: 'wheatseed', key: 'item:item_wheat_seed', clicks: [] },
    { name: 'recipe', key: 'recipe:several', clicks: [] },
    { name: 'farmland', key: 'token:token_farmland', clicks: [] },
    { name: 'guildhall', key: 'token:token_guild_hall', clicks: [] },
];
const pick = process.argv[3] ? process.argv[3].split(',') : PAGES.map(p => p.name);

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

// A recipe entry that makes several things (its page draws "makes" to each).
const SEVERAL = `(async () => {
    const M = await import('/src/ui/components/encyclopedia/encyclopediaModel.js');
    const C = await import('/src/ui/components/encyclopedia/encyclopediaChart.js');
    const book = M.encyclopedia();
    const r = book.byKind.recipes.find(e => C.madeBy(book, e.key) === e.key && C.waysOut(book, e.key).length > 1);
    return r ? r.key : null;
})()`;

// Every drawn word: its rect against the boxes, marks, tabs, captions and the other words; its text against its room.
const CHECK = `(() => {
    const rect = (el) => el.getBoundingClientRect();
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const words = [...document.querySelectorAll('[data-codex-line-word]')];
    const others = [...document.querySelectorAll('[data-codex-node], [data-codex-line-label], [data-codex-stem], [data-codex-caption]')];
    const clashes = [];
    let overflow = 0, caps = 0, outlined = 0;
    words.forEach((w, i) => {
        const r = rect(w);
        const room = rect(w.parentElement);
        if (r.width > room.width + 0.5) overflow++;
        const cs = getComputedStyle(w);
        if (cs.textTransform === 'uppercase') caps++;
        if (cs.textShadow && cs.textShadow !== 'none') outlined++;
        for (const o of others) if (hit(r, rect(o))) clashes.push(w.dataset.codexLineWord + ' / ' + (o.dataset.codexNode || o.dataset.codexLineLabel || o.dataset.codexStemOf || o.dataset.codexCaption));
        words.slice(i + 1).forEach(v => { if (hit(r, rect(v))) clashes.push(w.dataset.codexLineWord + ' / ' + v.dataset.codexLineWord); });
    });
    const kinds = {};
    for (const w of words) kinds[w.dataset.codexWord] = (kinds[w.dataset.codexWord] || 0) + 1;
    const bar = document.querySelector('[data-codex-progress]');
    const chart = document.querySelector('[data-codex-chart]');
    const clearOfBars = bar && chart ? rect(chart).bottom <= rect(bar).top : null;
    return { words: words.length, onLine: words.filter(w => w.dataset.onLine).length, kinds, clashes, overflow, caps, outlined, clearOfBars };
})()`;

const centreOf = (page, sel) => page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
// Off every box and line, on the book: the toolbar's empty right end (a screen corner can open a nav bubble's view instead).
const away = async (page) => { const at = await page.evaluate(`(() => { const r = document.querySelector('[data-codex-toolbar]')?.getBoundingClientRect(); return r ? { x: Math.round(r.right - 6), y: Math.round(r.top + 6) } : { x: 5, y: 5 }; })()`); await page.mouse('mouseMoved', at.x, at.y); };
const lookUp = (page, key) => page.evaluate(`(async () => { (await import('/src/ui/components/encyclopedia/encyclopediaLink.js')).lookUp(${JSON.stringify(key)}); return true; })()`);

const checksFile = path.join(out, 'checks.json');
const report = fs.existsSync(checksFile) ? JSON.parse(fs.readFileSync(checksFile, 'utf8')) : {};
for (const wkey of widths) {
    const [W, H] = SIZES[wkey];
    // A big sideways wheel would otherwise swipe the tab back to its blank first page.
    const chrome = await launchChrome({ width: W, height: H, headless: true, extraArgs: ['--overscroll-history-navigation=0', '--disable-features=OverscrollHistoryNavigation'] });
    try {
        const page = await chrome.newPage();
        const consoleLines = [];
        page.on('Runtime.consoleAPICalled', (p) => { if (p.type === 'error' || p.type === 'warning') consoleLines.push(p.type + ': ' + (p.args || []).map(a => a.value ?? a.description ?? '').join(' ').slice(0, 600)); });
        await page.navigate('http://localhost:5427/');
        await page.waitFor(`!!document.querySelector('[data-save-slot="1"] button')`, { timeoutMs: 180000, intervalMs: 500, what: 'the slot picker' });
        await sleep(800);
        const slot = await centreOf(page, '[data-save-slot="1"] button');
        await page.click(slot.x, slot.y);
        await page.waitFor(`!document.querySelector('[data-save-slot]') && !!window.Game`, { timeoutMs: 120000, intervalMs: 500, what: 'the new game' });
        await sleep(4000);
        console.log(W, 'heroes:', await page.evaluate(SETUP));
        await sleep(2500);
        await page.evaluate(`(() => { try { window.__perf?.stop?.(); window.__perf?.hideHud?.(); } catch {} return true; })()`);

        for (const p of PAGES.filter(p => pick.includes(p.name))) {
            const key = p.key === 'recipe:several' ? await page.evaluate(SEVERAL) : p.key;
            await away(page);
            await lookUp(page, 'item:item_bones');
            await page.waitFor(`!!document.querySelector('[data-codex-chart]')`, { timeoutMs: 10000, what: 'the chart' });
            await sleep(500);
            await lookUp(page, key);
            await sleep(900);
            const shown = await page.evaluate(`document.querySelector('[data-codex-node="s"]')?.dataset.codexKey`);
            if (shown !== key) { console.error(`${p.name}: the chart shows ${shown}, not ${key}`); continue; }
            for (const c of p.clicks) {
                let sel;
                if (c === 'station') sel = `[data-codex-node][data-codex-key^="station:"]`;
                else if (c.startsWith('stem:')) {
                    const [, kind, id, side] = c.split(':');
                    const nodeId = await page.evaluate(`document.querySelector('[data-codex-node][data-codex-key="${kind}:${id}"]')?.dataset.codexNode`);
                    sel = `[data-codex-stem="${side}"][data-codex-stem-of="${nodeId}"]`;
                } else sel = `[data-codex-node][data-codex-key=${JSON.stringify(c)}]`;
                const at = await page.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + Math.min(30, r.width / 2)), y: Math.round(r.top + r.height / 2) }; })()`);
                if (!at) { console.error(`no ${sel} on ${p.name}`); continue; }
                // A click by the element's own handler: the box may lie outside the window at this size.
                await page.evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`);
                await sleep(800);
            }
            for (const frame of p.frames || ['centre']) {
                const fit = await page.evaluate(`(() => {
                    const ch = document.querySelector('[data-codex-chart]'), svg = ch.querySelector('svg[data-codex-links]');
                    const [vx, vy] = ch.dataset.codexView.split(',').map(Number);
                    const x0 = parseFloat(svg.style.left), y0 = parseFloat(svg.style.top), w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
                    const vw = ch.clientWidth, vh = ch.clientHeight, side = ${JSON.stringify(frame)};
                    const wx = w <= vw || side === 'centre' ? Math.round((vw - w) / 2 - x0) : side === 'left' ? 8 - x0 : vw - 8 - (x0 + w);
                    const wy = h <= vh ? Math.round((vh - h) / 2 - y0) : Math.round(vh / 2 - (y0 + h / 2));
                    const r = ch.getBoundingClientRect();
                    return { dx: vx - wx, dy: vy - wy, cx: Math.round(r.left + 40), cy: Math.round(r.top + 40), w, h, vw, vh };
                })()`);
                await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: fit.cx, y: fit.cy, deltaX: fit.dx, deltaY: fit.dy });
                await sleep(300);
                await away(page);
                await sleep(600);
                if (!(await page.evaluate(`!!document.querySelector('[data-codex-chart]')`))) {
                    console.log('BOOK GONE', JSON.stringify((page.consoleErrors || []).slice(-6), null, 1), consoleLines.filter(l => !l.includes('Content check')).slice(-8).join(' || '));
                    continue;
                }
                const check = await page.evaluate(CHECK);
                const name = `${p.name}${frame === 'centre' ? '' : `_${frame}`}_${W}`;
                report[name] = { chart: `${fit.w}x${fit.h} in ${fit.vw}x${fit.vh}`, ...check };
                console.log(name, JSON.stringify(report[name]));
                const shot = async (suffix) => {
                    const res = await page.send('Page.captureScreenshot', { format: 'png' });
                    fs.writeFileSync(path.join(out, `${name}${suffix}.png`), Buffer.from(res.data, 'base64'));
                };
                await shot('');
                // The lit path: the pointer resting on a box far from the start.
                if (p.hover && frame === (p.frames || ['centre'])[0]) {
                    const sel = `[data-codex-node][data-codex-key=${JSON.stringify(p.hover)}]`;
                    // Panned into the window first when the frame left it outside.
                    const pan = await page.evaluate(`(() => {
                        const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null;
                        const b = el.getBoundingClientRect(), w = document.querySelector('[data-codex-chart]').getBoundingClientRect();
                        const dx = b.right > w.right - 24 ? b.right - (w.right - 24) : b.left < w.left + 24 ? b.left - (w.left + 24) : 0;
                        const dy = b.bottom > w.bottom - 24 ? b.bottom - (w.bottom - 24) : b.top < w.top + 24 ? b.top - (w.top + 24) : 0;
                        return { dx, dy, x: Math.round(w.left + 40), y: Math.round(w.top + 40) };
                    })()`);
                    if (pan && (pan.dx || pan.dy)) {
                        await page.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: pan.x, y: pan.y, deltaX: pan.dx, deltaY: pan.dy });
                        await sleep(400);
                    }
                    const at = await centreOf(page, sel);
                    if (at) {
                        await page.mouse('mouseMoved', at.x, at.y);
                        await sleep(700);
                        const lit = await page.evaluate(`({ hover: document.querySelector('[data-codex-chart]').dataset.codexHover, lit: document.querySelectorAll('[data-codex-link][data-lit]').length })`);
                        console.log('  lit', JSON.stringify(lit));
                        await shot('_lit');
                        await away(page);
                        await sleep(300);
                    }
                }
                // A word's hover sentence.
                if (p.tip && frame === (p.frames || ['centre'])[0]) {
                    const at = await centreOf(page, `[data-codex-word="${p.tip}"]`);
                    if (at) {
                        await page.mouse('mouseMoved', at.x, at.y);
                        await sleep(900);
                        const tipText = await page.evaluate(`[...document.querySelectorAll('body > *')].map(e => e.textContent).filter(t => /${p.tip === 'toolFor' ? 'never used up' : 'is made at'}/.test(t)).slice(-1)[0] || null`);
                        console.log('  tip', JSON.stringify(tipText));
                        await shot('_tip');
                        await away(page);
                        await sleep(300);
                    }
                }
            }
        }
        if (page.consoleErrors?.length) console.log('page errors:', page.consoleErrors.slice(0, 5));
    } finally {
        await chrome.close();
    }
}
fs.writeFileSync(checksFile, JSON.stringify(report, null, 1));
