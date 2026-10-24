// The Guild Hall camera glide, for the owner's phone review and a first look at its cost:
// node capture_hall_glide.mjs <url> <outDir> [passes]
// Any build that installs the perf harness (the dev server, or the perf build under `vite
// preview`), on the bench's S2 board (`?stress=realistic`) at 1920 x 1080. Frames come from
// Chrome's screencast (every frame the compositor draws, with its time), picked ~40 ms apart
// from the click and laid out as a contact sheet at a quarter size (WebP, to keep the folder small):
//   open     the Hall orb clicked on the mat: the glide up to the sky
//   close    the Return to Playmat button: the glide back down
//   skip     the orb, then a click on the screen 150 ms in: the glide lands at once
//   reduced  the same open and close with the computer asking for reduced motion: a plain swap
//   count    dev build only: with the game loop stopped, the mat's own renders and the commits in
//            its subtree during each glide
//   timing   frame timing of glide against swap (reduced motion), alternated, the loop running
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5213', out = '.', passArg = 'open,close,skip,reduced,timing'] = process.argv.slice(2);
const passes = new Set(passArg.split(','));
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));
const log = (...a) => console.log(...a);

/** Frames the compositor draws, with their wall-clock time in ms, while `run` runs. */
async function screencast(page, run) {
    const frames = [];
    const off = page.on('Page.screencastFrame', (f) => {
        frames.push({ t: f.metadata.timestamp * 1000, data: f.data });
        page.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await page.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: W / 4, maxHeight: H / 4, everyNthFrame: 1 });
    try {
        await run();
    } finally {
        await page.send('Page.stopScreencast');
        off();
    }
    return frames;
}

/** The frame on screen at each of `at` (ms from `t0`): the latest drawn at or before it. */
function pick(frames, t0, at) {
    return at.map((ms) => {
        let best = null;
        for (const f of frames) if (f.t - t0 <= ms && (!best || f.t > best.t)) best = f;
        return best && { ms, drawnAt: Math.round(best.t - t0), data: best.data };
    }).filter(Boolean);
}

