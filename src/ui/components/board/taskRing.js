// The job areas: the ground round every job in progress toned like old parchment, fading out at
// the edge in whole art-pixel steps. No line is drawn: the area alone marks a job.

import { taskRingOf } from '../../../systems/board/jobArea.js';
import { ringTween, ringPxAt } from './growRing.js';
import { pixelRingCells } from './pixelRing.js';

export { taskRingOf, TASK_RING_PAD_PX } from '../../../systems/board/jobArea.js';

/**
 * The parchment tone, as layers drawn bottom to top over everything under the area: the colour
 * drained, a warm tint, a paper glow, a touch of shade. Each is `{ blend, fill, opacity }`, `blend`
 * a CSS `mix-blend-mode` (null: plain over).
 */
export const TASK_AREA_LAYERS = Object.freeze([
    Object.freeze({ blend: 'saturation', fill: '#808080', opacity: 1 }),
    Object.freeze({ blend: 'color', fill: '#b8925a', opacity: 0.75 }),
    Object.freeze({ blend: 'soft-light', fill: '#f3e2bf', opacity: 0.5 }),
    Object.freeze({ blend: null, fill: '#000', opacity: 0.1 })
]);

/** How many steps the area's edge fades in over, each weaker toward the outside. */
export const TASK_FADE_STEPS = 6;

/** How wide each fade step is, in whole art pixels. */
export const TASK_FADE_STEP_PX = 2;

/**
 * Every job in progress, one area per Token, sorted by Token id. A job is a Token standing on the
 * mat (not walking, not in the hand) with at least one hero standing beside it working it; a hero
 * still walking up is not counted yet. A stuck job keeps its area as it is: its "!" says it is stuck.
 * @param {{heroId: string, tokenId: string|null, x: number|null, y: number|null}[]} heroes
 *   as `MatBoard` lists them (`tokenId` only while working)
 * @param {{id: string, typeId: string, x: number|null, y: number}[]} tokens as `MatBoard` lists them
 * @param {{carriedId?: string|null, artScale: number}} options
 * @returns {{id: string, x: number, y: number, r: number}[]}
 */
export function taskJobsOf(heroes, tokens, { carriedId = null, artScale }) {
    const crews = new Map();
    let byId = null;
    for (const h of heroes) {
        if (!h.tokenId || h.x == null || h.y == null || h.tokenId === carriedId) continue;
        byId ??= new Map(tokens.map(t => [t.id, t]));
        const t = byId.get(h.tokenId);
        if (!t || t.x == null) continue;
        let crew = crews.get(t.id);
        if (!crew) crews.set(t.id, crew = { token: t, heroes: [] });
        crew.heroes.push({ x: h.x, y: h.y });
    }
    const out = [];
    for (const crew of crews.values()) out.push(taskRingOf(crew.token, crew.heroes, artScale));
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The jobs as one string: equal jobs, equal key, so a walking step changes nothing. */
export function taskJobsKey(jobs) {
    return jobs.map(j => `${j.id}@${j.x},${j.y},${j.r}`).join('|');
}

/**
 * A job's area on the art-pixel grid: its centre cell (as `snapToArt` picks it) and its radius in
 * art pixels.
 */
export function taskRingTarget(job, artScale) {
    return {
        id: job.id,
        cx: Math.round(job.x / artScale - 0.5),
        cy: Math.round(job.y / artScale - 0.5),
        px: Math.max(1, Math.round(job.r / artScale))
    };
}

const still = (px, now) => ({ from: px, to: px, at: now, ms: 0 });

/** No rings. */
export const NO_RINGS = Object.freeze([]);

function sameRings(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const p = a[i];
        const q = b[i];
        if (p.id !== q.id || p.px !== q.px || p.cx !== q.cx || p.cy !== q.cy) return false;
    }
    return true;
}

