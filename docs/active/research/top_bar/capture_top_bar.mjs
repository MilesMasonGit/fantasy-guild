// Captures the mat's top bar from a running dev server, for the owner's phone review:
// node capture_top_bar.mjs <url> <outDir> <label> [matSteps]
// Per window size: the whole window, the bar's left end at 2x with no smoothing, and the bar in
// Demolish mode. At 1920 x 1080
// also the whole bar in two more Regions' grounds (the QA panel's terrain buttons).
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5203', out = '.', label = 'shot', steps = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const SIZES = [[1920, 1080], [1366, 768]];
const BIOMES = ['FOREST', 'COAST'];

const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));

/** A clip of the page, upscaled `k` times with nearest-neighbour in the page's own canvas. */
async function clipScaled(page, clip, k) {
    const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    return page.evaluate(`(async () => {
        const img = new Image(); img.src = 'data:image/png;base64,${shot.data}'; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

const MEASURE = `(() => {
    const bar = document.querySelector('[data-mat-top-bar]');
    const mat = document.querySelector('[data-board-origin]');
    const b = bar?.getBoundingClientRect(); const m = mat?.getBoundingClientRect();
    const banner = document.querySelector('[data-mat-region-banner]')?.getAttribute('data-mat-region-banner');
    return { bar: b && { x: b.x, y: b.y, w: b.width, h: b.height }, mat: m && { x: m.x, y: m.y, w: m.width, h: m.height }, banner };
})()`;

for (const [w, h] of SIZES) {
    const chrome = await launchChrome({ width: w, height: h });
    try {
        const page = await chrome.newPage();
        await page.setViewport(w, h);
        await page.navigate(url);
        await page.waitFor('!!window.Game');
        if (steps) {
            await page.evaluate(`import('/src/config/matTuning.js').then(m => m.setMatTuning('matSteps', ${Number(steps)}))`);
        }
        await sleep(3000);
        const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
        if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
        await sleep(6000);
        const m = await page.evaluate(MEASURE);
        console.log(label, `${w}x${h}`, JSON.stringify(m));
        const full = await page.send('Page.captureScreenshot', { format: 'png' });
        save(`${label}_${w}x${h}.png`, full.data);
        if (m.bar) {
            const left = await clipScaled(page, { x: m.bar.x, y: m.bar.y, width: Math.min(480, m.bar.w), height: m.bar.h }, 2);
            save(`${label}_${w}x${h}_bar_left_2x.png`, left);
        }
        // The bar with Demolish mode on: its words take the centre.
        await page.evaluate(`document.querySelector('[data-map-mode-toggle="demolish"]')?.click()`);
        await sleep(800);
        if (m.bar) {
            const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: m.bar.x, y: m.bar.y, width: m.bar.w, height: m.bar.h, scale: 1 } });
            save(`${label}_${w}x${h}_bar_demolish.png`, shot.data);
        }
        await page.evaluate(`document.querySelector('[data-map-mode-toggle="demolish"]')?.click()`);
        await sleep(500);
        if (w === 1920) {
            for (const biome of BIOMES) {
                await page.evaluate(`document.querySelectorAll('[data-cap-hidden]').forEach(e => { e.style.visibility = ''; delete e.dataset.capHidden; })`);
                await page.evaluate(`(() => { const q = document.querySelector('[aria-label="Open QA Dashboard"], [title="Open QA Dashboard"]'); if (q) q.click(); })()`);
                await sleep(600);
                let ok = await clickText(biome);
                if (!ok) {
                    await page.evaluate(`(() => { const s = [...document.querySelectorAll('summary, button, div')].find(e => e.innerText && e.innerText.trim() === 'Terrain (dev only)'); if (s) s.click(); })()`);
                    await sleep(400); ok = await clickText(biome);
                }
                // Hide the QA panel so it does not cover the bar's right end.
                await page.evaluate(`(() => {
                    const heads = [...document.querySelectorAll('*')].filter(e => (e.innerText || '').trim().toUpperCase() === 'QA TESTER');
                    let p = heads[heads.length - 1];
                    while (p && p.parentElement) {
                        const cs = getComputedStyle(p);
                        if ((cs.position === 'fixed' || cs.position === 'absolute') && p.getBoundingClientRect().width < 600) { p.dataset.capHidden = '1'; p.style.visibility = 'hidden'; break; }
                        p = p.parentElement;
                    }
                })()`);
                await sleep(2500);
                const mb = await page.evaluate(MEASURE);
                console.log(label, biome, ok, JSON.stringify(mb));
                if (!mb.bar) continue;
                const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: mb.bar.x, y: mb.bar.y, width: mb.bar.w, height: mb.bar.h, scale: 1 } });
                save(`${label}_bar_${biome.toLowerCase()}.png`, shot.data);
            }
        }
    } finally {
        await chrome.close();
    }
}
