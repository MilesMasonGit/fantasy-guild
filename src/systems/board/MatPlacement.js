// where a Token may stand on the free playmat

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { artRadiusOf, matW, matH, LARGEST_ART_RADIUS } from '../../config/matGeometry.js';
import { matTuning, onMatTuningChanged } from '../../config/matTuning.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import { distanceSq, nearRadius } from './nearby.js';
import * as BoardState from './BoardState.js';
import * as Restrictions from './Restrictions.js';

/**
 * A Token lands exactly where the player lets go: there are no tiles and nothing snaps. This file
 * is the whole answer to may a Token of this type stand at this point, and if not, where is the
 * nearest place it may?
 *
 * The three rules a spot has to pass:
 * 1. It fits on the mat: the art circle, not the hitbox, stays fully inside. A Token half off the
 * edge would be half unclickable, and the art is what the player sees.
 * 2. It is not crowding anything: centre to centre, against the invisible hitbox. See {@link
 * minGap}.
 * 3. It breaks no `Cannot` rule: a spot that would is simply not a spot, so the search carries on
 * past it rather than refusing the drop.
 *
 * ⚠️ This file decides, it does not act. Nothing here moves a Token, publishes an event or
 * transfers a charge. {@link dropAt} returns what should happen; `Placement.js` makes it happen and
 * announces it. That split is what lets the drag preview (`MatRings`) ask where would this land?
 * without placing anything.
 *
 * Mat units: 1 u = one natural board pixel, as everywhere else on the mat.
 */

/**
 * Float slack for a distance comparison, in squared mat units.
 *
 * Gaps are derived from percentages, so `61.2` is really `61.19999999999999`
 * often enough to matter. Without this a spot exactly at the limit would be
 * legal or illegal depending on which multiplication produced it, which is the
 * kind of thing that makes a drop feel random.
 */
const EPS = 1e-6;

/** Ring spacing of the nudge search, in mat units. */
const RING_STEP = 4;

/** Arc between candidates on a ring, in mat units — `n = ceil(2πd / ARC)`. */
const RING_ARC = 6;

/**
 * The invisible collision radius of a Token type: a percentage of its art radius, rounded to whole
 * mat units.
 *
 * ⚠️ The rounding is deliberate and load-bearing. Centres are whole numbers, and gaps are stated as
 * whole gaps (61 u between two small Tokens). Unrounded, `64 × 80% = 51.2` makes that gap `61.44`,
 * so two Tokens placed 61.4 u apart would be refused by four hundredths of a pixel nobody can see.
 * Rounded, the small hitbox is 51 u.
 */
export function hitRadiusOf(typeId) {
    return Math.round(artRadiusOf(typeId) * matTuning('hitboxPct') / 100);
}

/**
 * The smallest centre-to-centre distance two Token types may sit at: both hitboxes, less the
 * overlap the Mat Tuner allows. Read live, every time: a Mat Tuner change has to take effect on the
 * very next drop.
 */
export function minGap(typeA, typeB) {
    return (hitRadiusOf(typeA) + hitRadiusOf(typeB)) * (1 - matTuning('overlapPct') / 100);
}

/** How far a refused drop may be nudged before it flies back instead. */
export function nudgeReach() {
    return matTuning('nudgeReach');
}

/**
 * Whether a Token of `typeId` centred at `point` sits **fully on the mat** —
 * its art circle, so nothing is ever drawn half off the edge.
 */
export function insideMat(typeId, point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    const r = artRadiusOf(typeId);
    // ⚠️ The mat's size is read LIVE: the mat can be resized while the game runs, and a spot that
    // fitted a moment ago may not now.
    return point.x >= r && point.y >= r && point.x <= matW() - r && point.y <= matH() - r;
}

/**
 * The nearest point to `point` at which a Token of `typeId` sits fully on the mat: its art circle
 * inside every edge. Says nothing about neighbours.
 *
 * This is the first half of what a shrinking mat does to a stranded Token (`MatResize`): pull it
 * back inside the edge, then ask {@link findSpot} from there where it can actually stand. Whole mat
 * units, because Token centres are whole numbers everywhere else.
 */
export function clampInside(typeId, point) {
    const at = clampOnto(typeId, point);
    return { x: Math.round(at.x), y: Math.round(at.y) };
}

