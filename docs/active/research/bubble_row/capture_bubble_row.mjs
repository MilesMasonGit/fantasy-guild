// Captures the bubble-row mock-ups and today's look of the same moments, for the owner's phone:
//   node capture_bubble_row.mjs <url> <outDir>
// Part 1, today on the mat (1920 x 1080, a New Game): four heroes pinned to a Furnace making
// Copper Ingots, a Furnace that ran out of Iron Ore, a Fir Forest with its charges, and a Goblin
// in a fight. The game loop is stopped and time is driven by hand, so the moments hold still.
// Saves `today_1x.png` (the screen), `today_<moment>_1x.png` / `_2x.png` (a 300 px patch round
// each Token and its hero, the 2x upscaled nearest-neighbour), `_hover_2x.png` (the pointer
// resting on the Token) and `today_waiting_tip_2x.png` (resting on the problem mark).
// Part 2, the mock-ups on the style sheet page (QA panel, Style Sheet): `mockup_<A|B|C>_1x.png`
// and `_2x.png`, and `mockup_<A|B|C>_tip_2x.png` (resting on the waiting moment's problem).
// Prints how many page elements each moment draws, today and in each mock-up.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5218', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const save = (name, b64) => writeFileSync(path.join(out, `${name}.png`), Buffer.from(b64, 'base64'));

async function shot(page, name, clip = null) {
    const s = await page.send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 } } : { format: 'png' });
    save(name, s.data);
    return s.data;
}

/** A clip saved at 1x, and upscaled `k` times nearest-neighbour in the page's own canvas. */
async function clipBoth(page, name, clip, { k = 2, one = true } = {}) {
    const data = await shot(page, `${name}_1x`, clip);
    const b64 = await page.evaluate(`(async () => {
        const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    })()`);
    save(`${name}_2x`, b64);
    if (!one) {
        const fs = await import('node:fs');
        fs.unlinkSync(path.join(out, `${name}_1x.png`));
    }
}

const away = async (page) => { await page.mouse('mouseMoved', 1910, 600); await sleep(500); };
const restOn = async (page, x, y) => { await page.mouse('mouseMoved', x - 3, y - 3); await sleep(80); await page.mouse('mouseMoved', x, y); await sleep(1400); };

