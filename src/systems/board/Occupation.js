// a mat held by the enemies it arrived with: until every one is beaten, heroes may fight and nothing else

import { GameState } from '../../state/GameState.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import * as BoardState from './BoardState.js';
import { isGuildHall } from './MatCap.js';

/**
 * A newly settled place arrives occupied (owner): a small fixed encounter stands on
 * its mat (`world/Arrival.js` writes it), and until every one of those enemies is beaten the mat
 * is held. The board says so itself, `board.arrival = { ids, cleared }`, so the state travels with
 * the Region and comes back with a save.
 *
 * While a mat is held a hero may be sent at any enemy and at nothing else ({@link holds}): its
 * nodes, camps and stations wait. Everything still runs on its own (spawners, passive output); only
 * hero work waits. A hero whose arrival enemy falls takes on the nearest one still standing that no
 * other hero has ({@link nextEnemyAfter}), so heroes sent at the encounter keep fighting while the player is away.
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

/**
 * The arrival's enemies still standing on the live mat, in their written order.
 *
 * ⚠️ Only Tokens whose type is still an enemy: one whose type was deleted or renamed in the CMS
 * stays on the mat (restoring the id restores the fight) but can never be fought, so counting it
 * would hold the mat for good.
 */
export function standingEnemies() {
    const a = arrivalOf();
    if (!a) return [];
    return a.ids.map(id => BoardState.getTokenById(id)).filter(t => t && isEnemyDef(getTokenType(t.typeId)));
}

/** Whether instance id `id` is one of the live mat's arrival enemies (standing or beaten). */
export function isArrivalId(id) {
    return !!arrivalOf()?.ids.includes(id);
}

/**
 * Whether the arrival holds `instance` from hero work: the mat is held, and it is not an enemy
 * or the Guild Hall.
 */
export function holds(instance) {
    if (!instance?.typeId || !isOccupied()) return false;
    if (isGuildHall(instance)) return false;
    return !isEnemyDef(getTokenType(instance.typeId));
}

/** Whether a Token of `typeId` is drawn held (dimmed) while the mat is: anything but an enemy or the Hall. */
export function isHeldType(typeId) {
    if (!typeId) return false;
    const def = getTokenType(typeId);
    return !isGuildHall({ typeId }) && !isEnemyDef(def);
}

/**
 * The arrival enemy `heroId` takes on once `goneId` (an arrival enemy) has fallen: the nearest one
 * still standing to `from` that no other hero fights or is sent at, the earlier written on a tie;
 * when every one is taken, the nearest of them all (the hero waits beside that fight). Null when
 * `goneId` was not one of them or none stands.
 */
export function nextEnemyAfter(goneId, from, heroId = null) {
    if (!isOccupied() || !isArrivalId(goneId)) return null;
    const flags = BoardState.getFlags();
    const taken = (enemy) => {
        const fighter = BoardState.heroOfInstance(enemy.id);
        if (fighter && fighter !== heroId) return true;
        for (const [otherId, flag] of Object.entries(flags)) {
            if (otherId !== heroId && flag?.pinnedTo === enemy.id) return true;
        }
        return false;
    };
    let best = null;
    let bestD = Infinity;
    let free = null;
    let freeD = Infinity;
    for (const enemy of standingEnemies()) {
        const dx = enemy.x - (from?.x ?? 0);
        const dy = enemy.y - (from?.y ?? 0);
        const d = dx * dx + dy * dy;
        if (d < bestD) {
            best = enemy;
            bestD = d;
        }
        if (d < freeD && !taken(enemy)) {
            free = enemy;
            freeD = d;
        }
    }
    return free ?? best;
}