/** {@link clampInside} without the rounding — for the push's inner loop. */
function clampOnto(typeId, point) {
    const r = artRadiusOf(typeId);
    const w = matW();
    const h = matH();
    // A Token wider than the mat cannot be fully inside it at all; the middle is the least wrong
    // place for it. Defensive.
    return {
        x: w >= 2 * r ? Math.max(r, Math.min(w - r, point.x)) : w / 2,
        y: h >= 2 * r ? Math.max(r, Math.min(h - r, point.y)) : h / 2
    };
}

/** Whether a Token type carries any `Cannot` rule at all. */
function hasCannot(typeId) {
    return statementsWith(getTokenType(typeId), KEYWORD.CANNOT).length > 0;
}

/**
 * Neighbours too many to scan one by one are bucketed into square cells as wide as the widest gap
 * any of them could have (`largestGap`, already the bound used to prefilter them: no real
 * neighbour's own gap can exceed it). A neighbour closer than its own gap to `point` is therefore
 * never more than one cell away on either axis, so {@link clearOf} only has to look at the 3×3
 * cells round the candidate's own cell: same answer, far fewer comparisons. Below the threshold the
 * plain scan is already cheap, so nothing is bucketed.
 */
const BUCKET_THRESHOLD = 16;

function bucketNeighbours(neighbours, cell) {
    if (neighbours.length < BUCKET_THRESHOLD || !(cell > 0)) return null;
    // Column index → row index → bucket: a lookup builds no string, and every integer index is its
    // own key, so no two cells can collide.
    const cells = new Map();
    for (const n of neighbours) {
        const ix = Math.floor(n.x / cell);
        const iy = Math.floor(n.y / cell);
        let column = cells.get(ix);
        if (!column) cells.set(ix, column = new Map());
        let bucket = column.get(iy);
        if (!bucket) column.set(iy, bucket = []);
        bucket.push(n);
    }
    return cells;
}

/**
 * Everything one drop needs to know, worked out once before the search starts rather than per
 * candidate.
 *
 * A fully blocked drop tries on the order of a thousand candidate points. Doing the two expensive
 * things per candidate, scanning every Token on the mat and building `Restrictions`' projected
 * board view, would turn a crowded drop into a visible stutter. So neighbours are prefiltered once
 * to those close enough to block any candidate (`reach` + the largest gap this type can have), with
 * their gap pre-squared, and `Cannot` is gated once: if neither the Token being placed nor anything
 * within reach of the drop carries a `Cannot`, no candidate can break one, and the projected view
 * is never built at all.
 */
function contextFor(typeId, point, { excludeId = null, plan = null, reach = nudgeReach() } = {}) {
    const hit = hitRadiusOf(typeId);
    const largestHit = Math.round(LARGEST_ART_RADIUS * matTuning('hitboxPct') / 100);
    const largestGap = (hit + largestHit) * (1 - matTuning('overlapPct') / 100);

    // Anything further than this cannot reach a candidate, so it cannot block one.
    const blockSpan = reach + largestGap;
    const blockSpanSq = blockSpan * blockSpan;

    // The `Cannot` gate looks further: a rule is broken by what is NEAR a
    // candidate, and Near is its own (larger) radius.
    const cannotSpan = reach + nearRadius() + LARGEST_ART_RADIUS;
    const cannotSpanSq = cannotSpan * cannotSpan;

    // The mat edge, read once per search rather than once per candidate: `insideBounds` below uses
    // this instead of `insideMat` recomputing `artRadiusOf`/`matW`/`matH` every time.
    const bounds = { r: artRadiusOf(typeId), w: matW(), h: matH() };

    const neighbours = [];
    let cannotMatters = hasCannot(typeId);

    for (const other of BoardState.tokens()) {
        if (other.id === excludeId) continue;
        if (!Number.isFinite(other.x) || !Number.isFinite(other.y)) continue;
        const d2 = distanceSq(point, other);
        if (d2 <= blockSpanSq) {
            const gap = minGap(typeId, other.typeId);
            neighbours.push({ id: other.id, x: other.x, y: other.y, gapSq: gap * gap });
        }
        if (!cannotMatters && d2 <= cannotSpanSq && hasCannot(other.typeId)) cannotMatters = true;
    }

    const buckets = bucketNeighbours(neighbours, largestGap);
    return { typeId, neighbours, buckets, cell: largestGap, cannotMatters, plan, excludeId, reach, bounds };
}

