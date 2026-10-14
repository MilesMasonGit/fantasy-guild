// Fantasy Guild sprite crispness check (`npm run bench:crisp`): does anything animating on the
// mat change how the Tokens that stand still are drawn? (T-145: Tokens twitched and went soft.)
//
//   npm run bench:crisp                  perf build, S2, every case
//   npm run bench:crisp -- --dev         the dev build (no build step)
//   npm run bench:crisp -- --neuter      the same with the mat's `will-change: contents` switched
//                                        off in the page: shows the fault (exits 1)
//   npm run bench:crisp -- --scene=cap128 --no-build --keep=<dir>   another board; keep the shots
//
// How: the board is built, settled and FROZEN (the game loop stopped, the running animations
// left to finish), so nothing moves on its own. Two screenshots at rest pick the still Tokens: those
// drawn identically in both. Then each case starts ONE of the game's own animations behind the
// Tokens (on the back-most Token, where every Token drawn after it is in front), screenshots, and
// stops it. A case passes when no still Token away from it changes a pixel. Chrome's composited
// layers are counted beside it (the mechanism: an animation on the compositor splits every sprite
// drawn after it onto "overlap" layers, which Chrome draws resampled at fractional offsets).
// Exit codes: 0 every case kept the Tokens as they were · 1 a case changed them · 3 the check failed.
// ⚠️ Pixels compare only within one run (one machine, one Chrome); nothing is kept between runs.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep, runCleanups } from './browser/cdp.mjs';
import { startDevServer, startPerfServer, buildPerf } from './browser/servers.mjs';
import { SCENES, sceneUrl, openBoard } from './browser/scenes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'package.json'));

function parseArgs(argv) {
    const a = { dev: false, build: true, neuter: false, scene: 'S2', settleS: 10, keep: null, width: 1600, height: 1000 };
    for (const arg of argv) {
        const [k, ...rest] = arg.replace(/^--/, '').split('=');
        const v = rest.join('=');
        switch (k) {
            case 'dev': a.dev = true; break;
            case 'no-build': a.build = false; break;
            case 'neuter': a.neuter = true; break;
            case 'scene': {
                const id = Object.keys(SCENES).find(s => s.toLowerCase() === v.toLowerCase());
                if (!id || SCENES[id].ui) throw new Error(`--scene: one of the plain boards (S1, S2, S3, cap128, camp128, cap256), not ${v}`);
                a.scene = id;
                break;
            }
            case 'settle': a.settleS = Number(v); break;
            case 'keep': a.keep = path.resolve(v); break;
            default: throw new Error(`unknown option --${k}`);
        }
    }
    return a;
}

// ---------------------------------------------------------------------------
// The cases: the game's own animations, each started on the back-most Token
// ---------------------------------------------------------------------------

// The back-most Token's two boxes (art and badges): every other Token is drawn after them.
const BACK = `(() => {
    const art = [...document.querySelectorAll('[data-token-art="true"]')]
        .sort((a, b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0))[0];
    const id = art.dataset.tokenId;
    return { art, badges: document.querySelector('[data-token-overlay="' + id + '"]'), sprite: art.querySelector('[data-sprite-outline]') || art.querySelector('img') };
})()`;
const LONG = 4000;   // every case lasts longer than its screenshot is taken

