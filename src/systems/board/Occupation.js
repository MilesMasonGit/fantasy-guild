// a mat held by the enemies it arrived with: until every one is beaten, heroes may fight and nothing else

import { GameState } from '../../state/GameState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import * as BoardState from './BoardState.js';
import { isGuildHall } from './MatCap.js';

/**
 * A newly settled place arrives occupied (owner, 2026-10-29): a small fixed encounter stands on
 * its mat (`world/Arrival.js` writes it), and until every one of those enemies is beaten the mat
 * is held. The board says so itself, `board.arrival = { ids, cleared }`, so the state travels with
 * the Region and comes back with a save.
 *
 * While a mat is held a hero may be sent at any enemy and at nothing else ({@link holds}): its
 * nodes, camps and stations wait. Everything still runs on its own (spawners, passive output); only
 * hero work waits. A hero whose arrival enemy falls takes on the nearest one still standing
 * ({@link nextEnemyAfter}), so heroes sent at the encounter keep fighting while the player is away.
 *
 * A leaf: reads the board and the registries only.
 */

/** The live board's arrival record, or null for a mat that never had one. */
export function arrivalOf(board = GameState.state?.board) {
    const a = board?.arrival;
    return a && typeof a === 'object' && Array.isArray(a.ids) ? a : null;
}

/** Whether the live mat is held by its arrival. */
export function isOccupied() {
    const a = arrivalOf();
    return !!a && a.cleared !== true;
}

/** The arrival's enemies still standing on the live mat, in their written order. */
export function standingEnemies() {
    const a = arrivalOf();
    if (!a) return [];
    return a.ids.map(id => BoardState.getTokenById(id)).filter(Boolean);
}

/** Whether instance id `id` is one of the live mat's arrival enemies (standing or beaten). */
export function isArrivalId(id) {
    return !!arrivalOf()?.ids.includes(id);
}

/**
 * Whether the arrival holds `instance` from hero work: the mat is held, and it is not an enemy,
 * the Guild Hall or a quest.
 */
export function holds(instance) {
    if (!instance?.typeId || !isOccupied()) return false;
    if (isGuildHall(instance) || instance.typeId === QUEST_TOKEN_TYPE) return false;
    return !isEnemyDef(getTokenType(instance.typeId));
}

/** Whether a Token of `typeId` is drawn held (dimmed) while the mat is: anything but an enemy, the Hall or a quest. */
export function isHeldType(typeId) {
    if (!typeId || typeId === QUEST_TOKEN_TYPE) return false;
    const def = getTokenType(typeId);
    return !isGuildHall({ typeId }) && !isEnemyDef(def);
}

/**
 * The arrival enemy a hero takes on once `goneId` (an arrival enemy) has fallen: the nearest one
 * still standing to `from`, the earlier written on a tie; null when `goneId` was not one of them
 * or none stands.
 */
export function nextEnemyAfter(goneId, from) {
    if (!isOccupied() || !isArrivalId(goneId)) return null;
    let best = null;
    let bestD = Infinity;
    for (const enemy of standingEnemies()) {
        const dx = enemy.x - (from?.x ?? 0);
        const dy = enemy.y - (from?.y ?? 0);
        const d = dx * dx + dy * dy;
        if (d < bestD) {
            best = enemy;
            bestD = d;
        }
    }
    return best;
}
