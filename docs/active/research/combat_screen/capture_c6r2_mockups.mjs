// ⚠️ The mock-ups were removed when the combat screen was built (C6b); this script is the record of
// how round two was captured and no longer runs. The built screen's capture is capture_c6b.mjs.
// node capture_c6r2_mockups.mjs <url> <outDir> [date]
// Round two of the combat screen mock-ups (brief 220, C6a) from the style sheet page (QA panel,
// Style Sheet, "Combat screen"), at a 1920 × 1080 screen with headless Chrome:
//   <date>_c6r2_panels_closed.png      the three fight panels side by side, log closed, at 2x
//   <date>_c6r2_panel<1|2|3>_log.png   each panel with its log open, at 2x
//   <date>_c6r2_mat.png                the settled fight on the mat and every floating number, at 2x
//   <date>_c6r2_cards.png              the enemy card on hover (fought, never fought), at 2x
//   <date>_c6r2_motion.png             the light-motion frames, at 2x
//   <date>_c6r2_section.png            the whole entry, at 1x (taller than one screen)
// 2x is doubled without smoothing, for a phone. It prints the elements each piece draws.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, date = '2026-10-25'] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node capture_c6r2_mockups.mjs <url> <outDir> [date]');
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, `${date}_c6r2_${name}.png`), Buffer.from(b64, 'base64'));

async function grab(page, clip) {
    const s = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
    return s.data;
}

