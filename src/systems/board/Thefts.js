// a Hideout's finished cycle: the thief's caught roll, the guard a catch sets, and the word of it

import { PLACEMENT } from '../../config/registries/placementRegistry.js';
import { logger } from '../../utils/Logger.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as EffectActions from './EffectActions.js';
import * as Hideouts from './Hideouts.js';

/**
 * The write side of a theft (`Hideouts.js` is the read side), called by `BoardRunner.completeCycle`
 * for a Hideout's cycle only.
 *
 * ⚠️ The bench's work check pins the `Math.random` stream: a Hideout's cycle draws once for the
 * caught roll (after Failure, before its drops), and a catch draws whatever the guard's landing
 * takes. No other cycle reaches here, so content without a Hideout draws nothing new.
 */

/**
 * Whether `heroId` is caught robbing `theft.campId` from Hideout `hideoutId`: one draw against
 * {@link Hideouts.caughtChanceAt}. A camp gone since the cycle began catches nobody.
 */
export function rollCaught(hideoutId, heroId, theft, random = Math.random) {
    const camp = theft ? BoardState.getTokenById(theft.campId) : null;
    if (!camp) return false;
    const chance = Hideouts.caughtChanceAt(hideoutId, heroId, camp);
    return random() * 100 < chance;
}

/**
 * Put a guard on `camp`: one of `enemyTypeId`, landed at the free spot nearest the camp (pushing if
 * it must), whatever the camp's cap and the mat's Token cap say. It stands still (no tether, so no
 * camp counts it) and carries `guardOf`, the camp's id, saved. Null when nowhere on the mat holds it.
 */
export function setGuard(camp, enemyTypeId, random = Math.random) {
    if (!camp || !enemyTypeId) return null;
    const landed = EffectActions.spawn(
        { payload: { typeId: enemyTypeId, placement: PLACEMENT.NEAREST_FREE } },
        { self: camp.id },
        random,
        { fields: { guardOf: camp.id } }
    );
    if (!landed) {
        logger.warn('Thefts', `No room on the mat for a guard on ${camp.typeId}`);
        return null;
    }
    const guard = BoardState.getTokenById(landed.instanceId);
    // Tethered to nothing, said outright, so no camp ever adopts it (`EnemyMotion.attachUntethered`).
    if (guard) BoardState.setTether(guard, null);
    return guard;
}

/**
 * After a Hideout's cycle: on a catch, a guard on the camp; either way the word of it (`THEFT`),
 * with what landed. A cycle that failed for another reason (a Failure rule) was no theft and says
 * nothing.
 * @param {object} hideout the Hideout on the mat
 * @param {{campId: string, campTypeId: string, enemyTypeId: string}} theft from `effectiveIO`
 * @param {{heroId?: string|null, caught: boolean, items: Array<{itemId: string, quantity: number}>}} result
 */
export function afterTheft(hideout, theft, { heroId = null, caught, items }) {
    const camp = BoardState.getTokenById(theft.campId);
    const guard = caught && camp ? setGuard(camp, theft.enemyTypeId) : null;
    EventBus.publish(BOARD_EVENTS.THEFT, {
        instanceId: hideout.id,
        typeId: hideout.typeId,
        campId: theft.campId,
        campTypeId: theft.campTypeId,
        heroId: heroId || null,
        caught: !!caught,
        guardId: guard?.id ?? null,
        items: caught ? [] : items
    });
    return guard;
}
