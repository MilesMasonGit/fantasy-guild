// placement restrictions, the `Cannot` keyword

import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import { getRestrictionKind, limitOf } from '../../config/registries/restrictionPalette.js';
import { isWithin, nearRadius } from './nearby.js';
import { matchesTokenTarget } from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import { renderStatement } from '../effects/statementText.js';

/**
 * `Cannot`: the only rule in the game that says no to a placement.
 *
 * A violation refuses: the Token flies back to its last location and a warning flashes saying why.
 * The board never sits in a violating state and nothing is destroyed. The refusal goes out through
 * the same channel as the one-Mythic-placed rule: `Placement.js` returns `{ success: false, reason
 * }` and every caller puts the Token back where it came from and flashes the reason. That is why
 * this file exports checks, not actions.
 *
 * ⚠️ A restriction is symmetric. If a Coast says no more than 2 nearby Coasts, dropping a third
 * beside it breaks the existing Coast's rule, not the newcomer's. So every check considers the
 * board as it would be and asks the question of every Token in the affected neighbourhood.
 *
 * A placement that shoves other Tokens is refused as a whole: `Placement` hands the moves to {@link
 * checkPlacement}, so the shoved Tokens are checked where they would land. An old save loading into
 * a now-illegal board has no last location to fly back to; {@link reconcile} fixes it.
 *
 * A board view is a `Map` of instance id to `{ typeId, x, y }`, and Near is a distance between
 * those points.
 */

/**
 * A board as a map of Tokens by instance id, with their type and point.
 *
 * Built fresh for every check rather than cached. A placement check runs on a
 * drop, not on the tick, and a stale copy of the board is the one thing that
 * would make a restriction refuse the wrong Token.
 *
 * @typedef {Map<string, {typeId: string, x: number, y: number}>} BoardView
 */

/** The id a Token being placed takes in a view when it brings no id of its own. */
export const PLACING_ID = '__placing__';

/** The board exactly as it is now, in arrival order. */
export function snapshot() {
    const view = new Map();
    for (const instance of BoardState.tokens()) {
        if (!Number.isFinite(instance.x) || !Number.isFinite(instance.y)) continue;
        view.set(instance.id, { typeId: instance.typeId, x: instance.x, y: instance.y });
    }
    return view;
}

/**
 * The board as it *would* be after a placement, including everything that
 * placement moves out of the way.
 *
 * @param {{
 *   place?: {id?: string, typeId: string, x: number, y: number},
 *   remove?: string[],
 *   move?: Array<{id: string, x: number, y: number}>
 * }} plan
 */
export function project(plan = {}) {
    const view = snapshot();

    for (const id of plan.remove || []) view.delete(id);

    for (const { id, x, y } of plan.move || []) {
        const entry = view.get(id);
        if (!entry) continue;
        view.set(id, { ...entry, x, y });
    }

    const place = plan.place;
    if (place?.typeId != null && Number.isFinite(place.x) && Number.isFinite(place.y)) {
        const id = place.id || PLACING_ID;
        // A Token already in the view (placed back down elsewhere) is moved, not doubled.
        view.delete(id);
        view.set(id, { typeId: place.typeId, x: place.x, y: place.y });
    }

    return view;
}

/**
 * The ids near one Token on a board view, never including itself, in view order.
 *
 * Near is measured on the view, not on the live board: every check here is about the board as it
 * would be. Only for Tokens that carry a `Cannot`, which is cheap enough to run on every drop.
 */
function nearIds(view, id, radius = nearRadius()) {
    const origin = view.get(id);
    if (!origin) return [];
    const out = [];
    for (const [other, entry] of view) {
        if (other === id) continue;
        if (isWithin(origin, entry, radius)) out.push(other);
    }
    return out;
}

/**
 * Whether one Token's own restrictions are satisfied on a board view.
 *
 * @returns {{id: string, typeId: string, x: number, y: number, reason: string, rulesText: string}|null}
 */
export function violationAt(view, id) {
    const entry = view.get(id);
    const typeId = entry?.typeId;
    const def = getTokenType(typeId);
    const restrictions = statementsWith(def, KEYWORD.CANNOT);
    if (!restrictions.length) return null;

    const neighbours = nearIds(view, id)
        .map(other => getTokenType(view.get(other).typeId))
        .filter(Boolean);

    for (const statement of restrictions) {
        const payload = statement?.payload || {};
        const kind = getRestrictionKind(payload.kind);
        // ⚠️ An unrecognised kind refuses NOTHING. A restriction the engine
        // cannot evaluate must never block a placement on a guess — a board
        // that silently rejects Tokens for a rule nobody can read would be far
        // worse than a rule that quietly does not apply yet.
        if (!kind || payload.kind !== 'adjacency_limit') continue;

        const matched = neighbours.filter(d => matchesTokenTarget(statement.to, d)).length;
        if (matched > limitOf(payload)) {
            return {
                id,
                typeId,
                x: entry.x,
                y: entry.y,
                rulesText: renderStatement(statement, { token: tid => tokenName(tid) || tid }),
                reason: kind.refusal(payload, subjectOf(statement), tokenName(typeId))
            };
        }
    }
    return null;
}

