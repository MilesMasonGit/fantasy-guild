// Fantasy Guild sprite crispness check (`npm run bench:crisp`): does anything animating on the
// mat change how the Tokens that stand still are drawn? (Tokens twitched and went soft.)
//
//   npm run bench:crisp                  perf build, S2, every case
//   npm run bench:crisp -- --dev         the dev build (no build step)
//   npm run bench:crisp -- --neuter      both guards switched off in the page (`will-change:
//                                        contents` on the animations among the resting Tokens,
//                                        hidden name labels not painted): shows the fault (exits
//                                        1); `--neuter=anims` or `--neuter=labels` for one
//   npm run bench:crisp -- --scene=cap128 --no-build --keep=<dir>   another board; keep the shots
//   --verbose                            each judged Token's share of exact pixels at rest
//
// How: the board is built, settled and FROZEN (the game loop stopped, the running animations
// left to finish), so nothing moves on its own. Screenshots for 2 s pick the still Tokens: those
// whose art is drawn the same in every one. Then each case starts ONE of the game's own animations
// where the game plays it (most on the back-most Token, so every other Token is drawn after it;
// a worked Token's -1, a walking hero and floor loot where they are drawn, in front), screenshots,
// and stops it. Two checks:
// * changed: a still Token away from the case whose art (its opaque texels; the faint ring at its
//   foot and the mat show through the rest) changed a pixel. A case may change 5 % of them (a hero's
//   frame, the case's own movement), no more.
// * exact: of the still Tokens nothing else is drawn over (no other Token's art, hero or flag reaches
//   into the middle of theirs), those with at least 98 % of the opaque pixels in the middle of the
//   art on screen exactly where nearest-neighbour sampling of the picture puts them. Every one must
//   be exact at rest and in every case.
// Chrome's composited layers are counted beside it: an animation on the compositor splits every
// sprite drawn after it onto "overlap" layers, and Chrome draws the board's sprites resampled.
// Exit codes: 0 every still Token exact and unchanged · 1 a case changed them or one is soft · 3 the check failed.
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
    const a = { dev: false, build: true, neuter: [], scene: 'S2', settleS: 10, keep: null, verbose: false, width: 1600, height: 1000 };
    for (const arg of argv) {
        const [k, ...rest] = arg.replace(/^--/, '').split('=');
        const v = rest.join('=');
        switch (k) {
            case 'dev': a.dev = true; break;
            case 'no-build': a.build = false; break;
            case 'neuter': {
                const parts = v ? v.split(',') : ['anims', 'labels'];
                for (const n of parts) if (!['anims', 'labels'].includes(n)) throw new Error(`--neuter: anims, labels or both, not ${n}`);
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
            case 'verbose': a.verbose = true; break;
            default: throw new Error(`unknown option --${k}`);
        }
    }
    return a;
}

// ---------------------------------------------------------------------------
// The cases: the game's own animations, where the game plays them
// ---------------------------------------------------------------------------

// The back-most Token's two boxes (art and badges): every other Token is drawn after them. It is
// at rest (a worked Token is drawn in front of every resting one).
const BACK = `(() => {
    const art = [...document.querySelectorAll('[data-token-art="true"]')]
        .sort((a, b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0))[0];
    const id = art.dataset.tokenId;
    return { id, type: art.dataset.tokenType, art, inner: art.querySelector(':scope > .w-full.h-full'),
        badges: document.querySelector('[data-token-overlay="' + id + '"]'), sprite: art.querySelector('[data-sprite-outline]') || art.querySelector('img') };
})()`;
const LONG = 4000;   // every case lasts longer than its screenshot is taken
const CHARGES = (who) => `(() => { const t = ${who}; if (!t) return false; window.__perf.game.EventBus.publish('board:token_charges_changed', { instanceId: t.id, delta: -1, remaining: 1, typeId: t.type }); return true; })()`;

/**
 * Each case: `start` (in the page; false skips the case on this board; a box {x, y, w, h} leaves
 * the still Tokens under the thing it moves out of the count), `stop`, and `settleMs`
 * after the stop. Where the game has a path the page can reach, the case takes it (a real
 * charges event draws the real -1 with the real props); otherwise it puts the game's own classes
 * where the game puts them, or (the spawn pop) does exactly what `spawnMotion.playSpawn` does.
 */
