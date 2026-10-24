// The Hall web at rest and one star under the pointer, for the owner's phone review:
// node capture_hover.mjs <url> <outDir> <label>
// Logs each star's outline (its sprite's CSS filter) at rest, and the hovered star's.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5211', out = '.', label = 'after2'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));
const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME').click()`);
    await sleep(6000);
    // What the QA panel's Every star look button does.
    await page.evaluate(`(async () => {
        const dev = await import('/src/ui/dev/GuildHallDevSection.jsx');
        dev.devSetGuildRanks(dev.SKY_SAMPLE_RANKS);
        dev.devGiveNextPrice(dev.SKY_SAMPLE_PAID);
        (await import('/src/systems/notifications/itemStubs.js')).clearUnpinned();
    })()`);
    await sleep(800);
    const orb = await page.evaluate(`(() => { const r = document.querySelector('#guild-bubble-target button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.click(orb.x, orb.y);
    await sleep(2500);
    await page.mouse('mouseMoved', 5, H - 5);
    await sleep(400);
    const outlines = `[...document.querySelectorAll('[data-hall-node]')].map(b => b.dataset.hallNode + ' ' + (b.dataset.starLook || '-') + (b.dataset.selected ? ' pinned' : '') + ': ' + getComputedStyle(b.querySelector('img')).filter.slice(0, 40))`;
    console.log('at rest', JSON.stringify(await page.evaluate(outlines), null, 1));
    const full = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 480, y: 0, width: 1120, height: 1080, scale: 1 } });
    save(`${label}_1_web_at_rest.png`, full.data);
    const s = await page.evaluate(`(() => { const r = document.querySelector('[data-hall-node="bank_slots"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.mouse('mouseMoved', s.x, s.y);
    await sleep(400);
    console.log('hovered', await page.evaluate(`getComputedStyle(document.querySelector('[data-hall-node="bank_slots"] img')).filter.slice(0, 60)`));
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: s.x - 140, y: s.y - 70, width: 280, height: 140, scale: 2 } });
    save(`${label}_2_star_hovered_2x.png`, shot.data);
} finally {
    await chrome.close();
}
