// Captures the Atlas's Regions section from a running dev server, for the owner's phone review:
// node capture_atlas_spread.mjs <url> <outDir> <label>
// At 1920 x 1080: a new game, two Regions settled from the dev maps (Game.Atlas, never data/), the
// Atlas opened on Regions; then the second Region clicked (when the spread has rows to click); then
// the book at 2x, nearest-neighbour. Full-screen shots are halved to stay small.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5215', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));

/** Rescale a PNG by `k` in the page's canvas: smooth when shrinking, no smoothing when growing. */
async function rescale(page, shot, k) {
    return page.evaluate(`(async () => {
        const i = new Image(); i.src = 'data:image/png;base64,${shot}'; await i.decode();
        const c = document.createElement('canvas'); c.width = Math.round(i.width * ${k}); c.height = Math.round(i.height * ${k});
        const g = c.getContext('2d'); g.imageSmoothingEnabled = ${k} < 1; g.imageSmoothingQuality = 'high';
        g.drawImage(i, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

const centreOf = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
const full = async (page) => (await page.send('Page.captureScreenshot', { format: 'png' })).data;
const clip = async (page, c) => (await page.send('Page.captureScreenshot', { format: 'png', clip: { ...c, scale: 1 } })).data;
const away = async (page) => { await page.mouse('mouseMoved', 5, H - 5); await sleep(400); };

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
    if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
    await sleep(6000);

    const settled = await page.evaluate(`(() => {
        const A = window.Game.Atlas;
        A.devGrantMaps(2);
        const one = A.devSettle(['forest', 'overgrown'], 11);
        const two = A.devSettle(['mountain', 'goblinCamp'], 23);
        return [one.success && one.region.id, two.success && two.region.id];
    })()`);
    console.log(label, 'settled', settled);
    const stubs = await page.evaluate(`(async () => { const s = await import('/src/systems/notifications/itemStubs.js'); s.clearUnpinned?.(); return true; })()`).catch(() => false);
    if (!stubs) console.log(label, 'no item stubs to clear');

    const bubble = await centreOf(page, '#atlas-bubble-target button');
    if (!bubble) throw new Error('no Atlas bubble');
    await page.click(bubble.x, bubble.y);
    await sleep(1500);
    const regionsTab = await centreOf(page, '[data-atlas-tab="regions"]');
    if (regionsTab) await page.click(regionsTab.x, regionsTab.y);
    await sleep(1200);
    await away(page);
    save(`${label}_1_regions.png`, await rescale(page, await full(page), 0.5));

    // The second Region: a click on its row, when this build selects by clicking.
    const second = settled[1] && await centreOf(page, `[data-region-select="${settled[1]}"]`);
    if (second) {
        await page.click(second.x, second.y);
        await sleep(1200);
        await away(page);
        save(`${label}_2_second_selected.png`, await rescale(page, await full(page), 0.5));
    } else {
        console.log(label, 'no selectable row: the second shot is skipped');
    }

    const book = await page.evaluate(`(() => { const e = document.querySelector('[data-tome-spread]') || document.querySelector('[data-region-list]'); const r = e.getBoundingClientRect(); const x = Math.max(0, Math.floor(r.x)); const y = Math.max(0, Math.floor(r.y)); return { x, y, width: Math.min(${W} - x, Math.ceil(r.width)), height: Math.min(${H} - y, Math.ceil(r.height)) }; })()`);
    // The 2x close-up crops to the pages' parchment on screen, so it stays a phone-sized picture.
    const pages = await page.evaluate(`(() => { const a = document.querySelector('[data-tome-left]').getBoundingClientRect(); const b = document.querySelector('[data-tome-right]').getBoundingClientRect(); const x = Math.floor(Math.min(a.x, b.x)) - 8; const y = Math.floor(Math.min(a.y, b.y)) - 8; return { x, y, width: Math.ceil(Math.max(a.right, b.right)) - x + 8, height: Math.ceil(Math.max(a.bottom, b.bottom)) - y + 8 }; })()`);
    console.log(label, 'book', book, 'pages', pages);
    save(`${label}_3_spread_2x.png`, await rescale(page, await clip(page, pages), 2));
    const facts = await page.evaluate(`(() => ({
        rows: document.querySelectorAll('[data-region-row]').length,
        preview: (() => { const c = document.querySelector('[data-region-preview] canvas'); return c ? { w: c.width, h: c.height, cssW: c.style.width, drawn: c.getAttribute('data-preview-drawn') } : null; })(),
        stats: [...document.querySelectorAll('[data-region-stat]')].map(e => e.textContent)
    }))()`);
    console.log(label, 'facts', JSON.stringify(facts));
    if (page.consoleErrors.length) console.log(label, 'page errors', page.consoleErrors);
} finally {
    await chrome.close();
}
