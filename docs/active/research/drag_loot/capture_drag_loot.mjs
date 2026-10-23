// Captures the drag grid and the loot landing from a running dev server, for the owner's phone review:
//   node docs/active/research/drag_loot/capture_drag_loot.mjs <url> <outDir> <label>
// At 1920 x 1080, on a New Game:
// - <label>_loot_strip.png: a loot drop from a Starter Camp Token, twenty-four stills as fast as the
//   browser takes them, at 2x in rows of four, each with its time since the drop (the hop, any
//   afterimages trailing it, the landing);
// - <label>_rare_strip.png: the same for a rare find (the gold flash and star after landing);
// - <label>_drag.png: the whole window mid-drag of a Token over the lake of the QA panel's
//   "Lake" water view (allowed and forbidden cells both on screen), and <label>_drag_zoom.png.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5206', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));

/** Base64 PNG stills, each upscaled 2x with no smoothing, laid out in rows of four with their time. */
function stitch(page, frames, times) {
    return page.evaluate(`(async () => {
        const srcs = ${JSON.stringify(frames)};
        const times = ${JSON.stringify(times)};
        const imgs = await Promise.all(srcs.map(async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); return i; }));
        const k = 2, gap = 6, per = 4;
        const w = imgs[0].width * k, h = imgs[0].height * k;
        const rows = Math.ceil(imgs.length / per);
        const c = document.createElement('canvas');
        c.width = per * (w + gap) - gap; c.height = rows * (h + gap) - gap;
        const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
        g.imageSmoothingEnabled = false; g.font = 'bold 22px sans-serif';
        imgs.forEach((im, n) => {
            const x = (n % per) * (w + gap), y = Math.floor(n / per) * (h + gap);
            g.drawImage(im, x, y, w, h);
            g.fillStyle = '#000'; g.fillRect(x, y, 96, 30); g.fillStyle = '#fff'; g.fillText(times[n] + ' ms', x + 6, y + 23);
        });
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

/** Screen box of a mat point. */
const TO_SCREEN = `(p) => { const b = document.querySelector('[data-board-origin]'); const r = b.getBoundingClientRect(); const s = r.width / b.offsetWidth; return { x: r.left + p.x * s, y: r.top + p.y * s, s }; }`;

async function lootStrip(page, fn, name) {
    const where = await page.evaluate(`(() => {
        const dev = globalThis.__fxDev; const toks = dev.everyToken().slice(0, 1);
        const t = toks[0]; const at = (${TO_SCREEN})(t);
        window.__lootFrom = toks;
        return at;
    })()`);
    const clip = { x: Math.max(0, Math.round(where.x - 110)), y: Math.max(0, Math.round(where.y - 110)), width: 220, height: 200, scale: 1 };
    await page.evaluate(`globalThis.__fxDev.${fn}(window.__lootFrom).length`);
    const t0 = Date.now();
    const frames = [];
    const times = [];
    for (let i = 0; i < 24; i++) {
        const shot = await page.send('Page.captureScreenshot', { format: 'png', clip });
        frames.push(shot.data);
        times.push(Date.now() - t0);
    }
    save(name, await stitch(page, frames, times));
}

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(3000);
    const clickText = (t) => page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === ${JSON.stringify(t)}); if (!b) return false; b.click(); return true; })()`);
    if (!(await clickText('NEW GAME'))) throw new Error('no New Game button');
    await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
    await sleep(6000);
    await page.evaluate(`import('/src/ui/dev/animationDev.js').then(() => !!globalThis.__fxDev)`);

    await lootStrip(page, 'dropLootFrom', `${label}_loot_strip.png`);
    await sleep(1500);
    await lootStrip(page, 'dropRareFrom', `${label}_rare_strip.png`);
    await sleep(1000);

    // The lake view: water in the middle of the mat, grass round it.
    const went = await page.evaluate(`import('/src/ui/dev/terrainDev.js').then(m => m.goToDevRegion(['water_lake']).success)`);
    if (!went) throw new Error('could not go to the lake view');
    await sleep(6000);
    // A Token to carry, and a forbidden cell next to an allowed one (the lake's shore) to carry it to.
    const plan = await page.evaluate(`(async () => {
        const GR = await import('/src/systems/board/GroundRules.js');
        const toks = Game.BoardState.tokens().filter(t => Number.isFinite(t.x));
        const FT = await import('/src/systems/board/FixedTokens.js');
        // A Token the player may move: the Guild Hall when every other one is a fixture.
        const t = toks.find(t => !FT.isFixed(t) && !/guild_hall/.test(t.typeId)) || toks.find(t => !FT.isFixed(t));
        const rules = GR.rulesFor(t.typeId);
        if (!rules) return { error: 'no ground rule for ' + t.typeId };
        const { cols, rows } = rules.grid;
        let best = null;
        for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
            const i = r * cols + c;
            if (rules.mask[i] !== 0 || rules.mask[i - 1] !== 1) continue;
            const x = (c - 1) * rules.cell; const y = (r + 0.5) * rules.cell;
            const d = Math.hypot(x - t.x, y - t.y);
            if (!best || d < best.d) best = { x, y, d };
        }
        const to = (${TO_SCREEN});
        return { typeId: t.typeId, id: t.id, from: to(t), to: best && to(best), forbidden: [...rules.mask].filter(v => v === 0).length, cells: rules.mask.length };
    })()`);
    console.log(label, 'drag plan', JSON.stringify(plan));
    if (plan.error || !plan.to) throw new Error(plan.error || 'no shore found');
    const { from, to } = plan;
    await page.mouse('mouseMoved', from.x, from.y);
    await sleep(300);
    console.log(label, 'under the press:', await page.evaluate(`(() => { const e = document.elementFromPoint(${from.x}, ${from.y}); return e && (e.closest('[data-token-id]')?.getAttribute('data-token-id') || e.tagName + '.' + e.className); })()`));
    await page.mouse('mousePressed', from.x, from.y, { button: 'left', buttons: 1, clickCount: 1 });
    await sleep(60);
    for (let i = 1; i <= 12; i++) {
        const k = i / 12;
        await page.mouse('mouseMoved', from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, { button: 'left', buttons: 1 });
        await sleep(35);
    }
    await sleep(600);
    const grid = await page.evaluate(`({ grid: !!document.querySelector('canvas[data-terrain-grid]'), dragging: document.body.classList.contains('gi-dnd-active') })`);
    console.log(label, 'mid-drag:', JSON.stringify(grid));
    const full = await page.send('Page.captureScreenshot', { format: 'png' });
    save(`${label}_drag.png`, full.data);
    const zoom = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, to.x - 400), y: Math.max(0, to.y - 260), width: 800, height: 520, scale: 1 } });
    save(`${label}_drag_zoom.png`, zoom.data);
    // Let go where it was picked up: nothing moves.
    for (let i = 11; i >= 0; i--) {
        const k = i / 12;
        await page.mouse('mouseMoved', from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k, { button: 'left', buttons: 1 });
        await sleep(20);
    }
    await page.mouse('mouseReleased', from.x, from.y, { button: 'left', buttons: 0, clickCount: 1 });
    if (page.consoleErrors.length) console.log(label, 'page errors:', page.consoleErrors.slice(0, 5));
} finally {
    await chrome.close();
}