const CASES = [
    {
        id: 'floater',
        what: 'a -1 charge floater (gi-charge-float) in its badges',
        start: `(() => { const { badges } = ${BACK}; const d = document.createElement('div'); d.id = 'crisp-case'; d.className = 'gi-charge-float absolute left-0 bottom-0'; d.style.animationDuration = '${LONG}ms'; d.textContent = '-1'; badges.appendChild(d); return true; })()`,
        stop: `(document.getElementById('crisp-case')?.remove(), true)`
    },
    {
        id: 'land',
        what: 'the landing hop (gi-token-land) on its sprite',
        start: `(() => { const { sprite } = ${BACK}; sprite.dataset.crispCase = 'true'; sprite.style.animation = 'gi-token-land ${LONG}ms steps(1, end) both'; return true; })()`,
        stop: `(() => { const el = document.querySelector('[data-crisp-case]'); el.style.animation = ''; delete el.dataset.crispCase; return true; })()`
    },
    {
        id: 'flash',
        what: 'a filter flash (the Guild Hall taking in loot) on its art',
        start: `(() => { const { art } = ${BACK}; const el = art.querySelector(':scope > div.flex'); el.dataset.crispCase = 'true'; el.style.transition = 'filter ${LONG}ms linear'; el.style.filter = 'brightness(1.25) saturate(1.25)'; return true; })()`,
        stop: `(() => { const el = document.querySelector('[data-crisp-case]'); el.style.filter = ''; el.style.transition = ''; delete el.dataset.crispCase; return true; })()`
    },
    {
        id: 'spawn',
        what: 'the spawn pop (Web Animations transform) on both its boxes',
        start: `(() => { const { art, badges } = ${BACK}; const kf = [{ transform: 'translate(-40px, -40px) scale(0.5)' }, { transform: 'translate(0px, 0px) scale(1)' }]; window.__crispCase = [art, badges].map(el => el.animate(kf, { duration: ${LONG}, composite: 'add' })); return true; })()`,
        stop: `(window.__crispCase?.forEach(a => a.cancel()), window.__crispCase = null, true)`
    },
    {
        id: 'walk',
        what: 'a walking step (a transform transition, as an enemy walks) on its badges',
        start: `(() => { const { badges } = ${BACK}; const d = document.createElement('div'); d.id = 'crisp-case'; d.style.cssText = 'position:absolute;left:0;top:0;width:8px;height:8px;transition:transform ${LONG}ms linear'; badges.appendChild(d); d.getBoundingClientRect(); d.style.transform = 'translate(24px, 0px)'; return true; })()`,
        stop: `(document.getElementById('crisp-case')?.remove(), true)`
    },
    {
        id: 'loot',
        what: 'floor loot bobbing (gi-sprite-hover) in its badges',
        start: `(() => { const { badges } = ${BACK}; const d = document.createElement('span'); d.id = 'crisp-case'; d.className = 'gi-sprite-hover absolute left-0 top-0'; d.style.cssText = 'width:8px;height:8px'; badges.appendChild(d); return true; })()`,
        stop: `(document.getElementById('crisp-case')?.remove(), true)`
    }
];

// ---------------------------------------------------------------------------
// Pixels
// ---------------------------------------------------------------------------

async function screenshot(page, keepAs) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
    const png = Buffer.from(data, 'base64');
    if (keepAs) fs.writeFileSync(keepAs, png);
    const sharp = require('sharp');
    const { data: raw, info } = await sharp(png).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    return { raw, width: info.width };
}

/** The centre of a Token's art (its inner 60 %), as one number per pixel. */
function artPixels(shot, t) {
    const x0 = t.x + Math.round(t.w * 0.2), y0 = t.y + Math.round(t.h * 0.2);
    const w = Math.round(t.w * 0.6), h = Math.round(t.h * 0.6);
    const out = new Uint32Array(w * h);
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const p = ((y0 + j) * shot.width + x0 + i) * 4;
            out[j * w + i] = (shot.raw[p] << 16) | (shot.raw[p + 1] << 8) | shot.raw[p + 2];
        }
    }
    return out;
}