/** {@link insideMat}, against bounds already read once for this search. */
function insideBounds(point, { r, w, h }) {
    return point.x >= r && point.y >= r && point.x <= w - r && point.y <= h - r;
}

/** The hot inner test: `point` against the prefiltered neighbour list. */
function clearOf(point, ctx) {
    return clearAt(point.x, point.y, ctx);
}

/** {@link clearOf} on bare coordinates, so a search need not build a point per candidate. */
function clearAt(x, y, ctx) {
    if (!ctx.buckets) {
        for (const n of ctx.neighbours) {
            const dx = x - n.x;
            const dy = y - n.y;
            if (dx * dx + dy * dy < n.gapSq - EPS) return false;
        }
        return true;
    }
    // Exact (see `bucketNeighbours`): only the 3×3 cells round the candidate
    // can hold a neighbour close enough to block it.
    const cx = Math.floor(x / ctx.cell);
    const cy = Math.floor(y / ctx.cell);
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
        const column = ctx.buckets.get(ix);
        if (!column) continue;
        for (let iy = cy - 1; iy <= cy + 1; iy++) {
            const bucket = column.get(iy);
            if (!bucket) continue;
            for (const n of bucket) {
                const dx = x - n.x;
                const dy = y - n.y;
                if (dx * dx + dy * dy < n.gapSq - EPS) return false;
            }
        }
    }
    return true;
}

/**
 * Whether a Token of `typeId` may stand at `point`: on the mat, clear of its neighbours, and
 * breaking no `Cannot` rule.
 *
 * @param {object} [options]
 * @param {string} [options.excludeId] a Token to ignore — itself, when moving
 * @param {object} [options.plan] what else the placement does (see `Restrictions.project`)
 */
export function isLegal(typeId, point, options = {}) {
    return legalIn(typeId, point, contextFor(typeId, point, { ...options, reach: 0 }));
}

function legalIn(typeId, point, ctx) {
    if (!insideBounds(point, ctx.bounds)) return false;
    if (!clearOf(point, ctx)) return false;
    if (!ctx.cannotMatters) return true;

    // ⚠️ Only reached when something in range actually carries a `Cannot`.
    // `checkPlacement` builds a whole projected board, so a drop with no
    // restriction anywhere near it must never get this far.
    const plan = { ...(ctx.plan || {}) };
    if (ctx.excludeId && plan.id == null) plan.id = ctx.excludeId;
    return Restrictions.checkPlacement(point, typeId, plan).ok === true;
}

/**
 * Searches that found nothing, remembered while nothing they read changed.
 *
 * A spawner with nowhere to land, a Foundation with no room to build and a recipe whose Token has
 * nowhere to go all ask the same failing question every tick until room appears. A search reads
 * only the board (which Tokens, where: `BoardState`'s membership counter and move journal), the Mat
 * Tuner (any change bumps `tuningGeneration`) and the Token registry (`registryVersion`). While all
 * three are exactly as they were, the same question has the same answer, so a remembered failure is
 * returned without searching again.
 *
 * Only failures are remembered (a success is acted on at once and changes the board), and never for
 * a search that consulted a `Cannot` rule or was given a `plan` (a projected board): those read
 * more than the three above. Any change at all forgets everything, so this is exact. A move
 * anywhere forgets: a fallback search reaches far across the mat, so keying by region would rarely
 * keep anything.
 */
let tuningGeneration = 0;
let tuningWatched = false;
let failedSearches = { tokens: null, stamp: '', keys: new Set() };

/** The failure memo for the board as it is now, emptied if anything changed. */
function failureMemo() {
    if (!tuningWatched) {
        tuningWatched = true;
        onMatTuningChanged(() => { tuningGeneration++; });
    }
    const { tokens, version } = BoardState.membershipVersion();
    const stamp = `${version}|${BoardState.moveCount()}|${tuningGeneration}|${registryVersion()}`;
    if (failedSearches.tokens !== tokens || failedSearches.stamp !== stamp) {
        failedSearches = { tokens, stamp, keys: new Set() };
    }
    return failedSearches.keys;
}