const CASES = [
    {
        id: 'floater',
        what: 'a -1 on the back-most Token (at rest): the real charges event',
        start: CHARGES(`(${BACK})`),
        stop: 'true',
        settleMs: 3000
    },
    {
        id: 'land',
        what: 'the landing hop (gi-token-land) on its sprite',
        start: `(() => { const { sprite } = ${BACK}; sprite.dataset.crispCase = 'true'; sprite.classList.add('gi-token-land'); sprite.style.animationDuration = '${LONG}ms'; return true; })()`,
        stop: `(() => { const el = document.querySelector('[data-crisp-case]'); el.classList.remove('gi-token-land'); el.style.animationDuration = ''; delete el.dataset.crispCase; return true; })()`
    },
    {
        id: 'flash',
        what: 'the art\'s filter flash (the Guild Hall taking in loot): its own classes',
        start: `(() => { const { inner } = ${BACK}; inner.dataset.crispCase = 'true'; inner.style.transitionDuration = '${LONG}ms'; inner.classList.add('brightness-125', 'saturate-125'); return true; })()`,
        stop: `(() => { const el = document.querySelector('[data-crisp-case]'); el.classList.remove('brightness-125', 'saturate-125'); el.style.transitionDuration = ''; delete el.dataset.crispCase; return true; })()`
    },
    {
        id: 'spawn',
        what: 'the spawn pop on both its boxes, as spawnMotion.playSpawn plays it',
        start: `(() => { const { art, badges } = ${BACK}; const kf = [{ transform: 'translate(-40px, -40px) scale(0.5)' }, { transform: 'translate(0px, 0px) scale(1)' }]; window.__crispCase = [art, badges].map(el => { const before = el.style.willChange; el.style.willChange = 'contents'; const a = el.animate(kf, { duration: ${LONG}, composite: 'add' }); a.oncancel = () => { el.style.willChange = before; }; return a; }); return true; })()`,
        stop: `(window.__crispCase?.forEach(a => a.cancel()), window.__crispCase = null, true)`
    },
    {
        id: 'walk',
        what: 'an enemy walking (its box\'s transform transition)',
        start: `(() => { const box = [...document.querySelectorAll('[data-token-art="true"]')].find(el => /translate\\(/.test(el.style.transform || '')); if (!box) return false; box.dataset.crispCase = 'true'; box.dataset.crispWas = box.style.transform; box.style.transition = 'transform ${LONG}ms linear'; const r = box.getBoundingClientRect(); box.style.transform = box.style.transform + ' translate(24px, 0px)'; return { x: r.left - 48, y: r.top - 48, w: r.width + 96, h: r.height + 96 }; })()`,
        stop: `(() => { const el = document.querySelector('[data-crisp-case]'); el.style.transition = 'none'; el.style.transform = el.dataset.crispWas; delete el.dataset.crispCase; delete el.dataset.crispWas; return true; })()`
    },
    {
        id: 'turn',
        what: 'turning into another Token (gi-transform-glow over it, gi-transform-flash on its art)',
        start: `(() => { const { art } = ${BACK}; const g = document.createElement('div'); g.id = 'crisp-case'; g.className = 'gi-transform-glow absolute inset-0 pointer-events-none'; g.style.animationDuration = '${LONG}ms'; art.appendChild(g); const hit = art.querySelector('[data-token-hit]:not([data-token-hit^="tok"])') || art.querySelector(':scope > div.flex > div'); hit.dataset.crispCase = 'true'; hit.classList.add('gi-transform-flash'); hit.style.animationDuration = '${LONG}ms'; return true; })()`,
        stop: `(() => { document.getElementById('crisp-case')?.remove(); const el = document.querySelector('[data-crisp-case]'); el.classList.remove('gi-transform-flash'); el.style.animationDuration = ''; delete el.dataset.crispCase; return true; })()`
    },
    {
        id: 'gear',
        what: 'a recipe gear pulsing (gi-gear-pulse) in its badges',
        start: `(() => { const { badges } = ${BACK}; const g = document.createElement('div'); g.id = 'crisp-case'; g.className = 'gi-gear-pulse absolute left-0 top-0'; g.style.cssText += 'width:28px;height:28px;background:#888'; badges.appendChild(g); return true; })()`,
        stop: `(document.getElementById('crisp-case')?.remove(), true)`
    },
    {
        id: 'worked',
        what: 'a -1 on a worked Token (left on the compositor: drawn in front of every resting Token)',
        start: CHARGES(`(() => { const el = [...document.querySelectorAll('[data-token-art][data-tile-staffed]')].pop(); return el && { id: el.dataset.tokenId, type: el.dataset.tokenType }; })()`),
        stop: 'true',
        settleMs: 3000
    },
    {
        id: 'hero',
        what: 'a hero walking (a transform transition on a hero, drawn above every Token)',
        start: `(() => { const h = [...document.querySelectorAll('[data-board-hero]')].pop(); if (!h) return false; h.dataset.crispCase = 'true'; h.dataset.crispWas = h.style.transform || ''; h.style.transition = 'transform ${LONG}ms linear'; const r = h.getBoundingClientRect(); h.style.transform = (h.style.transform || '') + ' translate(24px, 0px)'; return { x: r.left - 48, y: r.top - 48, w: r.width + 96, h: r.height + 96 }; })()`,
        stop: `(() => { const h = document.querySelector('[data-crisp-case]'); h.style.transition = 'none'; h.style.transform = h.dataset.crispWas; delete h.dataset.crispCase; delete h.dataset.crispWas; return true; })()`
    }
];

