// Fantasy Guild sprite crispness check (`npm run bench:crisp`): does anything animating on the
// mat change how the Tokens that stand still are drawn? (Tokens twitched and went soft.)
//
//   npm run bench:crisp                  perf build, S2, every case
//   npm run bench:crisp -- --dev         the dev build (no build step)
//   npm run bench:crisp -- --neuter      both guards switched off in the page (`will-change:
//                                        contents` on the animations among the resting Tokens,
//                                        hidden name labels not painted): shows the fault (exits
//                                        1); `--neuter=anims` or `--neuter=labels` for one
//   npm run bench:crisp -- --scene=cap128 --no-build --keep=<dir>   another board (a plain one or an
//                                        envelope scene); keep the shots
//   npm run bench:crisp -- --window=1920x1080   another window (1600×1000 by default); the mat's fit
//                                        follows (S2: 1200x770 fit 0.55, 1600x1000 0.76,
//                                        1920x1080 0.83, 2060x1266 1.00)
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
// Then floor loot itself: an item is thrown and watched through a whole bob (`bob`), and again with
// reduced motion (`hold`). The art must keep one shape (the same pixels off its picture in every
// shot), the shadow stay in one place, 2 art pixels right of the art, and the art stand 1 to 4
// whole art pixels above where it rests (held 3 with reduced motion).
// Exit codes: 0 every still Token exact and unchanged, the loot as it should float · 1 a case changed
// them, one is soft, or the loot is not · 3 the check failed.
// ⚠️ Pixels compare only within one run (one machine, one Chrome); nothing is kept between runs.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { launchChrome, sleep, runCleanups } from './browser/cdp.mjs';
import { startDevServer, startPerfServer, buildPerf } from './browser/servers.mjs';
import { sceneFor, sceneUrl, openBoard } from './browser/scenes.mjs';
import { ENVELOPE_SCENE_NAMES } from './browser/drawLib.mjs';

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
                const scene = sceneFor(v);
                if (!scene || (scene.ui && !scene.probe)) throw new Error(`--scene: one of the plain boards (S1, S2, S3, cap128, camp128, cap256) or ${ENVELOPE_SCENE_NAMES}, not ${v}`);
                a.scene = scene.id;
                break;
            }
            case 'settle': a.settleS = Number(v); break;
            case 'window': {
                const [w, h] = v.split('x').map(Number);
                if (!(w > 0) || !(h > 0)) throw new Error(`--window: WIDTHxHEIGHT, not ${v}`);
                a.width = w;
                a.height = h;
                break;
            }
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
 * after the stop. `mainThread`: the game plays it on the main thread (`will-change: contents`), so it
 * may add no composited layer: at a fit of 1 a layer more moves no pixel, but at every other fit it
 * draws what comes after it resampled. Where the game has a path the page can reach, the case takes it (a real
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
        what: 'an enemy walking (its box\'s transform glide, a screen pixel a jump, as walkerGlide steps it)',
        start: `(() => { const box = [...document.querySelectorAll('[data-token-art="true"]')].find(el => /translate\\(/.test(el.style.transform || '')); if (!box) return false; box.dataset.crispCase = 'true'; box.dataset.crispWas = box.style.transform; const fit = Number(document.querySelector('[data-board-scale]').dataset.boardScale); box.style.transition = 'transform ${LONG}ms steps(' + Math.ceil(24 * fit * devicePixelRatio) + ', start)'; const r = box.getBoundingClientRect(); box.style.transform = box.style.transform + ' translate(24px, 0px)'; return { x: r.left - 48, y: r.top - 48, w: r.width + 96, h: r.height + 96 }; })()`,
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
        id: 'flag',
        mainThread: true,
        what: 'a flag fading (its own opacity transition, to the 30 % of a drag) on the back-most flag',
        start: `(() => { const f = [...document.querySelectorAll('[data-flag]')].sort((a, b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0))[0]; if (!f) return false; f.dataset.crispCase = 'true'; f.dataset.crispWas = f.style.transitionDuration; f.style.transitionDuration = '${LONG}ms'; f.classList.add('opacity-30'); const r = f.getBoundingClientRect(); return { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 }; })()`,
        stop: `(() => { const f = document.querySelector('[data-crisp-case]'); f.style.transitionDuration = '0ms'; f.classList.remove('opacity-30'); getComputedStyle(f).opacity; f.style.transitionDuration = f.dataset.crispWas; delete f.dataset.crispCase; delete f.dataset.crispWas; return true; })()`
    },
    {
        id: 'limp',
        mainThread: true,
        what: 'a hero going limp (the filter fade on its art, MatHero\'s LIMP_FILTER) on the back-most hero',
        start: `(() => { const h = [...document.querySelectorAll('[data-board-hero]')].sort((a, b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0))[0]; const art = h && h.querySelector(':scope > div.w-full.h-full'); if (!art) return false; art.dataset.crispCase = 'true'; art.dataset.crispWas = art.style.filter; art.style.transitionDuration = '${LONG}ms'; art.style.filter = 'grayscale(0.7) brightness(0.8) sepia(0.25)'; const a = h.getBoundingClientRect(), b = (art.querySelector('img') || art).getBoundingClientRect(); const x = Math.min(a.left, b.left) - 24, y = Math.min(a.top, b.top) - 24; return { x, y, w: Math.max(a.right, b.right) + 24 - x, h: Math.max(a.bottom, b.bottom) + 24 - y }; })()`,
        stop: `(() => { const el = document.querySelector('[data-crisp-case]'); el.style.transitionDuration = '0ms'; el.style.filter = el.dataset.crispWas; getComputedStyle(el).filter; el.style.transitionDuration = ''; delete el.dataset.crispCase; delete el.dataset.crispWas; return true; })()`
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
        mainThread: true,
        judgesHero: true,
        what: 'a hero walking (its box\'s transform glide, a screen pixel a jump, as walkerGlide steps it), the hero itself judged',
        start: `(() => { const h = (window.__crispHero && document.querySelector('[data-board-hero="' + window.__crispHero + '"]')) || [...document.querySelectorAll('[data-board-hero]')].pop(); if (!h) return false; h.dataset.crispCase = 'true'; h.dataset.crispWas = h.style.transform || ''; const fit = Number(document.querySelector('[data-board-scale]').dataset.boardScale); h.style.transition = 'transform ${LONG}ms steps(' + Math.ceil(24 * fit * devicePixelRatio) + ', start)'; const r = h.getBoundingClientRect(); h.style.transform = (h.style.transform || '') + ' translate(24px, 0px)'; return { x: r.left - 48, y: r.top - 48, w: r.width + 96, h: r.height + 96 }; })()`,
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
    return { raw, width: info.width, height: info.height };
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
// The walking hero itself
// ---------------------------------------------------------------------------

/** The still portrait the judged hero is given: one picture to judge it by, whatever its frame. */
const HERO_STILL_SPRITE = 'hm_cleric_por';

/**
 * Give hero `id` the still portrait, and say where it is drawn: its picture, its box on screen and
 * whether it faces left (drawn mirrored). Null when it is not drawn as a still picture.
 */
const HERO_STILL = (id) => `(async () => {
    const G = window.__perf.game;
    const hero = G.GameState.state.heroes.find(h => h.id === ${JSON.stringify(id)});
    if (!hero) return null;
    const was = hero.spriteId;
    hero.spriteId = '${HERO_STILL_SPRITE}';
    G.EventBus.publish('heroes_updated', {});
    await new Promise(r => setTimeout(r, 500));
    const box = document.querySelector('[data-board-hero="' + ${JSON.stringify(id)} + '"]');
    const img = box && box.querySelector('img');
    if (!img || box.querySelector('[data-hero-row]')) return { was, drawn: false };
    const r = img.getBoundingClientRect();
    const outer = img.parentElement.parentElement;
    return { was, drawn: true, src: img.currentSrc || img.src, left: r.left, top: r.top, size: r.width, flipped: /scaleX\\(-1\\)/.test(outer.style.transform) };
})()`;
const HERO_BACK = (id, was) => `(() => { const G = window.__perf.game; const hero = G.GameState.state.heroes.find(h => h.id === ${JSON.stringify(id)}); if (hero) { hero.spriteId = ${JSON.stringify(was)}; G.EventBus.publish('heroes_updated', {}); } return true; })()`;

/** A picture mirrored left to right (a hero facing left). */
function mirrored(pic) {
    const data = Buffer.alloc(pic.data.length);
    for (let y = 0; y < pic.h; y++) {
        for (let x = 0; x < pic.w; x++) pic.data.copy(data, (y * pic.w + x) * 4, (y * pic.w + (pic.w - 1 - x)) * 4, (y * pic.w + (pic.w - 1 - x)) * 4 + 4);
    }
    return { w: pic.w, h: pic.h, data };
}

/**
 * How crisply a hero's still picture is drawn on a screenshot: the share of its core pixels (the
 * middle band of the figure, clear of the work plate at its feet and anything over its head, two
 * pixels in from any edge of its art) that show one of its picture's own colours. Drawn pixel for
 * texel (at any phase, even a row off) every one does; resampled on the compositor, the colours
 * between texels blend into new ones. `dxMax`: how far right it may have walked, in pixels.
 */
function heroCrisp(shot, hero, pic, dxMax = 0) {
    const size = Math.round(hero.size);
    const per = size / pic.w;
    const opaque = (px, py) => px >= 0 && py >= 0 && px < size && py < size
        && pic.data[(Math.floor((py + 0.5) / per) * pic.w + Math.floor((px + 0.5) / per)) * 4 + 3] === 255;
    const band = insideOf(pic, size).filter(t => t.py >= size * 0.15 && t.py <= size * 0.7);
    const core = band.filter(t => {
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!opaque(t.px + dx, t.py + dy)) return false;
        return true;
    });
    const palette = new Set();
    for (let q = 0; q < pic.data.length; q += 4) if (pic.data[q + 3] === 255) palette.add((pic.data[q] << 16) | (pic.data[q + 1] << 8) | pic.data[q + 2]);
    const x0 = Math.round(hero.left), y0 = Math.round(hero.top);
    const at = findArt(shot, band, range(x0 - 3, x0 + 3 + dxMax), range(y0 - 3, y0 + 3));
    const inPalette = core.filter(t => palette.has(rgbAt(shot, at.x + t.px, at.y + t.py))).length;
    return { crisp: core.length ? inPalette / core.length : 0, exact: at.share, at: [at.x, at.y], pixels: core.length };
}

