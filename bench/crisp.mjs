// Fantasy Guild sprite crispness check (`npm run bench:crisp`): does anything animating on the
// mat change how the Tokens that stand still are drawn? (T-145: Tokens twitched and went soft.)
//
//   npm run bench:crisp                  perf build, S2, every case
//   npm run bench:crisp -- --dev         the dev build (no build step)
//   npm run bench:crisp -- --neuter      both guards switched off in the page (the mat's
//                                        `will-change: contents`, hidden name labels not painted):
//                                        shows the fault (exits 1); `--neuter=mat` or `=labels` one
//   npm run bench:crisp -- --scene=cap128 --no-build --keep=<dir>   another board; keep the shots
//
// How: the board is built, settled and FROZEN (the game loop stopped, the running animations
// left to finish), so nothing moves on its own. Two screenshots at rest pick the still Tokens: those
// drawn identically in both. Then each case starts ONE of the game's own animations behind the
// Tokens (on the back-most Token, where every Token drawn after it is in front), screenshots, and
// stops it. A case passes when no still Token away from it changes a pixel. Chrome's composited
// layers are counted beside it (the mechanism: an animation on the compositor splits every sprite
// drawn after it onto "overlap" layers, which Chrome draws resampled at fractional offsets).
// Sharp is checked against the art itself, on the still Tokens nothing else is drawn over (no other
// Token's art, hero or flag reaches into the middle of theirs): one is "exact" when at least 98 % of
// the opaque pixels in the middle of its art are on screen exactly where nearest-neighbour sampling
// of its picture puts them. It fails when fewer are exact during a case than at rest, or when the
// rest itself leaves more than 5 % of them soft.
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
    const a = { dev: false, build: true, neuter: [], scene: 'S2', settleS: 10, keep: null, width: 1600, height: 1000 };
    for (const arg of argv) {
        const [k, ...rest] = arg.replace(/^--/, '').split('=');
        const v = rest.join('=');
        switch (k) {
            case 'dev': a.dev = true; break;
            case 'no-build': a.build = false; break;
            case 'neuter': {
                const parts = v ? v.split(',') : ['mat', 'labels'];
                for (const n of parts) if (!['mat', 'labels'].includes(n)) throw new Error(`--neuter: mat, labels or both, not ${n}`);
                a.neuter = parts;
                break;
            }
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

/** The art's picture, decoded once per URL: { w, h, data (RGBA) }. */
const pictures = new Map();
async function picture(url) {
    if (!pictures.has(url)) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        const sharp = require('sharp');
        const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
        pictures.set(url, { w: info.width, h: info.height, data });
    }
    return pictures.get(url);
}

/**
 * The share of a Token's opaque art pixels drawn exactly where nearest-neighbour sampling of its
 * picture puts them. `t.r` is the sprite's on-screen box (fractional); a screen pixel shows the
 * texel under its centre. A centre that falls on a texel edge may show either neighbour.
 */
function exactShare(shot, t, pic) {
    // Chrome snaps the sprite's box to whole mat units before the mat's scale, so the box it
    // draws can sit up to a pixel from the one the page reports: try the phases in between.
    let best = 0;
    for (let dy = -1; dy <= 1; dy += 0.25) {
        for (let dx = -1; dx <= 1; dx += 0.25) {
            const share = exactShareAt(shot, { ...t.r, left: t.r.left + dx, top: t.r.top + dy }, pic);
            if (share != null && share > best) best = share;
            if (best >= 0.999) return best;
        }
    }
    return best;
}

function exactShareAt(shot, r, pic) {
    const { left, top, width, height } = r;
    // the middle 60 % of the art: the Token's own bubbles sit round its edges
    const x0 = left + width * 0.2, x1 = left + width * 0.8, y0 = top + height * 0.2, y1 = top + height * 0.8;
    const sx = pic.w / width, sy = pic.h / height;
    let total = 0, exact = 0;
    const texel = (tx, ty) => {
        if (tx < 0 || ty < 0 || tx >= pic.w || ty >= pic.h) return null;
        const q = (ty * pic.w + tx) * 4;
        return pic.data[q + 3] === 255 ? (pic.data[q] << 16) | (pic.data[q + 1] << 8) | pic.data[q + 2] : null;
    };
    for (let py = Math.ceil(y0); py < Math.floor(y1); py++) {
        const fy = (py + 0.5 - top) * sy, ty = Math.floor(fy), ey = fy - ty;
        for (let px = Math.ceil(x0); px < Math.floor(x1); px++) {
            const fx = (px + 0.5 - left) * sx, tx = Math.floor(fx), ex = fx - tx;
            const want = texel(tx, ty);
            if (want == null) continue;
            total++;
            const p = (py * shot.width + px) * 4;
            const got = (shot.raw[p] << 16) | (shot.raw[p + 1] << 8) | shot.raw[p + 2];
            if (got === want) { exact++; continue; }
            const edge = [[ex < 0.03 ? -1 : 0, 0], [ex > 0.97 ? 1 : 0, 0], [0, ey < 0.03 ? -1 : 0], [0, ey > 0.97 ? 1 : 0]];
            if (edge.some(([dx, dy]) => (dx || dy) && texel(tx + dx, ty + dy) === got)) exact++;
        }
    }
    return total ? exact / total : null;
}
const EXACT = 0.98;

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
        console.log(`${server.build} build, ${scene.name}, ${chrome.info.product}${args.neuter.length ? `, NEUTERED: ${args.neuter.join(' and ')}` : ''}`);
        const page = await openBoard(chrome, sceneUrl(server.url, scene), { cpu: 1, stress: scene.stress });
        await page.send('LayerTree.enable');
        let layers = 0;
        page.on('LayerTree.layerTreeDidChange', (p) => { layers = (p.layers || []).filter(l => l.drawsContent).length; });

        if (args.neuter.includes('mat')) await page.evaluate(`(document.querySelector('[data-board-origin]').style.willChange = 'auto', true)`);
        await sleep(args.settleS * 1000);
        // Labels made later (a spawn) keep their own visibility; the board is frozen below.
        if (args.neuter.includes('labels')) await page.evaluate(`(document.querySelectorAll('[data-token-name]').forEach(el => { el.style.visibility = 'visible'; }), true)`);
        await page.evaluate('(window.__perf.game.GameLoop.stop(), true)');
        await sleep(4500);   // a floater lasts 3 s; slides, hops and flashes less

        const tokens = await page.evaluate(`(() => {
          const others = [...document.querySelectorAll('[data-token-art="true"] img, [data-board-hero], [data-flag]')].map(o => ({ o, r: o.getBoundingClientRect() }));
          return [...document.querySelectorAll('[data-token-art="true"]')].map(el => {
            const img = el.querySelector('img');
            if (!img || el.querySelector('[data-token-hit-live]')) return null;
            const r = img.getBoundingClientRect();
            if (r.width < 20 || r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return null;
            // A resting or flashing Token is tinted by a filter: its colours are not its picture's.
            let tinted = false;
            for (let n = img; n && n !== el.parentElement; n = n.parentElement) if (getComputedStyle(n).filter !== 'none') tinted = true;
            const m = { l: r.left + r.width * 0.2, t: r.top + r.height * 0.2, r: r.right - r.width * 0.2, b: r.bottom - r.height * 0.2 };
            const covered = others.some(({ o, r: q }) => o !== img && q.width > 0 && q.left < m.r && m.l < q.right && q.top < m.b && m.t < q.bottom);
            return { id: el.dataset.tokenId, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
                r: { left: r.left, top: r.top, width: r.width, height: r.height }, src: img.currentSrc || img.src, tinted, covered };
          }).filter(Boolean);
        })()`);
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
        const judged = [];
        for (const t of still.filter(t => !t.tinted && !t.covered)) judged.push({ t, pic: await picture(t.src) });
        const exactIn = (shot) => judged.filter(({ t, pic }) => (exactShare(shot, t, pic) ?? 0) >= EXACT).length;
        const restExact = exactIn(rest1);
        if (process.env.CRISP_DEBUG) {
            const shares = judged.map(({ t, pic }) => ({ id: t.id, x: Math.round(t.r.left), y: Math.round(t.r.top), share: exactShare(rest1, t, pic) }));
            console.log(JSON.stringify(shares.sort((a, b) => a.share - b.share).map(s => `${s.share.toFixed(2)}@${s.x},${s.y}`)));
        }
        console.log(`at rest ${restExact} of the ${judged.length} uncovered still Tokens are drawn exactly to their art`);

        const rows = [];
        for (const c of CASES) {
            await page.evaluate(c.start);
            await sleep(700);
            const shot = await screenshot(page, args.keep && path.join(args.keep, `${c.id}.png`));
            const caseLayers = layers;
            await page.evaluate(c.stop);
            const changed = still.filter(t => !samePixels(artPixels(rest1, t), artPixels(shot, t)));
            rows.push({ id: c.id, what: c.what, changed: changed.length, exact: exactIn(shot), layers: caseLayers });
            await sleep(700);
        }
        const restAgain = await screenshot(page, args.keep && path.join(args.keep, 'rest-end.png'));
        const drift = still.filter(t => !samePixels(artPixels(rest1, t), artPixels(restAgain, t))).length;

        console.log('');
        console.log('case      still Tokens changed   drawn exactly   composited layers   what');
        for (const r of rows) {
            console.log(`${r.id.padEnd(9)} ${String(r.changed).padStart(4)} of ${String(still.length).padEnd(14)} ${String(r.exact).padStart(4)} of ${String(judged.length).padEnd(6)} ${String(r.layers).padStart(3)} (rest ${restLayers})      ${r.what}`);
        }
        console.log(`rest at the end: ${drift} changed`);
        // A Token or two may be brushed by a case's own movement or a hero's frame; the fault moves
        // most of them.
        const allowed = Math.max(2, Math.round(still.length * 0.05));
        const failed = rows.filter(r => r.changed > allowed || r.exact < restExact - allowed);
        if (drift > allowed) throw new Error(`the board was not still (${drift} Tokens changed at rest)`);
        const soft = judged.length - restExact;
        const softAtRest = soft > Math.max(2, Math.round(judged.length * 0.05));
        if (failed.length) console.log(`\nCHANGED: ${failed.map(r => r.id).join(', ')} changed how still Tokens are drawn`);
        if (softAtRest) console.log(`\nSOFT: at rest ${soft} still Tokens are not drawn exactly to their art`);
        if (!failed.length && !softAtRest) console.log('\nok: still Tokens are drawn exactly to their art, and no animation changes that');
        return failed.length || softAtRest ? 1 : 0;
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
