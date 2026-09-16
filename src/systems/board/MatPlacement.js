// Fantasy Guild — Where a Token may stand on the free playmat (Free Playmat slice 1.6d)

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { artRadiusOf, MAT_W, MAT_H, LARGEST_ART_RADIUS } from '../../config/matGeometry.js';
import { matTuning } from '../../config/matTuning.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import { distanceSq, nearRadius } from './nearby.js';
import * as BoardState from './BoardState.js';
import * as Restrictions from './Restrictions.js';

/**
 * ⭐ **A Token lands exactly where the player lets go** (Free Playmat slice
 * 1.6d, FP-6). There are no tiles and nothing snaps: this file is the whole
 * answer to "may a Token of this type stand at this point, and if not, where is
 * the nearest place it may?".
 *
 * ## The three rules a spot has to pass
 * 1. **It fits on the mat** — the *art* circle, not the hitbox, stays fully
 *    inside (director's pick). A Token half off the edge would be half
 *    unclickable, and the art is what the player sees.
 * 2. **It is not crowding anything** — centre to centre, against the invisible
 *    hitbox (FP-63, FP-64). See {@link minGap}.
 * 3. **It breaks no `Cannot` rule** (FP-88) — and a spot that would is simply
 *    not a spot, so the search carries on past it rather than refusing the drop.
 *
 * ## ⚠️ This file decides, it does not act
 * Nothing here moves a Token, publishes an event or transfers a charge.
 * {@link dropAt} returns **what should happen**; `Placement.js` is what makes it
 * happen and announces it. That is the same split `BoardState` (shape) and
 * `Placement` (rules) already keep, and it is what lets the drag preview
 * (`MatRings`) ask "where would this land?" without the asking placing anything.
 *
 * ## Mat units
 * 1 u = one natural board pixel, as everywhere else on the mat.
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

/** Ring spacing of the nudge search, in mat units (plan §B). */
const RING_STEP = 4;

/** Arc between candidates on a ring, in mat units — `n = ceil(2πd / ARC)`. */
const RING_ARC = 6;

/**
 * The invisible collision radius of a Token type: a percentage of its art
 * radius (FP-63), **rounded to whole mat units**.
 *
 * ⚠️ The rounding is deliberate and load-bearing. Centres are whole numbers,
 * and the owner's numbers are stated as whole gaps — 61 u between two small
 * Tokens. Unrounded, `64 × 80% = 51.2` makes that gap `61.44`, so two Tokens
 * placed 61.4 u apart (a gap the owner called legal) would be refused by four
 * hundredths of a pixel nobody can see. Rounded, the small hitbox is 51 u and
 * the three gaps come out at **61.2 / 99.6 / 138.0**.
 */
export function hitRadiusOf(typeId) {
    return Math.round(artRadiusOf(typeId) * matTuning('hitboxPct') / 100);
}

/**
 * The smallest centre-to-centre distance two Token types may sit at (FP-63).
 *
 * Both hitboxes, less the overlap the Mat Tuner allows. At the shipped 80%
 * hitbox and 40% overlap: **small–small 61.2 u**, small–large 99.6 u,
 * large–large 138 u. Read live, every time — a Mat Tuner change has to take
 * effect on the very next drop.
 */
export function minGap(typeA, typeB) {
    return (hitRadiusOf(typeA) + hitRadiusOf(typeB)) * (1 - matTuning('overlapPct') / 100);
}

/** How far a refused drop may be nudged before it flies back instead (FP-46). */
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
    return point.x >= r && point.y >= r && point.x <= MAT_W - r && point.y <= MAT_H - r;
}

/** Whether a Token type carries any `Cannot` rule at all. */
function hasCannot(typeId) {
    return statementsWith(getTokenType(typeId), KEYWORD.CANNOT).length > 0;
}

/**
 * Everything one drop needs to know, worked out **once** before the search
 * starts rather than per candidate.
 *
 * ## Why this exists (plan §B, §G)
 * A fully blocked drop tries on the order of a thousand candidate points. Doing
 * the two expensive things per candidate — scanning every Token on the mat, and
 * building `Restrictions`' projected board view — is what would turn a crowded
 * drop into a visible stutter. So:
 *
 * * **Neighbours are prefiltered once** to those close enough to block *any*
 *   candidate (`reach` + the largest gap this type can have), with their gap
 *   pre-squared. A typical candidate then costs a handful of subtractions.
 * * **`Cannot` is gated once.** If neither the Token being placed nor anything
 *   within reach of the drop carries a `Cannot`, no candidate can break one, and
 *   the projected view is never built at all — which is the overwhelmingly
 *   common case and the performance gate in the tests.
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

    return { typeId, neighbours, cannotMatters, plan, excludeId, reach };
}

/**
 * Whether `point` is clear of every Token that could crowd it.
 *
 * Exported for tests and for `1.6d-3`'s resize pass; ordinary callers want
 * {@link isLegal}, which also checks the mat edge and `Cannot`.
 */
export function isClear(typeId, point, excludeId = null) {
    return clearOf(point, contextFor(typeId, point, { excludeId, reach: 0 }));
}

/** The hot inner test: `point` against the prefiltered neighbour list. */
function clearOf(point, ctx) {
    for (const n of ctx.neighbours) {
        const dx = point.x - n.x;
        const dy = point.y - n.y;
        if (dx * dx + dy * dy < n.gapSq - EPS) return false;
    }
    return true;
}