/** A picture upscaled `k` times nearest-neighbour in the page's own canvas. */
const upscale = (page, data, k = 2) => page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
})()`);

/** Tiles side by side, top-aligned, each labelled above, on the page's dark background, at `k`x. */
const compose = (page, tiles, k = 1) => page.evaluate(`(async () => {
    const tiles = ${JSON.stringify(tiles)};
    const imgs = await Promise.all(tiles.map(async t => { const i = new Image(); i.src = 'data:image/png;base64,' + t.data; await i.decode(); return i; }));
    const gap = 12 * ${k}, label = 30 * ${k};
    const c = document.createElement('canvas');
    c.width = imgs.reduce((w, i) => w + i.width * ${k}, 0) + gap * (imgs.length - 1);
    c.height = Math.max(...imgs.map(i => i.height * ${k})) + label;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffffff'; g.font = 'bold ' + (18 * ${k}) + 'px monospace'; g.textBaseline = 'top';
    let x = 0;
    imgs.forEach((img, i) => { g.fillText(tiles[i].label, x + 4, 6); g.drawImage(img, x, label, img.width * ${k}, img.height * ${k}); x += img.width * ${k} + gap; });
    return c.toDataURL('image/png').split(',')[1];
})()`);

/** The box of the elements matching `sels` (inside `root`), joined, with `pad` around. */
const boxOf = (page, root, sels, pad = 0) => page.evaluate(`(() => {
    const root = document.querySelector(${JSON.stringify(root)});
    const els = ${JSON.stringify(sels)}.flatMap(s => s === ':root' ? [root] : [...root.querySelectorAll(s)]);
    if (!els.length) return null;
    const rs = els.map(e => e.getBoundingClientRect());
    const x = Math.min(...rs.map(r => r.left)) - ${pad}, y = Math.min(...rs.map(r => r.top)) - ${pad};
    const r = Math.max(...rs.map(r => r.right)) + ${pad}, b = Math.max(...rs.map(r => r.bottom)) + ${pad};
    return { x: Math.round(x), y: Math.round(y), width: Math.round(r - x), height: Math.round(b - y) };
})()`);

/** Scroll the style sheet so `sel` starts near the top, the pointer parked away. */
const show = async (page, sel) => {
    await page.evaluate(`(() => {
        document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'start' });
        document.querySelector('[data-style-sheet-page]').scrollBy(0, -70);
    })()`);
    await page.mouse('mouseMoved', 5, H - 5);
    await sleep(700);
};

const counts = (page) => page.evaluate(`(() => {
    const n = (el) => el ? el.querySelectorAll('*').length + 1 : 0;
    const mat = document.querySelector('[data-c6-shot="mat"]');
    const sum = (sel, scope) => [...scope.querySelectorAll(sel)].reduce((a, e) => a + n(e), 0);
    const out = {
        mat: { bars: sum('[data-c6-cost="bars"]', mat), icon: sum('[data-c6-cost="icon"]', mat), plate: sum('[data-c6-cost="plate"]', mat), floats: sum('[data-c6-cost="float"]', mat) },
        panels: {}
    };
    for (const o of document.querySelectorAll('[data-c6-panel-option]')) {
        const id = o.getAttribute('data-c6-panel-option');
        out.panels[id] = { closed: n(o.querySelector('[data-c6-shot="closed"] [data-c6-panel]')), open: n(o.querySelector('[data-c6-shot="open"] [data-c6-panel]')) };
    }
    return out;
})()`);

const chrome = await launchChrome({ width: W, height: H });
const log = {};
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(url);
    await page.waitFor('!!window.Game', { timeoutMs: 120000 });
    await sleep(2500);
    const clicked = await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.innerText.trim().toUpperCase() === 'NEW GAME'); if (!b) return false; b.click(); return true; })()`);
    if (!clicked) throw new Error('no New Game button');
    await page.waitFor(`!!document.querySelector('[data-board-origin]')`, { timeoutMs: 60000 });
    await sleep(3000);
    log.sheet = await page.evaluate(`(async () => {
        const qa = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'QA') || document.querySelector('button[title="Open QA Dashboard"]');
        if (!qa) return 'no QA button';
        qa.click();
        await new Promise(r => setTimeout(r, 800));
        const s = [...document.querySelectorAll('button')].find(b => /style sheet/i.test(b.textContent || ''));
        if (!s) return 'no Style Sheet button';
        s.click();
        await new Promise(r => setTimeout(r, 1500));
        return !!document.querySelector('[data-combat-mockups]');
    })()`);
    if (log.sheet !== true) throw new Error(`style sheet: ${log.sheet}`);
    await sleep(1500);
    log.counts = await counts(page);

    // The whole entry, taller than one screen: grow the screen to hold it, then back.
    await show(page, '[data-combat-mockups]');
    const h = await page.evaluate(`Math.ceil(document.querySelector('[data-combat-mockups]').getBoundingClientRect().height) + 140`);
    await page.setViewport(W, Math.max(H, h));
    await show(page, '[data-combat-mockups]');
    save('section', await grab(page, await boxOf(page, '[data-combat-mockups]', [':root'], 8)));
    await page.setViewport(W, H);

    await show(page, '[data-c6-mat]');
    save('mat', await upscale(page, await grab(page, await boxOf(page, '[data-c6-mat]', ['[data-c6-shot="mat"]', '[data-c6-shot="floats"]']))));
    await show(page, '[data-c6-enemy-card]');
    save('cards', await upscale(page, await grab(page, await boxOf(page, '[data-c6-mat]', ['[data-c6-shot^="card-"]']))));

    const closed = [];
    for (const id of ['1', '2', '3']) {
        const root = `[data-c6-panel-option="${id}"]`;
        await show(page, root);
        closed.push({ label: `Panel ${id}`, data: await grab(page, await boxOf(page, root, ['[data-c6-shot="closed"]'], 14)) });
        save(`panel${id}_log`, await upscale(page, await grab(page, await boxOf(page, root, ['[data-c6-shot="open"]'], 14))));
    }
    save('panels_closed', await compose(page, closed, 2));

    await show(page, '[data-c6-shot="motion"]');
    save('motion', await upscale(page, await grab(page, await boxOf(page, '[data-combat-mockups]', ['[data-c6-shot="motion"]'], 4))));
    console.log(JSON.stringify(log, null, 2));
} finally {
    await chrome.close();
}