const samePixels = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---------------------------------------------------------------------------

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.keep) fs.mkdirSync(args.keep, { recursive: true });
    let server = null;
    let chrome = null;
    try {
        if (args.dev) server = await startDevServer();
        else {
            if (args.build) { console.log('building the perf build…'); buildPerf(); }
            server = await startPerfServer();
        }
        chrome = await launchChrome({ width: args.width, height: args.height });
        const scene = SCENES[args.scene];
        console.log(`${server.build} build, ${scene.name}, ${chrome.info.product}${args.neuter ? ', NEUTERED (the mat\'s will-change: contents switched off)' : ''}`);
        const page = await openBoard(chrome, sceneUrl(server.url, scene), { cpu: 1, stress: scene.stress });
        await page.send('LayerTree.enable');
        let layers = 0;
        page.on('LayerTree.layerTreeDidChange', (p) => { layers = (p.layers || []).filter(l => l.drawsContent).length; });

        if (args.neuter) await page.evaluate(`(document.querySelector('[data-board-origin]').style.willChange = 'auto', true)`);
        await sleep(args.settleS * 1000);
        await page.evaluate('(window.__perf.game.GameLoop.stop(), true)');
        await sleep(4500);   // a floater lasts 3 s; slides, hops and flashes less

        const tokens = await page.evaluate(`(() => [...document.querySelectorAll('[data-token-art="true"]')].map(el => {
            const img = el.querySelector('img');
            if (!img || el.querySelector('[data-token-hit-live]')) return null;
            const r = img.getBoundingClientRect();
            if (r.width < 20 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return null;
            return { id: el.dataset.tokenId, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
        }).filter(Boolean))()`);
        const backBox = await page.evaluate(`(() => { const { art, badges } = ${BACK}; const a = art.getBoundingClientRect(), b = badges.getBoundingClientRect(); const x = Math.min(a.left, b.left) - 48, y = Math.min(a.top, b.top) - 48; return { id: art.dataset.tokenId, x, y, w: Math.max(a.right, b.right) + 48 - x, h: Math.max(a.bottom, b.bottom) + 48 - y }; })()`);

        // Rest shots for 2 s (two loops of a hero's idle frames): a Token is still when it is drawn
        // the same in every one, and clear of the back-most Token, where the cases draw their own
        // movement.
        const rest1 = await screenshot(page, args.keep && path.join(args.keep, 'rest-1.png'));
        const restLayers = layers;
        let candidates = tokens.filter(t => t.id !== backBox.id && !overlaps(t, backBox));
        const restUntil = Date.now() + 2000;
        let restShots = 1;
        while (Date.now() < restUntil) {
            const again = await screenshot(page);
            restShots++;
            candidates = candidates.filter(t => samePixels(artPixels(rest1, t), artPixels(again, t)));
        }
        const still = candidates;
        console.log(`${tokens.length} Tokens on screen, ${still.length} still (the same in ${restShots} shots over 2 s); ${restLayers} composited layers at rest`);
        if (still.length < 10) throw new Error(`only ${still.length} still Tokens to watch: the board did not freeze`);

        const rows = [];
        for (const c of CASES) {
            await page.evaluate(c.start);
            await sleep(700);
            const shot = await screenshot(page, args.keep && path.join(args.keep, `${c.id}.png`));
            const caseLayers = layers;
            await page.evaluate(c.stop);
            const changed = still.filter(t => !samePixels(artPixels(rest1, t), artPixels(shot, t)));
            rows.push({ id: c.id, what: c.what, changed: changed.length, layers: caseLayers });
            await sleep(700);
        }
        const restAgain = await screenshot(page, args.keep && path.join(args.keep, 'rest-end.png'));
        const drift = still.filter(t => !samePixels(artPixels(rest1, t), artPixels(restAgain, t))).length;

        console.log('');
        console.log('case      still Tokens changed   composited layers   what');
        for (const r of rows) {
            console.log(`${r.id.padEnd(9)} ${String(r.changed).padStart(4)} of ${String(still.length).padEnd(14)} ${String(r.layers).padStart(3)} (rest ${restLayers})      ${r.what}`);
        }
        console.log(`rest at the end: ${drift} changed`);
        // A Token or two may be brushed by a case's own movement or a hero's frame; the fault moves
        // most of them.
        const allowed = Math.max(2, Math.round(still.length * 0.05));
        const failed = rows.filter(r => r.changed > allowed);
        if (drift > allowed) throw new Error(`the board was not still (${drift} Tokens changed at rest)`);
        console.log(failed.length ? `\nCHANGED: ${failed.map(r => r.id).join(', ')} moved Tokens that stand still` : '\nok: no animation changed how a still Token is drawn');
        return failed.length ? 1 : 0;
    } finally {
        if (chrome) await chrome.close();
        if (server) await server.close();
    }
}

main().then((code) => { runCleanups(); process.exit(code); }, (err) => {
    console.error(`bench:crisp failed: ${err.message}`);
    runCleanups();
    process.exit(3);
});