/**
 * The nearest point to `point` where a Token of `typeId` may legally stand, or null when there is
 * none within nudge reach (it flies back).
 *
 * The drop point itself is tried first, so a drop with room lands exactly where it was let go and
 * reports a nudge of 0. Otherwise the search walks outward in rings `RING_STEP` apart with
 * `RING_ARC` between candidates around each ring: close enough that the spot it finds is the
 * nearest one to within a few mat units, and far fewer candidates than a finer search would need.
 *
 * Also used by `MatResize`, which clamps the point onto the smaller mat and asks this where it can
 * actually go.
 * @returns {{x: number, y: number, nudge: number}|null}
 */
export function findSpot(typeId, point, options = {}) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

    // ⚠️ A Token whose type has no definition is placed anyway, at a 1×1's size (warn-only).
    // Refusing it here would turn a renamed CMS id from a Token that sits there doing nothing into
    // a Token that cannot be put down at all, a harder failure to recognise and not this file's
    // call to make.
    const memo = options.plan ? null : failureMemo();
    const key = memo ? `${typeId}|${point.x}|${point.y}|${options.excludeId ?? ''}|${options.reach ?? ''}` : null;
    if (memo?.has(key)) return null;

    const ctx = contextFor(typeId, point, options);

    // `candidatesAround`'s walk, inlined: the same candidates in the same order, each put through
    // the same three tests `legalIn` makes (mat edge, crowding, then `Cannot`), but on bare
    // coordinates, so a search that fails allocates nothing per candidate. A point object is made
    // only for a candidate that gets as far as `Cannot`. `whyRefused` still walks the generator.
    const { r, w, h } = ctx.bounds;
    const at = (x, y) => x >= r && y >= r && x <= w - r && y <= h - r
        && clearAt(x, y, ctx)
        && (!ctx.cannotMatters || legalIn(typeId, { x, y }, ctx));

    if (at(point.x, point.y)) return { x: point.x, y: point.y, nudge: 0 };
    for (let d = RING_STEP; d <= ctx.reach; d += RING_STEP) {
        for (const { cos, sin } of ringTrig(d)) {
            const x = point.x + cos * d;
            const y = point.y + sin * d;
            if (at(x, y)) return { x, y, nudge: d };
        }
    }
    if (memo && !ctx.cannotMatters) memo.add(key);
    return null;
}

/** Grid spacing of the whole-mat search, in mat units. */
const ANYWHERE_STEP = 8;

/**
 * The nearest legal free spot to `point` anywhere on the mat, or null only when the whole mat has
 * no legal spot for a Token of `typeId`.
 *
 * For arrivals with no hand to fly back to and no reason to push: a Shop purchase, a Token a recipe
 * makes. Tries {@link findSpot} within nudge reach first, so an arrival with room nearby lands
 * exactly where it always did; only when that fails does it scan the whole mat.
 *
 * The scan is a coarse grid sorted nearest first, rather than {@link candidatesAround} out to the
 * mat's diagonal, which would be far more candidates; each is checked by the same {@link legalIn}
 * (mat edge, crowding, `Cannot`), so a spot it returns is exactly as legal as a nudge. Nothing is
 * pushed.
 * @param {object} [options] as {@link findSpot} (`excludeId`, `plan`)
 * @returns {{x: number, y: number, nudge: number}|null}
 */
export function findSpotAnywhere(typeId, point, options = {}) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

    const near = findSpot(typeId, point, options);
    if (near) return near;

    const r = artRadiusOf(typeId);
    const w = matW();
    const h = matH();
    if (w < 2 * r || h < 2 * r) return null;

    const axis = (lo, hi) => {
        const out = [];
        for (let v = lo; v < hi; v += ANYWHERE_STEP) out.push(v);
        out.push(hi);
        return out;
    };
    const xs = axis(r, w - r);
    const ys = axis(r, h - r);

    const candidates = [];
    for (const x of xs) {
        for (const y of ys) {
            const dx = x - point.x;
            const dy = y - point.y;
            candidates.push({ x, y, d2: dx * dx + dy * dy });
        }
    }
    candidates.sort((a, b) => a.d2 - b.d2);

    // Every Token on the mat can block some candidate, so none are prefiltered away.
    const ctx = contextFor(typeId, point, { ...options, reach: Math.hypot(w, h) });
    for (const c of candidates) {
        if (legalIn(typeId, c, ctx)) return { x: c.x, y: c.y, nudge: Math.sqrt(c.d2) };
    }
    return null;
}