/** A contact sheet: the stills in rows of `cols`, each labelled with its time from the click. */
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
        return c.toDataURL('image/webp', 0.85).split(',')[1];
    })()`);
}

const centre = (page, sel) => page.evaluate(`(() => { const r = document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect(); return r ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null; })()`);
const phase = (page) => page.evaluate(`document.querySelector('[data-hall-camera]')?.getAttribute('data-hall-camera') ?? null`);

/** Click (real input) and return the page's wall-clock time of the press. */
async function pressAt(page, at) {
    await page.evaluate(`window.__pressAt = null; addEventListener('pointerdown', () => { window.__pressAt ??= Date.now(); }, { capture: true, once: true }); true`);
    await page.click(at.x, at.y);
    return page.waitFor('window.__pressAt');
}

/** One glide filmed: the press, then ~0.7 s; a sheet of stills ~40 ms apart. */
/**
 * Watch the camera from the page, every frame: when its glide's animation first runs and when it
 * rests again, in the page's wall-clock ms.
 */
const WATCH = `(() => {
    const W = window.__watch = { start: null, end: null, on: true };
    const loop = () => {
        const cam = document.querySelector('[data-hall-camera]');
        const anim = document.getAnimations().find(a => a.effect?.target === cam);
        const phase = cam?.getAttribute('data-hall-camera');
        if (anim && W.start == null) W.start = Date.now();
        if (W.start != null && W.end == null && (phase === 'sky' || phase === 'mat')) W.end = Date.now();
        if (W.on) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    return true;
})()`;

/**
 * One transition filmed: the press, then ~1.2 s. The sheet shows the screen just before the
 * press, then stills ~40 ms apart from just before the glide starts moving to just after it rests
 * (or, with no glide, from the press), each labelled with its time from the press.
 */
async function film(page, name, title, press, { after = 1200, maxStills = 20 } = {}) {
    let t0 = 0;
    const frames = await screencast(page, async () => {
        await page.evaluate(WATCH);
        await sleep(200);
        t0 = await press();
        await sleep(after);
    });
    const w = await page.evaluate(`(() => { window.__watch.on = false; return window.__watch; })()`);
    const from = w.start != null ? Math.max(0, Math.round((w.start - t0) / 40) * 40 - 40) : 0;
    const to = w.end != null ? Math.round((w.end - t0) / 40) * 40 + 80 : from + 200;
    const steps = [-40];
    for (let ms = from; ms <= to && steps.length < maxStills; ms += 40) steps.push(ms);
    const stills = pick(frames, t0, steps).map(s => ({ ...s, label: s.ms < 0 ? 'just before the click' : `+${s.ms} ms` }));
    const motion = w.start != null ? `glide moving from +${w.start - t0} ms, at rest from +${w.end - t0} ms` : 'no glide';
    const gaps = frames.filter(f => f.t >= t0 && f.t <= t0 + 1200).map((f, i, a) => (i ? Math.round(f.t - a[i - 1].t) : 0)).slice(1);
    log(name, `${motion}; ${frames.length} frames filmed; gaps ms after the press`, gaps.join(','));
    save(`${name}.webp`, await sheet(page, stills, 3, `${title} (${motion})`));
    return { motion, gaps };
}

const chrome = await launchChrome({ width: W, height: H });
try {
    const page = await chrome.newPage();
    await page.setViewport(W, H);
    await page.navigate(`${url}/?stress=realistic`);
    await page.waitFor(`!!window.__perf && !!document.querySelector('[data-board-origin]')`);
    await sleep(2000);
    await page.evaluate(`window.__perf.hideHud?.(); true`);
    // Stars in every state, two of them affordable, as the QA panel's sample (written as its
    // helpers write them); the gifts' stubs gone.
    await page.evaluate(`(() => {
        const G = window.__perf.game;
        G.GameState.state.progress.guildUpgrades = { roster_size: 1, notice_board: 3, wishing_well: 10 };
        G.GuildUpgradeManager.recompute();
        G.EventBus.publish('guild_upgrades_updated', {});
        for (const id of ['bank_slots', 'token_cap']) for (const p of G.GuildUpgradeManager.getNextCost(id) || []) G.InventoryManager.addItem(p.itemId, p.quantity);
        G.ItemStubs.clearUnpinned?.();
        return true;
    })()`);
    // The bench's settle: the heroes walk to their work.
    await sleep(15000);
    const orb = await centre(page, '#guild-bubble-target button');
    const geometry = await page.evaluate(`(() => {
        const cam = document.querySelector('[data-hall-camera]');
        const row = cam?.closest('.react-overlay')?.firstElementChild;
        return { camera: cam?.offsetHeight, column: cam?.parentElement?.offsetHeight, row: row?.offsetHeight, phase: cam?.getAttribute('data-hall-camera') };
    })()`);
    log('geometry', JSON.stringify(geometry));
    await page.mouse('mouseMoved', W - 5, H - 5);

    if (passes.has('open') || passes.has('close')) {
        await film(page, 'glide_open', 'Opening the Guild Hall: the camera glides up from the mat to the night sky', () => pressAt(page, orb));
        log('after open', await phase(page));
        await page.mouse('mouseMoved', W - 5, H - 5);
        await sleep(800);
        save('hall_at_rest.webp', (await page.send('Page.captureScreenshot', { format: 'webp', quality: 90 })).data);
        const back = await centre(page, '[data-hall-details] button');
        await film(page, 'glide_close', 'Return to Playmat: the camera glides back down to the mat', () => pressAt(page, back));
        log('after close', await phase(page));
        await sleep(800);
        save('mat_after_close.webp', (await page.send('Page.captureScreenshot', { format: 'webp', quality: 90 })).data);
    }

    if (passes.has('skip')) {
        const mid = await page.evaluate(`(() => { const r = document.querySelector('[data-hall-camera]').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`);
        await film(page, 'glide_skip', 'A click on the screen mid-glide lands it at once', async () => {
            const t = await pressAt(page, orb);
            await sleep(150);
            await page.click(mid.x, mid.y);
            return t;
        }, { maxStills: 12 });
        log('after skip', await phase(page));
        await sleep(600);
        await page.click(orb.x, orb.y);
        await sleep(1500);
        log('closed again', await phase(page));
    }

    if (passes.has('reduced')) {
        await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await sleep(300);
        await film(page, 'reduced_motion_open', 'Reduced motion: opening the Hall is a plain swap', () => pressAt(page, orb), { after: 600 });
        await sleep(800);
        const back = await centre(page, '[data-hall-details] button');
        await film(page, 'reduced_motion_close', 'Reduced motion: Return to Playmat is a plain swap', () => pressAt(page, back), { after: 600 });
        await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        await sleep(800);
    }

    if (passes.has('count')) {
        // The mat's renders and commits during each glide, with the game loop stopped so only the
        // camera could make them.
        const counts = await page.evaluate(`(async () => {
            const P = await import('/src/ui/dev/perf/PerfProfiler.jsx');
            const read = () => ({ own: P.ownRenders.MatBoard || 0, commits: P.reactCommits.MatBoard?.commits || 0, mounts: P.reactCommits.MatBoard?.mounts || 0 });
            const cam = () => document.querySelector('[data-hall-camera]').getAttribute('data-hall-camera');
            const orb = document.querySelector('#guild-bubble-target button');
            const press = (el) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 })); };
            const until = async (p) => { const t0 = performance.now(); while (cam() !== p && performance.now() - t0 < 4000) await new Promise(r => requestAnimationFrame(r)); return cam(); };
            const frame = () => new Promise(r => requestAnimationFrame(r));
            window.__perf.game.GameLoop.stop();
            await new Promise(r => setTimeout(r, 500));
            const out = {};
            // The same stretch at rest on the mat, nothing pressed: what commits without the camera.
            let a = read();
            await new Promise(r => setTimeout(r, 1500));
            const rest = read();
            out.restPer1500ms = { own: rest.own - a.own, commits: rest.commits - a.commits };
            a = read();
            press(orb);
            await until('to-sky'); await frame();
            out.upStart = read();
            await until('sky');
            out.upEnd = read();
            out.up = { own: out.upEnd.own - a.own, commits: out.upEnd.commits - a.commits };
            await new Promise(r => setTimeout(r, 500));
            a = read();
            press(document.querySelector('[data-hall-details] button'));
            await until('to-mat'); await frame(); await frame();
            out.downStart = read();
            out.downStartAt = performance.now();
            await until('mat');
            await frame();
            out.downEnd = read();
            out.downEndAt = performance.now();
            out.downDuring = { own: out.downEnd.own - out.downStart.own, commits: out.downEnd.commits - out.downStart.commits };
            out.downMount = { own: out.downStart.own - a.own, commits: out.downStart.commits - a.commits, mounts: out.downStart.mounts - a.mounts };
            // The same mat laid back by a plain swap (reduced motion asked through a stand-in
            // matchMedia), over the same stretch after the mount: what the mat commits by itself.
            const realMatch = window.matchMedia;
            window.matchMedia = (q) => (q.includes('reduced-motion') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : realMatch.call(window, q));
            press(orb);
            await until('sky');
            await new Promise(r => setTimeout(r, 500));
            press(document.querySelector('[data-hall-details] button'));
            await until('mat'); await frame(); await frame();
            const s0 = read();
            await new Promise(r => setTimeout(r, 600));
            const s1 = read();
            out.swapAfterMount600ms = { own: s1.own - s0.own, commits: s1.commits - s0.commits };
            window.matchMedia = realMatch;
            window.__perf.game.GameLoop.start();
            return out;
        })()`);
        log('mat during the glides (loop stopped)', JSON.stringify(counts));
        writeFileSync(path.join(out, 'count.json'), JSON.stringify({ geometry, counts }, null, 2));
    }

    if (passes.has('timing')) {
        // Glide against swap (reduced motion), alternated, the game loop running: per open and
        // close, when the glide starts moving and rests (from the press), and the compositor's
        // frames (the screencast: what reaches the screen), their longest gap from the press to
        // 200 ms after the rest, and during the motion alone.
        const timing = [];
        const back = () => centre(page, '[data-hall-details] button');
        for (let round = 0; round < 3; round++) {
            for (const mode of ['glide', 'swap']) {
                await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: mode === 'swap' ? 'reduce' : 'no-preference' }] });
                await sleep(1500);
                for (const dir of ['open', 'close']) {
                    const at = dir === 'open' ? orb : await back();
                    let t0 = 0;
                    const frames = await screencast(page, async () => {
                        await page.evaluate(WATCH);
                        await sleep(200);
                        t0 = await pressAt(page, at);
                        await sleep(1300);
                    });
                    const w = await page.evaluate(`(() => { window.__watch.on = false; return window.__watch; })()`);
                    const rel = frames.map(f => f.t - t0);
                    const restAt = w.end != null ? w.end - t0 : null;
                    const gapsIn = (a, b) => rel.filter(t => t >= a && t <= b).map((t, i, x) => (i ? t - x[i - 1] : 0)).slice(1);
                    const all = gapsIn(0, (restAt ?? 400) + 200);
                    const motion = w.start != null ? gapsIn(w.start - t0, restAt) : [];
                    const r = {
                        round, mode, dir,
                        movingFrom: w.start != null ? w.start - t0 : null,
                        restFrom: restAt,
                        longestGapMs: Math.round(Math.max(0, ...all)),
                        longestGapInMotionMs: motion.length ? Math.round(Math.max(...motion)) : null,
                        gapsOver34InMotion: motion.filter(g => g > 34).length,
                        framesInMotion: motion.length + (motion.length ? 1 : 0)
                    };
                    timing.push(r);
                    log('timing', JSON.stringify(r));
                    await sleep(1000);
                }
            }
        }
        await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
        writeFileSync(path.join(out, 'timing.json'), JSON.stringify({ geometry, timing }, null, 2));
    }
    if (page.consoleErrors.length) log('page errors', page.consoleErrors);
} finally {
    await chrome.close();
}