// ---------------------------------------------------------------------------
// Floor loot's bob: one shape, whole art pixels, its shadow still on the ground
// ---------------------------------------------------------------------------

/**
 * Throw one item on the floor for the bob checks: quantity 1 (no count badge over its shadow), one
 * the sprite generator made a hard shadow for and none of which lies on the floor (so it does not
 * slide into a pile), on a spot where nothing the mat draws over loot (work plates, fights, bubbles,
 * other loot) reaches its box, its bob or its shadow, and away from the items thrown before; bare
 * ground if there is any. Resolves to what `FIND_THROWN` needs, or a string saying why not.
 */
const THROW_FOR_BOB = `(async () => {
    const G = window.__perf.game;
    const man = await fetch('/_gen/sprite-fx/manifest.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!man) return 'no sprite-fx manifest';
    const keys = Object.keys(man.sprites).filter(k => k.startsWith('assets/items/') && !man.sprites[k].cols);
    const onFloor = new Set([...document.querySelectorAll('[data-item-sprite] img:not([data-sprite-shadow])')].map(i => decodeURI(new URL(i.src).pathname).replace(/^\\//, '')));
    let pick = null;
    for (const it of Object.values(G.getAllItems())) {
        if (!it || !it.id || it.equipSlot || typeof it.sprite !== 'string') continue;
        const key = keys.find(k => k.endsWith('/' + it.sprite + '.png'));
        if (key && !onFloor.has(key)) { pick = { id: it.id, key }; break; }
    }
    if (!pick) return 'no item with a shadow to throw';
    const mat = document.querySelector('[data-board-origin]');
    const s = Number(mat.dataset.boardScale);
    const m = mat.getBoundingClientRect();
    const w = Number(mat.dataset.naturalWidth), h = m.height / s;
    const art = Math.max(1, Math.round(2 * s));
    const size = 32 * art;
    const rectOf = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const shown = (el) => { const c = getComputedStyle(el); return c.visibility !== 'hidden' && c.display !== 'none' && Number(c.opacity) > 0; };
    // Over loot: what the mat's layers above the loot's draw, and other loot.
    const lootLayer = document.querySelector('[data-item-sprite]')?.parentElement;
    const lootZ = lootLayer ? Number(lootLayer.style.zIndex) || 0 : Infinity;
    const big = (q) => (q.r - q.l) * (q.b - q.t) > (m.width * m.height) / 4;
    const over = [];
    for (const el of mat.querySelectorAll('*')) {
        if (!(Number(el.style.zIndex) > lootZ)) continue;
        for (const leaf of [el, ...el.querySelectorAll('*')]) {
            const q = rectOf(leaf);
            if (q.r > q.l && q.b > q.t && !big(q) && shown(leaf)) over.push(q);
        }
    }
    for (const b of document.querySelectorAll('[data-item-sprite], [data-item-sprite] *')) over.push(rectOf(b));
    // Under it: Tokens, heroes, flags (bare ground first, so nothing dark sits by the shadow).
    const under = [...document.querySelectorAll('[data-token-art="true"] img, [data-board-hero], [data-flag]')].map(rectOf);
    const thrown = window.__crispThrown || (window.__crispThrown = []);
    const hit = (box, list) => list.some(q => box.l < q.r && q.l < box.r && box.t < q.b && q.t < box.b);
    const spots = [];
    for (let y = 120; y < h - 120; y += 24) {
        for (let x = 120; x < w - 120; x += 24) {
            const cx = m.left + x * s, cy = m.top + y * s;
            const box = { l: cx - size / 2 - 4, t: cy - size / 2 - 6 * art - 4, r: cx + size / 2 + 4 * art + 4, b: cy + size / 2 + 4 * art + 4 };
            if (box.l < 0 || box.t < 0 || box.r > innerWidth || box.b > innerHeight) continue;
            if (hit(box, over) || thrown.some(p => Math.hypot(p.sx - cx, p.sy - cy) < 3 * size)) continue;
            spots.push({ x, y, sx: cx, sy: cy, bare: !hit(box, under) });
        }
    }
    const spot = spots.find(p => p.bare) || spots[0];
    if (!spot) return 'no spot on screen clear of what is drawn over loot';
    thrown.push(spot);
    G.SpriteLayer.addSprite('item', pick.id, 1, { centre: { x: spot.x, y: spot.y } });
    return { key: pick.key, sx: spot.sx, sy: spot.sy, bare: spot.bare };
})()`;

