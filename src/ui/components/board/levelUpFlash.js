import { subscribeLevelUps } from './levelUpFeed.js';
import { pixelRingCells } from './pixelRing.js';
import { isDrawingPaused } from './frameClock.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';

/**
 * The level-up flash: glowing rings spread out from the hero one after another, fading as they
 * grow, and a shower of pixel sparkles, as the level-up float appears (`levelUpFloats.js`). A small
 * flash every 5 levels, a big one at the majors. Picked from the screenshot page
 * (`docs/active/research/levelup_flash/`, tile D), whose table these numbers are.
 * One-shot and UI memory only: a flash is held here from its level-up until it has played, drawn by
 * `LevelUpFlashLayer.jsx`. None while drawing is paused (a minimised window) or the player asked for
 * less motion, and none for the level-ups of time away: the catch-up summary tells those.
 * All sizes in art pixels, times in ms.
 */

/** The game's golds and white (`--color-gi-gold`, `--color-gi-gold-pale`): a canvas cannot read CSS variables. */
export const FLASH_GOLD = '#fbbf24';
export const FLASH_PALE = '#fde68a';
export const FLASH_WHITE = '#ffffff';

/** A ring's glow: the next lighter colour. */
const LIGHTER = { [FLASH_GOLD]: FLASH_PALE, [FLASH_PALE]: FLASH_WHITE, [FLASH_WHITE]: FLASH_PALE };

/** The levels that get the big flash; every other multiple of {@link SMALL_FLASH_EVERY} gets the small one. */
export const BIG_FLASH_LEVELS = Object.freeze([10, 25, 50, 75, 99]);
export const SMALL_FLASH_EVERY = 5;

/**
 * The two flashes. `rings`: `count` rings to radius `R`, each starting `staggerMs` after the one
 * before and growing from nothing to `R` in a straight line over `growMs`, gone when it gets there.
 * `sparkles`: `count` sparkles in `colours` (taken in turn), spread evenly round the hero, each
 * launched as the first ring passes `fromShare` of `R` plus a fixed stagger of up to `jitterMs`,
 * flying out to `R + reach` plus up to `spread`. `stars`: which open as the 9-cell star rather than
 * the 5-cell plus (`half`: every other one, `most`: two in three).
 */
export const LEVEL_UP_FLASH = Object.freeze({
    small: Object.freeze({
        rings: Object.freeze({ count: 3, R: 56, growMs: 480, staggerMs: 120, colours: Object.freeze([FLASH_GOLD, FLASH_PALE, FLASH_WHITE]) }),
        sparkles: Object.freeze({
            count: 16, colours: Object.freeze([FLASH_GOLD, FLASH_PALE, FLASH_WHITE]),
            fromShare: 0.3, reach: 4, spread: 16, stars: 'half', jitterMs: 200
        })
    }),
    big: Object.freeze({
        rings: Object.freeze({ count: 5, R: 96, growMs: 640, staggerMs: 110, colours: Object.freeze([FLASH_WHITE, FLASH_GOLD, FLASH_PALE, FLASH_GOLD, FLASH_WHITE]) }),
        sparkles: Object.freeze({
            count: 30, colours: Object.freeze([FLASH_GOLD, FLASH_PALE, FLASH_WHITE]),
            fromShare: 0.25, reach: 6, spread: 24, stars: 'most', jitterMs: 300
        })
    })
});

/** A ring's opacity as it grows: `[up to this share of R, opacity]`, in steps. */
export const RING_FADE = Object.freeze([[0.4, 1], [0.6, 0.75], [0.8, 0.5], [1, 0.25]]);
/** The glow either side of a ring line, as a share of the line's opacity. */
export const RING_GLOW = 0.5;
/** How long a sparkle takes to fly out (easing out). */
export const SPARKLE_FLY_MS = 450;
/** A sparkle's shapes from its launch: `[until ms, shape]`, null for nothing shown. */
export const SPARKLE_STEPS = Object.freeze([
    [150, 'star'], [300, 'plus'], [450, 'dot'], [520, null], [620, 'plus'], [720, 'dot'], [780, null], [860, 'dot']
]);

