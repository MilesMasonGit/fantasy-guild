// The surfaces smaller than a window (round two), each opened by clicking as the owner would and
// cropped for the before/after sheets: node capture_round2.mjs <url> <rawDir> <label>
// At 1920 x 1080. Each surface is saved as `<label>_<name>.png` (the crop at 1x) and
// `<label>_<name>_zoom.png` (a small region of it, for the 2x close-up); `sheet_round2.mjs` lays them out.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5219', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, `${label}_${name}.png`), Buffer.from(b64, 'base64'));
const log = (...a) => console.log(label, ...a);

/** The rect of the element a JS expression returns (or of the largest visible match of a selector). */
const rectOfExpr = (page, expr) => page.evaluate(`(() => { const e = (${expr}); if (!e) return null; const r = e.getBoundingClientRect(); return r.width * r.height > 0 ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; })()`);
const largest = (sel) => `[...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => { const r = e.getBoundingClientRect(); return r.width * r.height > 0; }).sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; })[0]`;
const centreOfExpr = async (page, expr) => { const r = await rectOfExpr(page, expr); return r && { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; };
const away = async (page) => { await page.mouse('mouseMoved', Math.round(W / 2), H - 3); await sleep(400); };
const buttonByText = (t) => `[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase().includes(${JSON.stringify(t.toUpperCase())}))`;
const clickExpr = (page, expr) => page.evaluate(`(() => { const b = (${expr}); if (!b) return false; b.click(); return true; })()`);

/** The surface under `expr` with a margin, and a zoom region (relative to the surface's top-left). */
async function grab(page, name, expr, { margin = 8, maxH = 1000, zoom = { x: 0, y: 0, w: 120, h: 80 } } = {}) {
    const r = await rectOfExpr(page, expr);
    if (!r) { log('MISSING', name); return; }
    const x = Math.max(0, Math.floor(r.x - margin)), y = Math.max(0, Math.floor(r.y - margin));
    const width = Math.min(W - x, Math.ceil(r.width + 2 * margin)), height = Math.min(H - y, maxH, Math.ceil(r.height + 2 * margin));
    const one = await page.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 } });
    save(name, one.data);
    const zx = Math.max(0, Math.floor(r.x + zoom.x - 4)), zy = Math.max(0, Math.floor(r.y + zoom.y - 4));
    const z = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: zx, y: zy, width: zoom.w, height: zoom.h, scale: 1 } });
    save(`${name}_zoom`, z.data);
    log('saved', name, `${width}x${height}`);
}