/** The thrown item (its picture, nearest the spot): where its box rests, its art and its shadow's picture. */
const FIND_THROWN = (thrown) => `(() => {
    const want = ${JSON.stringify(thrown)};
    const artOf = (b) => b.querySelector('img:not([data-sprite-shadow])');
    const all = [...document.querySelectorAll('[data-item-sprite]')].filter(b => decodeURI(new URL(artOf(b).src).pathname).endsWith(want.key));
    const dist = (b) => { const q = b.getBoundingClientRect(); return Math.hypot(q.left + q.width / 2 - want.sx, q.top + q.height / 2 - want.sy); };
    const box = all.sort((a, b) => dist(a) - dist(b))[0];
    if (!box) return null;
    const img = artOf(box);
    const outer = img.parentElement.parentElement;
    const r = outer.getBoundingClientRect();
    const shadow = box.querySelector('[data-sprite-shadow]');
    const url = !shadow ? null : shadow.tagName === 'IMG' ? (shadow.currentSrc || shadow.src) : getComputedStyle(shadow).backgroundImage.replace(/^url\\("?|"?\\)$/g, '');
    return { left: r.left, top: r.top, size: r.width, art: img.currentSrc || img.src, shadow: url };
})()`;

/** A region of the screen as raw RGBA, with where it sits. */
async function screenshotClip(page, clip) {
    const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    const sharp = require('sharp');
    const { data: raw, info } = await sharp(Buffer.from(data, 'base64')).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    return { raw, width: info.width, height: info.height, x0: clip.x, y0: clip.y, png: data };
}

