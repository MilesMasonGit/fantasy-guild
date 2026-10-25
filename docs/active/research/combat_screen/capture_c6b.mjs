// node capture_c6b.mjs <url> <outDir> [date]
// The combat screen as built (brief 220, C6b), at a 1920 × 1080 screen with headless Chrome, from a
// New Game with the QA panel's "Combat screen" scene (Aela on a Goblin Warlord, Bram on a Cow, a
// Goblin Scout nobody has fought):
//   <date>_c6b_mat.png              a live fight on the mat with floats (the effects paused for the picture)
//   <date>_c6b_mat_zoom.png         the two fights, doubled without smoothing, for a phone
//   <date>_c6b_panel.png            Aela's fight panel open over the mat, log closed
//   <date>_c6b_panel_this.png       the same with the log open on "This fight"
//   <date>_c6b_panel_last.png       the same on "Last fight" (Bram's, who has finished a Cow)
//   <date>_c6b_card.png             the enemy card on hover: the Warlord (fought) and the Scout (never fought)
//   <date>_c6b_catchup.png          "While you were away" after 20 minutes away, with the fights block
// Each full shot is the whole 1920 × 1080 screen; the zooms are crops doubled. It prints the
// elements each piece draws and how often each part of the page changes (draw cost).
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url, out, date = '2026-10-25'] = process.argv.slice(2);
if (!url || !out) throw new Error('usage: node capture_c6b.mjs <url> <outDir> [date]');
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const file = (name) => path.join(out, `${date}_c6b_${name}.png`);
const save = (name, b64) => writeFileSync(file(name), Buffer.from(b64, 'base64'));

const shot = async (page, clip = null) => (await page.send('Page.captureScreenshot', {
    format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {})
})).data;

/** A picture upscaled `k` times nearest-neighbour in the page's own canvas. */
const upscale = (page, data, k = 2) => page.evaluate(`(async () => {
    const img = new Image(); img.src = 'data:image/png;base64,${data}'; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width * ${k}; c.height = img.height * ${k};
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
})()`);

/** Pictures side by side, top-aligned, each labelled above, on a dark background. */
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

/** The box around everything matching `sels`, with `pad`, clamped to the screen. */
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
const tokenOf = (page, typeId) => page.evaluate(`(window.Game?.BoardState?.tokens?.() || []).find(t => t.typeId === ${JSON.stringify(typeId)})?.id || null`);

/** Elements a fight draws on the mat at rest, per fight; and the panel's, closed and open. */
const countFight = (page) => page.evaluate(`(() => {
    const n = (el) => el ? el.querySelectorAll('*').length + 1 : 0;
    return [...document.querySelectorAll('[data-fight]')].map(f => {
        const id = f.getAttribute('data-fight');
        const heroId = f.querySelector('[data-fight-chip]')?.getAttribute('data-fight-chip');
        const parts = {
            enemyBar: n(document.querySelector('[data-health-bar="enemy"][data-health-of="' + id + '"]')),
            heroBar: n(document.querySelector('[data-health-bar="hero"][data-health-of="' + heroId + '"]')),
            chip: n(f.querySelector('[data-fight-chip-slot]')),
            plate: n(f.querySelector('[data-fight-plate-slot]')),
            wrapper: 1
        };
        return { tokenId: id, ...parts, total: Object.values(parts).reduce((a, b) => a + b, 0) };
    });
})()`);

