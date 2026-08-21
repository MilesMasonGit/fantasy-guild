// Fantasy Guild — placement restrictions, the `Cannot` keyword (effect grammar Phase 2)

import { getTokenType, tokenName } from '../../config/registries/tokenRegistry.js';
import { KEYWORD, statementsWith } from '../effects/statements.js';
import { getRestrictionKind, limitOf } from '../../config/registries/restrictionPalette.js';
import { tileFootprint } from '../../ui/components/board/boardConstants.js';
import { neighboursOfToken } from './adjacency.js';
import { matchesTokenTarget } from './TileModifiers.js';
import * as BoardState from './BoardState.js';

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
 * the Vault, the sprite it was dragged from, the tile it was moved off) and
 * flashes the reason. That is why this file exports checks and not actions:
 * **the fly-back was already built**, and inventing a second refusal path
 * beside it would have been the wrong shape.
 *
 * ## ⚠️ A restriction is symmetric — the trap
 * If a Coast says *"no more than 2 adjacent Coasts"*, then dropping a **third**
 * Coast beside it breaks **the existing Coast's** rule, not the newcomer's. So
 * every check considers the board as it *would* be and asks the question of
 * every Token in the affected neighbourhood, not only of the one being placed.
 *
 * ## The paths that have no "last location"
 * The owner: *"There should always be a last location, but we can make it fly
 * to the vault as a fallback in case."* Three paths were candidates, and only
 * one of them turned out to be real:
 *
 * * **A Map burst** — not a placement at all. `Cartographer.openMap` scatters
 *   its contents as *sprites* on the floor; picking one up and putting it down
 *   is an ordinary placement that this refuses like any other. Nothing to do.
 * * **A 2×2 cascade push** — real, and handled by **refusing the whole
 *   placement** rather than by shoving a Token into an illegal spot and then
 *   rescuing it. `Placement` hands the cascade plan to {@link checkPlacement},
 *   so the shoved Tokens are checked where they would land. Refusing is
 *   strictly kinder than displacing and then confiscating.
 * * **An old save loading into a now-illegal board** — real, and the one case
 *   with genuinely no origin to fly back to. {@link reconcile} lifts the
 *   offenders into the Vault. That is the owner's fallback, used exactly where
 *   it was meant to be used.
 */

/**
 * A board as a pair of lookups: which anchor owns each tile, and what type
 * sits on each anchor.
 *
 * Built fresh for every check rather than cached. A placement check runs on a
 * drag-drop, not on the tick, and a stale copy of the board is the one thing
 * that would make a restriction refuse the wrong Token.
 *
 * @typedef {{owner: Map<number, number>, typeAt: Map<number, string>}} BoardView
 */

/** The board exactly as it is now. */
export function snapshot() {
    const view = { owner: new Map(), typeAt: new Map() };
    for (const [anchor, instance] of BoardState.occupiedTiles()) {
        if (!instance?.typeId) continue;
        addTo(view, anchor, instance.typeId);
    }
    return view;
}

/** Put a Token onto a board view. */
function addTo(view, anchor, typeId) {
    const size = getTokenType(typeId)?.size || 1;
    view.typeAt.set(anchor, typeId);
    for (const tile of tileFootprint(anchor, size)) view.owner.set(tile, anchor);
}

/** Take a Token off a board view. */
function removeFrom(view, anchor) {
    if (!view.typeAt.has(anchor)) return;
    const size = getTokenType(view.typeAt.get(anchor))?.size || 1;
    for (const tile of tileFootprint(anchor, size)) {
        if (view.owner.get(tile) === anchor) view.owner.delete(tile);
    }
    view.typeAt.delete(anchor);
}

/**
 * The board as it *would* be after a placement, including everything that
 * placement moves out of the way.
 *
 * @param {{
 *   place?: {anchor: number, typeId: string},
 *   remove?: number[],
 *   shifts?: Array<{fromTile: number, toTile: number}>
 * }} plan
 */
