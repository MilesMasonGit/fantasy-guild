// the player's orders: where a hero dropped or right-clicked on the mat goes, and why not

import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { GameState } from '../../state/GameState.js';
import { t } from '../../i18n/index.js';
import { formatClock } from '../../utils/Formatters.js';
import { clampToMat } from '../../config/matGeometry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { neededToolOf, toolNeedPhrase } from '../../config/registries/toolKinds.js';
import { ALERT } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as Flags from './Flags.js';
import * as Camps from './Camps.js';
import { isGuildHall } from './MatCap.js';
import { workConfigOf } from './StationRecipe.js';

/**
 * A hero dropped on the mat (`dropOnMat`, from the figure, the flag or the roster tab) gets an
 * order here:
 * - on a Token they can work: they walk there and work only it (`Flags.orderToken`); a Token
 * another hero works, or one resting, growing or out of an input, is still theirs to wait by;
 * - on a camp: they work what it hands out in its reach, one Token at a time (`Camps.js`); on an
 * enemy camp, they hunt what it spawns;
 * - on a Token they cannot work: refused with the reason ("Needs Pickaxe"), and they keep the
 * order they had;
 * - on the Guild Hall: home, to wait there (`Flags.sendHome`);
 * - on bare ground: they go there and idle (`Flags.orderSpot`).
 * A hero healing from a defeat takes no order until healed.
 * A right-click with a hero selected gives the very same order (`rightClickOrders.js` hands it to
 * `dropOnMat`), except on the hero's own job, which stops them ({@link ownJobAt}, {@link stop}).
 *
 * Results carry `success`, and on a refusal `reason` (the words) and `instanceId` (the Token it is
 * said over), so `dropOnMat.announce` can say it where it was aimed.
 */

/** A healing hero's record, or null. Read straight from state, never rehydrated. */
function woundedHero(heroId) {
    const hero = (GameState.state?.heroes || []).find(h => h?.id === heroId);
    return hero && hero.status === 'wounded' ? hero : null;
}

/**
 * The words for an order refusal on `instance` (`Flags.orderRefusal`'s reason). For a camp the need
 * is a Token's in its reach (`Flags.orderToken`'s `refusedOn`), or the camp's own skill.
 */
export function refusalText(heroId, instance, reason) {
    const def = getTokenType(instance?.typeId);
    const skillId = def ? (Camps.campOf(def)?.skill || workConfigOf(def, instance)?.skill) : null;
    const skill = skillId ? (getSkill(skillId)?.name || skillId) : null;
    switch (reason) {
        case Flags.SKIP.OCCUPIED: return t('orders.occupied');
        case ALERT.NO_TOOL: {
            const need = neededToolOf(def);
            return need ? t('orders.needs', { what: toolNeedPhrase(need, getAllItems()) }) : t('orders.nothing');
        }
        case ALERT.ACCESS: {
            const level = workConfigOf(def, instance)?.skillRequired || 1;
            return skill ? t('orders.levelLow', { skill, level }) : t('orders.nothing');
        }
        case ALERT.UNSKILLED: return skill ? t('orders.needs', { what: skill }) : t('orders.nothing');
        default: return t('orders.nothing');
    }
}

/** "Ana is healing: 0:42", the refusal for a healing hero. */
const healingText = (hero) => t('orders.healing', { hero: hero.name || 'This hero', time: formatClock(hero.woundedRemainingMs) });

/**
 * What a drop of `heroId` on `instance` would do, asked while they are carried over it: `snap` when
 * the drop would give them the Token as their job (the flag snaps to its centre), else `reason`,
 * the words the drop would refuse with (null for the Guild Hall, which takes them home). The same
 * gates, in the same order, as {@link orderAt}.
 * @returns {{ snap: boolean, reason: string|null }}
 */
