// The task ring: a ring round every job in progress, the ground inside it dimmed and greyed.

import { artRadiusOf } from '../../../config/matGeometry.js';
import { HERO_HIT_PX, HERO_BOX_PX } from './boardConstants.js';
import { ringTween, ringPxAt } from './growRing.js';
import { pixelRingCells, pixelRingPath } from './pixelRing.js';

/** The ring's colour: the work green (`--color-gi-success`), which already means "working". */
export const TASK_RING_COLOUR = 'var(--color-gi-success)';

/** How bright the ground inside a ring stays: 1 untouched, 0 black. Tuned at the look. */
export const TASK_DIM_LIGHT = 0.6;

/** How much of the ground's colour inside a ring is drained to grey: 0 none, 1 all. Tuned at the look. */
export const TASK_DIM_GREY = 0.8;

/** The room a ring leaves round its Token and heroes: this share of its radius, then whole art pixels. */
export const TASK_RING_PAD = 0.1;
export const TASK_RING_PAD_PX = 2;

/**
 * One job's ring, in mat units: the circle round the box that holds the Token's body
 * (`artRadiusOf`) and each hero's box (`HERO_HIT_PX` × `HERO_BOX_PX` on their point), padded by
 * {@link TASK_RING_PAD} and {@link TASK_RING_PAD_PX}. Centred on the box, so a lone hero on one
 * side pulls the ring toward them and two heroes on both sides centre it on the Token.
 * @param {{id: string, x: number, y: number, typeId: string}} token
 * @param {{x: number, y: number}[]} heroes where each hero working it stands
 * @param {number} artScale mat units per art pixel
 * @returns {{id: string, x: number, y: number, r: number}}
 */
export function taskRingOf(token, heroes, artScale) {
    const body = artRadiusOf(token.typeId);
    let left = token.x - body;
    let right = token.x + body;
    let top = token.y - body;
    let bottom = token.y + body;
    for (const h of heroes) {
        left = Math.min(left, h.x - HERO_HIT_PX / 2);
        right = Math.max(right, h.x + HERO_HIT_PX / 2);
        top = Math.min(top, h.y - HERO_BOX_PX / 2);
        bottom = Math.max(bottom, h.y + HERO_BOX_PX / 2);
    }
    const r = (Math.hypot(right - left, bottom - top) / 2) * (1 + TASK_RING_PAD) + TASK_RING_PAD_PX * artScale;
    return { id: token.id, x: (left + right) / 2, y: (top + bottom) / 2, r };
}

/**
 * Every job in progress, one ring per Token, sorted by Token id. A job is a Token standing on the
 * mat (not walking, not in the hand) with at least one hero standing beside it working it
 * productively: a hero still walking up is not counted yet, and a stuck job (the Token in alert,
 * its hero idle) has no ring, as it had no green outline.
 * @param {{heroId: string, tokenId: string|null, stuck?: boolean, x: number|null, y: number|null}[]} heroes
 *   as `MatBoard` lists them (`tokenId` only while working)
 * @param {{id: string, typeId: string, x: number|null, y: number}[]} tokens as `MatBoard` lists them
 * @param {{carriedId?: string|null, artScale: number}} options
 */
export function taskJobsOf(heroes, tokens, { carriedId = null, artScale }) {
    const crews = new Map();
    let byId = null;
    for (const h of heroes) {
        if (!h.tokenId || h.stuck || h.x == null || h.y == null || h.tokenId === carriedId) continue;
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

/** A job's ring on the art-pixel grid: its centre cell (as `snapToArt` picks it) and its radius in art pixels. */
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
 * The task rings as they grow and shrink, one per job, each with the reach ring's tween
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
 * The cells inside a ring of `px` art pixels, by row: `dy → [first dx, last dx]`, taken from the
 * ring's own cells (`pixelRingCells`), so the dim ends exactly under the ring.
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
 * cover it: `row → [[x0, x1], …]`, runs sorted and never touching. Where rings overlap the ground
 * is dimmed once.
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

/** {@link dimRuns} as one SVG path in art-pixel units from the mat's corner: one rectangle per run. */
export function dimPath(rings) {
    let d = '';
    for (const [y, runs] of dimRuns(rings)) {
        for (const [x0, x1] of runs) d += `M${x0} ${y}h${x1 - x0 + 1}v1h${x0 - x1 - 1}z`;
    }
    return d;
}

const ringPathCache = new Map();

/** `pixelRingPath(px)`, kept: a growing ring passes through every radius, and rings share them. */
export function ringPathOf(px) {
    let d = ringPathCache.get(px);
    if (d === undefined) ringPathCache.set(px, d = pixelRingPath(px));
    return d;
}