// Last, after the rest is checked again: real loot thrown on the floor (it stays there).
const LOOT_CASE = {
    id: 'loot',
    what: 'loot thrown on the floor and bobbing (drawn above every Token): SpriteLayer.addSprite',
    start: `(() => { const G = window.__perf.game; const item = Object.values(G.getAllItems()).find(i => i && i.id && !i.equipSlot); const { art } = ${BACK}; const mat = document.querySelector('[data-board-origin]'); const s = Number(mat.dataset.boardScale); const r = art.getBoundingClientRect(), m = mat.getBoundingClientRect(); G.SpriteLayer.addSprite('item', item.id, 2, { centre: { x: (r.left + r.width / 2 - m.left) / s, y: (r.bottom - m.top) / s + 60 } }); return true; })()`,
    stop: 'true'
};

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

/**
 * The screen pixels a Token's art paints whatever its drawing phase: those whose texel, and the
 * texels a pixel either side would show, are all opaque in its picture. The faint ring at a
 * Token's foot and the mat's surface show only through transparent texels, so they are left out.
 */
function artInterior(t, pic, width) {
    const { left, top, width: w, height: h } = t.r;
    const sx = pic.w / w, sy = pic.h / h;
    const opaque = (px, py) => {
        const tx = Math.floor((px + 0.5 - left) * sx), ty = Math.floor((py + 0.5 - top) * sy);
        return tx >= 0 && ty >= 0 && tx < pic.w && ty < pic.h && pic.data[(ty * pic.w + tx) * 4 + 3] === 255;
    };
    const out = [];
    for (let py = Math.ceil(top) + 1; py < Math.floor(top + h) - 1; py++) {
        for (let px = Math.ceil(left) + 1; px < Math.floor(left + w) - 1; px++) {
            if (opaque(px, py) && opaque(px - 1, py) && opaque(px + 1, py) && opaque(px, py - 1) && opaque(px, py + 1)) out.push((py * width + px) * 4);
        }
    }
    return out;
}

/** What a Token's art shows on screen, one number per pixel of its interior. */
function artPixels(shot, t) {
    const out = new Uint32Array(t.interior.length);
    t.interior.forEach((p, i) => { out[i] = (shot.raw[p] << 16) | (shot.raw[p + 1] << 8) | shot.raw[p + 2]; });
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

        // Every will-change on the mat back to auto (the per-animation guard, and P2-5's on the hit loops).
        if (args.neuter.includes('anims')) await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = '[data-board-origin], [data-board-origin] * { will-change: auto !important; }'; document.head.appendChild(s); return true; })()`);
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
        for (const t of candidates) t.interior = artInterior(t, await picture(t.src), rest1.width);
        candidates = candidates.filter(t => t.interior.length >= 100);
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
        if (args.verbose) {
            const shares = judged.map(({ t, pic }) => ({ id: t.id, x: Math.round(t.r.left), y: Math.round(t.r.top), share: exactShare(rest1, t, pic) }));
            console.log(JSON.stringify(shares.sort((a, b) => a.share - b.share).map(s => `${s.share.toFixed(2)}@${s.x},${s.y}`)));
        }
        console.log(`at rest ${restExact} of the ${judged.length} uncovered still Tokens are drawn exactly to their art`);

        const rows = [];
        const runCase = async (c) => {
            const started = await page.evaluate(c.start);
            if (!started) { console.log(`(${c.id}: nothing to animate on this board, skipped)`); return; }
            const moved = typeof started === 'object' ? started : null;
            await sleep(700);
            const shot = await screenshot(page, args.keep && path.join(args.keep, `${c.id}.png`));
            const caseLayers = layers;
            await page.evaluate(c.stop);
            const changed = still.filter(t => !(moved && overlaps(t, moved)) && !samePixels(artPixels(rest1, t), artPixels(shot, t)));
            rows.push({ id: c.id, what: c.what, changed: changed.length, exact: exactIn(shot), layers: caseLayers });
            await sleep(700 + (c.settleMs || 0));
        };
        for (const c of CASES) await runCase(c);
        const restAgain = await screenshot(page, args.keep && path.join(args.keep, 'rest-end.png'));
        const drift = still.filter(t => !samePixels(artPixels(rest1, t), artPixels(restAgain, t))).length;
        await runCase(LOOT_CASE);

        console.log('');
        console.log('case      still Tokens changed   drawn exactly   composited layers   what');
        for (const r of rows) {
            console.log(`${r.id.padEnd(9)} ${String(r.changed).padStart(4)} of ${String(still.length).padEnd(14)} ${String(r.exact).padStart(4)} of ${String(judged.length).padEnd(6)} ${String(r.layers).padStart(3)} (rest ${restLayers})      ${r.what}`);
        }
        console.log(`rest at the end: ${drift} changed`);
        // A Token or two may be brushed by a case's own movement or a hero's frame; the fault moves
        // most of them.
        const allowed = Math.max(2, Math.round(still.length * 0.05));
        // Exactness is not noisy: with the guards on every uncovered still Token is exact.
        const failed = rows.filter(r => r.changed > allowed || r.exact < restExact);
        if (drift > allowed) throw new Error(`the board was not still (${drift} Tokens changed at rest)`);
        const soft = judged.length - restExact;
        const softAtRest = soft > 0;
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
