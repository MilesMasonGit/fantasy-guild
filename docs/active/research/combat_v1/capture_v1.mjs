// node capture_v1.mjs <url> <outDir> [date]
// Damage types as built (brief 280 V1), at a 1920 × 1080 screen with headless Chrome, from a New
// Game with the QA panel's "Damage types" scene (Aela's Ember Wand and Bram's Frost Wand on Fire
// Elementals, Cara's Spark Bow and Bodkin Arrows on a Rock Crab):
//   <date>_v1_mat.png           the three fights on the mat with their floats (effects paused)
//   <date>_v1_mat_zoom.png      the same fights, doubled without smoothing
//   <date>_v1_panel_fire.png    Aela's panel, log open: every hit Resisted for 0, Fire
//   <date>_v1_panel_ice.png     Bram's panel, log open: every hit Weak!, Ice
//   <date>_v1_panel_bow.png     Cara's panel, log open: Electric + Stab on every hit
//   <date>_v1_cards.png         the enemy cards: the Fire Elemental and the Rock Crab
// It prints the floats in the mat shot, the arrows in the Bank before and after a while, and errors.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, date = '2026-10-30'] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node capture_v1.mjs <url> <outDir> [date]');
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const file = (name) => path.join(out, `${date}_v1_${name}.png`);
const save = (name, b64) => writeFileSync(file(name), Buffer.from(b64, 'base64'));

const shot = async (page, clip = null) => (await page.send('Page.captureScreenshot', {
    format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {})
})).data;

const upscale = (page, data, k = 2) => page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
})()`);

const compose = (page, tiles) => page.evaluate(`(async () => {
    const tiles = ${JSON.stringify(tiles)};
    const imgs = await Promise.all(tiles.map(async t => { const i = new Image(); i.src = 'data:image/png;base64,' + t.data; await i.decode(); return i; }));
    const gap = 16, label = 34;
    const c = document.createElement('canvas');
    c.width = imgs.reduce((w, i) => w + i.width, 0) + gap * (imgs.length - 1);
    c.height = Math.max(...imgs.map(i => i.height)) + label;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#ffffff'; g.font = 'bold 22px monospace'; g.textBaseline = 'top';
    let x = 0;
    imgs.forEach((img, i) => { g.fillText(tiles[i].label, x + 4, 6); g.drawImage(img, x, label); x += img.width + gap; });
    return c.toDataURL('image/png').split(',')[1];
})()`);

const boxOf = (page, sels, pad = 0) => page.evaluate(`(() => {
    const els = ${JSON.stringify(sels)}.flatMap(s => [...document.querySelectorAll(s)]);
    if (!els.length) return null;
    const rs = els.map(e => e.getBoundingClientRect());
    const x = Math.max(0, Math.min(...rs.map(r => r.left)) - ${pad}), y = Math.max(0, Math.min(...rs.map(r => r.top)) - ${pad});
    const r = Math.min(${W}, Math.max(...rs.map(r => r.right)) + ${pad}), b = Math.min(${H}, Math.max(...rs.map(r => r.bottom)) + ${pad});
    return { x: Math.round(x), y: Math.round(y), width: Math.round(r - x), height: Math.round(b - y) };
})()`);

const heroIdOf = (page, name) => page.evaluate(`(window.GameState?.state?.heroes || []).find(h => h.name === ${JSON.stringify(name)})?.id || null`);
const centreOf = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()`);
const tokensOf = (page, typeId) => page.evaluate(`(window.Game?.BoardState?.tokens?.() || []).filter(t => t.typeId === ${JSON.stringify(typeId)}).map(t => t.id)`);
const arrows = (page) => page.evaluate(`window.Game?.InventoryManager?.getItemCount?.('qa_v1_bodkin_arrow') ?? (window.GameState?.state?.inventory?.items?.qa_v1_bodkin_arrow?.quantity ?? null)`);

