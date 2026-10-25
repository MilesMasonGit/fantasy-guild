// node capture_c6_mockups.mjs <url> <outDir> [date]
// The combat screen mock-ups (brief 220, C6a) from the style sheet page (QA panel, Style Sheet,
// "Combat screen"), at a 1920-wide screen with headless Chrome:
//   <date>_c6_option<A|B|C>_section.png  the whole option, at 1x (taller than one screen)
//   <date>_c6_option<A|B|C>_mat.png      the fight on the mat and every floating number, at 2x
//   <date>_c6_option<A|B|C>_cards.png    the enemy card on hover (fought, never fought), at 2x
//   <date>_c6_option<A|B|C>_panel.png    the fight panel open over the playmat, at 2x
//   <date>_c6_compare_mat.png / _panel.png   A, B and C side by side
// 2x is doubled without smoothing, for a phone. It prints the elements each option draws per fight.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, date = '2026-10-24'] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node capture_c6_mockups.mjs <url> <outDir> [date]');
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, `${date}_c6_${name}.png`), Buffer.from(b64, 'base64'));

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

/** Tiles side by side, each labelled above, on the page's dark background. */
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

/** The box of the elements matching `sel` inside option `id`, joined, with `pad` around. */
const boxOf = (page, id, sels, pad = 0) => page.evaluate(`(() => {
    const root = document.querySelector('[data-c6-option="${id}"]');
    const els = ${JSON.stringify(sels)}.flatMap(s => s === ':root' ? [root] : [...root.querySelectorAll(s)]);
    if (!els.length) return null;
    const rs = els.map(e => e.getBoundingClientRect());
    const x = Math.min(...rs.map(r => r.left)) - ${pad}, y = Math.min(...rs.map(r => r.top)) - ${pad};
    const r = Math.max(...rs.map(r => r.right)) + ${pad}, b = Math.max(...rs.map(r => r.bottom)) + ${pad};
    return { x: Math.round(x), y: Math.round(y), width: Math.round(r - x), height: Math.round(b - y) };
})()`);

/** Scroll the style sheet so option `id` starts near the top. */
const showOption = async (page, id, sel = null) => {
    await page.evaluate(`(() => {
        const root = document.querySelector('[data-c6-option="${id}"]');
        const el = ${sel ? `root.querySelector('${sel}')` : 'root'};
        el.scrollIntoView({ block: 'start' });
        document.querySelector('[data-style-sheet-page]').scrollBy(0, -70);
    })()`);
    await page.mouse('mouseMoved', 5, H - 5);
    await sleep(700);
};

/** Elements each option draws for one fight on the mat (its mat scene), and for its panel. */
const counts = (page, id) => page.evaluate(`(() => {
    const root = document.querySelector('[data-c6-option="${id}"]');
    const mat = root.querySelector('[data-c6-shot="mat"]');
    const n = (el) => el ? el.querySelectorAll('*').length + 1 : 0;
    const sum = (sel, scope = mat) => [...scope.querySelectorAll(sel)].reduce((a, e) => a + n(e), 0);
    return {
        bars: sum('[data-c6-cost="bars"]'),
        icon: sum('[data-c6-cost="icon"]'),
        plate: sum('[data-c6-cost="plate"]'),
        floats: sum('[data-c6-cost="float"]'),
        perFloat: { crit: n(mat.querySelector('[data-c6-cost="float"]')), poison: n(mat.querySelectorAll('[data-c6-cost="float"]')[1]) },
        cardKnown: sum('[data-c6-cost="card"]', root.querySelector('[data-c6-enemy-card="known"]')),
        panel: sum('[data-c6-cost="panel"]', root.querySelector('[data-c6-shot="panel"]'))
    };
})()`);

const chrome = await launchChrome({ width: W, height: H });
const log = { counts: {} };
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

    const mats = [];
    const panels = [];
    for (const id of ['A', 'B', 'C']) {
        log.counts[id] = await counts(page, id);

        // The whole option, taller than one screen: grow the screen to hold it, then back.
        await showOption(page, id);
        const h = await page.evaluate(`Math.ceil(document.querySelector('[data-c6-option="${id}"]').getBoundingClientRect().height) + 140`);
        await page.setViewport(W, Math.max(H, h));
        await showOption(page, id);
        const whole = await boxOf(page, id, [':root'], 8);
        save(`option${id}_section`, await grab(page, whole));
        await page.setViewport(W, H);

        await showOption(page, id, '[data-c6-shot="mat"]');
        const matBox = await boxOf(page, id, ['[data-c6-shot="mat"]', '[data-c6-shot="floats"]'], 0);
        const mat = await grab(page, matBox);
        save(`option${id}_mat`, await upscale(page, mat));
        mats.push({ label: `Option ${id}`, data: await grab(page, await boxOf(page, id, ['[data-c6-shot="mat"]'], 0)) });

        await showOption(page, id, '[data-c6-enemy-card]');
        const cards = await grab(page, await boxOf(page, id, ['[data-c6-shot^="card-"]'], 0));
        save(`option${id}_cards`, await upscale(page, cards));

        await showOption(page, id, '[data-c6-shot="panel"]');
        const panelBox = await boxOf(page, id, ['[data-c6-shot="panel"]'], 0);
        const panel = await grab(page, panelBox);
        save(`option${id}_panel`, await upscale(page, panel));
        panels.push({ label: `Option ${id}`, data: await grab(page, await boxOf(page, id, ['[data-c6-panel]'], 10)) });
    }
    save('compare_mat', await compose(page, mats, 2));
    save('compare_panel', await compose(page, panels, 1));
    console.log(JSON.stringify(log, null, 2));
} finally {
    await chrome.close();
}