/**
 * The job areas as they grow and shrink, one per job, each with the reach ring's tween
 * (`growRing.js`: whole art pixels, `RING_GROW_MS` from nothing to full). Only the difference
 * between what is drawn and what is aimed at moves, so a burst of starts and ends (a catch-up, a
 * stalled tab) is one grow or shrink per ring, never a replay.
 * * `aim(targets, now, snap)`: the rings wanted now (`taskRingTarget`s). A new one grows from
 * nothing; one no longer wanted shrinks from wherever it is, its centre held; one wanted again
 * while shrinking grows back from there. A settled ring that only changes size or moves (a hero
 * joins, the mat's fit) jumps, as the reach ring does. `snap` jumps every ring to its end.
 * * `at(now)`: what to draw, `{ id, cx, cy, px }` with `px` above 0; the same array while
 * nothing changed. A ring that has shrunk away is forgotten.
 * * `moving(now)`: whether any ring is still growing or shrinking.
 */
export function createTaskRingSet() {
    const rings = new Map();
    let last = NO_RINGS;
    return {
        aim(targets, now, snap = false) {
            const wanted = new Set();
            for (const t of targets) {
                wanted.add(t.id);
                let r = rings.get(t.id);
                if (!r) {
                    r = { id: t.id, cx: t.cx, cy: t.cy, goal: 0, full: t.px, tween: still(0, now) };
                    rings.set(t.id, r);
                }
                r.cx = t.cx;
                r.cy = t.cy;
                if (t.px === r.goal) continue;
                const px = ringPxAt(r.tween, now);
                const resize = r.goal > 0 && px === r.goal;
                r.goal = t.px;
                r.full = t.px;
                r.tween = snap || resize ? still(t.px, now) : ringTween(px, t.px, t.px, now);
            }
            for (const r of rings.values()) {
                if (wanted.has(r.id) || r.goal === 0) continue;
                const px = ringPxAt(r.tween, now);
                r.goal = 0;
                r.tween = snap ? still(0, now) : ringTween(px, 0, r.full, now);
            }
        },
        at(now) {
            const out = [];
            for (const r of rings.values()) {
                const px = ringPxAt(r.tween, now);
                if (px > 0) out.push({ id: r.id, cx: r.cx, cy: r.cy, px });
                else if (r.goal === 0) rings.delete(r.id);
            }
            if (sameRings(out, last)) return last;
            last = out.length ? out : NO_RINGS;
            return last;
        },
        moving(now) {
            for (const r of rings.values()) if (r.tween.ms > 0 && now < r.tween.at + r.tween.ms) return true;
            return false;
        }
    };
}

const diskCache = new Map();

/**
 * The cells inside a circle of `px` art pixels, by row: `dy → [first dx, last dx]`, taken from the
 * pixel ring's own cells (`pixelRingCells`), so an area is as round as the reach ring.
 */
export function diskRows(px) {
    let rows = diskCache.get(px);
    if (rows) return rows;
    rows = new Map();
    for (const [x, y] of pixelRingCells(px)) {
        const span = rows.get(y);
        if (!span) rows.set(y, [x, x]);
        else {
            if (x < span[0]) span[0] = x;
            if (x > span[1]) span[1] = x;
        }
    }
    diskCache.set(px, rows);
    return rows;
}

/**
 * Every art-pixel cell inside any of `rings` (`{ cx, cy, px }`), each cell once however many rings
 * cover it: `row → [[x0, x1], …]`, runs sorted and never touching. Where areas overlap the ground
 * is toned once.
 */
export function dimRuns(rings) {
    const rows = new Map();
    for (const r of rings) {
        for (const [dy, [x0, x1]] of diskRows(r.px)) {
            const y = r.cy + dy;
            let runs = rows.get(y);
            if (!runs) rows.set(y, runs = []);
            runs.push([r.cx + x0, r.cx + x1]);
        }
    }
    for (const [y, runs] of rows) {
        if (runs.length < 2) continue;
        runs.sort((a, b) => a[0] - b[0]);
        const merged = [runs[0]];
        for (let i = 1; i < runs.length; i++) {
            const top = merged[merged.length - 1];
            if (runs[i][0] <= top[1] + 1) top[1] = Math.max(top[1], runs[i][1]);
            else merged.push(runs[i]);
        }
        rows.set(y, merged);
    }
    return rows;
}

