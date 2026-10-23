// Captures the whole app window on a fresh New Game for today's mat and the candidate sizes, at
// 1920 x 1080 and 1366 x 768 (and 1680 x 1050 for some), from a dev server this script starts itself
// (port 5201, its own Vite cache):
//   node docs/active/research/mat_size/capture_mat_sizes.mjs [outDir]
// Each candidate is tried through the dev build's Mat Tuner rows (Mat size, Mat shape), stored
// before the game loads, so the Starter Camp is laid out on that mat exactly as a baked size would.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep, onCleanup } from '../../../../bench/browser/cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..', '..');
const [out = here, only = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const PORT = 5201;
// 1680 × 1050: a 16:10 window where the mat's fit crosses 0.75 and Token art halves (128 → 64 px).
const WIDE = [1680, 1050];
export const VARIANTS = [
    { name: 'today', steps: 11, aspect: 0.64, extra: [WIDE] },
    { name: 'a', steps: 12, aspect: 7 / 12 },
    { name: 'b', steps: 12, aspect: 13 / 24 },
    { name: 'c', steps: 13, aspect: 0.5, extra: [WIDE] },
    { name: 'd', steps: 12, aspect: 0.5, extra: [WIDE] }
].filter(v => !only || only.split(',').includes(v.name));
const WINDOWS = [[1920, 1080], [1366, 768]];

const { createServer } = await import('vite');
const server = await createServer({
    root,
    configFile: path.join(root, 'vite.config.js'),
    cacheDir: path.join(root, 'node_modules', '.vite-matsize-bm'),
    server: { port: PORT, strictPort: true, host: 'localhost', open: false },
    logLevel: 'warn',
    clearScreen: false
});
await server.listen();
onCleanup(() => { server.close(); });
const url = `http://localhost:${PORT}`;

const PROBE = `(async () => {
    const board = document.querySelector('[data-board-origin]');
    if (!board) return null;
    const geo = await import('/src/config/matGeometry.js');
    const MP = await import('/src/systems/board/MatPlacement.js');
    const r = board.getBoundingClientRect();
    const box = board.parentElement.parentElement;
    const bar = document.querySelector('[data-mat-top-bar]')?.getBoundingClientRect();
    const scale = Number(board.dataset.boardScale);
    const tokens = Game.BoardState.tokens().map(t => ({ typeId: t.typeId, x: t.x, y: t.y, inside: MP.insideMat(t.typeId, t) }));
    const art = [...document.querySelectorAll('[data-token-id] img')].map(i => Math.round(i.getBoundingClientRect().width));
    return {
        mat: { w: geo.matW(), h: geo.matH(), steps: geo.matSteps(), aspect: geo.matAspect() },
        scale,
        artSteps: Math.max(1, Math.round(2 * scale)),
        onScreen: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        box: { w: box.clientWidth, h: box.clientHeight },
        bar: bar ? { y: Math.round(bar.y), w: Math.round(bar.width), h: Math.round(bar.height) } : null,
        stepOnScreen: Math.round(160 * scale * 10) / 10,
        tokenArtPx: [...new Set(art)].sort((a, b) => a - b),
        tokens,
        allInside: tokens.every(t => t.inside)
    };
})()`;

const clickText = (page, t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);

const results = {};
try {
    for (const v of VARIANTS) {
        const chrome = await launchChrome({ width: 1920, height: 1080 });
        try {
            const page = await chrome.newPage();
            await page.setViewport(1920, 1080);
            await page.navigate(url);
            await page.evaluate(`localStorage.setItem('fantasy_guild_mat_tuning', JSON.stringify({ matSteps: ${v.steps}, matAspect: ${v.aspect} }))`);
            await page.navigate(url);
            await page.waitFor('!!window.Game', { timeoutMs: 120000 });
            await sleep(3000);
            if (!(await clickText(page, 'NEW GAME'))) throw new Error('no New Game button');
            await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
            await sleep(6000);
            results[v.name] = {};
            for (const [w, h] of [...WINDOWS, ...(v.extra || [])]) {
                await page.setViewport(w, h);
                await page.evaluate(`window.dispatchEvent(new Event('resize'))`);
                await sleep(4000);
                const probe = await page.evaluate(PROBE);
                results[v.name][w] = probe;
                const shot = await page.send('Page.captureScreenshot', { format: 'png' });
                const file = path.join(out, `${v.name}_${w}.png`);
                writeFileSync(file, Buffer.from(shot.data, 'base64'));
                console.log(v.name, w, JSON.stringify({ ...probe, tokens: probe?.tokens?.length }));
            }
            if (page.consoleErrors.length) console.log(v.name, 'page errors:', page.consoleErrors.slice(0, 5));
        } finally {
            await chrome.close();
        }
    }
} finally {
    writeFileSync(path.join(out, 'probe.json'), JSON.stringify(results, null, 2));
    await server.close();
}
