// The game's windows, each opened by clicking as the owner would, cropped one by one for the pixel
// frames' before/after sheets: node capture_pixel_frames.mjs <url> <rawDir> <label>
// At 1920 x 1080. Every window is saved as `<label>_<name>.png` (the crop at 1x) and
// `<label>_<name>_corner.png` (its top-left corner); `sheet_pixel_frames.mjs` lays them out.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5217', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, `${label}_${name}.png`), Buffer.from(b64, 'base64'));
const log = (...a) => console.log(label, ...a);

/** The largest visible element matching `sel` (several panels share a hook, the dock and the Bank among them). */
const rectOf = (page, sel) => page.evaluate(`(() => { let best = null; for (const e of document.querySelectorAll(${JSON.stringify(sel)})) { const r = e.getBoundingClientRect(); if (r.width * r.height > 0 && (!best || r.width * r.height > best.width * best.height)) best = { x: r.x, y: r.y, width: r.width, height: r.height }; } return best; })()`);
const centreOf = async (page, sel) => { const r = await rectOf(page, sel); return r && { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; };
const away = async (page) => { await page.mouse('mouseMoved', Math.round(W / 2), H - 3); await sleep(400); };
const clickText = (page, t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);

/** The window under `sel`, with a margin (its shadow sits outside it), and its top-left corner. */
async function grab(page, name, sel, { margin = 12, corner = 40, maxH = 1000 } = {}) {
    const r = await rectOf(page, sel);
    if (!r) { log('MISSING', name, sel); return; }
    const x = Math.max(0, Math.floor(r.x - margin)), y = Math.max(0, Math.floor(r.y - margin));
    const width = Math.min(W - x, Math.ceil(r.width + 2 * margin)), height = Math.min(H - y, maxH, Math.ceil(r.height + 2 * margin));
    const one = await page.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 } });
    save(name, one.data);
    const cx = Math.max(0, Math.floor(r.x - 6)), cy = Math.max(0, Math.floor(r.y - 6));
    const c = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: cx, y: cy, width: corner, height: corner, scale: 1 } });
    save(`${name}_corner`, c.data);
    log('saved', name, `${width}x${height}`);
}

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);

    // The slot screen: the shared modal shell.
    await grab(page, '1_modal_slots', '[id^="headlessui-dialog-panel"]');

    if (!(await clickText(page, 'NEW GAME'))) throw new Error('no New Game button');
    await sleep(8000);
    // Heroes to show a hero panel: the QA panel's Spawn Party.
    await page.evaluate(`document.querySelector('button[title="Open QA Dashboard"]')?.click()`);
    await sleep(800);
    await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Spawn Party'))?.click()`);
    await sleep(500);
    await page.evaluate(`(() => { const p = document.querySelector('[data-testid="qa-panel"]'); const b = p && [...p.querySelectorAll('button')].find(b => /close|✕|×/i.test(b.title + b.textContent + (b.getAttribute('aria-label') || ''))); b?.click(); })()`);
    await sleep(1500);
    await away(page);

    // A tooltip: hovering the Work Permissions button.
    const rules = await centreOf(page, '[data-work-rules-button]');
    if (rules) {
        await page.mouse('mouseMoved', rules.x, rules.y);
        await sleep(150);
        await page.mouse('mouseMoved', rules.x + 2, rules.y + 1);
        await sleep(500);
        await grab(page, '2_tooltip', '[data-tooltip]');
        await away(page);
    }

    // The Token Summary: a click on the top bar's Token count.
    const cap = await centreOf(page, '[data-mat-cap-badge]');
    if (cap) {
        await page.click(cap.x, cap.y);
        await sleep(500);
        await grab(page, '3_token_summary', '[data-token-summary]');
        await page.click(cap.x, cap.y);
        await sleep(300);
        await away(page);
    }

    // Settings: the nav orb, a modal.
    const settings = await centreOf(page, 'button[aria-label="Settings"]');
    if (settings) {
        await page.click(settings.x, settings.y);
        await sleep(900);
        await grab(page, '4_modal_settings', '[id^="headlessui-dialog-panel"]');
        await page.key('Escape');
        await sleep(600);
    }

    // A hero's panel, from the hero bar.
    const hero = await centreOf(page, '[data-dock-hero]');
    if (hero) {
        await page.click(hero.x, hero.y);
        await sleep(900);
        await away(page);
        await grab(page, '7_hero_panel', '[data-hero-panel] > div', { maxH: 1080, margin: 0 });
        await page.key('Escape');
        await sleep(600);
    } else log('no hero in the bar');

    // The Bank, then a tile's tooltip.
    const bank = await centreOf(page, '#bank-bubble-target button');
    await page.click(bank.x, bank.y);
    await sleep(1000);
    await away(page);
    await grab(page, '5_bank', '[data-dnd-surface="drawer"]', { maxH: 1080, margin: 0 });
    const tile = await centreOf(page, '.ui-item-tile');
    if (tile) {
        await page.mouse('mouseMoved', tile.x, tile.y);
        await sleep(150);
        await page.mouse('mouseMoved', tile.x + 2, tile.y + 1);
        await sleep(600);
        await grab(page, '6_item_tooltip', '[data-tooltip]');
        await away(page);
    }
    await page.click(bank.x, bank.y);
    await sleep(1000);

    // The Shop.
    const shop = await centreOf(page, '#shop-bubble-target button');
    await page.click(shop.x, shop.y);
    await sleep(1000);
    await page.mouse('mouseMoved', W - 5, H - 5);
    await sleep(400);
    await grab(page, '8_shop', '[data-shop-drawer]', { maxH: 1080, margin: 0 });
    await page.click(shop.x, shop.y);
    await sleep(900);

    // While you were away: half an hour played back (what reopening the game later shows).
    await page.evaluate(`(async () => { const C = await import('/src/systems/core/CatchUp.js'); C.run({ savedAt: Date.now() - 30 * 60 * 1000, save: false }); return true; })()`);
    await page.waitFor(`!!document.querySelector('[data-catch-up-overlay] [role="dialog"], [data-catch-up-summary]') || (!!document.querySelector('[data-catch-up-overlay]') && !document.querySelector('[data-catch-up-bar]'))`, { timeoutMs: 120000 });
    await sleep(600);
    await grab(page, '9_catch_up', '[data-catch-up-overlay] > div');

    if (page.consoleErrors.length) log('page errors', page.consoleErrors.slice(0, 5));
} finally {
    await chrome.close();
}
