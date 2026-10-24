// Captures the work plate in the running game, for the owner's phone, matching the mock-up phase's
// `today_*` captures of the same moments (`capture_bubble_row.mjs`):
//   node capture_work_plate.mjs <url> <outDir>
// A New Game at 1920 x 1080: four heroes pinned to a Furnace making Copper Ingots, a Furnace that
// ran out of Iron Ore, a Fir Forest with its charges, and a Goblin in a fight. The game loop is
// stopped and time is driven by hand, so the moments hold still. Saves `after_1x.png` (the
// screen), `after_<moment>_1x.png` / `_2x.png` (the same 300 x 320 patches as `today_*`; 2x is
// upscaled nearest-neighbour), `after_<moment>_hover_2x.png` (the pointer resting on the Token:
// the plate opens), `after_charges_open_hero_2x.png` (resting on the hero instead),
// `after_waiting_tip_2x.png` (resting on what the Token waits for), `before_after_<moment>` (today
// beside after, from `today_<moment>_1x.png` in the same folder) and `sheet_work_plate` (the style
// sheet page's entry). Prints each plate's cells and how many page elements it draws.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5218', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const save = (name, b64) => writeFileSync(path.join(out, `${name}.png`), Buffer.from(b64, 'base64'));

async function shot(page, name, clip = null) {
    const s = await page.send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : { format: 'png' });
    save(name, s.data);
    return s.data;
}