/** How often the page changes, for `ms`: mutations in the fight layer, the bars, the panel; floats made. */
const rates = (page, ms) => page.evaluate(`(async () => {
    const counts = { fightLayer: 0, bars: 0, panel: 0, floats: 0, fx: 0 };
    const watch = (el, key, opts) => { if (!el) return null; const mo = new MutationObserver(ms => { counts[key] += ms.length; }); mo.observe(el, opts); return mo; };
    const all = { childList: true, subtree: true, attributes: true, characterData: true };
    const mos = [
        watch(document.querySelector('[data-fights]'), 'fightLayer', all),
        watch(document.querySelector('[data-fight-panel-popup]'), 'panel', all),
        watch(document.querySelector('[data-mat-fx]'), 'fx', { childList: true })
    ];
    const bars = [...document.querySelectorAll('[data-health-bar]')].map(b => watch(b, 'bars', all));
    const fx = document.querySelector('[data-mat-fx]');
    const mo2 = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.hasAttribute('data-fight-float')) counts.floats++; });
    if (fx) mo2.observe(fx, { childList: true });
    await new Promise(r => setTimeout(r, ${ms}));
    [...mos, ...bars, mo2].forEach(m => m && m.disconnect());
    const per = (k) => Math.round(counts[k] / (${ms} / 1000) * 10) / 10;
    return { seconds: ${ms} / 1000, perSecond: { fightLayerMutations: per('fightLayer'), barMutations: per('bars'), panelMutations: per('panel'), floatsMade: per('floats') } };
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
    log.scene = await page.evaluate(`(async () => {
        const qa = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'QA') || document.querySelector('button[title="Open QA Dashboard"]');
        if (!qa) return 'no QA button';
        qa.click();
        await new Promise(r => setTimeout(r, 800));
        const b = document.querySelector('[data-qa-combat-screen-scene]');
        if (!b) return 'no scene button';
        b.click();
        await new Promise(r => setTimeout(r, 300));
        document.querySelector('[data-testid="qa-panel"] [data-close-x]')?.click();
        return true;
    })()`);
    if (log.scene !== true) throw new Error(`scene: ${log.scene}`);
    // The new heroes' sheet opens with them: put it away for the pictures.
    await sleep(500);
    await page.key('Escape', 'Escape', 27);
    await page.mouse('mouseMoved', 5, H - 5);
    await sleep(9000);

    // 1. The mat with floats: wait for floats on both sides at once, then hold every effect still.
    await page.send('Animation.enable');
    let floats = 0;
    for (let i = 0; i < 400; i++) {
        floats = await page.evaluate(`(() => { const fs = [...document.querySelectorAll('[data-fight-float]')].filter(f => getComputedStyle(f).visibility === 'visible');
            return new Set(fs.map(f => f.getAttribute('data-fight-float-on'))).size; })()`);
        if (floats >= 2) break;
        await sleep(40);
    }
    await page.send('Animation.setPlaybackRate', { playbackRate: 0 });
    log.floatsInShot = await page.evaluate(`[...document.querySelectorAll('[data-fight-float]')].map(f => f.getAttribute('data-fight-float') + ' on ' + f.getAttribute('data-fight-float-on') + ': ' + f.textContent)`);
    save('mat', await shot(page));
    const fights = await boxOf(page, ['[data-fight-plate-slot] [data-fight-plate]', '[data-fight-chip]', '[data-health-bar]', '[data-fight-float]', '[data-board-hero]'], 40);
    save('mat_zoom', await upscale(page, await shot(page, fights)));
    await page.send('Animation.setPlaybackRate', { playbackRate: 1 });
    log.perFight = await countFight(page);
    log.matRates = await rates(page, 10000);

    // 2. Aela's panel, log closed, then open on This fight.
    const aela = await heroIdOf(page, 'Aela');
    await page.evaluate(`document.querySelector('[data-fight-chip="${aela}"]').click()`);
    await sleep(1200);
    await page.mouse('mouseMoved', 5, H - 5);
    save('panel', await shot(page));
    log.panelClosed = await page.evaluate(`document.querySelector('[data-fight-panel-popup]').querySelectorAll('*').length + 1`);
    log.panelRates = await rates(page, 6000);
    await page.evaluate(`document.querySelector('[data-fight-log-toggle]').click()`);
    await sleep(900);
    save('panel_this', await shot(page));
    log.panelOpen = await page.evaluate(`document.querySelector('[data-fight-panel-popup]').querySelectorAll('*').length + 1`);
    log.panelOpenRates = await rates(page, 6000);

    // 3. Bram's panel (he has beaten a Cow by now), log open on Last fight.
    const bram = await heroIdOf(page, 'Bram');
    await page.evaluate(`document.querySelector('[data-fight-chip="${bram}"]').click()`);
    await sleep(900);
    await page.evaluate(`document.querySelector('[data-fight-log-toggle]').click()`);
    await sleep(400);
    await page.evaluate(`document.querySelector('[data-fight-log-tab="last"]').click()`);
    await sleep(900);
    await page.mouse('mouseMoved', 5, H - 5);
    save('panel_last', await shot(page));
    await page.key('Escape', 'Escape', 27);
    await sleep(600);

    // 4. The enemy card: the Warlord (fought) and the Scout (never fought).
    const tiles = [];
    for (const [typeId, label] of [['qa_c6_warlord', 'Fought: its kinds show'], ['qa_c6_scout', 'Never fought: kinds hidden']]) {
        const id = await tokenOf(page, typeId);
        const at = await centreOf(page, `[data-token-art="true"][data-token-id="${id}"]`);
        await page.mouse('mouseMoved', at[0] - 2, at[1] - 2);
        await sleep(200);
        await page.mouse('mouseMoved', at[0], at[1]);
        await sleep(1400);
        const box = await boxOf(page, [`[data-token-art="true"][data-token-id="${id}"]`, '[data-enemy-card-tip]'], 24);
        tiles.push({ label, data: await shot(page, box) });
    }
    save('card', await upscale(page, await compose(page, tiles)));
    await page.mouse('mouseMoved', 5, H - 5);
    await sleep(500);

    // 5. Time away: the catch-up summary's fights block.
    log.away = await page.evaluate(`(async () => {
        const qa = [...document.querySelectorAll('button')].find(b => (b.innerText || '').trim() === 'QA') || document.querySelector('button[title="Open QA Dashboard"]');
        qa?.click(); await new Promise(r => setTimeout(r, 800));
        document.querySelector('[data-qa-combat-screen-away]').click();
        await new Promise(r => setTimeout(r, 300));
        document.querySelector('[data-testid="qa-panel"] [data-close-x]')?.click();
        for (let i = 0; i < 240 && !document.querySelector('[data-catch-up-summary]'); i++) await new Promise(r => setTimeout(r, 500));
        return !!document.querySelector('[data-catch-up-summary]');
    })()`);
    await sleep(1500);
    save('catchup', await shot(page));
    log.errors = page.consoleErrors;
    console.log(JSON.stringify(log, null, 2));
} finally {
    await chrome.close();
}
