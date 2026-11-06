// node capture_r1.mjs <url> <outDir> [view:seed ...]
// Brief 370 R1, the rivers as built: the running game at 1920 x 1080 in a headless Chrome, each shot a
// QA panel Terrain view (a dev Region, `src/ui/dev/terrainDev.js`) settled for free with a given seed.
// Needs this branch's dev server. Nothing under src/ or data/ changes; the game is a fresh one.
import { writeFileSync, mkdirSync } from 'node:fs';
import { launchChrome, sleep } from '../../../../../../bench/browser/cdp.mjs';

const W = 1920;
const H = 1080;
const [url = 'http://localhost:5398/', out = '.', ...wanted] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

/** Each shot: a file name, the dev maps, a seed (the view's own when null). */
const SHOTS = wanted.length ? wanted.map((w) => {
    const [name, maps, seed] = w.split(':');
    // `name:@fixture:highland`: the QA panel's Atlas fixture place of that kit (its Stone with it).
    if (maps === '@fixture') return { name, kit: seed };
    return { name, maps: maps.split('+'), seed: seed ? Number(seed) : null };
}) : [];

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    // A fresh game for every shot: the water's shimmer keeps a travelled-from Region's boxes a while.
    const newGame = async () => {
        // The throwaway profile's saves cleared, so the slot screen offers a new game again.
        await page.navigate(url);
        await page.waitFor('!!window.Game', { timeoutMs: 120000 });
        await page.evaluate('localStorage.clear(); true');
        await page.navigate(url);
        await page.waitFor('!!window.Game', { timeoutMs: 120000 });
        await sleep(2000);
        const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
        if (!clicked) throw new Error('no New Game button');
        await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
        await sleep(2000);
        // Through a Region with no water first: the shimmer of the Starter Camp's pond outlasts the
        // trip by a while, drawn over the next Region.
        await page.evaluate(`(async () => (await import('/src/ui/dev/terrainDev.js')).goToDevRegion(['volcano']).success)()`);
        await sleep(3000);
    };
    for (const shot of SHOTS) {
        await newGame();
        const result = await page.evaluate(shot.kit ? `(async () => {
            const dev = await import('/src/ui/dev/worldDev.js');
            const r = dev.settleFixture(${JSON.stringify(shot.kit)});
            if (!r.success) return { ok: false, reason: r.reason };
            // Its arrival beaten, so the mat is not darkened.
            dev.beatArrival();
            const w = r.region.terrain.water;
            return { ok: true, seed: r.region.seed, shapes: (w?.shapes || []).map(s => s.k).join(',') + ' stone ' + (r.region.terrain.stone?.shapes?.length ?? 0) };
        })()` : `(async () => {
            const dev = await import('/src/ui/dev/terrainDev.js');
            const r = dev.goToDevRegion(${JSON.stringify(shot.maps)}, ${shot.seed === null ? '{}' : `{ seed: ${shot.seed} }`});
            if (!r.success) return { ok: false, reason: r.reason };
            const w = r.region.terrain.water;
            return { ok: true, seed: r.region.seed, shapes: (w?.shapes || []).map(s => s.k).join(',') };
        })()`);
        if (!result.ok) {
            console.log('skipped', shot.name, result.reason);
            continue;
        }
        // The ground is drawn off the main thread once the Region is shown; give it time.
        await sleep(4500);
        await page.key('Escape', 'Escape', 27);
        await page.mouse('mouseMoved', 5, H - 5);
        await sleep(300);
        const d = await page.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(`${out}/${shot.name}.png`, Buffer.from(d.data, 'base64'));
        console.log('saved', shot.name, 'seed', result.seed, result.shapes);
    }
} finally {
    await chrome.close();
}
