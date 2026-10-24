// The Bank and Shop drawers, for the owner's phone review and a look at what opening the Bank costs:
// node capture_drawers.mjs <url> <outDir> <label> [passes]
// Any build that installs the perf harness (the dev server), on the bench's S2 board
// (`?stress=realistic`). `label` prefixes every file (before / after).
//   stills   at 1920 x 1080 and 1366 x 768: the mat, the Bank open, the Shop open (half size, PNG)
//   film     at 1920 x 1080: the Bank opening and closing, stills ~40 ms apart from the click
//            (Chrome's screencast: every frame the compositor draws), a sixth size, as a sheet
//   right    at 1920 x 1080 with the nav on the right (Settings): the Bank and the Shop open, and
//            the Bank opening filmed
//   reduced  at 1920 x 1080 with reduced motion asked for: the Bank opening filmed
//   count    with the game loop stopped: the mat's own renders and its subtree's commits while the
//            Bank opens and closes, and the frames' longest gap
import { writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5214', out = '.', label = 'shot', passArg = 'stills,film,count,right,reduced'] = process.argv.slice(2);
const passes = new Set(passArg.split(','));
mkdirSync(out, { recursive: true });
const save = (name, b64) => writeFileSync(path.join(out, `${label}_${name}`), Buffer.from(b64, 'base64'));
const log = (...a) => console.log(...a);

const centre = (page, sel) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null; })()`);

async function shot(page, name, W, H) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 0.5 } });
    save(name, data);
}

async function screencast(page, W, H, run) {
    const frames = [];
    const off = page.on('Page.screencastFrame', (f) => {
        frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
        page.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await page.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W / 6, maxHeight: H / 6, everyNthFrame: 1 });
    try { await run(); } finally { await page.send('Page.stopScreencast'); off(); }
    return frames;
}

function pick(frames, t0, at) {
    return at.map((ms) => {
        let best = null;
        for (const f of frames) if (f.t - t0 <= ms && (!best || f.t > best.t)) best = f;
        return best && { ms, data: best.data };
    }).filter(Boolean);
}

async function sheet(page, stills, cols, title) {
    return page.evaluate(`(async () => {
        const stills = ${JSON.stringify(stills.map(s => ({ label: s.label, data: s.data })))};
        const imgs = [];
        for (const s of stills) { const i = new Image(); i.src = 'data:image/jpeg;base64,' + s.data; await i.decode(); imgs.push(i); }
        const w = imgs[0].width, h = imgs[0].height, gap = 6, head = 34, lab = 22, cols = ${cols};
        const rows = Math.ceil(imgs.length / cols);
        const c = document.createElement('canvas');
        c.width = cols * w + (cols + 1) * gap; c.height = head + rows * (h + lab + gap) + gap;
        const g = c.getContext('2d');
        g.fillStyle = '#16120e'; g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#f3e6c8'; g.font = 'bold 20px sans-serif'; g.fillText(${JSON.stringify(title)}, gap, 24);
        g.font = '16px sans-serif';
        imgs.forEach((im, n) => {
            const x = gap + (n % cols) * (w + gap), y = head + Math.floor(n / cols) * (h + lab + gap);
            g.fillStyle = '#f3e6c8'; g.fillText(stills[n].label, x, y + 16);
            g.drawImage(im, x, y + lab, w, h);
        });
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

async function pressAt(page, at) {
    await page.evaluate(`window.__pressAt = null; addEventListener('pointerdown', () => { window.__pressAt ??= Date.now(); }, { capture: true, once: true }); true`);
    await page.click(at.x, at.y);
    return page.waitFor('window.__pressAt');
}

async function film(page, W, H, name, title, press) {
    let t0 = 0;
    const frames = await screencast(page, W, H, async () => {
        await sleep(200);
        t0 = await press();
        await sleep(900);
    });
    const steps = [-40];
    for (let ms = 0; ms <= 400; ms += 40) steps.push(ms);
    const stills = pick(frames, t0, steps).map(s => ({ ...s, label: s.ms < 0 ? 'just before the click' : `+${s.ms} ms` }));
    const gaps = frames.filter(f => f.t >= t0 && f.t <= t0 + 700).map((f, i, a) => (i ? Math.round(f.t - a[i - 1].t) : 0)).slice(1);
    log(name, `${frames.length} frames; gaps ms after the press`, gaps.join(','));
    save(`${name}.png`, await sheet(page, stills, 4, title));
}

async function boot(page, W, H) {
    await page.setViewport(W, H);
    await page.navigate(`${url}/?stress=realistic`);
    await page.waitFor(`!!window.__perf && !!document.querySelector('[data-board-origin]')`);
    await sleep(2000);
    await page.evaluate(`window.__perf.hideHud?.(); true`);
    // The bench's settle: the heroes walk to their work and the stubs fill.
    await sleep(10000);
    await page.mouse('mouseMoved', Math.round(W / 2), H - 5);
}

const chrome = await launchChrome({ width: 1920, height: 1080 });
try {
    const page = await chrome.newPage();
    const sizes = passes.has('stills') ? [[1920, 1080], [1366, 768]] : [[1920, 1080]];
    for (const [W, H] of sizes) {
        await boot(page, W, H);
        const bank = await centre(page, '#bank-bubble-target button');
        const shop = await centre(page, '#shop-bubble-target button');
        if (passes.has('stills')) {
            await shot(page, `${W}_mat.png`, W, H);
            await page.click(bank.x, bank.y);
            await sleep(900);
            await page.mouse('mouseMoved', Math.round(W / 2), H - 5);
            await sleep(300);
            await shot(page, `${W}_bank.png`, W, H);
            await page.click(bank.x, bank.y);
            await sleep(900);
            await page.click(shop.x, shop.y);
            await sleep(900);
            await page.mouse('mouseMoved', W - 5, H - 5);
            await sleep(300);
            await shot(page, `${W}_shop.png`, W, H);
            await page.click(shop.x, shop.y);
            await sleep(900);
        }
        if (passes.has('film') && W === 1920) {
            await film(page, W, H, 'bank_open', `${label}: opening the Bank (1920 x 1080, a sixth size)`, () => pressAt(page, bank));
            await sleep(600);
            await film(page, W, H, 'bank_close', `${label}: closing the Bank`, () => pressAt(page, bank));
            await sleep(600);
        }
        if (passes.has('reduced') && W === 1920) {
            await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
            await sleep(300);
            await film(page, W, H, 'reduced_bank_open', `${label}: reduced motion, opening the Bank`, () => pressAt(page, bank));
            await sleep(600);
            await page.click(bank.x, bank.y);
            await sleep(900);
            await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        }
        if (passes.has('right') && W === 1920) {
            const setRight = (on) => page.evaluate(`import('/src/systems/core/SettingsManager.js').then(m => { m.SettingsManager.set('ui.bubbleMenuRight', ${on}); return true; })`);
            await setRight(true);
            await sleep(800);
            const bankR = await centre(page, '#bank-bubble-target button');
            const shopR = await centre(page, '#shop-bubble-target button');
            await film(page, W, H, 'right_bank_open', `${label}: nav on the right, opening the Bank`, () => pressAt(page, bankR));
            await page.mouse('mouseMoved', Math.round(W / 2), H - 5);
            await sleep(600);
            await shot(page, `right_${W}_bank.png`, W, H);
            await page.click(bankR.x, bankR.y);
            await sleep(900);
            await page.click(shopR.x, shopR.y);
            await sleep(900);
            await shot(page, `right_${W}_shop.png`, W, H);
            await page.click(shopR.x, shopR.y);
            await sleep(900);
            await setRight(false);
            await sleep(800);
        }
        if (passes.has('count') && W === 1920) {
            const counts = await page.evaluate(`(async () => {
                const P = await import('/src/ui/dev/perf/PerfProfiler.jsx');
                const read = () => ({ own: P.ownRenders.MatBoard || 0, commits: P.reactCommits.MatBoard?.commits || 0 });
                const btn = document.querySelector('#bank-bubble-target button');
                const press = () => { const r = btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); };
                const wait = (ms) => new Promise(r => setTimeout(r, ms));
                window.__perf.game.GameLoop.stop();
                await wait(500);
                const out = {};
                let a = read(); await wait(1000); let b = read();
                out.restPer1000ms = { own: b.own - a.own, commits: b.commits - a.commits };
                for (const dir of ['open', 'close', 'open2', 'close2']) {
                    a = read();
                    const frames = [];
                    let on = true;
                    const loop = (t) => { frames.push(t); if (on) requestAnimationFrame(loop); };
                    requestAnimationFrame(loop);
                    press();
                    await wait(1000);
                    on = false;
                    b = read();
                    const gaps = frames.slice(1).map((t, i) => t - frames[i]);
                    out[dir] = { own: b.own - a.own, commits: b.commits - a.commits, longestGapMs: Math.round(Math.max(...gaps)), over34: gaps.filter(g => g > 34).length };
                    await wait(500);
                }
                window.__perf.game.GameLoop.start();
                return out;
            })()`);
            log('mat while the Bank opens and closes (loop stopped, 1 s each)', JSON.stringify(counts));
            writeFileSync(path.join(out, `${label}_count.json`), JSON.stringify(counts, null, 2));
        }
    }
    if (page.consoleErrors.length) log('page errors', page.consoleErrors.slice(0, 5));
} finally {
    await chrome.close();
}
// Kept small for the repo: every picture of this run down to a 128-colour palette.
const sharp = createRequire(import.meta.url)('sharp');
for (const f of readdirSync(out).filter(n => n.startsWith(`${label}_`) && n.endsWith('.png'))) {
    const p = path.join(out, f);
    writeFileSync(p, await sharp(p).png({ palette: true, colors: 128, effort: 10 }).toBuffer());
}
