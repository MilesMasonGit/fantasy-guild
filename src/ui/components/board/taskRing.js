// The task ring: a ring round every job in progress, the ground inside it dimmed and greyed.

import { artRadiusOf } from '../../../config/matGeometry.js';
import { ringTween, ringPxAt } from './growRing.js';
import { pixelRingCells } from './pixelRing.js';
import { HERO_HIT_PX, HERO_BOX_PX } from './boardConstants.js';

/** The ring's colour: the work green (`--color-gi-success`), which already means "working". */
export const TASK_RING_COLOUR = 'var(--color-gi-success)';

/**
 * A stuck job's ring (its Token shows its "!"): the theme's warning amber, drawn as the green is,
 * over the same dimmed and greyed ground. Not the reach ring's gold.
 */
export const TASK_RING_STUCK_COLOUR = 'var(--color-gi-warning)';

/** How bright the ground inside a ring stays: 1 untouched, 0 black. Tuned at the look. */
export const TASK_DIM_LIGHT = 0.6;

/** How much of the ground's colour inside a ring is drained to grey: 0 none, 1 all. Tuned at the look. */
export const TASK_DIM_GREY = 0.8;

/** The room a ring leaves round its Token and heroes, in whole art pixels. Tuned at the look. */
export const TASK_RING_PAD_PX = 2;

/**
 * One job's ring, in mat units: it frames the Token and every hero working it whole. Each is a
 * box, the Token's body (`artRadiusOf`) and each hero's figure (`HERO_HIT_PX` by `HERO_BOX_PX`,
 * centred on where they stand, as `MatHero` draws it). The ring is centred on the middle of all
 * the boxes together, so one hero beside the Token puts it between the two and heroes on both
 * sides centre it on the Token; its radius reaches the farthest corner of any box, plus
 * {@link TASK_RING_PAD_PX}. About 54 art pixels round a one-cell Token and one hero at a
 * 1920 × 1080 window.
 * @param {{id: string, x: number, y: number, typeId: string}} token
 * @param {{x: number, y: number}[]} heroes where each hero working it stands
 * @param {number} artScale mat units per art pixel
 * @returns {{id: string, x: number, y: number, r: number}}
 */
export function taskRingOf(token, heroes, artScale) {
    const body = artRadiusOf(token.typeId);
    const boxes = [[token.x - body, token.y - body, token.x + body, token.y + body]];
    for (const h of heroes) {
        boxes.push([h.x - HERO_HIT_PX / 2, h.y - HERO_BOX_PX / 2, h.x + HERO_HIT_PX / 2, h.y + HERO_BOX_PX / 2]);
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const [l, t, r, b] of boxes) {
        left = Math.min(left, l);
        top = Math.min(top, t);
        right = Math.max(right, r);
        bottom = Math.max(bottom, b);
    }
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    let far = 0;
    for (const [l, t, r, b] of boxes) far = Math.max(far, Math.hypot(Math.max(x - l, r - x), Math.max(y - t, b - y)));
    return { id: token.id, x, y, r: far + TASK_RING_PAD_PX * artScale };
}

/**
 * Every job in progress, one ring per Token, sorted by Token id. A job is a Token standing on the
 * mat (not walking, not in the hand) with at least one hero standing beside it working it; a hero
 * still walking up is not counted yet. A job is `stuck` while its Token shows its "!" (`jobStuck`,
 * the problem mark's own test): it keeps its ring, in amber.
 * @param {{heroId: string, tokenId: string|null, jobStuck?: boolean, x: number|null, y: number|null}[]} heroes
 *   as `MatBoard` lists them (`tokenId` only while working)
 * @param {{id: string, typeId: string, x: number|null, y: number}[]} tokens as `MatBoard` lists them
 * @param {{carriedId?: string|null, artScale: number}} options
 * @returns {{id: string, x: number, y: number, r: number, stuck: boolean}[]}
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
        if (!crew) crews.set(t.id, crew = { token: t, heroes: [], stuck: false });
        crew.heroes.push({ x: h.x, y: h.y });
        if (h.jobStuck) crew.stuck = true;
    }
    const out = [];
    for (const crew of crews.values()) out.push({ ...taskRingOf(crew.token, crew.heroes, artScale), stuck: crew.stuck });
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The jobs as one string: equal jobs, equal key, so a walking step changes nothing. */
export function taskJobsKey(jobs) {
    return jobs.map(j => `${j.id}@${j.x},${j.y},${j.r}${j.stuck ? '!' : ''}`).join('|');
}