/** Cells of each shape round the sparkle's centre: `[dx, dy, tip]`, a tip in the lighter colour. */
const SHAPES = {
    star: [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [2, 0, 1], [-2, 0, 1], [0, 2, 1], [0, -2, 1]],
    plus: [[0, 0, 0], [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]],
    dot: [[0, 0, 0]]
};
/** A sparkle's tips: pale gold on white, gold on pale gold, pale gold on gold. */
const TIP = { [FLASH_GOLD]: FLASH_PALE, [FLASH_PALE]: FLASH_GOLD, [FLASH_WHITE]: FLASH_PALE };

/**
 * Which flash a level-up from `oldLevel` to `newLevel` gets: the biggest of the levels it passes,
 * or null for none.
 * @returns {'big'|'small'|null}
 */
export function flashSizeFor(oldLevel, newLevel) {
    if (!Number.isFinite(newLevel)) return null;
    const from = Number.isFinite(oldLevel) ? oldLevel : newLevel - 1;
    let size = null;
    for (let level = from + 1; level <= newLevel; level++) {
        if (BIG_FLASH_LEVELS.includes(level)) return 'big';
        if (level % SMALL_FLASH_EVERY === 0) size = 'small';
    }
    return size;
}

/** When a flash of `size` has finished playing, ms after it starts. */
export function flashEndMs(size) {
    const { rings, sparkles } = LEVEL_UP_FLASH[size];
    const ringsEnd = (rings.count - 1) * rings.staggerMs + rings.growMs;
    const sparklesEnd = rings.growMs * sparkles.fromShare + sparkles.jitterMs + SPARKLE_STEPS[SPARKLE_STEPS.length - 1][0];
    return Math.ceil(Math.max(ringsEnd, sparklesEnd));
}

/** How far out from the hero's centre a flash of `size` ever draws, shadows included. */
export function flashExtent(size) {
    const { rings, sparkles } = LEVEL_UP_FLASH[size];
    return Math.max(rings.R + 1, rings.R + sparkles.reach + sparkles.spread + 2) + 1;
}