/**
 * How far an arrival that cannot push looks for free space instead, in mat units: wider than a
 * player's nudge reach, because an arrival has no hand to fly back to, but bounded, since an
 * unbounded ring search on a nearly full mat is a great many candidates.
 */
const ARRIVAL_FALLBACK_REACH = 640;

/** Relaxation passes before a push is given up as unsolvable. */
const PUSH_PASSES = 30;

/** How far past the gap a push shoves — float slack, so a pair just pushed apart is not read as overlapping again. */
const PUSH_MARGIN = 0.5;

/**
 * Where an arrival (a spawn, a transform) lands. Unlike a player's drop, an arrival may push: it
 * stands at `point` and shoves the Tokens it overlaps outward, and they shove theirs.
 *
 * Guard rails:
 * - a pushed Token stays on the mat (clamped to the edge);
 * - nothing is pushed into a spot that breaks a `Cannot` rule;
 * - when the push cannot be solved, the arrival lands in the nearest free space instead, and
 * nothing is pushed.
 *
 * Returns null only when there is no free space within {@link ARRIVAL_FALLBACK_REACH} either: the
 * mat is full.
 *
 * Decides only: `BoardState.applyPushes` moves the pushed Tokens.
 *
 * @param {object} [options]
 * @param {string} [options.excludeId] a Token to ignore — the one being replaced
 * @param {string[]} [options.fixedIds] Tokens that must not be pushed
 * @returns {{x: number, y: number, pushed: {id: string, x: number, y: number}[]}|null}
 */
export function forceSpot(typeId, point, options = {}) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const { excludeId = null, fixedIds = [] } = options;

    const at = clampInside(typeId, point);
    if (isLegal(typeId, at, { excludeId })) return { x: at.x, y: at.y, pushed: [] };

    const pushed = relax(typeId, at, excludeId, new Set(fixedIds));
    if (pushed) return { x: at.x, y: at.y, pushed };

    const spot = findSpot(typeId, at, { excludeId, reach: ARRIVAL_FALLBACK_REACH });
    return spot ? { x: spot.x, y: spot.y, pushed: [] } : null;
}

/**
 * Push everything overlapping a newcomer at `at` outward until nothing
 * overlaps, or null when that cannot be done legally.
 *
 * Pairwise relaxation: each overlapping pair is pushed apart along the line
 * between their centres — all of it onto the free one when the other is fixed
 * (the newcomer always is), half each otherwise — then pushed Tokens are
 * clamped back onto the mat. Positions are not rounded (see the loop).
 */