/** Rows of runs (`row → [[x0, x1], …]`) as one SVG path in art-pixel units from the mat's corner: one rectangle per run. */
export function runsPath(rows) {
    let d = '';
    for (const [y, runs] of rows) {
        for (const [x0, x1] of runs) d += `M${x0} ${y}h${x1 - x0 + 1}v1h${x0 - x1 - 1}z`;
    }
    return d;
}

const NO_RUNS = Object.freeze([]);

/** The cells two sorted, never-touching run lists share. */
function intersectRuns(a, b) {
    const out = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        const lo = Math.max(a[i][0], b[j][0]);
        const hi = Math.min(a[i][1], b[j][1]);
        if (lo <= hi) out.push([lo, hi]);
        if (a[i][1] < b[j][1]) i++;
        else j++;
    }
    return out;
}

/** The cells of the sorted run list `a` that are in none of `b`'s. */
function subtractRuns(a, b) {
    const out = [];
    let j = 0;
    for (const [x0, x1] of a) {
        let from = x0;
        while (j < b.length && b[j][1] < from) j++;
        let k = j;
        while (k < b.length && b[k][0] <= x1) {
            if (b[k][0] > from) out.push([from, b[k][0] - 1]);
            from = Math.max(from, b[k][1] + 1);
            k++;
        }
        if (from <= x1) out.push([from, x1]);
    }
    return out;
}

/**
 * The cells of `rows` with all four neighbours in it too: the shape worn away by one art pixel, as
 * a step of four-neighbour distance from the ground outside.
 * @param {Map<number, number[][]>} rows row → runs, sorted and never touching
 * @returns {Map<number, number[][]>}
 */
export function erodeRuns(rows) {
    const out = new Map();
    for (const [y, runs] of rows) {
        const up = rows.get(y - 1);
        const down = rows.get(y + 1);
        if (!up || !down) continue;
        const shrunk = [];
        for (const [x0, x1] of runs) if (x1 - x0 >= 2) shrunk.push([x0 + 1, x1 - 1]);
        const inner = intersectRuns(intersectRuns(shrunk, up), down);
        if (inner.length) out.set(y, inner);
    }
    return out;
}

/**
 * The area's edge fade: `steps` bands of `stepPx` art pixels each, from the outside in, then the
 * core. A cell's band is its four-neighbour distance from the ground outside, so where areas
 * overlap only the merged shape's outer edge fades. Bands never overlap one another or the core.
 * @param {Map<number, number[][]>} rows `dimRuns(rings)`
 * @param {number} [steps]
 * @param {number} [stepPx]
 * @returns {{ bands: Map<number, number[][]>[], core: Map<number, number[][]> }} `bands[0]` outermost
 */
export function fadeBands(rows, steps = TASK_FADE_STEPS, stepPx = TASK_FADE_STEP_PX) {
    const bands = [];
    let outer = rows;
    for (let k = 0; k < steps; k++) {
        let inner = outer;
        for (let i = 0; i < stepPx; i++) inner = erodeRuns(inner);
        const band = new Map();
        for (const [y, runs] of outer) {
            const left = subtractRuns(runs, inner.get(y) ?? NO_RUNS);
            if (left.length) band.set(y, left);
        }
        bands.push(band);
        outer = inner;
    }
    return { bands, core: outer };
}

/** How strong band `k` of {@link fadeBands} is, 0 to 1: even steps up to the core's 1. */
export const fadeStrength = (k, steps = TASK_FADE_STEPS) => (k + 1) / (steps + 1);