/**
 * The box pixels a sprite drawn `size` px across from picture `pic` paints with an opaque texel, each
 * with that texel's colour, left out the box's outer rows and columns: drawn at a fractional
 * position, Chrome blends the box's edge with what is behind. (Inside the box the sampling is
 * nearest-neighbour: an opaque texel next to a clear one leaves a hard edge.)
 */
function insideOf(pic, size) {
    const per = size / pic.w;
    const out = [];
    for (let py = 1; py < size - 1; py++) {
        for (let px = 1; px < size - 1; px++) {
            const q = (Math.floor((py + 0.5) / per) * pic.w + Math.floor((px + 0.5) / per)) * 4;
            if (pic.data[q + 3] === 255) out.push({ px, py, rgb: (pic.data[q] << 16) | (pic.data[q + 1] << 8) | pic.data[q + 2] });
        }
    }
    return out;
}

const rgbAt = (clip, x, y) => {
    if (x < 0 || y < 0 || x >= clip.width || y >= clip.height) return -1;
    const p = (y * clip.width + x) * 4;
    return (clip.raw[p] << 16) | (clip.raw[p + 1] << 8) | clip.raw[p + 2];
};

/**
 * Where the art is on a clip: of the candidate whole-pixel corners, the one where the most of its
 * pixels show exactly their texel's colour. With a whole number of screen pixels a texel, every
 * sub-pixel phase is one of these corners. `share` is how exactly it is drawn there (art drawn a
 * row short, pinched, matches at no corner), `misses` which of its pixels are not: its shape as
 * drawn, the same in every shot when only whole pixels move it.
 */
