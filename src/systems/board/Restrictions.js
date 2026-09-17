// Fantasy Guild — placement restrictions, the `Cannot` keyword (effect grammar Phase 2)

import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import { getRestrictionKind, limitOf } from '../../config/registries/restrictionPalette.js';
import { isWithin, nearRadius } from './nearby.js';
import { matchesTokenTarget } from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import { renderStatement } from '../effects/statementText.js';

/**
 * `Cannot` — the only rule in the game that says **no** to a placement.
 *
 * ## What a violation does (owner ruling, 2026-08-20)
 * > *"Refuse, token flies back to it's last location. We will have a warning
 * > that will flash to show the player that it was rejected and why."*
 *
 * So the board never sits in a violating state and nothing is ever destroyed.
 * The refusal goes out through the same channel the one-Mythic-placed rule
 * already uses — `Placement.js` returns `{ success: false, reason }` and every
 * caller already puts the Token back exactly where it came from (the Tray slot,
 * the Vault, the sprite it was dragged from, the spot it was moved off) and
 * flashes the reason. That is why this file exports checks and not actions:
 * **the fly-back was already built**, and inventing a second refusal path
 * beside it would have been the wrong shape.
 *
 * ## ⚠️ A restriction is symmetric — the trap
 * If a Coast says *"no more than 2 nearby Coasts"*, then dropping a **third**
 * Coast beside it breaks **the existing Coast's** rule, not the newcomer's. So
 * every check considers the board as it *would* be and asks the question of
 * every Token in the affected neighbourhood, not only of the one being placed.
 *
 * ## The paths that have no "last location"
 * * **A Map burst** — not a placement at all; its contents are sprites, and
 *   putting one down is an ordinary placement this refuses like any other.
 * * **A placement that shoves other Tokens** — handled by **refusing the whole
 *   placement**: `Placement` hands the moves to {@link checkPlacement}, so the
 *   shoved Tokens are checked where they would land.
 * * **An old save loading into a now-illegal board** — the one case with
 *   genuinely no origin to fly back to. {@link reconcile} lifts the offenders
 *   into the Vault, the owner's fallback.
 *
 * ## By instance id and mat point (Free Playmat slice 1.6b)
 * A board view is a `Map` of **instance id → `{ typeId, x, y }`**, and "Near"
 * is a distance between those points. There are no tiles here.
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
 * ## Near, measured on the view — not on the live board
 * Every check here is about the board as it **would** be, so the same
 * centre-to-centre measurement (FP-41) is taken from the view's own points.
 * Only for Tokens that carry a `Cannot` — cheap enough to run on every drop.
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
 * Deliberately its own small function rather than an import from
 * `statementText.js`: that module renders **authoring** text for the CMS and
 * the tooltip, and this is a one-line message flashed at a player mid-drag. A
 * shared renderer would tie a game-facing string to an editor-facing one.
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
 * Bring a board that is *already* violating back into legality.
 *
 * The one case with no last location: a save authored before a restriction
 * existed, loading into a board the rule now forbids. Offenders are lifted into
 * the **Vault** — the owner's stated fallback. Nothing is destroyed, and the
 * board is legal by the time anyone looks at it.
 *
 * ⚠️ **Re-checked after every lift, one at a time.** A row of four Coasts
 * breaks the rule in several places at once, but removing one Coast can fix
 * three of those findings, and confiscating all four would take three Tokens
 * the player never had to lose. The earliest-arrived offender is lifted and the
 * question asked again.
 *
 * @param {(instance: object) => boolean} depositToVault — injected so this
 *   module does not import `TokenBank`, which imports `BoardState`, which is a
 *   circle the board layer keeps out of.
 * @returns {Array<{id: string, typeId: string, x: number, y: number, reason: string}>}
 *   what moved, and the point it moved from
 */
export function reconcile(depositToVault) {
    const moved = [];

    // Bounded hard. `violations` shrinks by at least one Token per pass, but a
    // loop over save-resident state is not a place to rely on that.
    for (let pass = 0; pass < 64; pass++) {
        const found = violations();
        if (!found.length) break;

        const worst = found[0];
        const instance = BoardState.getTokenById(worst.id);
        if (!instance) break;

        // If the Vault will not take it, leave it where it is rather than
        // destroy it. A board that is briefly illegal is recoverable; a Token
        // the player owned and no longer does is not.
        if (!depositToVault(instance)) break;

        BoardState.removeToken(worst.id);
        moved.push({ ...worst });
    }

    return moved;
}