export function project(plan = {}) {
    const view = snapshot();

    for (const anchor of plan.remove || []) removeFrom(view, anchor);

    // Cascade shifts are 1×1 only (a displaced 2×2 goes to the Tray instead),
    // so the tile IS the anchor on both sides. Applied in order, because the
    // plan is a chain: A moves into B's tile only once B has moved on.
    for (const { fromTile, toTile } of plan.shifts || []) {
        const typeId = view.typeAt.get(fromTile);
        if (typeId == null) continue;
        removeFrom(view, fromTile);
        addTo(view, toTile, typeId);
    }

    if (plan.place?.typeId != null) addTo(view, plan.place.anchor, plan.place.typeId);

    return view;
}

/** The anchors adjacent to one Token on a board view, never including itself. */
function adjacentAnchors(view, anchor) {
    const typeId = view.typeAt.get(anchor);
    const size = getTokenType(typeId)?.size || 1;
    const out = new Set();
    for (const tile of neighboursOfToken(anchor, size)) {
        const other = view.owner.get(tile);
        if (other != null && other !== anchor) out.add(other);
    }
    return out;
}

/**
 * Whether one Token's own restrictions are satisfied on a board view.
 *
 * @returns {{anchor: number, typeId: string, reason: string}|null}
 */
export function violationAt(view, anchor) {
    const typeId = view.typeAt.get(anchor);
    const def = getTokenType(typeId);
    const restrictions = statementsWith(def, KEYWORD.CANNOT);
    if (!restrictions.length) return null;

    const neighbours = [...adjacentAnchors(view, anchor)]
        .map(a => getTokenType(view.typeAt.get(a)))
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
                anchor,
                typeId,
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
 * Every Token on a board view whose restrictions are broken.
 *
 * @returns {Array<{anchor: number, typeId: string, reason: string}>}
 */
export function violations(view = snapshot()) {
    const out = [];
    for (const anchor of view.typeAt.keys()) {
        const hit = violationAt(view, anchor);
        if (hit) out.push(hit);
    }
    return out;
}

/**
 * Whether a placement is legal, and if not, why not — in a sentence a player
 * can act on.
 *
 * Checks the incoming Token first so the message names the rule the player just
 * broke, then everything else in the neighbourhood so the symmetric case is
 * caught too.
 *
 * @param {number} anchor    where it would land
 * @param {string} typeId    what is landing
 * @param {object} [plan]    what else the placement moves — see {@link project}
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function checkPlacement(anchor, typeId, plan = {}) {
    const def = getTokenType(typeId);
    if (!def) return { ok: true };

    const view = project({ ...plan, place: { anchor, typeId } });

    const own = violationAt(view, anchor);
    if (own) return { ok: false, reason: own.reason };

    for (const other of adjacentAnchors(view, anchor)) {
        const hit = violationAt(view, other);
        if (hit) return { ok: false, reason: hit.reason };
    }

    // A cascade moves Tokens away from the anchor as well as towards it, so a
    // shoved Token can break a rule several tiles from where the player
    // dropped anything. Checking only the drop site would let that through.
    for (const { toTile } of plan.shifts || []) {
        const hit = violationAt(view, toTile);
        if (hit) return { ok: false, reason: hit.reason };
        for (const other of adjacentAnchors(view, toTile)) {
            const near = violationAt(view, other);
            if (near) return { ok: false, reason: near.reason };
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
 * the player never had to lose. Lifting the offender with the most trouble
 * around it and then asking again is what keeps the cost minimal.
 *
 * @param {(instance: object) => boolean} depositToVault — injected so this
 *   module does not import `TokenBank`, which imports `BoardState`, which is a
 *   circle the board layer keeps out of.
 * @returns {Array<{anchor: number, typeId: string, reason: string}>} what moved
 */
export function reconcile(depositToVault) {
    const moved = [];

    // Bounded hard. `violations` shrinks by at least one Token per pass, but a
    // loop over save-resident state is not a place to rely on that.
    for (let pass = 0; pass < 64; pass++) {
        const found = violations();
        if (!found.length) break;

        const worst = found[0];
        const instance = BoardState.getToken(worst.anchor);
        if (!instance) break;

        // If the Vault will not take it, leave it where it is rather than
        // destroy it. A board that is briefly illegal is recoverable; a Token
        // the player owned and no longer does is not.
        if (!depositToVault(instance)) break;

        BoardState.setToken(worst.anchor, null);
        moved.push(worst);
    }

    return moved;
}