function findArt(clip, inside, xs, ys) {
    let best = { share: -1, x: 0, y: 0 };
    for (const y of ys) {
        for (const x of xs) {
            let exact = 0;
            for (const t of inside) if (rgbAt(clip, x + t.px, y + t.py) === t.rgb) exact++;
            const share = inside.length ? exact / inside.length : 0;
            if (share > best.share) best = { share, x, y };
        }
    }
    best.misses = new Set(inside.filter(t => rgbAt(clip, best.x + t.px, best.y + t.py) !== t.rgb).map(t => `${t.px},${t.py}`));
    best.pixels = inside.length;
    return best;
}

/**
 * Where the hard shadow (a solid black silhouette, under the art) is on a clip: of the candidate
 * corners, the one whose pixels the art leaves uncovered land on the most black ones less the
 * others (not a share: a corner that hides nearly all of it under the art matches the few left by
 * chance; not a count alone: a corner a pixel off takes in one more black and many more not).
 * `share` is how many of those it puts on black.
 */
function findShadow(clip, silInside, artMask, art, xs, ys) {
    let best = { share: -1, score: -Infinity, x: 0, y: 0 };
    for (const y of ys) {
        for (const x of xs) {
            let total = 0, black = 0;
            for (const t of silInside) {
                const cx = x + t.px, cy = y + t.py;
                if (artMask.has(`${cx - art.x},${cy - art.y}`)) continue;
                total++;
                if (rgbAt(clip, cx, cy) === 0) black++;
            }
            const share = total ? black / total : 0;
            const score = 2 * black - total;
            if (score > best.score) best = { share, score, x, y };
        }
    }
    return best;
}

/** Every box pixel a sprite's opaque texels paint, as "x,y" keys. */
function maskOf(pic, size) {
    const per = size / pic.w;
    const out = new Set();
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            if (pic.data[(Math.floor((py + 0.5) / per) * pic.w + Math.floor((px + 0.5) / per)) * 4 + 3] === 255) out.add(`${px},${py}`);
        }
    }
    return out;
}

const range = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/**
 * Screenshot the thrown item for `ms` and judge every shot: the art drawn exactly to its picture
 * (one shape), and where the art and its shadow are. `art` is one art pixel in screen pixels.
 * The art's lift is read against its shadow: the shadow stands on the ground 2 art pixels right
 * of and below where the art rests, so a lift is how far the art is above that.
 */
async function watchLoot(page, found, { art, ms, keepAs = null }) {
    const pic = await picture(found.art);
    const sil = found.shadow ? await picture(found.shadow) : null;
    const size = Math.round(found.size);
    const margin = 14 * art + 8;
    const clip = { x: Math.max(0, Math.round(found.left) - margin), y: Math.max(0, Math.round(found.top) - margin), width: size + 2 * margin, height: size + 2 * margin };
    const ax = Math.round(found.left) - clip.x, ay = Math.round(found.top) - clip.y;
    const xs = range(ax - 3, ax + 3), ys = range(ay - 12 * art - 4, ay + 4);
    const shots = [];
    const until = Date.now() + ms;
    while (Date.now() < until) shots.push(await screenshotClip(page, clip));
    const kept = new Set();
    const artInside = insideOf(pic, size);
    const artMask = maskOf(pic, size);
    const silInside = sil ? insideOf(sil, size) : null;
    return shots.map((shot) => {
        const a = findArt(shot, artInside, xs, ys);
        const s = sil ? findShadow(shot, silInside, artMask, a, range(a.x - 2, a.x + 4 * art + 2), range(a.y - 2, a.y + 8 * art + 2)) : null;
        // One picture of each way it was drawn.
        const seenAs = `${a.x}_${a.y}_${s ? `${s.x}_${s.y}` : 'none'}_${a.misses.size}`;
        if (keepAs && !kept.has(seenAs)) { kept.add(seenAs); fs.writeFileSync(`${keepAs}-${kept.size}_art${a.x}_${a.y}_shadow${s ? `${s.x}_${s.y}` : 'none'}_misses${a.misses.size}.png`, Buffer.from(shot.png, 'base64')); }
        return {
            artShare: a.share,
            artMisses: a.misses,
            artPixels: a.pixels,
            artAt: [a.x, a.y],
            shadowShare: s ? s.share : null,
            shadowAt: s ? [s.x, s.y] : null,
            gap: s ? [s.x - a.x, s.y - a.y] : null,
            lift: s ? (s.y - a.y - 2 * art) / art : null
        };
    });
}