function relax(typeId, at, excludeId, fixedIds) {
    // Hit radius per body, once, and the overlap factor read once for this push (`minGap`'s own
    // expression, hoisted; still read live, so a Mat Tuner change takes effect on the very next
    // push).
    const factor = 1 - matTuning('overlapPct') / 100;
    const bodies = BoardState.tokens()
        .filter(t => t.id !== excludeId && Number.isFinite(t.x) && Number.isFinite(t.y))
        .map(t => ({
            id: t.id, typeId: t.typeId, x: t.x, y: t.y, x0: t.x, y0: t.y,
            h: hitRadiusOf(t.typeId), fixed: fixedIds.has(t.id)
        }));
    const newcomer = { id: null, typeId, x: at.x, y: at.y, h: hitRadiusOf(typeId), fixed: true };
    bodies.push(newcomer);

    for (let pass = 0; pass < PUSH_PASSES; pass++) {
        let moved = false;
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const a = bodies[i];
                const b = bodies[j];
                if (a.fixed && b.fixed) continue;
                const gap = (a.h + b.h) * factor;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                // Axis rejection before `hypot`: if either axis is already at or past the gap, the
                // hypot would be too, so the pair is not overlapping.
                if (dx >= gap || dx <= -gap || dy >= gap || dy <= -gap) continue;
                const d = Math.hypot(dx, dy);
                if (d * d >= gap * gap - EPS) continue;

                moved = true;
                const push = gap - d + PUSH_MARGIN;
                const nx = d === 0 ? 1 : dx / d;
                const ny = d === 0 ? 0 : dy / d;
                const shareA = a.fixed ? 0 : (b.fixed ? 1 : 0.5);
                const shareB = 1 - shareA;
                a.x -= nx * push * shareA;
                a.y -= ny * push * shareA;
                b.x += nx * push * shareB;
                b.y += ny * push * shareB;
                if (shareA) a.pushed = true;
                if (shareB) b.pushed = true;
            }
        }
        // ⚠️ Only Tokens this push has touched, and WITHOUT rounding. Rounding makes pushed Tokens
        // jitter by half a unit every pass so a packed block never settles, and rounding once at
        // the end shrinks a 61.25 u gap. Points stay fractional, as the ones `findSpot` returns
        // already are.
        for (const t of bodies) {
            if (t.fixed || !t.pushed) continue;
            const c = clampOnto(t.typeId, t);
            t.x = c.x;
            t.y = c.y;
        }
        if (!moved) break;
    }

    // Every pair the push is answerable for must now be clear: the newcomer's, and every moved
    // Token's. Two Tokens that were already overlapping before (a mat shrink can leave them so) are
    // not this push's business; counting them would make every push on that mat fail.
    const answerable = (t) => t === newcomer || t.pushed;
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i];
            const b = bodies[j];
            if (!answerable(a) && !answerable(b)) continue;
            const gap = (a.h + b.h) * factor;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            // Same axis rejection as the pass loop, before `distanceSq`.
            if (dx >= gap || dx <= -gap || dy >= gap || dy <= -gap) continue;
            if (distanceSq(a, b) < gap * gap - EPS) return null;
        }
    }

    const moved = bodies
        .filter(t => t.id != null && t.pushed && (t.x !== t.x0 || t.y !== t.y0))
        .map(t => ({ id: t.id, x: t.x, y: t.y }));

    // One check on the board as it would be — the newcomer down and every
    // pushed Token at its new point — so a push that carries a Token next to
    // something it Cannot be near is caught wherever that happens. A push is
    // rare (bursts and spawns), so the projected board is affordable here.
    const plan = { move: moved };
    if (excludeId) plan.id = excludeId;
    if (!Restrictions.checkPlacement(at, typeId, plan).ok) return null;

    return moved;
}

/**
 * A ring's unit offsets, `{ cos, sin }` per candidate, worked out once per ring distance and
 * reused. A ring's shape depends only on `d` (and the fixed `RING_ARC`), never on the drop point,
 * so it is identical on every search and safe to cache for the module's lifetime.
 */
const ringTrigCache = new Map();

function ringTrig(d) {
    let table = ringTrigCache.get(d);
    if (!table) {
        const count = Math.ceil(2 * Math.PI * d / RING_ARC);
        table = new Array(count);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            table[i] = { cos: Math.cos(angle), sin: Math.sin(angle) };
        }
        ringTrigCache.set(d, table);
    }
    return table;
}

/**
 * The points a drop is willing to consider, nearest first: the drop point
 * itself, then rings outward to `reach`.
 *
 * One walk, shared by the search and by the diagnosis below, so the two can
 * never disagree about which spots were even on offer.
 */
function* candidatesAround(point, reach) {
    yield { x: point.x, y: point.y, nudge: 0 };
    for (let d = RING_STEP; d <= reach; d += RING_STEP) {
        for (const { cos, sin } of ringTrig(d)) {
            yield { x: point.x + cos * d, y: point.y + sin * d, nudge: d };
        }
    }
}

/**
 * What should happen when `instance` is dropped at `point`: the one decision every drop on the mat
 * goes through. Nothing is moved here; `Placement.placeTokenAt` carries the answer out.
 *
 * Restock-on-copy comes first: dropping a Token onto a matching copy that has room for charges tops
 * it up rather than looking for a spot beside it, otherwise a crowded board would nudge the Token
 * away from the very copy the player aimed at. Whatever charges are left over stay on the mat,
 * nudged beside the copy.
 *
 * @returns {{status: 'placed'|'nudged'|'restocked'|'full', x?: number, y?: number,
 *            nudge?: number, reason?: string, targetId?: string, transferred?: number,
 *            absorbed?: boolean}}
 */