const BANK_ITEMS = ['item_copper_ore', 'item_oak_wood', 'item_copper_pickaxe', 'item_iron_pickaxe', 'item_shrimp', 'item_blueberry_pie',
    'item_water', 'item_apple_juice', 'item_shrimp_trawler_potion', 'map_forest', 'mod_overgrown', 'item_charcoal'];

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);

    if (!(await clickExpr(page, buttonByText('NEW GAME')))) throw new Error('no New Game button');
    await sleep(8000);
    // Heroes and Bank items: the QA panel's Spawn Party, and items added straight to the Bank.
    await page.evaluate(`document.querySelector('button[title="Open QA Dashboard"]')?.click()`);
    await sleep(800);
    await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Spawn Party'))?.click()`);
    await sleep(500);
    await page.evaluate(`(() => { const p = document.querySelector('[data-testid="qa-panel"]'); const b = p && [...p.querySelectorAll('button')].find(b => /close|✕|×/i.test(b.title + b.textContent + (b.getAttribute('aria-label') || ''))); b?.click(); })()`);
    await sleep(800);
    await page.evaluate(`(async () => { const { InventoryManager } = await import('/src/systems/inventory/InventoryManager.js'); for (const [i, id] of ${JSON.stringify(BANK_ITEMS)}.entries()) InventoryManager.addItem(id, 3 + i * 7); const E = await import('/src/systems/equipment/EquipmentManager.js'); const { HeroManager } = await import('/src/systems/hero/HeroManager.js'); const h = HeroManager.getAllHeroes()[0]; E.equipItem(h.id, 'item_copper_pickaxe'); E.equipItem(h.id, 'item_shrimp'); E.equipItem(h.id, 'item_apple_juice'); return true; })()`);
    await sleep(1200);
    await away(page);


    // The Bank, then one tile hovered.
    const bank = await centreOfExpr(page, `document.querySelector('#bank-bubble-target button')`);
    await page.click(bank.x, bank.y);
    await sleep(1000);
    await away(page);
    await grab(page, '2_bank', largest('[data-dnd-surface="drawer"]'), { margin: 0, maxH: 560, zoom: { x: 10, y: 40, w: 200, h: 150 } });
    const tile = await centreOfExpr(page, `document.querySelectorAll('[data-bank-item]')[1]`);
    if (tile) {
        await page.mouse('mouseMoved', tile.x, tile.y);
        await sleep(300);
        await grab(page, '3_bank_tile_hover', `document.querySelectorAll('[data-bank-item]')[1]`, { margin: 30, zoom: { x: -10, y: -10, w: 70, h: 50 } });
        await away(page);
    }
    // Select mode: one tile checked.
    await clickExpr(page, buttonByText('SELECT'));
    await sleep(300);
    await clickExpr(page, `document.querySelectorAll('[data-bank-item]')[0]`);
    await sleep(300);
    await away(page);
    await grab(page, '4_bank_selected', `document.querySelectorAll('[data-bank-item]')[0]`, { margin: 30, zoom: { x: -10, y: -10, w: 70, h: 50 } });
    await clickExpr(page, buttonByText('DONE'));
    await sleep(300);
    await page.click(bank.x, bank.y);
    await sleep(1000);

    // A hero's panel: the loadout slots. (A new game opens in the Guild Hall view; its orb toggles.)
    await clickExpr(page, `document.querySelector('button[title="Guild Hall"]')`);
    await sleep(1500);
    // The playmat's top bar: its Disallow and Demolish buttons.
    await grab(page, '1_bar_buttons', `document.querySelector('[data-map-mode-toggle]')?.parentElement`, { margin: 4, maxH: 80, zoom: { x: -4, y: 0, w: 110, h: 50 } });
    const hero = await centreOfExpr(page, `document.querySelector('[data-dock-hero]')`);
    if (hero) {
        await clickExpr(page, `document.querySelector('[data-dock-hero]')`);
        await sleep(900);
        if (!(await page.evaluate(`!!document.querySelector('[data-slot-kind]')`))) {
            await clickExpr(page, `document.querySelector('[data-dock-hero]')`);
            await sleep(900);
        }
        log('hero panel', await page.evaluate(`document.querySelectorAll('[data-hero-panel-body]').length + ' ' + document.querySelectorAll('[data-slot-kind]').length + ' ' + !!document.querySelector('[data-slot-kind]')?.closest('.grid')`));
        await away(page);
        const grid = `document.querySelector('[data-slot-kind]')?.closest('.grid')`;
        await grab(page, '5_loadout', grid, { margin: 10, zoom: { x: 0, y: 0, w: 100, h: 70 } });
        // The edit window, then Change Job.
        await clickExpr(page, `document.querySelector('[data-hero-panel-edit]')`);
        await sleep(900);
        await grab(page, '6_hero_edit', `document.querySelector('[id^="headlessui-dialog-panel"]')`, { zoom: { x: 10, y: 50, w: 200, h: 120 } });
        await clickExpr(page, buttonByText('CHANGE JOB'));
        await sleep(900);
        await grab(page, '7_job_change', `document.querySelector('[id^="headlessui-dialog-panel"]')`, { zoom: { x: 10, y: 60, w: 200, h: 120 } });
        await page.key('Escape');
        await sleep(600);
        await page.key('Escape');
        await sleep(600);
    } else log('no hero in the bar');
    await clickExpr(page, `document.querySelector('button[title="Guild Hall"]')`);
    await sleep(1500);

    // Work Permissions: the priority toggle.
    await clickExpr(page, `document.querySelector('[data-work-rules-button]')`);
    await sleep(900);
    await away(page);
    await grab(page, '8_rules_toggle', `document.querySelector('[data-rules-priority-mode]')`, { margin: 12, zoom: { x: 0, y: 0, w: 80, h: 40 } });
    await clickExpr(page, `document.querySelector('[data-work-rules-button]')`);
    await sleep(700);

    // The Shop's select box.
    const shop = await centreOfExpr(page, `document.querySelector('#shop-bubble-target button')`);
    await page.click(shop.x, shop.y);
    await sleep(1000);
    await page.mouse('mouseMoved', W - 5, H - 5);
    await sleep(400);
    await grab(page, '9_shop_select', `document.querySelector('[data-shop-drawer] select')`, { margin: 12, zoom: { x: 0, y: 0, w: 90, h: 40 } });
    await page.click(shop.x, shop.y);
    await sleep(900);

    // Settings: the Accessibility and Gameplay tabs, then Typography.
    const settings = await centreOfExpr(page, `document.querySelector('button[aria-label="Settings"]')`);
    await page.click(settings.x, settings.y);
    await sleep(900);
    await away(page);
    await grab(page, '10_settings_access', `document.querySelector('[id^="headlessui-dialog-panel"]')`, { zoom: { x: 200, y: 60, w: 260, h: 160 } });
    await clickExpr(page, buttonByText('GAMEPLAY'));
    await sleep(600);
    await grab(page, '11_settings_gameplay', `document.querySelector('[id^="headlessui-dialog-panel"]')`, { zoom: { x: 200, y: 60, w: 260, h: 160 } });
    await clickExpr(page, buttonByText('ACCESSIBILITY'));
    await sleep(400);
    await clickExpr(page, buttonByText('ADJUST SCALE'));
    await sleep(900);
    await grab(page, '12_typography', `document.querySelector('[data-typography-window]')?.closest('[id^="headlessui-dialog-panel"]')`, { zoom: { x: 10, y: 60, w: 240, h: 150 } });
    await page.key('Escape');
    await sleep(600);
    await page.key('Escape');
    await sleep(600);

    // The promotion window, as a Promotes Token opens it (the board's event, for a made-up Token).
    await page.evaluate(`(async () => { const { EventBus } = await import('/src/systems/core/EventBus.js'); const { BOARD_EVENTS } = await import('/src/systems/board/boardEvents.js'); const { HeroManager } = await import('/src/systems/hero/HeroManager.js'); const { getAllJobIds } = await import('/src/config/registries/jobRegistry.js'); const h = HeroManager.getAllHeroes()[0]; const jobId = getAllJobIds().find(j => j !== h.jobId && j !== 'recruit'); EventBus.publish(BOARD_EVENTS.PROMOTION_READY, { instanceId: 999999, heroId: h.id, jobId }); return jobId; })()`);
    await sleep(900);
    await grab(page, '13_promotion', `document.querySelector('[id^="headlessui-dialog-panel"]')`, { zoom: { x: 10, y: 140, w: 240, h: 150 } });
    await clickExpr(page, buttonByText('NOT YET'));
    await sleep(600);

    // While you were away: the summary's buttons.
    await page.evaluate(`(async () => { const C = await import('/src/systems/core/CatchUp.js'); C.run({ savedAt: Date.now() - 30 * 60 * 1000, save: false }); return true; })()`);
    await page.waitFor(`!!document.querySelector('[data-catch-up-summary]')`, { timeoutMs: 120000 });
    await sleep(600);
    await grab(page, '14_catch_up', `document.querySelector('[data-summary-close]')?.closest('.border-t')`, { margin: 10, zoom: { x: 0, y: 0, w: 160, h: 60 } });
    await clickExpr(page, `document.querySelector('[data-catch-up-summary] button')`);
    await sleep(600);

    // The slot screen with a saved game: save, then reload.
    await page.evaluate(`(async () => { const { SaveManager } = await import('/src/systems/core/SaveManager.js'); await SaveManager.save(true); return true; })()`);
    await sleep(800);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    await grab(page, '15_save_slots', `document.querySelector('[id^="headlessui-dialog-panel"]')`, { zoom: { x: 10, y: 80, w: 260, h: 150 } });

    if (page.consoleErrors.length) log('page errors', page.consoleErrors.slice(0, 5));
} finally {
    await chrome.close();
}