/**
 * The verdict on a watched item. `bob`: it rises and sinks 1 to 4 whole art pixels (all four
 * reached), keeps one shape (the same pixels of its art drawn off its picture in every shot: where
 * an item rests can leave a pixel off at every height, a bob of part pixels moved it from height to
 * height), and its shadow stays in one place, 2 art pixels right of the art. `hold` (reduced motion):
 * one place, raised `hold` art pixels, the same. How exactly each is drawn to its picture is said,
 * not judged.
 */
function judgeLoot(seen, { art, hold = null }) {
    const fails = [];
    // Shapes: shots whose art is off its picture at the same pixels, give or take a stray pixel or
    // two (half a percent): a bob of part pixels moved whole rows from height to height.
    const shapes = [];
    for (const { artMisses: m, artPixels: n } of seen) {
        const near = (r) => [...m].filter(k => !r.has(k)).length + [...r].filter(k => !m.has(k)).length <= Math.max(2, n * 0.005);
        if (!shapes.some(near)) shapes.push(m);
    }
    if (shapes.length > 1) fails.push(`the art drawn in ${shapes.length} shapes`);
    const minArt = Math.min(...seen.map(s => s.artShare));
    if (seen.some(s => s.shadowShare == null)) {
        fails.push('no shadow drawn');
    } else {
        const places = new Set(seen.map(s => s.shadowAt.join(',')));
        if (places.size > 1) fails.push(`the shadow moved (${places.size} places)`);
        if (seen.some(s => s.gap[0] !== 2 * art || !Number.isInteger(s.lift))) fails.push('the shadow is not 2 whole art pixels right of the art, or the art not whole art pixels above it');
        const lifts = [...new Set(seen.map(s => s.lift))].sort((a, b) => a - b);
        if (hold != null) {
            if (lifts.length !== 1 || lifts[0] !== hold) fails.push(`held at ${lifts.join(', ')} art px, not ${hold}`);
        } else if (lifts.join(',') !== '1,2,3,4') {
            fails.push(`lifts ${lifts.map(l => (Number.isInteger(l) ? l : l.toFixed(2))).join(', ')} art px, not 1 to 4`);
        }
    }
    const lifts = [...new Set(seen.map(s => s.lift))].sort((a, b) => a - b);
    const gaps = [...new Set(seen.map(s => (s.gap ? s.gap.join('/') : '-')))];
    const line = `${seen.length} shots; art in ${shapes.length} shape(s), exact to its picture ${minArt.toFixed(2)} at worst; shadow in ${new Set(seen.map(s => (s.shadowAt ? s.shadowAt.join(',') : '-'))).size} place(s), exact ${seen.some(s => s.shadowShare == null) ? '-' : Math.min(...seen.map(s => s.shadowShare)).toFixed(2)} at worst; lifts ${lifts.map(l => (l == null ? '-' : Number.isInteger(l) ? l : l.toFixed(2))).join(', ')} art px; shadow gap right/down ${gaps.join(' ')} px`;
    return { fails, line };
}

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
        const scene = sceneFor(args.scene);
        console.log(`${server.build} build, ${scene.name}, ${chrome.info.product}${args.neuter.length ? `, NEUTERED: ${args.neuter.join(' and ')}` : ''}`);
        const page = await openBoard(chrome, sceneUrl(server.url, scene), { cpu: 1, stress: scene.stress, stressId: scene.stressId });
        const how = scene.ui ? await scene.ui(page) : null;
        if (how) console.log(how);
        // One art pixel of the mat in screen pixels: the art steps to a whole multiple of its size.
        const fit = await page.evaluate(`Number(document.querySelector('[data-board-scale]').dataset.boardScale)`);
        const artPx = Math.max(1, Math.round(2 * fit));
        console.log(`${args.width}×${args.height}: the mat at fit ${fit}, one art pixel ${artPx} screen px`);
        await page.send('LayerTree.enable');
        let layers = 0;
        page.on('LayerTree.layerTreeDidChange', (p) => { layers = (p.layers || []).filter(l => l.drawsContent).length; });

        // Every will-change on the mat back to auto (the per-animation guard, and P2-5's on the hit loops).
        if (args.neuter.includes('anims')) await page.evaluate(`(() => { const s = document.createElement('style'); s.textContent = '[data-board-origin], [data-board-origin] * { will-change: auto !important; }'; document.head.appendChild(s); return true; })()`);
        await sleep(args.settleS * 1000);
        // Labels made later (a spawn) keep their own visibility; the board is frozen below.
        if (args.neuter.includes('labels')) await page.evaluate(`(document.querySelectorAll('[data-token-name]').forEach(el => { el.style.visibility = 'visible'; }), true)`);
        // An envelope scene's page timers would keep changing the screen on a frozen board.
        await page.evaluate('(window.__perf.game.GameLoop.stop(), clearInterval(window.__benchTimer), clearInterval(window.__envSampler), true)');
        await sleep(4500);   // a floater lasts 3 s; slides, hops and flashes less

        // The hero the walking case judges: from the back, the first that, given a still portrait,
        // is drawn crisp at rest with nothing over its middle (no bubble, no hero in front).
        let judgedHero = null;
        const heroIds = await page.evaluate(`[...document.querySelectorAll('[data-board-hero]')].sort((a, b) => (Number(a.style.zIndex) || 0) - (Number(b.style.zIndex) || 0)).map(b => b.dataset.boardHero)`);
        for (const id of heroIds.slice(0, 4)) {
            const dressed = await page.evaluate(HERO_STILL(id));
            if (!dressed) continue;
            if (dressed.drawn) {
                const pic = await picture(dressed.src);
                const hero = { id, ...dressed, pic: dressed.flipped ? mirrored(pic) : pic };
                const atRest = heroCrisp(await screenshot(page), hero, hero.pic);
                if (atRest.crisp >= EXACT && atRest.pixels >= 100) { judgedHero = { ...hero, atRest }; break; }
            }
            await page.evaluate(HERO_BACK(id, dressed.was));
        }
        if (judgedHero) await page.evaluate(`(window.__crispHero = ${JSON.stringify(judgedHero.id)}, true)`);
        console.log(judgedHero
            ? `walking hero judged: ${judgedHero.id} as a still portrait, ${(judgedHero.atRest.crisp * 100).toFixed(1)} % of its ${judgedHero.atRest.pixels} core pixels in its own colours at rest`
            : 'walking hero: no hero drawn crisp at rest to judge (the case still counts Tokens and layers)');
        await sleep(1500);

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
        const exactIn = (shot, list = judged) => list.filter(({ t, pic }) => (exactShare(shot, t, pic) ?? 0) >= EXACT).length;
        const restExact = exactIn(rest1);
        const exactAtRest = new Set(judged.filter(({ t, pic }) => (exactShare(rest1, t, pic) ?? 0) >= EXACT).map(({ t }) => t.id));
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
            const hero = c.judgesHero && judgedHero ? heroCrisp(shot, judgedHero, judgedHero.pic, Math.ceil(24 * fit) + 2) : null;
            // A Token the case's own movement passes over is judged neither way (a walking hero may
            // come to stand over one).
            const clear = judged.filter(({ t }) => !(moved && overlaps(t, moved)));
            const exactBefore = clear.filter(({ t }) => exactAtRest.has(t.id)).length;
            rows.push({ id: c.id, what: c.what, changed: changed.length, exact: exactIn(shot), softened: exactBefore - exactIn(shot, clear.filter(({ t }) => exactAtRest.has(t.id))), layers: caseLayers, mainThread: !!c.mainThread, hero });
            await sleep(700 + (c.settleMs || 0));
        };
        for (const c of CASES) await runCase(c);
        const restAgain = await screenshot(page, args.keep && path.join(args.keep, 'rest-end.png'));
        const drift = still.filter(t => !samePixels(artPixels(rest1, t), artPixels(restAgain, t))).length;
        await runCase(LOOT_CASE);

        // Floor loot itself, across its bob and held by reduced motion (after the rest is judged:
        // what is thrown stays on the floor).
        const lootRows = [];
        // ⚠️ At some resting places Chrome draws an item a row or column off its picture, at every
        // height alike (a sprite at a fractional position; not the bob's doing). There the art is
        // found a pixel off at one corner or the other, its gap to the shadow reads a pixel out, and
        // the few pixels off come and go between shots. So an item is thrown again elsewhere, up to
        // four times, until one rests with not a pixel off its picture.
        const watchThrown = async (id, what, judge) => {
            let found = null;
            let tries = 0;
            for (; tries < 4; tries++) {
                const thrown = await page.evaluate(THROW_FOR_BOB);
                if (typeof thrown === 'string') { lootRows.push({ id, what, fails: [thrown], line: '' }); return; }
                await sleep(1200);   // the hop out of its Token is over
                found = await page.evaluate(FIND_THROWN(thrown));
                if (!found) { lootRows.push({ id, what, fails: ['the thrown item was not found on the floor'], line: '' }); return; }
                const first = await watchLoot(page, found, { art: artPx, ms: 1 });
                if (first[0].artMisses.size === 0) break;
            }
            const seen = await watchLoot(page, found, { art: artPx, ms: 2600, keepAs: args.keep && path.join(args.keep, id) });
            const verdict = judgeLoot(seen, { art: artPx, ...judge });
            lootRows.push({ id, what, ...verdict, line: `${verdict.line}${tries ? `; thrown ${Math.min(tries, 3) + 1} times for a resting place drawn exactly` : ''}` });
            if (args.verbose) console.log(id, JSON.stringify(seen));
        };
        await watchThrown('bob', 'an item on the floor bobbing: one shape, 1 to 4 whole art px, its shadow still', {});
        await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
        await watchThrown('hold', 'the same with reduced motion: held 3 art px up, one shape, its shadow still', { hold: 3 });
        await page.send('Emulation.setEmulatedMedia', { features: [] });

        console.log('');
        console.log('case      still Tokens changed   drawn exactly   composited layers   what');
        for (const r of rows) {
            console.log(`${r.id.padEnd(9)} ${String(r.changed).padStart(4)} of ${String(still.length).padEnd(14)} ${String(r.exact).padStart(4)} of ${String(judged.length).padEnd(6)} ${String(r.layers).padStart(3)} (rest ${restLayers})      ${r.what}`);
        }
        console.log(`rest at the end: ${drift} changed`);
        for (const r of rows) if (r.hero) console.log(`${r.id.padEnd(9)} the hero itself: ${(r.hero.crisp * 100).toFixed(1)} % of its core pixels in its own colours (at rest ${(judgedHero.atRest.crisp * 100).toFixed(1)} %), drawn at ${r.hero.at.join(',')}`);
        for (const r of lootRows) {
            console.log(`${r.id.padEnd(9)} ${r.fails.length ? 'FAILED' : 'ok'}: ${r.line}${r.fails.length ? `\n          ${r.fails.join('; ')}` : ''}`);
            console.log(`          ${r.what}`);
        }
        // A Token or two may be brushed by a case's own movement or a hero's frame; the fault moves
        // most of them.
        const allowed = Math.max(2, Math.round(still.length * 0.05));
        // Exactness is not noisy: with the guards on every uncovered still Token is exact.
        const failed = rows.filter(r => r.changed > allowed || r.softened > 0);
        const layered = rows.filter(r => r.mainThread && r.layers > restLayers);
        const softHero = rows.filter(r => r.hero && r.hero.crisp < EXACT);
        const soft = judged.length - restExact;
        const softAtRest = soft > 0;
        const lootFailed = lootRows.filter(r => r.fails.length);
        // Layers and the loot do not lean on the still Tokens: said even when the board moved.
        if (softHero.length && drift > allowed) console.log(`\nHERO: ${softHero.map(r => r.id).join(', ')} drew the walking hero resampled`);
        if (layered.length && drift > allowed) console.log(`\nLAYERED: ${layered.map(r => r.id).join(', ')} ran on the compositor (a composited layer more than at rest)`);
        if (lootFailed.length && drift > allowed) console.log(`\nLOOT: ${lootFailed.map(r => r.id).join(', ')} not drawn as an item floats`);
        if (drift > allowed) throw new Error(`the board was not still (${drift} Tokens changed at rest)`);
        if (failed.length) console.log(`\nCHANGED: ${failed.map(r => r.id).join(', ')} changed how still Tokens are drawn`);
        if (softAtRest) console.log(`\nSOFT: at rest ${soft} still Tokens are not drawn exactly to their art`);
        if (softHero.length) console.log(`\nHERO: ${softHero.map(r => r.id).join(', ')} drew the walking hero resampled`);
        if (layered.length) console.log(`\nLAYERED: ${layered.map(r => r.id).join(', ')} ran on the compositor (a composited layer more than at rest)`);
        if (lootFailed.length) console.log(`\nLOOT: ${lootFailed.map(r => r.id).join(', ')} not drawn as an item floats`);
        if (!failed.length && !layered.length && !softHero.length && !softAtRest && !lootFailed.length) console.log('\nok: still Tokens are drawn exactly to their art, no animation changes that, and floor loot floats in one shape over a still shadow');
        return failed.length || layered.length || softHero.length || softAtRest || lootFailed.length ? 1 : 0;
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