export function dropAt(instance, point, options = {}) {
    const typeId = instance?.typeId;
    if (!typeId) return { status: 'full', reason: 'Not a valid Token' };
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return { status: 'full', reason: 'Nowhere to drop that' };
    }

    // `noRestock`: a Token a recipe makes is always its own Token.
    const restock = options.noRestock ? null : restockTargetAt(instance, point, options.excludeId);
    if (restock) {
        const maxCap = restock.cap;
        const needed = maxCap - restock.target.usesRemaining;
        const available = instance.usesRemaining != null ? instance.usesRemaining : maxCap;
        const transferred = Math.min(needed, available);
        const leftover = available - transferred;

        if (leftover === 0) {
            return { status: 'restocked', targetId: restock.target.id, transferred, absorbed: true };
        }

        // The leftover stays on the mat, beside the copy it just filled.
        const spot = findSpot(typeId, { x: restock.target.x, y: restock.target.y }, {
            ...options,
            excludeId: instance.id
        });
        return {
            status: 'restocked',
            targetId: restock.target.id,
            transferred,
            absorbed: false,
            ...(spot ? { x: spot.x, y: spot.y, nudge: spot.nudge } : {})
        };
    }

    const spot = findSpot(typeId, point, options);
    if (!spot) return { status: 'full', ...whyRefused(typeId, point, options) };

    return {
        status: spot.nudge > 0 ? 'nudged' : 'placed',
        x: spot.x,
        y: spot.y,
        nudge: spot.nudge
    };
}

/** The note a drop with nowhere to go flies back with. */
export const NO_ROOM = 'No room there.';

/**
 * Why a drop found nowhere to go: run only once the search has already failed, so its cost falls on
 * the rare fly-back and never on a normal drop.
 *
 * Why this is not just No room there: a spot breaking a `Cannot` rule is simply not a spot, so a
 * Token boxed in by a restriction and one boxed in by its neighbours both come back with `findSpot`
 * returning null. They are not the same thing to a player: one is shuffle something along, the
 * other is that rule will never let this sit here. If the drop point itself was physically clear
 * and only the rule refused it, the rule's own sentence is the honest answer, and it is the message
 * `TILE_EVENT_ALERT`'s refused-drop mark was built to carry.
 */
function whyRefused(typeId, point, options = {}) {
    const ctx = contextFor(typeId, point, options);

    // No restriction anywhere in range, so crowding is the only thing it can
    // have been — and this never costs an ordinary drop anything.
    if (!ctx.cannotMatters) return { reason: NO_ROOM };

    const plan = { ...(options.plan || {}) };
    if (options.excludeId && plan.id == null) plan.id = options.excludeId;

    // ⚠️ The first spot that was physically fine and refused only by a rule is the honest answer,
    // not merely the drop point. A player aiming at a Token they are not allowed to sit beside hits
    // a spot that is both occupied AND against the rule; reporting on that one point alone would
    // say No room there and hide the rule.
    for (const candidate of candidatesAround(point, ctx.reach)) {
        if (!insideBounds(candidate, ctx.bounds) || !clearOf(candidate, ctx)) continue;
        const verdict = Restrictions.checkPlacement(candidate, typeId, plan);
        if (!verdict.ok) {
            return {
                reason: verdict.reason,
                violatingTypeId: verdict.violatingTypeId,
                rulesText: verdict.rulesText
            };
        }
    }
    return { reason: NO_ROOM };
}

/**
 * The matching copy under `point` that this Token could top up, or null.
 *
 * Under the point is the Token's art circle: the same test the pointer uses to decide what it is
 * hovering (`Flags.pointOnToken`). Deliberately not imported from `Flags.js`: that module is the
 * flag/claim rules and importing it here would tie placement to the hero system for one circle
 * test.
 */
function restockTargetAt(instance, point, excludeId = null) {
    const def = getTokenType(instance.typeId);
    if (def?.uses == null) return null;

    let best = null;
    for (const other of BoardState.tokens()) {
        if (other.id === instance.id || other.id === excludeId) continue;
        if (other.typeId !== instance.typeId) continue;
        if (other.usesRemaining == null || other.usesRemaining >= def.uses) continue;
        const r = artRadiusOf(other.typeId);
        const d2 = distanceSq(point, other);
        if (d2 > r * r) continue;
        if (!best || d2 < best.d2) best = { target: other, d2, cap: def.uses };
    }
    return best;
}
