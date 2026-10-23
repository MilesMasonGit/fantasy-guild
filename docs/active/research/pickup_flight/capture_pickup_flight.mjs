// Measures where each kind's pickup flight starts, and saves frame strips of it, from a running dev server:
//   node docs/active/research/pickup_flight/capture_pickup_flight.mjs <url> <outDir> <label>
// At 1920 x 1080, on a New Game with the QA panel's animation scene (goblins, heroes and their flags):
// for a Token, an enemy, a flag, a hero on the mat and a hero in the hero bar, it presses on the
// thing, moves the pointer 40 px, and records, every frame for 200 ms, the centre of the carried
// picture against the centre of the thing as it stood. Animations play at a tenth of their speed (`SLOW`). It prints one line per kind and saves
// <label>_<kind>_close.png (twelve stills round the press, at 2x, with their time since the press) and,
// for an enemy and a hero, <label>_<kind>_wide.png (from the window's corner to the press, small).
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchChrome, sleep } from '../../../../bench/browser/cdp.mjs';

const [url = 'http://localhost:5207', out = '.', label = 'shot'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const W = 1920;
const H = 1080;
const SLOW = 0.1;
const save = (name, b64) => writeFileSync(path.join(out, name), Buffer.from(b64, 'base64'));

function stitch(page, frames, times, { k = 2, per = 4 } = {}) {
    return page.evaluate(`(async () => {
        const srcs = ${JSON.stringify(frames)};
        const times = ${JSON.stringify(times)};
        const imgs = await Promise.all(srcs.map(async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); return i; }));
        const k = ${k}, gap = 6, per = ${per};
        const w = imgs[0].width * k, h = imgs[0].height * k;
        const rows = Math.ceil(imgs.length / per);
        const c = document.createElement('canvas');
        c.width = per * (w + gap) - gap; c.height = rows * (h + gap) - gap;
        const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
        g.imageSmoothingEnabled = false; g.font = 'bold 22px sans-serif';
        imgs.forEach((im, n) => {
            const x = (n % per) * (w + gap), y = Math.floor(n / per) * (h + gap);
            g.drawImage(im, x, y, w, h);
            g.fillStyle = '#000'; g.fillRect(x, y, 250, 30); g.fillStyle = '#fff'; g.fillText(times[n] + ' ms, 10x slowed', x + 6, y + 23);
        });
        return c.toDataURL('image/png').split(',')[1];
    })()`);
}

/** The first of `sel` that a press on its middle lands on (a hero often stands over its flag). */
const firstUncovered = (sel) => `[...document.querySelectorAll('${sel}')].find(el => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2 + Math.min(10, r.height / 6);
    return document.elementFromPoint(x, y)?.closest('[data-token-id],[data-flag],[data-board-hero]') === el;
})`;

const SELECTORS = {
    token: `(() => { const d = globalThis.__fxDev; const t = d.everyToken().find(t => t.typeId === 'token_oak_tree'); return t && document.querySelector('[data-token-id="' + t.id + '"]'); })()`,
    enemy: `(() => { const t = globalThis.__fxDev.enemies()[0]; return t && document.querySelector('[data-token-id="' + t.id + '"]'); })()`,
    flag: firstUncovered('[data-flag]'),
    hero: firstUncovered('[data-board-hero]'),
    dockHero: `document.querySelector('[data-dock-hero]')`
};

/** Presses on the source, moves 40 px, samples the carried picture; returns the samples. */
async function pickUp(page, kind, { strip = null } = {}) {
    const src = await page.evaluate(`(() => {
        const el = ${SELECTORS[kind]};
        if (!el) return null;
        const r = el.getBoundingClientRect();
        // Press on an opaque bit: the middle of the box, nudged up for the tall ones.
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!src) return { kind, error: 'no source' };
    const press = { x: Math.round(src.x), y: Math.round(src.y + Math.min(10, src.h / 6)) };
    await page.mouse('mouseMoved', press.x, press.y);
    await sleep(30);
    // Sample in the page, every frame, from just before the press.
    await page.evaluate(`(() => {
        window.__pf = [];
        // What the press lands on, and where it stands the moment it is pressed (a hero may be walking).
        { const e = document.elementFromPoint(${press.x}, ${press.y})?.closest('[data-token-id],[data-flag],[data-board-hero],[data-dock-hero]');
          const s = e.getBoundingClientRect();
          const what = ['data-token-type', 'data-flag', 'data-board-hero', 'data-dock-hero'].find(a => e.hasAttribute(a));
          window.__pfSource = { x: s.left + s.width / 2, y: s.top + s.height / 2, pressed: what + '=' + e.getAttribute(what) }; }
        const t0 = performance.now();
        const step = () => {
            const el = document.querySelector('[data-pickup-flight]');
            if (el) { const r = el.getBoundingClientRect(); window.__pf.push({ t: Math.round(performance.now() - t0), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width) }); }
            if (performance.now() - t0 < 600) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        return true;
    })()`);
    await page.mouse('mousePressed', press.x, press.y, { button: 'left', buttons: 1, clickCount: 1 });
    const t0 = Date.now();
    const frames = [];
    const times = [];
    // Close: round the press, at 2x. Wide: from the window's corner to the press, small, so a flight
    // from that corner shows.
    const clip = strip === 'wide'
        ? { x: 0, y: 0, width: Math.min(W, press.x + 150), height: Math.min(H, press.y + 110), scale: 0.35 }
        : { x: Math.max(0, press.x - 150), y: Math.max(0, press.y - 110), width: 300, height: 180, scale: 1 };
    let moved = false;
    for (let i = 0; i < (strip ? 12 : 1); i++) {
        if (strip) {
            const shot = await page.send('Page.captureScreenshot', { format: 'png', clip });
            frames.push(shot.data);
            times.push(Date.now() - t0);
        }
        if (!moved) {
            for (let k = 1; k <= 4; k++) await page.mouse('mouseMoved', press.x + 10 * k, press.y, { button: 'left', buttons: 1 });
            moved = true;
        }
    }
    await sleep(400);
    const samples = await page.evaluate('window.__pf');
    const to = { x: press.x + 40, y: press.y };
    await page.mouse('mouseMoved', press.x, press.y, { button: 'left', buttons: 1 });
    await sleep(50);
    await page.mouse('mouseReleased', press.x, press.y, { button: 'left', buttons: 0, clickCount: 1 });
    await sleep(800);
    if (strip) save(`${label}_${kind}_${strip}.png`, await stitch(page, frames, times, strip === 'wide' ? { k: 1, per: 4 } : {}));
    const first = samples[0];
    Object.assign(src, await page.evaluate('window.__pfSource'));
    return {
        kind, pressed: src.pressed, source: { x: Math.round(src.x), y: Math.round(src.y) }, cursor: to,
        first, firstOffFromSource: first && Math.round(Math.hypot(first.x - src.x, first.y - src.y)),
        samples: samples.slice(0, 14).map(s => `${s.t}ms:(${s.x},${s.y})`).join(' ')
    };
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
    await page.evaluate(`import('/src/ui/dev/animationDev.js').then(m => { globalThis.__fxDev = globalThis.__fxDev || m; return m.setUpAnimationScene(); })`);
    await sleep(4000);
    // The flight takes 80 ms, quicker than stills can be taken: every animation plays at a tenth of
    // its speed here, so the stills show it. Where the first frame stands does not change.
    await page.send('Animation.enable');
    await page.send('Animation.setPlaybackRate', { playbackRate: SLOW });
    for (const kind of ['token', 'enemy', 'flag', 'hero', 'dockHero']) {
        const r = await pickUp(page, kind, { strip: kind === 'dockHero' ? null : 'close' });
        console.log(label, JSON.stringify(r));
        await sleep(500);
        // Straight after, as the heroes may soon knock the goblins out.
        if (kind === 'enemy' || kind === 'hero') {
            const w = await pickUp(page, kind, { strip: 'wide' });
            if (w.error) console.log(label, 'wide', kind, w.error);
            await sleep(500);
        }
    }
    if (page.consoleErrors.length) console.log(label, 'page errors:', page.consoleErrors.slice(0, 5));
} finally {
    await chrome.close();
}
