// the player's orders: where a hero dropped on the mat goes, and why not

import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { GameState } from '../../state/GameState.js';
import { t } from '../../i18n/index.js';
import { clampToMat } from '../../config/matGeometry.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { getAllItems } from '../../config/registries/itemRegistry.js';
import { neededToolOf, toolNeedPhrase } from '../../config/registries/toolKinds.js';
import { ALERT } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as BoardPromotion from './BoardPromotion.js';
import * as Flags from './Flags.js';
import * as Camps from './Camps.js';
import { isGuildHall } from './MatCap.js';
import { workConfigOf } from './StationRecipe.js';
import * as PromotionSystem from '../hero/PromotionSystem.js';

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
 *
 * Results carry `success`, and on a refusal `reason` (the words) and `instanceId` (the Token it is
 * said over), so `dropOnMat.announce` can say it where it was aimed.
 */

/** A healing hero's record, or null. Read straight from state, never rehydrated. */
function woundedHero(heroId) {
    const hero = (GameState.state?.heroes || []).find(h => h?.id === heroId);
    return hero && hero.status === 'wounded' ? hero : null;
}

/** `0:42`, `4:05`. */
function clock(ms) {
    const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The words for an order refusal on `instance` (`Flags.orderRefusal`'s reason). For a camp the need
 * is a Token's in its reach (`Flags.orderToken`'s `refusedOn`), or the camp's own skill.
 */
export function refusalText(heroId, instance, reason) {
    const def = getTokenType(instance?.typeId);
    const skillId = def ? (Camps.campOf(def)?.skill || workConfigOf(def, instance)?.skill) : null;
    const skill = skillId ? (getSkill(skillId)?.name || skillId) : null;
    if (BoardPromotion.isPromotionToken(instance)) {
        const job = BoardPromotion.jobFor(instance);
        const verdict = job ? PromotionSystem.canPromote(heroId, job.id) : null;
        if (verdict?.detail) return verdict.detail;
    }
    switch (reason) {
        case Flags.SKIP.DISALLOWED: return t('orders.disallowed');
        case ALERT.NO_TOOL: {
            const need = neededToolOf(def);
            return need ? t('orders.needs', { what: toolNeedPhrase(need, getAllItems()) }) : t('orders.nothing');
        }
        case ALERT.ACCESS: {
            const level = workConfigOf(def, instance)?.skillRequired || 1;
            return skill ? t('orders.needs', { what: `${skill} ${level}/99` }) : t('orders.nothing');
        }
        case ALERT.UNSKILLED: return skill ? t('orders.needs', { what: skill }) : t('orders.nothing');
        default: return t('orders.nothing');
    }
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
        return {
            success: false,
            reason: t('orders.healing', { hero: wounded.name || 'This hero', time: clock(wounded.woundedRemainingMs) }),
            instanceId: target?.id ?? null
        };
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
