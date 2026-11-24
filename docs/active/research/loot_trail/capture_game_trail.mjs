// Records the loot trail as the game draws it (brief 840 F2): from a running dev server, a New Game at
// 1920 x 1080 (New Game, Begin), a pile of copper ore dropped on the mat (as the QA panel's Drop does) at 1 (one shadow),
// 12,000 (five) and 3,000,000 (seven), each collected and its flight to its item notice recorded with
// Chrome's screencast, every frame it paints. Writes game_1.gif, game_5.gif and game_7.gif here,
// cropped to the flight and the notice column, at the frames' own timing.
//   node capture_game_trail.mjs <url>      e.g. http://localhost:5322
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodeGif } from './gif.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const { launchChrome, sleep } = await import(pathToFileURL(path.join(root, 'bench/browser/cdp.mjs')).href);
const { PNG } = createRequire(path.join(root, 'package.json'))('pngjs');

const url = process.argv[2] || 'http://localhost:5322';
const W = 1920, H = 1080;
const ITEM = 'item_copper_ore';
const RUNS = [[1, 'game_1.gif'], [12000, 'game_5.gif'], [3000000, 'game_7.gif']];

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(3000);
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) throw new Error('no New Game button');
    await sleep(2000);
    const begun = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => /BEGIN/i.test(b.innerText)); if (!b) return false; b.click(); return true; })()`);
    if (!begun) throw new Error('no Begin button');
    await page.waitFor('!!window.Game.GameState.state', { timeoutMs: 60000 });
    await sleep(6000);

    for (const [qty, file] of RUNS) {
        const said = await page.evaluate(`import('/src/ui/dev/qaTools.js').then(m => m.dropAndSay('${ITEM}', ${qty}))`);
        console.log(said);
        await sleep(2500);
        const frames = [];
        const off = page.on('Page.screencastFrame', (f) => {
            frames.push({ data: f.data, t: f.metadata.timestamp });
            page.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
        });
        await page.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
        await sleep(300);
        // The pile's collect, as a click on it does; where the flight's canvas stands as it flies.
        const box = await page.evaluate(`(async () => {
            const SL = await import('/src/systems/board/SpriteLayer.js');
            const pile = SL.getSprites().filter(s => s.refId === '${ITEM}').at(-1);
            if (!pile) return null;
            SL.collectSprite(pile.id);
            const boxes = [];
            const t0 = performance.now();
            await new Promise(done => { const step = () => {
                const c = document.querySelector('canvas[class*="mat-flights"]');
                if (c && c.style.display !== 'none') boxes.push({ l: parseFloat(c.style.left), t: parseFloat(c.style.top), w: c.width, h: c.height });
                if (performance.now() - t0 < 1400) requestAnimationFrame(step); else done();
            }; requestAnimationFrame(step); });
            return boxes.reduce((a, b) => ({ l: Math.min(a.l, b.l), t: Math.min(a.t, b.t), r: Math.max(a.r, b.l + b.w), b: Math.max(a.b, b.t + b.h) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
        })()`);
        await page.send('Page.stopScreencast');
        off();
        if (!box || !Number.isFinite(box.l)) { console.log(file, 'no flight seen'); continue; }
        // The flight's reach, out to the screen's right edge (the notice column) and a little round it.
        const cx = Math.max(0, Math.floor(box.l) - 16), cy = Math.max(0, Math.floor(box.t) - 16);
        const cw = W - cx, ch = Math.min(H, Math.ceil(box.b) + 16) - cy;
        const imgs = frames.map(f => PNG.sync.read(Buffer.from(f.data, 'base64')));
        const crops = imgs.filter(p => p.width === W && p.height === H).map(p => {
            const o = new Uint8Array(cw * ch * 4);
            for (let y = 0; y < ch; y++) o.set(p.data.subarray(((y + cy) * W + cx) * 4, ((y + cy) * W + cx + cw) * 4), y * cw * 4);
            return o;
        });
        const delays = frames.map((f, i) => Math.round(((frames[i + 1]?.t ?? f.t + 0.5) - f.t) * 100));
        writeFileSync(path.join(here, file), encodeGif(crops, cw, ch, delays));
        const span = frames.length > 1 ? Math.round((frames.at(-1).t - frames[0].t) * 1000) : 0;
        console.log(`${file}: ${crops.length} frames over ${span} ms, ${cw}x${ch}`);
        await sleep(1500);
    }
    if (page.consoleErrors.length) console.log('page errors:', page.consoleErrors.slice(0, 5));
} finally {
    console.log('chrome closed:', JSON.stringify(await chrome.close()));
}