/** A picture upscaled `k` times nearest-neighbour in the page's own canvas. */
const upscale = (page, data, k = 2) => page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
})()`);

/** A clip saved at 1x and at 2x; with `one: false` only the 2x is kept. Returns the 1x picture. */
async function clipBoth(page, name, clip, { k = 2, one = true } = {}) {
    const data = await shot(page, `${name}_1x`, clip);
    save(`${name}_2x`, await upscale(page, data, k));
    if (!one) {
        const fs = await import('node:fs');
        fs.unlinkSync(path.join(out, `${name}_1x.png`));
    }
    return data;
}

/** Tiles side by side, each with its label above, on the page's dark background. */
const compose = (page, tiles) => page.evaluate(`(async () => {
    const tiles = ${JSON.stringify(tiles)};
    const imgs = await Promise.all(tiles.map(async t => { const i = new Image(); i.src = 'data:image/png;base64,' + t.data; await i.decode(); return i; }));
    const gap = 8, label = 22;
    const c = document.createElement('canvas');
    c.width = imgs.reduce((w, i) => w + i.width, 0) + gap * (imgs.length - 1);
    c.height = Math.max(...imgs.map(i => i.height)) + label;
    const g = c.getContext('2d');
    g.fillStyle = '#0d0a08'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffffff'; g.font = 'bold 14px monospace'; g.textBaseline = 'top';
    let x = 0;
    imgs.forEach((img, i) => { g.fillText(tiles[i].label, x + 4, 4); g.drawImage(img, x, label); x += img.width + gap; });
    return c.toDataURL('image/png').split(',')[1];
})()`);

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

    // ---- The same four moments as the mock-up phase's `today_*` captures ----
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
    // The scene was built before the mat drew it: a few more ticks, so each plate hears its cycle.
    log.ticks = await page.evaluate(`(() => { for (let i = 0; i < 25; i++) Game.GameLoop.runHandlers(100); return Game.BoardCombat.fightOfHero(window.__bubbleRow.heroes.combat) ? 'fight on' : 'fight over'; })()`);
    await away(page);
    await sleep(1500);
    await shot(page, 'after_1x');

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
            const plate = document.querySelector('[data-work-plate="' + tokens[k] + '"]');
            const cell = (kind) => { const c = plate?.querySelector('[data-plate-cell="' + kind + '"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
            out[k] = {
                clip: { x: Math.round(cx - 143), y: Math.round(cy - 180), width: 300, height: 320 },
                token: { x: a.x + a.width / 2, y: a.y + a.height / 2 },
                hero: { x: b.x + b.width / 2, y: b.y + b.height / 2 },
                cells: plate ? [...plate.querySelectorAll('[data-plate-cell]')].map(c => c.getAttribute('data-plate-cell') + (c.textContent ? ':' + c.textContent : '')) : null,
                tone: plate?.getAttribute('data-work-plate-tone') || null,
                fill: plate?.querySelector('[data-work-bar]')?.getAttribute('data-work-bar-fill') ?? null,
                elements: { plate: plate ? count(plate.parentElement) : 0, tokenOverlay: count(o), heroFigure: count(h) },
                problemMarkOnToken: !!o.querySelector('[data-problem-mark]'),
                workBarOnToken: !!o.querySelector('[data-work-bar]'),
                missing: cell('missing')
            };
        }
        out.floaters = document.querySelectorAll('[data-charge-floater]').length;
        out.layerZ = document.querySelector('[data-work-plates]')?.style.zIndex ?? null;
        return out;
    })()`);
    log.after = places;
    const tiles = {};
    for (const [k, p] of Object.entries(places)) {
        if (!p?.clip) continue;
        tiles[k] = { after: await clipBoth(page, `after_${k}`, p.clip) };
    }
    for (const [k, p] of Object.entries(places)) {
        if (!p?.clip) continue;
        await restOn(page, p.token.x, p.token.y);
        log.after[k].cellsHovered = await page.evaluate(`[...(document.querySelector('[data-work-plate="' + window.__bubbleRow.tokens['${k}'] + '"]')?.querySelectorAll('[data-plate-cell]') || [])].map(c => c.getAttribute('data-plate-cell') + (c.textContent ? ':' + c.textContent : ''))`);
        tiles[k].hover = await clipBoth(page, `after_${k}_hover`, p.clip, { one: false });
        await away(page);
    }
    if (places.charges?.hero) {
        await restOn(page, places.charges.hero.x, places.charges.hero.y);
        await clipBoth(page, 'after_charges_open_hero', places.charges.clip, { one: false });
        await away(page);
    }
    if (places.waiting?.missing) {
        await restOn(page, places.waiting.missing.x, places.waiting.missing.y);
        log.after.waitingTip = await page.evaluate(`document.querySelector('[data-bubble-tip]')?.textContent || null`);
        await clipBoth(page, 'after_waiting_tip', { x: places.waiting.clip.x, y: places.waiting.clip.y, width: 560, height: 380 }, { one: false });
        await away(page);
    }

    // Today beside after, for each moment, from the mock-up phase's captures in the same folder.
    for (const [k, t] of Object.entries(tiles)) {
        const before = path.join(out, `today_${k}_1x.png`);
        if (!existsSync(before)) continue;
        const list = [{ label: 'Today', data: readFileSync(before).toString('base64') }, { label: 'Built', data: t.after }, { label: 'Built, pointer resting', data: t.hover }];
        const data = await compose(page, list);
        save(`before_after_${k}_1x`, data);
        save(`before_after_${k}_2x`, await upscale(page, data));
    }

    // The style sheet page's entry.
    await page.setViewport(1920, 1500);
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
        const el = document.querySelector('[data-kit-section="work-plate"]');
        if (!el) return 'no work plate entry';
        el.scrollIntoView({ block: 'start' });
        document.querySelector('[data-style-sheet-page]').scrollBy(0, -64);
        return true;
    })()`);
    if (log.sheet === true) {
        await away(page);
        await sleep(900);
        const r = await page.evaluate(`(() => { const r = document.querySelector('[data-kit-section="work-plate"]').getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
        await clipBoth(page, 'sheet_work_plate', r);
    }
    if (page.consoleErrors?.length) log.pageErrors = page.consoleErrors.slice(0, 5);
} finally {
    console.log(JSON.stringify(log, null, 1));
    await chrome.close();
}