/** A fixed hash in [0, 1): a flash's sparkles are spread the same way every time it is drawn. */
function hash(n) {
    let t = (n + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * What a flash of `size` shows `t` ms after it starts, in art pixels round the hero's centre cell:
 * `rings` as `{ r, alpha, colour, glow }` and `sparkles` as `{ x, y, colour }` cells. `seed` turns
 * the sparkles' spread, so two flashes differ.
 */
export function flashFrame(size, t, seed = 0) {
    const { rings, sparkles } = LEVEL_UP_FLASH[size];
    const outRings = [];
    for (let i = 0; i < rings.count; i++) {
        const k = t - i * rings.staggerMs;
        if (k < 0 || k >= rings.growMs) continue;
        const r = Math.round(rings.R * (k / rings.growMs));
        if (r < 2) continue;
        const alpha = RING_FADE.find(([upTo]) => r / rings.R <= upTo)[1];
        const colour = rings.colours[i % rings.colours.length];
        outRings.push({ r, alpha, colour, glow: LIGHTER[colour] });
    }
    const cells = [];
    const launch = rings.growMs * sparkles.fromShare;
    const turn = hash(seed * 7 + 3) * Math.PI * 2;
    for (let i = 0; i < sparkles.count; i++) {
        const h1 = hash(seed * 101 + i * 13 + 1);
        const h2 = hash(seed * 101 + i * 13 + 2);
        const h3 = hash(seed * 101 + i * 13 + 3);
        const k = t - launch - h3 * sparkles.jitterMs;
        if (k < 0) continue;
        const step = SPARKLE_STEPS.find(([until]) => k < until);
        if (!step || !step[1]) continue;
        const starred = sparkles.stars === 'half' ? i % 2 === 0 : sparkles.stars === 'most' ? i % 3 !== 2 : !!sparkles.stars;
        const shape = step[1] === 'star' && !starred ? 'plus' : step[1];
        const angle = turn + ((i + 0.5) / sparkles.count + ((h1 - 0.5) * 0.6) / sparkles.count) * Math.PI * 2;
        const r0 = rings.R * sparkles.fromShare;
        const r1 = rings.R + sparkles.reach + h2 * sparkles.spread;
        const f = Math.min(1, k / SPARKLE_FLY_MS);
        const r = r0 + (r1 - r0) * (1 - Math.pow(1 - f, 3));
        const x = Math.round(Math.cos(angle) * r);
        const y = Math.round(Math.sin(angle) * r);
        const colour = sparkles.colours[i % sparkles.colours.length];
        for (const [dx, dy, tip] of SHAPES[shape]) cells.push({ x: x + dx, y: y + dy, colour: tip ? TIP[colour] : colour });
    }
    return { rings: outRings, sparkles: cells };
}

const ringCache = new Map();
/** The cells of 720's pixel ring of radius `r`, kept: a flash draws the same few radii every time. */
export function ringCells(r) {
    let cells = ringCache.get(r);
    if (!cells) {
        cells = pixelRingCells(r);
        ringCache.set(r, cells);
    }
    return cells;
}

/**
 * Draw `flashFrame`'s frame on a 2D context, one canvas pixel per art pixel, the hero's centre cell
 * at (`cx`, `cy`). Each ring line and each sparkle cell over a black copy one art pixel down-right;
 * a ring's glow one pixel inside and outside its line.
 */
export function drawFlashFrame(g, frame, cx, cy) {
    for (const ring of frame.rings) {
        g.globalAlpha = ring.alpha;
        g.fillStyle = '#000';
        for (const [x, y] of ringCells(ring.r)) g.fillRect(cx + x + 1, cy + y + 1, 1, 1);
        g.globalAlpha = ring.alpha * RING_GLOW;
        g.fillStyle = ring.glow;
        for (const rr of [ring.r - 1, ring.r + 1]) for (const [x, y] of ringCells(rr)) g.fillRect(cx + x, cy + y, 1, 1);
        g.globalAlpha = ring.alpha;
        g.fillStyle = ring.colour;
        for (const [x, y] of ringCells(ring.r)) g.fillRect(cx + x, cy + y, 1, 1);
    }
    g.globalAlpha = 1;
    g.fillStyle = '#000';
    for (const c of frame.sparkles) g.fillRect(cx + c.x + 1, cy + c.y + 1, 1, 1);
    for (const c of frame.sparkles) {
        g.fillStyle = c.colour;
        g.fillRect(cx + c.x, cy + c.y, 1, 1);
    }
}

/* ---------- the flashes playing ---------- */

let flashes = Object.freeze([]);
let seeds = 0;
const listeners = new Set();
const emit = () => { for (const l of listeners) l(); };

/** Called whenever a flash starts or is let go. */
export function subscribeFlashes(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Every flash started and not yet let go: `{ id, heroId, size, at, seed }`, `at` on `performance.now()`. */
export function currentFlashes() {
    return flashes;
}

/**
 * Start a hero's flash for a level-up from `oldLevel` to `newLevel`, if it earns one. None while
 * drawing is paused or under reduced motion. A hero already flashing keeps theirs unless the new
 * one is bigger.
 * @returns the flash started, or null
 */
export function startFlash(heroId, oldLevel, newLevel, now = performance.now()) {
    const size = flashSizeFor(oldLevel, newLevel);
    if (!heroId || !size || isDrawingPaused() || prefersReducedMotion()) return null;
    const kept = flashes.filter(f => now - f.at < flashEndMs(f.size));
    const playing = kept.find(f => f.heroId === heroId);
    if (playing && !(size === 'big' && playing.size === 'small')) {
        if (kept.length !== flashes.length) { flashes = Object.freeze(kept); emit(); }
        return null;
    }
    seeds += 1;
    const flash = Object.freeze({ id: seeds, heroId, size, at: now, seed: seeds });
    flashes = Object.freeze([...kept.filter(f => f.heroId !== heroId), flash]);
    emit();
    return flash;
}

/** Let go of the flashes in `ids` (played out). */
export function dropFlashes(ids) {
    const next = flashes.filter(f => !ids.includes(f.id));
    if (next.length === flashes.length) return;
    flashes = Object.freeze(next);
    emit();
}

/** Forget every flash. */
export function clearAllFlashes() {
    if (!flashes.length) return;
    flashes = Object.freeze([]);
    emit();
}

// With the float: the same level-ups, heard the same way. A catch-up's are told by its summary.
subscribeLevelUps({
    onLevelUps: (rows, { catchUp }) => {
        if (catchUp) return;
        for (const row of rows) startFlash(row.heroId, row.oldLevel, row.newLevel);
    },
    onReset: clearAllFlashes
});
