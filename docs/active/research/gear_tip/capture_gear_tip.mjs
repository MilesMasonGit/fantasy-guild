// Captures a worked station's recipe gear tooltip over its work plate:
//   node capture_gear_tip.mjs <url> <outDir> <name>
// A New Game at 1920 x 1080 with one hero pinned to a Furnace making Copper Ingots (the scene of
// `../bubble_row/capture_work_plate.mjs`), the game loop stopped. The pointer rests on the
// Token's centre, on its gear; saves `<name>_1x.png` and `<name>_2x.png` (nearest-neighbour) of
// the patch around it, and prints where the tooltip is and which layer it sits in.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5221', out = '.', name = 'after_working_gear'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const save = (n, b64) => writeFileSync(path.join(out, `${n}.png`), Buffer.from(b64, 'base64'));

const upscale = (page, data, k = 2) => page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
})()`);

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

    log.build = await page.evaluate(`(async () => {
        const SR = await import('/src/systems/board/StationRecipe.js');
        const TR = await import('/src/config/registries/tokenRegistry.js');
        const TM = await import('/src/systems/board/TileModifiers.js');
        const HG = await import('/src/systems/hero/HeroGenerator.js');
        const XP = await import('/src/utils/XPCurve.js');
        const BS = Game.BoardState;
        Game.GameLoop.stop();
        Game.GameState.state.progress.rosterLimit = 8;
        const h = HG.generateHero({ name: 'Aela' });
        h.skills.smithing = { level: 30, xp: XP.xpForLevel(30) };
        const hero = Game.HeroManager.addHero(h);
        Game.InventoryManager.addItem('item_copper_ore', 400);
        Game.InventoryManager.addItem('item_coal', 400);
        const inst = BS.createTokenInstance('token_furnace', TR.tokenStartingUses('token_furnace'));
        Game.BoardPlacement.placeTokenAt(inst, { x: 420, y: 820 });
        SR.setSelectedRecipe(BS.getTokenById(inst.id), 'recipe_copper_ingot');
        TM.rebuildAll();
        const t = BS.getTokenById(inst.id);
        const pinned = Game.BoardPlacement.plantFlagAt(hero.id, { x: t.x, y: t.y }, { pin: true }).success;
        for (let i = 0; i < 60; i++) Game.GameLoop.runHandlers(100);
        Game.SpriteLayer.collectAll();
        window.__gearTip = { hero: hero.id, token: inst.id };
        return { pinned, worked: BS.getTokenById(inst.id)?.heroId === hero.id };
    })()`, { timeoutMs: 120000 });

    await sleep(1000);
    for (let i = 0; i < 5; i++) {
        const x = await page.evaluate(`(() => { const b = document.querySelector('[data-hero-panel-close]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
        if (!x) break;
        await page.click(x.x, x.y);
        await sleep(700);
    }
    for (let i = 0; i < 8; i++) {
        const left = await page.evaluate(`(() => { const b = document.querySelector('[data-banner]:not([data-banner-leaving])'); if (b) b.click(); return document.querySelectorAll('[data-banner]').length; })()`);
        if (!left) break;
        await sleep(500);
    }
    await page.evaluate(`(() => { for (let i = 0; i < 25; i++) Game.GameLoop.runHandlers(100); })()`);
    await page.mouse('mouseMoved', 1910, 600);
    await sleep(1500);

    const at = await page.evaluate(`(() => {
        const o = document.querySelector('[data-token-overlay="' + window.__gearTip.token + '"]');
        const r = o.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);
    // Rest on the Token's centre, where its gear opens; a second move lands on the gear itself.
    await page.mouse('mouseMoved', at.x - 3, at.y - 3);
    await sleep(600);
    await page.mouse('mouseMoved', at.x, at.y);
    await sleep(1400);
    log.tip = await page.evaluate(`(() => {
        const gear = document.querySelector('[data-station-gear]');
        const shared = document.querySelector('[data-tooltip]');
        const plate = document.querySelector('[data-work-plate="' + window.__gearTip.token + '"]');
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
        return {
            gearShown: !!gear,
            sharedTip: shared ? { text: shared.textContent, inBody: shared.parentElement === document.body, z: getComputedStyle(shared).zIndex, box: box(shared) } : null,
            inMatTipText: gear ? gear.textContent : null,
            plate: box(plate),
            plateOpen: plate?.getAttribute('data-work-plate-open') === 'true',
            plateLayerZ: document.querySelector('[data-work-plates]')?.style.zIndex ?? null
        };
    })()`);
    const clip = { x: Math.round(at.x - 150), y: Math.round(at.y - 120), width: 480, height: 300, scale: 1 };
    const s = await page.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true });
    save(`${name}_1x`, s.data);
    save(`${name}_2x`, await upscale(page, s.data));
    if (page.consoleErrors?.length) log.pageErrors = page.consoleErrors.slice(0, 5);
} finally {
    console.log(JSON.stringify(log, null, 1));
    await chrome.close();
}
