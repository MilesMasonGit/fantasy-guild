// Captures each biome's real in-game ground at one canvas pixel per art pixel (the mat fitted at exactly 0.5),
// plus the whole mat with its Tokens, from a running dev server: node capture_biomes.mjs http://localhost:5195 outDir
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5195', out = 'capture'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const BIOMES = ['MEADOW', 'FLOWER MEADOW', 'FOREST', 'CHERRY GROVE', 'YELLOWSTONE', 'MOUNTAIN', 'COAST', 'VOLCANO', 'FOREST + MOUNTAIN', 'FOREST + COAST'];
const chrome = await launchChrome({ width: 1100, height: 660 });
try {
    const page = await chrome.newPage();
    await page.navigate(url);
    await page.waitFor('!!window.Game');
    await sleep(3000);
    const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
    if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
    await sleep(5000);
    for (const biome of BIOMES) {
        await page.evaluate(`(() => { const q = document.querySelector('[aria-label="Open QA Dashboard"], [title="Open QA Dashboard"]'); if (q) q.click(); })()`);
        await sleep(600);
        let ok = await clickText(biome);
        if (!ok) {   // the section was open already and the click closed it
            await page.evaluate(`(() => { const s = [...document.querySelectorAll('summary, button, div')].find(e => e.innerText && e.innerText.trim() === 'Terrain (dev only)'); if (s) s.click(); })()`);
            await sleep(400); ok = await clickText(biome);
        }
        if (!ok) { console.log('no button', biome); continue; }
        await sleep(800);
        await page.evaluate(`(() => {
            const heads = [...document.querySelectorAll('*')].filter(e => (e.innerText || '').trim().toUpperCase() === 'QA TESTER');
            let p = heads[heads.length - 1];
            while (p && p.parentElement) {
                const cs = getComputedStyle(p);
                if ((cs.position === 'fixed' || cs.position === 'absolute') && p.getBoundingClientRect().width < 600) { p.dataset.capHidden = '1'; p.style.visibility = 'hidden'; break; }
                p = p.parentElement;
            }
        })()`);
        await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
        await sleep(3500);
        const info = await page.evaluate(`(() => {
            const c = [...document.querySelectorAll('canvas')].find(c => c.className.includes('absolute'));
            const board = [...document.querySelectorAll('div')].find(e => getComputedStyle(e).transform.startsWith('matrix(0.5, 0, 0, 0.5'));
            const r = board.getBoundingClientRect();
            return { w: c.width, h: c.height, ground: c.toDataURL('image/png'), rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
        })()`);
        const name = biome.toLowerCase().replace(/[^a-z]+/g, '_');
        writeFileSync(path.join(out, `${name}_ground.png`), Buffer.from(info.ground.split(',')[1], 'base64'));
        const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: info.rect.x, y: info.rect.y, width: info.w, height: info.h, scale: 1 } });
        writeFileSync(path.join(out, `${name}_full.png`), Buffer.from(shot.data, 'base64'));
        await page.evaluate(`document.querySelectorAll('[data-cap-hidden]').forEach(e => { e.style.visibility = ''; delete e.dataset.capHidden; })`);
        console.log(name, info.w, 'x', info.h, JSON.stringify(await page.evaluate(`[...document.querySelectorAll('[aria-label*="QA"], [title*="QA"]')].map(e => e.getAttribute('aria-label') || e.title)`)));
    }
} finally {
    await chrome.close();
}