const log = {};
const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    await page.setViewport(1920, 1080);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(2500);
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) throw new Error('no New Game button');
    await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
    await sleep(4000);

    // ---- Part 1: today ----
    log.build = await page.evaluate(`(async () => {
        const SR = await import('/src/systems/board/StationRecipe.js');
        const TR = await import('/src/config/registries/tokenRegistry.js');
        const TM = await import('/src/systems/board/TileModifiers.js');
        const HG = await import('/src/systems/hero/HeroGenerator.js');
        const XP = await import('/src/utils/XPCurve.js');
        const BS = Game.BoardState;
        Game.GameLoop.stop();
        Game.GameState.state.progress.rosterLimit = 8;
        const mk = (name, skills) => {
            const h = HG.generateHero({ name });
            for (const [k, v] of Object.entries(skills)) h.skills[k] = { level: v, xp: XP.xpForLevel(v) };
            return Game.HeroManager.addHero(h);
        };
        const heroes = { working: mk('Aela', { smithing: 30 }), waiting: mk('Bram', { smithing: 30 }), charges: mk('Cora', { forestry: 30 }), combat: mk('Dain', { melee: 3 }) };
        const inv = Game.InventoryManager;
        inv.addItem('item_copper_ore', 400);
        inv.addItem('item_coal', 400);
        inv.addItem('item_iron_ore', 6);
        inv.addItem('item_copper_woodaxe', 1);
        Game.EquipmentManager.equipItem(heroes.charges.id, 'item_copper_woodaxe');
        const place = (typeId, x, y) => {
            const inst = BS.createTokenInstance(typeId, TR.tokenStartingUses(typeId));
            Game.BoardPlacement.placeTokenAt(inst, { x, y });
            return inst.id;
        };
        const tokens = { working: place('token_furnace', 420, 820), waiting: place('token_furnace', 800, 820), charges: place('token_fir_forest', 1180, 840) };
        SR.setSelectedRecipe(BS.getTokenById(tokens.working), 'recipe_copper_ingot');
        SR.setSelectedRecipe(BS.getTokenById(tokens.waiting), 'recipe_mtp8qjj0');
        TM.rebuildAll();
        const pin = (heroId, tokenId) => { const t = BS.getTokenById(tokenId); return Game.BoardPlacement.plantFlagAt(heroId, { x: t.x, y: t.y }, { pin: true }).success; };
        for (const k of Object.keys(tokens)) pin(heroes[k].id, tokens[k]);
        // Long enough for the Iron Ore to run out; then mid-cycle, so the work bars stand part-way along.
        for (let i = 0; i < 380; i++) Game.GameLoop.runHandlers(100);
        tokens.combat = place('token_goblin', 1500, 300);
        pin(heroes.combat.id, tokens.combat);
        let fight = null;
        for (let i = 0; i < 300 && !fight; i++) { Game.GameLoop.runHandlers(100); fight = Game.BoardCombat.fightOfHero(heroes.combat.id); }
        for (let i = 0; i < 4; i++) Game.GameLoop.runHandlers(100);
        // The outputs land as loot beside each Token; picked up, so the moments read clearly.
        Game.SpriteLayer.collectAll();
        window.__bubbleRow = { heroes: Object.fromEntries(Object.entries(heroes).map(([k, h]) => [k, h.id])), tokens };
        return Object.fromEntries(Object.keys(tokens).map(k => {
            const t = BS.getTokenById(tokens[k]);
            return [k, { typeId: t?.typeId, alert: t?.alert || null, uses: t?.usesRemaining ?? null, hero: t?.heroId || null, fight: k === 'combat' ? !!fight : undefined }];
        }));
    })()`, { timeoutMs: 120000 });

    // The hero panel and the New Hero banners are not part of these moments.
    await sleep(1000);
    for (let i = 0; i < 5; i++) {
        const x = await page.evaluate(`(() => { const b = document.querySelector('[data-hero-panel-close]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        if (!x) break;
        await page.click(x.x, x.y);
        await sleep(700);
    }
    log.heroPanelOpen = await page.evaluate(`!!document.querySelector('[data-hero-panel]')`);
    for (let i = 0; i < 8; i++) {
        const left = await page.evaluate(`(() => { const b = document.querySelector('[data-banner]:not([data-banner-leaving])'); if (b) b.click(); return document.querySelectorAll('[data-banner]').length; })()`);
        if (!left) break;
        await sleep(500);
    }
    await away(page);
    await sleep(1500);
    await shot(page, 'today_1x');

    const places = await page.evaluate(`(() => {
        const { heroes, tokens } = window.__bubbleRow;
        const out = {};
        for (const k of Object.keys(tokens)) {
            const o = document.querySelector('[data-token-overlay="' + tokens[k] + '"]');
            const h = document.querySelector('[data-board-hero="' + heroes[k] + '"]');
            if (!o || !h) { out[k] = null; continue; }
            const a = o.getBoundingClientRect();
            const b = h.getBoundingClientRect();
            const cx = (a.x + a.width / 2 + b.x + b.width / 2) / 2;
            const cy = a.y + a.height / 2;
            const count = (el) => el ? el.querySelectorAll('*').length + 1 : 0;
            out[k] = {
                clip: { x: Math.round(cx - 150), y: Math.round(cy - 160), width: 300, height: 300 },
                token: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
                elements: { tokenOverlay: count(o), heroFigure: count(h) },
                problem: (() => { const p = o.querySelector('[data-problem-mark]'); if (!p) return null; const r = p.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()
            };
        }
        return out;
    })()`);
    log.today = places;
    for (const [k, p] of Object.entries(places)) {
        if (!p) continue;
        await clipBoth(page, `today_${k}`, p.clip);
    }
    for (const [k, p] of Object.entries(places)) {
        if (!p) continue;
        await restOn(page, p.token.x, p.token.y);
        log.today[k].elementsHovered = await page.evaluate(`(() => { const o = document.querySelector('[data-token-overlay="' + window.__bubbleRow.tokens['${k}'] + '"]'); return o ? o.querySelectorAll('*').length + 1 : 0; })()`);
        await clipBoth(page, `today_${k}_hover`, p.clip, { one: false });
        await away(page);
    }
    if (places.waiting?.problem) {
        const p = places.waiting.problem;
        await restOn(page, p.x, p.y);
        await clipBoth(page, 'today_waiting_tip', { x: places.waiting.clip.x, y: places.waiting.clip.y, width: 560, height: 300 }, { one: false });
        await away(page);
    }

    // ---- Part 2: the mock-ups ----
    await page.setViewport(1920, 1700);
    await sleep(500);
    log.sheet = await page.evaluate(`(async () => {
        const qa = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'QA');
        if (!qa) return 'no QA button';
        qa.click();
        await new Promise(r => setTimeout(r, 800));
        const s = [...document.querySelectorAll('button')].find(b => /style sheet/i.test(b.textContent || ''));
        if (!s) return 'no Style Sheet button';
        s.click();
        await new Promise(r => setTimeout(r, 1500));
        return !!document.querySelector('[data-bubble-row-mockups]');
    })()`);
    const ids = await page.evaluate(`[...document.querySelectorAll('[data-mockup]')].map(e => e.getAttribute('data-mockup'))`);
    log.mockups = {};
    for (const id of ids) {
        await page.evaluate(`(() => {
            const el = document.querySelector('[data-mockup="${id}"]');
            el.scrollIntoView({ block: 'start' });
            document.querySelector('[data-style-sheet-page]').scrollBy(0, -64);
        })()`);
        await away(page);
        await sleep(900);
        const r = await page.evaluate(`(() => {
            const box = document.querySelector('[data-mockup="${id}"]');
            const r = box.getBoundingClientRect();
            const right = Math.max(...[...box.querySelectorAll('[data-mock-scene]')].map(f => f.getBoundingClientRect().right));
            return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(right - r.x), height: Math.round(r.height) };
        })()`);
        await clipBoth(page, `mockup_${id}`, r);
        log.mockups[id] = await page.evaluate(`(() => {
            const out = {};
            for (const fig of document.querySelectorAll('[data-mockup="${id}"] [data-mock-scene]')) {
                const scene = fig.getAttribute('data-mock-scene') + (out[fig.getAttribute('data-mock-scene')] ? '_open' : '');
                const parts = fig.querySelectorAll('[data-mock-row], [data-mock-plate], [data-mock-tail]');
                const roots = [...parts].filter(p => ![...parts].some(q => q !== p && q.contains(p)));
                out[scene] = roots.reduce((n, el) => n + el.querySelectorAll('*').length + 1, 0);
            }
            return out;
        })()`);
        const tip = await page.evaluate(`(() => { const c = document.querySelector('[data-mockup="${id}"] [data-mock-scene="waiting"] [data-mock-cell="problem"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        if (tip) {
            await restOn(page, tip.x, tip.y);
            const fig = await page.evaluate(`(() => { const r = document.querySelector('[data-mockup="${id}"] [data-mock-scene="waiting"]').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: 600, height: Math.round(r.height) }; })()`);
            await clipBoth(page, `mockup_${id}_tip`, fig, { one: false });
            await away(page);
        }
    }
    if (page.consoleErrors?.length) log.pageErrors = page.consoleErrors.slice(0, 5);
} finally {
    console.log(JSON.stringify(log, null, 1));
    await chrome.close();
}
