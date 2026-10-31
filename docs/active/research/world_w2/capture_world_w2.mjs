// Captures the world map screen (brief 330 W2) from a running dev server, at 1920 x 1080:
// node capture_world_w2.mjs <url> <outDir>
// A new game in a throwaway headless Chrome profile (no save slot of anyone's is touched): the
// World page, a frontier cell's hover with have/need, the QA panel's "Meet the frontier's prices",
// Settle and the arrival, the map after it, and Travel back to the Starter Camp.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5282', out = '.'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    const shot = async (name) => writeFileSync(path.join(out, name), Buffer.from((await page.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
    const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
    const centre = (sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
    const realClick = async (sel) => {
        const c = await centre(sel);
        if (!c) throw new Error(`nothing at ${sel}`);
        await page.click(c.x, c.y);
    };
    const away = async () => { await page.mouse('mouseMoved', 5, H - 5); await sleep(300); };
    const atlas = async () => { await realClick('#atlas-bubble-target button'); await sleep(1200); await away(); };
    const qa = async (sel) => {
        if (!(await page.evaluate(`!!document.querySelector('[data-testid="qa-atlas"]')`))) await realClick('button[title="Open QA Dashboard"]');
        await sleep(600);
        await page.evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView()`);
        await realClick(sel);
        await sleep(400);
    };
    const closeQa = async () => { await page.evaluate(`document.querySelector('[data-testid="qa-panel"] .shrink-0 button')?.click()`); await sleep(500); };
    const state = () => page.evaluate(`JSON.stringify({ cell: window.Game.World.activeCellId(), region: window.Game.Atlas.activeRegion()?.flavourName, states: [...window.Game.World.cellStatesNow().values()].reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {}) })`);

    if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
    await sleep(6000);
    // The first hero, as the tutorial's first step has the player do (the Bunk Beds).
    console.log('hero:', await page.evaluate(`JSON.stringify(window.Game.GuildUpgradeManager.purchase('roster_size'))`));
    console.log('start:', await state());

    await atlas();
    console.log('map:', await page.evaluate(`(() => { const m = document.querySelector('[data-world-map]'); return m.dataset.worldRings + ' rings, radius ' + m.dataset.worldRadius + ', ' + document.querySelectorAll('[data-world-cell]').length + ' cells'; })()`));
    await shot('w2_01_world_map.png');

    // A frontier cell's hover: what it yields and its price, have/need, red where short.
    const target = await page.evaluate(`(() => { const w = window.Game.World; const s = w.cellStatesNow(); return w.currentWorld().cells.find(c => s.get(c.id) === 'frontier' && c.wedge === 'ores')?.id || w.currentWorld().cells.find(c => s.get(c.id) === 'frontier').id; })()`);
    const at = await centre(`[data-world-cell="${target}"] polygon`);
    await page.mouse('mouseMoved', at.x - 2, at.y + 2);
    await sleep(200);
    await page.mouse('mouseMoved', at.x, at.y);
    await sleep(600);
    console.log('hover:', await page.evaluate(`document.querySelector('[data-world-tip]')?.textContent`));
    await shot('w2_02_hover_have_need.png');

    // Click it: the right page reads it, Settle greyed with what is short.
    await page.click(at.x, at.y);
    await sleep(400);
    await away();
    console.log('detail:', await page.evaluate(`document.querySelector('[data-world-detail]')?.textContent`));
    await shot('w2_03_cell_short.png');

    // The QA panel meets the frontier's prices; the book shows every ring-1 cell ready (green).
    await page.key('Escape');
    await sleep(600);
    await qa('[data-qa-world-meet]');
    console.log('qa:', await page.evaluate(`document.querySelector('[data-testid="qa-atlas"]')?.textContent.slice(0, 200)`));
    await closeQa();
    await atlas();
    await page.evaluate(`document.querySelector('[data-world-cell="${target}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(400);
    await away();
    console.log('ready:', await page.evaluate(`[...document.querySelectorAll('[data-world-ready]')].map(e => e.dataset.worldCell).join(' ')`));
    await shot('w2_04_ready_to_settle.png');

    // Settle: pays, writes the place, takes the guild there.
    const bank = await page.evaluate(`JSON.stringify(window.Game.World.currentWorld().cells.find(c => c.id === '${target}').requires.items.map(i => [i.itemId, i.qty, window.Game.InventoryManager.getItemCount(i.itemId)]))`);
    await realClick(`[data-world-settle="${target}"]`);
    await sleep(700);
    const after = await page.evaluate(`JSON.stringify(window.Game.World.currentWorld().cells.find(c => c.id === '${target}').requires.items.map(i => [i.itemId, window.Game.InventoryManager.getItemCount(i.itemId)]))`);
    console.log('paid: before', bank, 'after', after);
    console.log('settled:', await state());
    await shot('w2_05_settled_arrival.png');
    await sleep(2500);
    await shot('w2_06_new_place.png');

    // The map after: two places lit, the frontier grown; the Hall's cell offers Travel.
    await atlas();
    await page.evaluate(`document.querySelector('[data-world-cell="0,0"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
    await sleep(400);
    await away();
    console.log('travel offered:', await page.evaluate(`!!document.querySelector('[data-world-travel="0,0"]')`));
    await shot('w2_07_map_after_settle_travel.png');
    await realClick('[data-world-travel="0,0"]');
    await sleep(3000);
    console.log('home:', await state());
    await shot('w2_08_travelled_home.png');
} finally {
    await chrome.close();
}