export function aimAt(heroId, instance) {
    if (!heroId || !instance) return { snap: false, reason: null };
    const wounded = woundedHero(heroId);
    if (wounded) return { snap: false, reason: healingText(wounded) };
    if (isGuildHall(instance)) return { snap: false, reason: null };
    const refusal = Flags.orderRefusal(heroId, instance);
    if (!refusal) return { snap: true, reason: null };
    const on = (refusal.on?.id && BoardState.getTokenById(refusal.on.id)) || instance;
    return { snap: false, reason: refusalText(heroId, on, refusal.reason) };
}

/** Whether `heroId` could be ordered onto `instance` (the Tokens that light while they are carried). */
export function canOrderOnto(heroId, instance) {
    if (!heroId || !instance) return false;
    if (isGuildHall(instance)) return true;
    return !Flags.orderRefusal(heroId, instance);
}

/**
 * The drop: an order for `heroId` from where they were let go, `point` in mat units.
 * @returns {{ success: boolean, reason?: string, instanceId?: string|null, order?: 'token'|'spot'|'home', unchanged?: boolean }}
 */
export function orderAt(heroId, point) {
    if (!heroId) return { success: false, reason: t('orders.noHero') };
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return { success: false, reason: t('orders.nowhere') };
    const target = Flags.tokenAtPoint(point);
    const wounded = woundedHero(heroId);
    if (wounded) {
        return { success: false, reason: healingText(wounded), instanceId: target?.id ?? null };
    }
    if (target && isGuildHall(target)) return sendHome(heroId);
    if (target) {
        const result = Flags.orderToken(heroId, target);
        if (!result.success) {
            const on = (result.refusedOn && BoardState.getTokenById(result.refusedOn)) || target;
            return { success: false, reason: refusalText(heroId, on, result.refused), instanceId: target.id };
        }
        if (!result.unchanged) EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'order' });
        return { ...result, order: 'token', instanceId: target.id };
    }
    const at = clampToMat(point);
    const result = Flags.orderSpot(heroId, at);
    if (result.success && !result.unchanged) EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'order' });
    return { ...result, order: 'spot', point: at };
}

/** Send `heroId` home to the Guild Hall, their order cleared. Already home: nothing changes. */
export function sendHome(heroId) {
    if (!heroId) return { success: false, reason: t('orders.noHero') };
    const sent = Flags.sendHome(heroId);
    if (sent) EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'order' });
    return { success: true, order: 'home', unchanged: !sent };
}

/** The Token `heroId`'s order names while it stands on the mat, or null. */
export function jobTokenOf(heroId) {
    const flag = BoardState.flagOf(heroId);
    return typeof flag?.pinnedTo === 'string' ? BoardState.getTokenById(flag.pinnedTo) : null;
}

/**
 * Whether `instance` is what `heroId` is busy with: the Token their order names (a camp or an enemy
 * camp included), or the one they work, walk to or fight (their claim, a camp's Token too). A job
 * cannot be given twice, so an order there stops them instead ({@link ownJobAt}).
 */
export function isOwnJob(heroId, instance) {
    if (!heroId || !instance?.id) return false;
    if (Flags.pinnedIdOf(heroId) === instance.id) return true;
    return BoardState.claimOfHero(heroId)?.instanceId === instance.id;
}

/**
 * The Token at mat `point` when it is `heroId`'s own job ({@link isOwnJob}), or null: the right-click
 * there stops them ({@link stop}) where a drop would change nothing. The drop's own hit test
 * (`Flags.tokenAtPoint`), so the two never disagree at a Token's edge.
 */
export function ownJobAt(heroId, point) {
    if (!heroId || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const target = Flags.tokenAtPoint(point);
    return target && isOwnJob(heroId, target) ? target : null;
}

/**
 * Stop `heroId` where they stand (`Flags.stop`): they wait there with the "needs a job" mark, the
 * Token they leave reset and a fight ended as a recall leaves them. A hero with no Token order
 * (waiting on bare ground, or home) has nothing to stop: nothing changes.
 */
export function stop(heroId) {
    if (!heroId) return { success: false, reason: t('orders.noHero') };
    const stopped = Flags.stop(heroId);
    if (stopped) EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'order' });
    return { success: true, order: 'stop', unchanged: !stopped };
}
