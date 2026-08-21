// Fantasy Guild — the `Applies` keyword, board side (effect grammar Phase 2)

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getStatusEffect } from '../../config/registries/statusRegistry.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import { neighboursOfToken } from './adjacency.js';
import { matchesTokenTarget } from './TileModifiers.js';
import * as BoardState from './BoardState.js';
import * as BoardCombat from './BoardCombat.js';

/**
 * `Applies` — content putting a status on somebody.
 *
 * Seven statuses exist and work, and `StatusEffectSystem` has applied them
 * correctly since it was built — but **only combat ever called it**. Nothing a
 * person could author reached them. This is that wire.
 *
 * ## ⚠️ The honest part: a filter selects Tokens, a status lands on a person
 * The owner ruled that `Applies` uses the same filter as every other keyword,
 * so the grammar has one targeting concept rather than two. That is the right
 * call for authoring and it leaves exactly one thing to resolve honestly: what
 * does *"adjacent Coast Tokens"* mean when the thing being applied cannot land
 * on a Token at all?
 *
 * **The only reading that is true of something real: the people working them.**
 * A Token holds at most one hero, and an enemy Token holds at most one live
 * fight. So a filter selecting Tokens resolves to that set of occupants, and
 * `statementText.js` renders the sentence as *"Applies Well Fed to heroes on
 * adjacent Coast Tokens"* — which is literally what happens, rather than a
 * shorter sentence that would leave the reader guessing.
 *
 * A filter that selects a Token nobody is standing on reaches nobody. That is
 * not a failure; it is the same as a buff aimed at an empty tile, and it is why
 * the sentence says *heroes on* rather than *Tokens*.
 *
 * ## Two moments, matching `Grants` exactly
 * * **Untriggered** — the neighbour finishing a cycle. It is the only ambient
 *   instant at which a status could land on the person who was working, and it
 *   is the same moment `Grants` uses, so the two keywords read alike.
 * * **Triggered** — whenever the `When` clause fires.
 *
 * A status is a stack applied at an instant, not a field that hangs in the air,
 * so there is deliberately **no** continuously-reapplied form. One would put a
 * fresh stack on the hero every tick and pin every DoT at maximum forever.
 *
 * ## ⚠️ The enemy path is built but unverified
 * `applyToEnemy` wants the ephemeral fight card, which `BoardCombat` holds per
 * tile, so routing to it is three lines and natural. But **no authored Token is
 * typed `enemy`** and combat is parked (CMS-2), so nothing in the game can
 * exercise it. It is written the way the hero path is written, and it has never
 * run in a real session.
 */

/**
 * Who is on a tile, as something a status can be applied to.
 *
 * @returns {{apply: () => void}|null}
 */
function occupantOf(tile) {
    const heroId = BoardState.heroOnTile(tile);
    if (heroId) {
        return { apply: (statusId, stacks) => StatusEffectSystem.applyToHero(heroId, statusId, stacks) };
    }

    const instance = BoardState.getToken(tile);
    if (instance && BoardCombat.isEnemyToken(instance)) {
        const fight = BoardCombat.getFight(tile);
        // Only a fight in progress: an enemy nobody has engaged has no status
        // list to put anything on, and inventing one here would make a status
        // that survives being ignored.
        if (fight) return { apply: (statusId, stacks) => StatusEffectSystem.applyToEnemy(fight, statusId, stacks) };
    }

    return null;
}

/** Whether a payload names a status the engine has, with a roll that hit. */
function rolls(payload, random = Math.random) {
    if (!payload?.statusId || !getStatusEffect(payload.statusId)) return false;
    const chance = payload.chance ?? 100;
    return chance >= 100 || random() * 100 < chance;
}

/**
 * Put one `Applies` payload onto whoever is working `tile`.
 *
 * Used by the **ambient** path: the statement was collected by
 * `TileModifiers.collectStatusApplications`, which already matched the filter
 * against this tile's Token, so the targeting question is settled by the time
 * this is called.
 *
 * @returns {boolean} whether anybody actually received it
 */
export function applyAt(tile, payload, random = Math.random) {
    if (!rolls(payload, random)) return false;
    const target = occupantOf(tile);
    if (!target) return false;
    target.apply(payload.statusId, Math.max(1, payload.stacks || 1));
    return true;
}

/**
 * Put one `Applies` statement onto the people working the neighbours it names.
 *
 * Used by the **triggered** path, where the statement is read from the Token
 * carrying it rather than from the Token receiving it, so the filter has to be
 * matched here.
 *
 * @returns {number} how many people received it
 */
export function applyToNeighbours(sourceTile, statement, random = Math.random) {
    const payload = statement?.payload;
    if (!rolls(payload, random)) return 0;

    const sourceDef = getTokenType(BoardState.getToken(sourceTile)?.typeId);
    const seen = new Set();
    let reached = 0;

    for (const tile of neighboursOfToken(sourceTile, sourceDef?.size || 1)) {
        const occ = BoardState.getOccupyingToken(tile);
        if (!occ?.instance) continue;
        if (seen.has(occ.anchorIndex)) continue;
        seen.add(occ.anchorIndex);

        if (!matchesTokenTarget(statement.to, getTokenType(occ.instance.typeId))) continue;

        const target = occupantOf(occ.anchorIndex);
        if (!target) continue;
        target.apply(payload.statusId, Math.max(1, payload.stacks || 1));
        reached += 1;
    }

    return reached;
}
