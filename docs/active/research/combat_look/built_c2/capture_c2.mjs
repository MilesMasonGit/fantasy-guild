// node capture_c2.mjs <url> [outDir]
// The fight windows as built (brief 360 C2), in the running game at 1920 x 1080: five real fights,
// three windows open (one dragged), two minimized to tabs; then Escape closing one window at a time.
// Everything is done by clicking: the fights' buttons, the minimize buttons, a drag of a title bar.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from '../../../../../bench/browser/cdp.mjs';
import { openGame, setUpCrowd } from '../scene.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [url = 'http://localhost:5401/', out = here] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const { chrome, page } = await openGame(url);
const shot = async (name, clip = null) => {
    const d = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
    writeFileSync(path.join(out, `${name}.png`), Buffer.from(d.data, 'base64'));
    console.log('saved', name);
};
const box = (sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
const clickAt = async (b) => { await page.click(Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2)); await sleep(250); };
const state = () => page.evaluate(`(async () => { const s = await import('/src/ui/components/combat/fightPanelStore.js'); return s.fightWindows().map(w => ({ hero: w.heroId, min: w.minimized, x: w.x, y: w.y })); })()`);

try {
    console.log(await setUpCrowd(page));
    await sleep(4000);
    const heroes = await page.evaluate(`[...document.querySelectorAll('[data-fight-chip]')].map(e => e.getAttribute('data-fight-chip'))`);
    console.log('fights', heroes.length);
    // Two windows opened by their fight's button and minimized at once (so no window covers the
    // next button), then three left open.
    for (const id of [...heroes.slice(3), ...heroes.slice(0, 3)]) {
        const chip = await box(`[data-fight-chip="${id}"]`);
        if (chip) await clickAt(chip);
        if (heroes.indexOf(id) >= 3) {
            const b = await box(`[data-fight-minimize="${id}"]`);
            if (b) await clickAt(b);
        }
    }
    await sleep(500);
    console.log('open', JSON.stringify(await state()));
    // Drag the first window's title bar 420 px right and 60 px down.
    const bar = await box(`[data-fight-window="${heroes[0]}"] [data-fight-titlebar]`);
    const sx = Math.round(bar.x + 60);
    const sy = Math.round(bar.y + bar.h / 2);
    await page.mouse('mouseMoved', sx, sy);
    await page.mouse('mousePressed', sx, sy, { button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i++) { await page.mouse('mouseMoved', sx + 42 * i, sy + 6 * i, { buttons: 1, button: 'left' }); await sleep(30); }
    await page.mouse('mouseReleased', sx + 420, sy + 60, { button: 'left', buttons: 0, clickCount: 1 });
    await page.mouse('mouseMoved', 5, 1075);
    await sleep(1500);
    console.log('after', JSON.stringify(await state()));
    await shot('c2_three_windows_two_tabs');
    const strip = await box('[data-fight-tabs]');
    const tabs = await page.evaluate(`[...document.querySelectorAll('[data-fight-tab]')].map(t => { const r = t.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, text: t.textContent }; })`);
    console.log('tabs', JSON.stringify(tabs));
    if (tabs.length) {
        const x0 = Math.min(...tabs.map(t => t.x)) - 8; const y0 = Math.min(...tabs.map(t => t.y)) - 8;
        const x1 = Math.max(...tabs.map(t => t.x + t.w)) + 12; const y1 = Math.max(...tabs.map(t => t.y + t.h)) + 12;
        await shot('c2_tabs_closeup', { x: Math.round(x0), y: Math.round(y0), width: Math.round(x1 - x0), height: Math.round(y1 - y0) });
    }
    const win = await box(`[data-fight-window="${heroes[1]}"]`);
    if (win) await shot('c2_window_closeup', { x: Math.round(win.x - 4), y: Math.round(win.y - 4), width: Math.round(win.w + 12), height: Math.round(win.h + 12) });
    console.log('strip', JSON.stringify(strip));

    // Escape: one window at a time, the top first; the tabs stay.
    for (let i = 0; i < 4; i++) {
        await page.key('Escape', 'Escape', 27);
        await sleep(300);
        console.log('escape', i + 1, JSON.stringify(await state()));
    }
} finally {
    await chrome.close();
}