/** Open a hero's fight panel with its log on This fight, and shoot the whole screen. */
async function panel(page, name, shotName) {
    const id = await heroIdOf(page, name);
    await page.evaluate(`document.querySelector('[data-fight-chip="${id}"]')?.click()`);
    await sleep(900);
    await page.evaluate(`document.querySelector('[data-fight-log-toggle="closed"]')?.click()`);
    await sleep(900);
    await page.mouse('mouseMoved', 5, H - 5);
    save(shotName, await shot(page));
    const lines = await page.evaluate(`[...document.querySelectorAll('[data-fight-log-line]')].slice(0, 6).map(l => l.textContent)`);
    await page.key('Escape', 'Escape', 27);
    await sleep(500);
    return lines;
}

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
    log.scene = await page.evaluate(`(async () => {
        const qa = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'QA') || document.querySelector('button[title="Open QA Dashboard"]');
        if (!qa) return 'no QA button';
        qa.click();
        await new Promise(r => setTimeout(r, 800));
        const b = document.querySelector('[data-qa-damage-types-scene]');
        if (!b) return 'no scene button';
        b.click();
        await new Promise(r => setTimeout(r, 300));
        document.querySelector('[data-testid="qa-panel"] [data-close-x]')?.click();
        return true;
    })()`);
    if (log.scene !== true) throw new Error(`scene: ${log.scene}`);
    await sleep(500);
    await page.key('Escape', 'Escape', 27);
    await page.mouse('mouseMoved', 5, H - 5);
    log.arrowsAtStart = await arrows(page);
    await sleep(9000);

    // 1. The mat: wait for floats on all three fights' enemies, then hold every effect still.
    await page.send('Animation.enable');
    for (let i = 0; i < 600; i++) {
        const words = await page.evaluate(`(() => { const fs = [...document.querySelectorAll('[data-fight-float]')].filter(f => getComputedStyle(f).visibility === 'visible' && f.getAttribute('data-fight-float-on') === 'enemy');
            return { weak: fs.some(f => f.getAttribute('data-fight-float-verdict') === 'weak'), resisted: fs.some(f => f.getAttribute('data-fight-float-verdict') === 'resisted'), two: fs.some(f => f.querySelectorAll('[data-fight-float-type]').length === 2) }; })()`);
        if (words.weak && words.resisted && words.two) break;
        await sleep(30);
    }
    await page.send('Animation.setPlaybackRate', { playbackRate: 0 });
    log.floatsInShot = await page.evaluate(`[...document.querySelectorAll('[data-fight-float]')].filter(f => getComputedStyle(f).visibility === 'visible').map(f => f.getAttribute('data-fight-float-on') + ': ' + f.textContent + ' [' + [...f.querySelectorAll('[data-fight-float-type]')].map(i => i.getAttribute('data-fight-float-type')).join('+') + ']')`);
    save('mat', await shot(page));
    const fights = await boxOf(page, ['[data-fight-plate-slot] [data-fight-plate]', '[data-fight-chip]', '[data-health-bar]', '[data-fight-float]', '[data-board-hero]'], 40);
    if (fights) save('mat_zoom', await upscale(page, await shot(page, fights)));
    await page.send('Animation.setPlaybackRate', { playbackRate: 1 });

    // 2. The three panels, each with its log open.
    log.fireLog = await panel(page, 'Aela', 'panel_fire');
    log.iceLog = await panel(page, 'Bram', 'panel_ice');
    log.bowLog = await panel(page, 'Cara', 'panel_bow');

    // 3. The enemy cards.
    const tiles = [];
    for (const [typeId, label] of [['qa_v1_fire_elemental', 'Fire Elemental'], ['qa_v1_rock_crab', 'Rock Crab (Armoured)']]) {
        const [id] = await tokensOf(page, typeId);
        const at = await centreOf(page, `[data-token-art="true"][data-token-id="${id}"]`);
        if (!at) continue;
        await page.mouse('mouseMoved', at[0] - 2, at[1] - 2);
        await sleep(200);
        await page.mouse('mouseMoved', at[0], at[1]);
        await sleep(1400);
        const box = await boxOf(page, [`[data-token-art="true"][data-token-id="${id}"]`, '[data-enemy-card-tip]'], 24);
        if (box) tiles.push({ label, data: await shot(page, box) });
        log[`card_${typeId}`] = await page.evaluate(`document.querySelector('[data-enemy-card-tip]')?.textContent || null`);
    }
    if (tiles.length) save('cards', await upscale(page, await compose(page, tiles)));
    await page.mouse('mouseMoved', 5, H - 5);
    log.arrowsAtEnd = await arrows(page);
    log.errors = page.consoleErrors;
    console.log(JSON.stringify(log, null, 2));
} finally {
    await chrome.close();
}
