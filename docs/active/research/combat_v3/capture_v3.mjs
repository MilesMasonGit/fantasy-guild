// node capture_v3.mjs <url> <outDir> [date]
// Enemy moves as built (brief 280 V3), at a 1920 × 1080 screen with headless Chrome, from a New Game
// with the QA panel's "Enemy moves" scene (Dara in a Plate Chestplate and a Kite Shield, Physical 35 %,
// on the owner's Chicken: Peck Stab, Scratch Slash, Flutter +50 % Physical for one attack):
//   <date>_v3_mat.png            the fight on the mat with a float naming a move (effects paused)
//   <date>_v3_floats.png         the three moves' floats side by side, doubled without smoothing
//   <date>_v3_panel_flutter.png  the panel while Flutter is on the chicken: Physical 50 %, Flutter bright
//   <date>_v3_panel_log.png      the panel, log open: every move by name, the Resisted swing after Flutter
//   <date>_v3_card.png           the chicken's enemy card: its three moves
// It prints what each says, and errors.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, date = '2026-10-30'] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node capture_v3.mjs <url> <outDir> [date]');
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const file = (name) => path.join(out, `${date}_v3_${name}.png`);
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
const tokensOf = (page, typeId) => page.evaluate(`(window.Game?.BoardState?.tokens?.() || []).filter(t => t.typeId === ${JSON.stringify(typeId)}).map(t => t.id)`);
const centreOf = (page, sel) => page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })()`);
const textOf = (page, sel) => page.evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => e.textContent.replace(/\\s+/g, ' ').trim())`);
const visibleFloats = `[...document.querySelectorAll('[data-fight-float]')].filter(f => getComputedStyle(f).visibility === 'visible')`;

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
        const b = document.querySelector('[data-qa-enemy-moves-scene]');
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
    await sleep(6000);

    // 1. The floats: catch each move's float as it shows, the effects held still for the shot.
    await page.send('Animation.enable');
    const fightBox = async () => boxOf(page, ['[data-fight-plate-slot] [data-fight-plate]', '[data-fight-chip]', '[data-health-bar]', '[data-fight-float]', '[data-board-hero]'], 40);
    const tiles = [];
    const got = new Set();
    log.floats = {};
    for (let i = 0; i < 3000 && got.size < 3; i++) {
        const seen = await page.evaluate(`${visibleFloats}.map(f => f.getAttribute('data-fight-float-move')).filter(Boolean)`);
        const fresh = seen.find(m => !got.has(m));
        if (fresh) {
            await page.send('Animation.setPlaybackRate', { playbackRate: 0 });
            log.floats[fresh] = await page.evaluate(`${visibleFloats}.map(f => f.getAttribute('data-fight-float-on') + ': ' + f.textContent + ' [' + [...f.querySelectorAll('[data-fight-float-type]')].map(i => i.getAttribute('data-fight-float-type')).join('+') + '] ' + (f.getAttribute('data-fight-float-verdict') || ''))`);
            if (got.size === 0) save('mat', await shot(page));
            const box = await fightBox();
            if (box) tiles.push({ label: fresh, data: await shot(page, box) });
            got.add(fresh);
            await page.send('Animation.setPlaybackRate', { playbackRate: 1 });
        }
        await sleep(40);
    }
    if (tiles.length) save('floats', await upscale(page, await compose(page, tiles)));

    // 2. The panel while Flutter is on the chicken: the engine held still for the shot.
    const id = await heroIdOf(page, 'Dara');
    await page.evaluate(`document.querySelector('[data-fight-chip="${id}"]')?.click()`);
    await sleep(900);
    await page.waitFor(`!!document.querySelector('[data-fight-buff="Flutter"]')`, { timeoutMs: 90000, what: 'Flutter on the chicken' });
    await page.evaluate(`window.Game.GameLoop.stop()`);
    await sleep(600);
    await page.mouse('mouseMoved', 5, H - 5);
    log.flutter = {
        rows: await textOf(page, '[data-fight-row]'),
        moves: await textOf(page, '[data-fight-move]'),
        last: await page.evaluate(`document.querySelector('[data-fight-move-last="true"]')?.getAttribute('data-fight-move') || null`),
        buffs: await textOf(page, '[data-fight-buff]'),
        resists: await page.evaluate(`[...document.querySelectorAll('[data-fight-side="enemy"] [data-fight-resist]')].map(e => e.getAttribute('data-fight-resist') + ' ' + e.textContent)`)
    };
    save('panel_flutter', await shot(page));
    await page.evaluate(`window.Game.GameLoop.start()`);

    // 3. The log, once it holds every move and a Resisted swing after a Flutter.
    await page.evaluate(`document.querySelector('[data-fight-log-toggle="closed"]')?.click()`);
    await sleep(900);
    // Newest first: both swing every 3 s in the same tick, Dara first, so the chicken's next swing on
    // top, then Dara's Resisted swing, then the Flutter it answered.
    await page.waitFor(`(() => {
        const lines = [...document.querySelectorAll('[data-fight-log-line]')].map(e => e.textContent);
        return ['Peck', 'Scratch', 'Flutter'].every(m => lines.some(l => l.includes(m)))
            && /Dara hits/.test(lines[1] || '') && /Resisted/.test(lines[1] || '') && /uses Flutter/.test(lines[2] || '');
    })()`, { timeoutMs: 180000, intervalMs: 50, what: 'every move in the log, a Resisted swing after a Flutter near the top' });
    await page.evaluate(`window.Game.GameLoop.stop()`);
    await sleep(600);
    await page.mouse('mouseMoved', 5, H - 5);
    log.log = (await textOf(page, '[data-fight-log-line]')).slice(0, 14);
    save('panel_log', await shot(page));
    await page.evaluate(`window.Game.GameLoop.start()`);
    await page.key('Escape', 'Escape', 27);
    await sleep(500);

    // 4. The chicken's card.
    const [chicken] = await tokensOf(page, 'qa_v3_chicken');
    const at = await centreOf(page, `[data-token-art="true"][data-token-id="${chicken}"]`);
    if (at) {
        await page.mouse('mouseMoved', at[0] - 2, at[1] - 2);
        await sleep(200);
        await page.mouse('mouseMoved', at[0], at[1]);
        await sleep(1400);
        const box = await boxOf(page, [`[data-token-art="true"][data-token-id="${chicken}"]`, '[data-enemy-card-tip]'], 24);
        if (box) save('card', await upscale(page, await shot(page, box)));
        log.card = await textOf(page, '[data-enemy-card-move]');
    }
    log.errors = page.consoleErrors;
    console.log(JSON.stringify(log, null, 2));
} finally {
    await chrome.close();
}
