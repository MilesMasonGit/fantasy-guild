// node capture_v2.mjs <url> <outDir> [date]
// Gear and defence as built (brief 280 V2), at a 1920 × 1080 screen with headless Chrome, from a New
// Game with the QA panel's "Gear and defence" scene (Dara in a Plate Chestplate and a Kite Shield on a
// Venomous Rat; Eli's Frost Wand in nothing and Fen's in the chestplate on Training Dummies; Gus's
// Sundering Spear on a Rock Crab):
//   <date>_v2_mat.png            the four fights on the mat with their floats (effects paused)
//   <date>_v2_mat_zoom.png       the same fights, doubled without smoothing
//   <date>_v2_panel_armour.png   Dara's panel, log open: the rat's swings Resisted, Venom on her
//   <date>_v2_panel_bare.png     Eli's panel: the wand's hit in nothing
//   <date>_v2_panel_plate.png    Fen's panel, the hit row's tip open: the same wand, cut 30 %
//   <date>_v2_panel_sunder.png   Gus's panel, log open: Sunder ×3 on the crab, its Physical down to 20
//   <date>_v2_tooltips.png       the Plate Chestplate's and the Kite Shield's tooltips in the Bank
// It prints what each panel and tooltip says, and errors.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, date = '2026-10-30'] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node capture_v2.mjs <url> <outDir> [date]');
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const file = (name) => path.join(out, `${date}_v2_${name}.png`);
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
const textOf = (page, sel) => page.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent.replace(/\\s+/g, ' ').trim())`);
const hover = async (page, at) => {
    await page.mouse('mouseMoved', at[0] - 2, at[1] - 2);
    await sleep(150);
    await page.mouse('mouseMoved', at[0], at[1]);
};

/** Open a hero's fight panel (its log too when asked), wait for `until`, run `extra`, shoot the screen. */
async function panel(page, name, shotName, { log = true, until = null, extra = null } = {}) {
    const id = await heroIdOf(page, name);
    await page.evaluate(`document.querySelector('[data-fight-chip="${id}"]')?.click()`);
    await sleep(900);
    if (until) await page.waitFor(until, { timeoutMs: 60000, what: `${name}: ${until}` });
    if (log) {
        await page.evaluate(`document.querySelector('[data-fight-log-toggle="closed"]')?.click()`);
        await sleep(900);
    }
    await page.mouse('mouseMoved', 5, H - 5);
    const said = {
        rows: await textOf(page, '[data-fight-row]'),
        statuses: await textOf(page, '[data-fight-status]'),
        log: (await textOf(page, '[data-fight-log-line]')).slice(0, 8)
    };
    if (extra) said.extra = await extra();
    save(shotName, await shot(page));
    await page.key('Escape', 'Escape', 27);
    await sleep(500);
    return said;
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
        const b = document.querySelector('[data-qa-gear-defence-scene]');
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
    await sleep(9000);

    // 1. The mat: wait for a Resisted float over a hero (the rat's swing on Dara) and a hit on each
    // dummy, then hold every effect still.
    await page.send('Animation.enable');
    for (let i = 0; i < 800; i++) {
        const words = await page.evaluate(`(() => { const fs = [...document.querySelectorAll('[data-fight-float]')].filter(f => getComputedStyle(f).visibility === 'visible');
            return { heroResisted: fs.some(f => f.getAttribute('data-fight-float-on') === 'hero' && f.getAttribute('data-fight-float-verdict') === 'resisted'), enemyHits: fs.filter(f => f.getAttribute('data-fight-float-on') === 'enemy').length }; })()`);
        if (words.heroResisted && words.enemyHits >= 1) break;
        await sleep(30);
    }
    await page.send('Animation.setPlaybackRate', { playbackRate: 0 });
    log.floatsInShot = await page.evaluate(`[...document.querySelectorAll('[data-fight-float]')].filter(f => getComputedStyle(f).visibility === 'visible').map(f => f.getAttribute('data-fight-float-on') + ': ' + f.textContent + ' [' + [...f.querySelectorAll('[data-fight-float-type]')].map(i => i.getAttribute('data-fight-float-type')).join('+') + '] ' + (f.getAttribute('data-fight-float-verdict') || ''))`);
    save('mat', await shot(page));
    const fights = await boxOf(page, ['[data-fight-plate-slot] [data-fight-plate]', '[data-fight-chip]', '[data-health-bar]', '[data-fight-float]', '[data-board-hero]'], 40);
    if (fights) save('mat_zoom', await upscale(page, await shot(page, fights)));
    await page.send('Animation.setPlaybackRate', { playbackRate: 1 });

    // 2. The panels.
    log.armour = await panel(page, 'Dara', 'panel_armour', { until: `document.querySelector('[data-fight-status]') !== null` });
    log.bare = await panel(page, 'Eli', 'panel_bare', { log: false });
    log.plate = await panel(page, 'Fen', 'panel_plate', {
        log: false,
        extra: async () => {
            const at = await centreOf(page, '[data-fight-row="hit"] [data-fight-side="hero"]');
            if (!at) return null;
            await hover(page, at);
            await sleep(1200);
            const tip = await page.evaluate(`[...document.querySelectorAll('[role="tooltip"], [data-tooltip], .ui-tooltip')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean)`);
            save('panel_plate', await shot(page));
            return tip;
        }
    });
    log.sunder = await panel(page, 'Gus', 'panel_sunder', {
        until: `[...document.querySelectorAll('[data-fight-status]')].some(e => /×3/.test(e.textContent))`
    });

    // 3. The tooltips: a spare chestplate and shield in the Bank, the Bank open, each tile hovered.
    await page.evaluate(`(() => { const I = window.Game?.InventoryManager; I?.addItem('qa_v2_plate_chestplate', 1); I?.addItem('qa_v2_kite_shield', 1); })()`);
    // A real click: the bubble answers only inside its circle.
    const bank = await centreOf(page, '#bank-bubble-target button');
    if (bank) await page.click(bank[0], bank[1]);
    await sleep(1200);
    const tiles = [];
    log.tips = {};
    for (const [itemId, label] of [['qa_v2_plate_chestplate', 'Plate Chestplate'], ['qa_v2_kite_shield', 'Kite Shield']]) {
        await page.evaluate(`document.querySelector('[data-bank-item="${itemId}"]')?.scrollIntoView({ block: 'center' })`);
        await sleep(300);
        const at = await centreOf(page, `[data-bank-item="${itemId}"]`);
        if (!at) { log.tips[itemId] = 'no tile'; continue; }
        await hover(page, at);
        await sleep(1200);
        log.tips[itemId] = await page.evaluate(`document.querySelector('[data-item-tip]')?.closest('[role="tooltip"]')?.textContent || document.querySelector('[data-item-tip]')?.textContent || null`);
        log.tips[`${itemId}_cuts`] = await page.evaluate(`[...document.querySelectorAll('[data-item-tip-cut]')].map(e => e.textContent + ' (' + getComputedStyle(e).color + ')')`);
        const box = await boxOf(page, [`[data-bank-item="${itemId}"]`, '[data-item-tip]'], 28);
        if (box) tiles.push({ label, data: await shot(page, box) });
        await page.mouse('mouseMoved', 5, H - 5);
        await sleep(400);
    }
    if (tiles.length) save('tooltips', await upscale(page, await compose(page, tiles)));
    log.errors = page.consoleErrors;
    console.log(JSON.stringify(log, null, 2));
} finally {
    await chrome.close();
}