/**
 * The filter as a noun, for the refusal message.
 *
 * Its own small function rather than an import from `statementText.js`: that renders authoring text
 * for the CMS and the tooltip, and this is a game-facing string flashed mid-drag.
 */
function subjectOf(statement) {
    const to = statement?.to;
    if (!to?.mode || to.mode === 'all') return 'Tokens';
    if (to.mode === 'id') return `${tokenName(to.value)} Tokens`;
    return to.value ? `${to.value} Tokens` : 'Tokens';
}

/**
 * Every Token on a board view whose restrictions are broken, in view order
 * (arrival order for a snapshot).
 */
export function violations(view = snapshot()) {
    const out = [];
    for (const id of view.keys()) {
        const hit = violationAt(view, id);
        if (hit) out.push(hit);
    }
    return out;
}

const refusalOf = (hit) => ({ ok: false, reason: hit.reason, violatingTypeId: hit.typeId, rulesText: hit.rulesText });

/**
 * Whether a placement is legal, and if not, why not — in a sentence a player
 * can act on.
 *
 * Checks the incoming Token first so the message names the rule the player just
 * broke, then everything else near it so the symmetric case is caught too, then
 * everything near each Token the placement moves.
 *
 * @param {{x: number, y: number}} point  where the Token's centre would land
 * @param {string} typeId                 what is landing
 * @param {object} [plan]                 what else the placement does — see {@link project};
 *                                        `plan.id` names the Token being placed, if it has one
 * @returns {{ok: true} | {ok: false, reason: string, violatingTypeId?: string, rulesText?: string}}
 */
export function checkPlacement(point, typeId, plan = {}) {
    const def = getTokenType(typeId);
    if (!def || !point) return { ok: true };

    const placedId = plan.id || PLACING_ID;
    const view = project({ ...plan, place: { id: placedId, typeId, x: point.x, y: point.y } });

    const own = violationAt(view, placedId);
    if (own) return refusalOf(own);

    for (const other of nearIds(view, placedId)) {
        const hit = violationAt(view, other);
        if (hit) return refusalOf(hit);
    }

    // A shove moves Tokens away from the drop as well as towards it, so a moved
    // Token can break a rule far from where the player dropped anything.
    // Checking only the drop site would let that through.
    for (const { id } of plan.move || []) {
        if (!view.has(id)) continue;
        const hit = violationAt(view, id);
        if (hit) return refusalOf(hit);
        for (const other of nearIds(view, id)) {
            const near = violationAt(view, other);
            if (near) return refusalOf(near);
        }
    }

    return { ok: true };
}

/**
 * Bring a board that is already violating back into legality: a save authored before a restriction
 * existed, loading into a board the rule now forbids. Offenders are moved to a legal spot on the
 * mat that `relocate` finds. Nothing is destroyed.
 *
 * ⚠️ Re-checked after every move, one at a time: moving one Coast can fix several findings at once,
 * and moving all of them would rearrange Tokens the player did not need to lose. The
 * earliest-arrived offender is moved and the question asked again.
 *
 * @param {(instance: object) => ({x: number, y: number}|null)} relocate —
 *   where the offender may stand instead, or null when there is nowhere.
 *   Injected so this module does not import `MatPlacement`, which imports it.
 * @returns {Array<{id: string, typeId: string, x: number, y: number, reason: string,
 *   to: {x: number, y: number}}>} what moved, the point it moved from and to
 */
export function reconcile(relocate) {
    const moved = [];

    // Bounded hard. `violations` shrinks by at least one Token per pass, but a
    // loop over save-resident state is not a place to rely on that.
    for (let pass = 0; pass < 64; pass++) {
        const found = violations();
        if (!found.length) break;

        const worst = found[0];
        const instance = BoardState.getTokenById(worst.id);
        if (!instance) break;

        // If there is nowhere legal to go, leave it where it is rather than
        // destroy it. A board that is briefly illegal is recoverable; a Token
        // the player owned and no longer does is not.
        const to = relocate(instance);
        if (!to || !Number.isFinite(to.x) || !Number.isFinite(to.y)) break;

        BoardState.setTokenPoint(worst.id, to.x, to.y);
        moved.push({ ...worst, to: { x: to.x, y: to.y } });
    }

    return moved;
}