/**
 * Whether a Token of `typeId` may stand at `point` — on the mat, clear of its
 * neighbours, and breaking no `Cannot` rule (FP-88).
 *
 * @param {object} [options]
 * @param {string} [options.excludeId] a Token to ignore — itself, when moving
 * @param {object} [options.plan] what else the placement does (see `Restrictions.project`)
 */
export function isLegal(typeId, point, options = {}) {
    return legalIn(typeId, point, contextFor(typeId, point, { ...options, reach: 0 }));
}

function legalIn(typeId, point, ctx) {
    if (!insideMat(typeId, point)) return false;
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
 * ⭐ The nearest point to `point` where a Token of `typeId` may legally stand,
 * or **null** when there is none within nudge reach (FP-46 — it flies back).
 *
 * The drop point itself is tried first, so a drop with room lands exactly where
 * it was let go and reports a nudge of 0. Otherwise the search walks outward in
 * rings 4 u apart, ~6 u between candidates around each ring — close enough that
 * the spot it finds is the nearest one to within a few mat units, and about a
 * tenth of the candidates a 2 u search would need.
 *
 * Reused by slice 1.6d-3, which pulls Tokens in when the mat shrinks (FP-98):
 * clamp the point onto the smaller mat, then ask this where it can actually go.
 *
 * @returns {{x: number, y: number, nudge: number}|null}
 */
export function findSpot(typeId, point, options = {}) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;

    // ⚠️ A Token whose type has no definition is placed anyway, at a 1×1's size
    // — warn-only, per the owner's ruling (CR2-108c / CR2-044). Refusing it here
    // would turn a renamed CMS id from "a Token that sits there doing nothing"
    // into "a Token that cannot be put down at all", which is a far harder
    // failure to recognise and is not this file's call to make.
    const ctx = contextFor(typeId, point, options);
    for (const candidate of candidatesAround(point, ctx.reach)) {
        if (legalIn(typeId, candidate, ctx)) {
            return { x: candidate.x, y: candidate.y, nudge: candidate.nudge };
        }
    }
    return null;
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
        const count = Math.ceil(2 * Math.PI * d / RING_ARC);
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            yield { x: point.x + Math.cos(angle) * d, y: point.y + Math.sin(angle) * d, nudge: d };
        }
    }
}

/**
 * ⭐ What should happen when `instance` is dropped at `point` — the one
 * decision every drop on the mat goes through.
 *
 * Nothing is moved here; `Placement.placeTokenAt` carries the answer out.
 *
 * ## Restock-on-copy comes first (FP-50, FP-87)
 * Dropping a Token onto a matching copy that has room for charges **tops it up**
 * rather than looking for a spot beside it — otherwise a crowded board would
 * nudge the Token away from the very copy the player aimed at, and the gesture
 * would stop working exactly when it is most wanted. Whatever charges are left
 * over stay on the mat, nudged beside the copy (FP-87).
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

    const restock = restockTargetAt(instance, point, options.excludeId);
    if (restock) {
        const maxCap = restock.cap;
        const needed = maxCap - restock.target.usesRemaining;
        const available = instance.usesRemaining != null ? instance.usesRemaining : maxCap;
        const transferred = Math.min(needed, available);
        const leftover = available - transferred;

        if (leftover === 0) {
            return { status: 'restocked', targetId: restock.target.id, transferred, absorbed: true };
        }

        // FP-87: the leftover stays on the mat, beside the copy it just filled.
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

/** The note a drop with nowhere to go flies back with (FP-46). */
export const NO_ROOM = 'No room there.';

/**
 * Why a drop found nowhere to go — run **only** once the search has already
 * failed, so its cost falls on the rare fly-back and never on a normal drop.
 *
 * ## Why this is not just "No room there."
 * Under FP-88 a spot breaking a `Cannot` rule is simply not a spot, so a Token
 * boxed in by a restriction and one boxed in by its neighbours both come back
 * with `findSpot` returning null. They are not the same thing to a player: one
 * is "shuffle something along", the other is "that rule will never let this sit
 * here". If the drop point itself was physically clear and only the rule
 * refused it, the rule's own sentence is the honest answer — and it is the
 * message `TILE_EVENT_ALERT`'s refused-drop mark was built to carry.
 */
function whyRefused(typeId, point, options = {}) {
    const ctx = contextFor(typeId, point, options);

    // No restriction anywhere in range, so crowding is the only thing it can
    // have been — and this never costs an ordinary drop anything.
    if (!ctx.cannotMatters) return { reason: NO_ROOM };

    const plan = { ...(options.plan || {}) };
    if (options.excludeId && plan.id == null) plan.id = options.excludeId;

    /**
     * ⚠️ The first spot that was **physically fine and refused only by a rule**
     * is the honest answer, not merely the drop point.
     *
     * A player aiming at a Token they are not allowed to sit beside hits a spot
     * that is both occupied AND against the rule. Reporting on that one point
     * alone would say "No room there." and hide the rule entirely — when the
     * rule is precisely what stopped the Token finding a home nearby.
     */
    for (const candidate of candidatesAround(point, ctx.reach)) {
        if (!insideMat(typeId, candidate) || !clearOf(candidate, ctx)) continue;
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
 * "Under the point" is the Token's **art circle** — the same test the pointer
 * uses to decide what it is hovering (`Flags.pointOnToken`), so restocking
 * happens exactly when the player let go over the copy. Deliberately not
 * imported from `Flags.js`: that module is the flag/claim rules and importing it
 * here would tie placement to the hero system for one circle test.
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