/**
 * A job's ring on the art-pixel grid: its centre cell (as `snapToArt` picks it), its radius in art
 * pixels, and whether it is stuck.
 */
export function taskRingTarget(job, artScale) {
    return {
        id: job.id,
        cx: Math.round(job.x / artScale - 0.5),
        cy: Math.round(job.y / artScale - 0.5),
        px: Math.max(1, Math.round(job.r / artScale)),
        stuck: !!job.stuck
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
        if (p.id !== q.id || p.px !== q.px || p.cx !== q.cx || p.cy !== q.cy || p.stuck !== q.stuck) return false;
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
 * joins, the mat's fit) jumps, as the reach ring does. `snap` jumps every ring to its end. A ring
 * turning stuck or unstuck changes colour at once, whatever its size is doing.
 * * `at(now)`: what to draw, `{ id, cx, cy, px, stuck }` with `px` above 0; the same array while
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
                    r = { id: t.id, cx: t.cx, cy: t.cy, stuck: false, goal: 0, full: t.px, tween: still(0, now) };
                    rings.set(t.id, r);
                }
                r.cx = t.cx;
                r.cy = t.cy;
                r.stuck = !!t.stuck;
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
                if (px > 0) out.push({ id: r.id, cx: r.cx, cy: r.cy, px, stuck: r.stuck });
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
 * The outer edge of the rings' dim ({@link dimRuns}) all together: every cell of it with a side
 * (not only a corner) on ground outside it. Around a lone ring that is exactly its pixel ring
 * (`pixelRingCells`, for every radius), so a ring alone looks as it always has; where rings cross,
 * the arcs that would run inside the shared dim are not part of it.
 * @param {Map<number, number[][]>} rows `dimRuns(rings)`
 * @returns {Map<number, number[][]>} row → runs, sorted and never touching
 */
export function edgeRuns(rows) {
    const edge = new Map();
    for (const [y, runs] of rows) {
        const up = rows.get(y - 1) ?? NO_RUNS;
        const down = rows.get(y + 1) ?? NO_RUNS;
        const out = [];
        for (const [x0, x1] of runs) {
            // Inside: dim on all four sides. A run's two ends never are (runs never touch).
            const inner = x1 - x0 >= 2 ? intersectRuns(intersectRuns([[x0 + 1, x1 - 1]], up), down) : NO_RUNS;
            for (const run of subtractRuns([[x0, x1]], inner)) out.push(run);
        }
        edge.set(y, out);
    }
    return edge;
}

/** The dim's cells that are not on its edge ({@link edgeRuns}): what lies inside the rings. */
export function insideRuns(rows, edge) {
    const inside = new Map();
    for (const [y, runs] of rows) {
        const out = subtractRuns(runs, edge.get(y) ?? NO_RUNS);
        if (out.length) inside.set(y, out);
    }
    return inside;
}

/**
 * Each ring's part of the outer edge ({@link edgeRuns}): the edge cells inside its own disc, which
 * are all its own pixel ring's cells. One path per ring id ({@link runsPath}'s form), empty for a
 * ring wholly inside another. A cell where two rings cross is in both.
 * @param {{id: string, cx: number, cy: number, px: number}[]} rings
 * @param {Map<number, number[][]>} edge
 * @returns {Map<string, string>}
 */
export function ringEdgePaths(rings, edge) {
    const out = new Map();
    for (const r of rings) {
        let d = '';
        for (const [dy, [x0, x1]] of diskRows(r.px)) {
            const y = r.cy + dy;
            const runs = edge.get(y);
            if (!runs) continue;
            for (const [a, b] of intersectRuns(runs, [[r.cx + x0, r.cx + x1]])) d += `M${a} ${y}h${b - a + 1}v1h${a - b - 1}z`;
        }
        out.set(r.id, d);
    }
    return out;
}
