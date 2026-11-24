/**
 * The waiting speech bubbles a hero raises (`speechBubbles.js`), each with the condition that
 * clears it: gear that broke, a hero back from a wound, and running out of what the work needs.
 */

import { GameState } from '../../../state/GameState.js';
import { BOARD_EVENTS, ALERT } from '../../../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import * as Flags from '../../../systems/board/Flags.js';
import { toolsOfHero } from '../../../systems/equipment/HeroTools.js';
import { getHeroWeaponSlot } from '../../../systems/combat/CombatFormulas.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getGrid, categoryOfItem, isConsumableCategory } from '../../../config/registries/equipmentConstants.js';
import { toolOf, toolKindLabel, neededToolOf } from '../../../config/registries/toolKinds.js';
import { getTokenType } from '../../../config/registries/tokenRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import * as WorkCheck from '../../../systems/board/WorkCheck.js';
import { availableOf } from '../../../systems/board/InputAllocator.js';
import { raiseBubble, bubbleKeysOf } from './speechBubbles.js';
import { t } from '../../../i18n/index.js';
import { SPEECH_TONE } from './speechTone.js';

/** The key a broken tool's or weapon's bubble is raised under. */
export const GEAR_BROKE_KEY = 'gearBroke';

/** What may answer a broken item: hearing these, the store asks again. */
const GEAR_CHECK_ON = Object.freeze([
    ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED,
    ENGINE_EVENTS.HERO_DEPLOYED,
    BOARD_EVENTS.HERO_MOVED
]);

function heroRecord(heroId) {
    return (GameState.state?.heroes || []).find(h => h?.id === heroId) || null;
}

/** The order a hero has now, as a number to compare: another order is another job. Null for none. */
function jobOf(heroId) {
    const flag = BoardState.flagOf(heroId);
    if (!flag) return null;
    return flag.plantedAt ?? flag.pinnedTo ?? 0;
}

/**
 * The bubble for `heroId`'s broken gear: a tool of `kind` (or a weapon, `kind` null), worded with
 * `name`. It stands while the hero holds nothing working of that kind and keeps the job they had.
 */
export function gearBrokeSpec(heroId, { kind, name }) {
    const job = jobOf(heroId);
    const holds = () => {
        const hero = heroRecord(heroId);
        if (!hero || jobOf(heroId) !== job) return false;
        if (kind) return !toolsOfHero(hero).some(tool => tool.backed && tool.kind === kind);
        return getHeroWeaponSlot(hero) === null;
    };
    return {
        key: GEAR_BROKE_KEY,
        text: t('messages.gearBroke', { item: name }),
        tone: SPEECH_TONE.ATTENTION,
        holds,
        checkOn: GEAR_CHECK_ON
    };
}

/** The bubble for a `GEAR_BROKE` payload, or null. */
export function gearBrokeSpecOf({ heroId, itemId, use } = {}) {
    if (!heroId || !itemId) return null;
    const item = getItem(itemId);
    const tool = use === 'fight' ? null : toolOf(item);
    return gearBrokeSpec(heroId, { kind: tool?.kind ?? null, name: item?.name || itemId });
}

/**
 * After a load, a hero still ordered onto work they cannot do for want of a tool lost it: an order
 * is refused without one. Worded with the tool's kind, since which item broke is not saved. A broken
 * weapon ended its order, so nothing stands for it here (the needs-a-job mark says it).
 */
export function rebuildGearBroke(raise) {
    for (const [heroId, flag] of Object.entries(BoardState.getFlags() || {})) {
        if (!flag || Flags.isSpot(flag)) continue;
        const ordered = BoardState.getTokenById(flag.pinnedTo);
        if (!ordered) continue;
        const refusal = Flags.orderRefusal(heroId, ordered);
        if (refusal?.reason !== ALERT.NO_TOOL) continue;
        const need = neededToolOf(getTokenType((refusal.on || ordered).typeId));
        if (!need) continue;
        raise(heroId, gearBrokeSpec(heroId, { kind: need.kind, name: toolKindLabel(need.kind) }));
    }
}

/** The key a hero back from a wound says so under. */
export const RECOVERED_KEY = 'recovered';

/** What may mean the hero has started work again, or is down again. */
const RECOVERED_CHECK_ON = Object.freeze([
    BOARD_EVENTS.CYCLE_START,
    BOARD_EVENTS.ALERT_CHANGED,
    BOARD_EVENTS.HERO_MOVED,
    ENGINE_EVENTS.HEROES_UPDATED
]);

/** Whether the hero is at a Token and working it, not stuck there. */
function working(heroId) {
    const at = BoardState.getTokenById(BoardState.workTokenOf(heroId));
    return !!at && !at.alert;
}

/**
 * "Recovered, ready to work!": stands until the hero starts work (or is down again). Not rebuilt on
 * a load: it is news of a moment, and nothing saved says a hero has just recovered.
 */
export function recoveredSpec(heroId) {
    return {
        key: RECOVERED_KEY,
        text: t('messages.recovered'),
        tone: SPEECH_TONE.ATTENTION,
        holds: () => {
            const hero = heroRecord(heroId);
            return !!hero && hero.status !== 'wounded' && !working(heroId);
        },
        checkOn: RECOVERED_CHECK_ON
    };
}

/** The key a hero's "Needs {item}" is raised under: one per item. */
export const needsItemKey = (itemId) => `needs:${itemId}`;

/**
 * What may put the item back within reach (the Bank, or loot on the floor the work also draws on),
 * or take the work away (another order, sent home, knocked out).
 */
const NEEDS_CHECK_ON = Object.freeze([
    ENGINE_EVENTS.INVENTORY_UPDATED,
    ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED,
    BOARD_EVENTS.SPRITES_CHANGED,
    ENGINE_EVENTS.HEROES_UPDATED,
    ENGINE_EVENTS.HERO_DEPLOYED,
    BOARD_EVENTS.HERO_MOVED
]);

/** Whether the hero carries `itemId` in a consumable cell, as bait is carried. */
function carries(hero, itemId) {
    return getGrid(hero).some(id => id === itemId && isConsumableCategory(categoryOfItem(id)));
}

/**
 * The bubble for a hero whose work stops for want of `itemId`: "Needs Coal", the same words
 * whether they ran dry or never had any. It stands until `quantity` of it is within reach again
 * (and, when it must be `carried`, as bait is, until the hero carries it too), or the hero is given
 * another job (or none), as broken gear's does. A hero who let go of Token `leftFrom` for it is past
 * the need once they work that Token again (a Trap taken up in place of a rod needs no bait).
 */
export function needsItemSpec(heroId, itemId, { quantity = 1, carried = false, leftFrom = null } = {}) {
    const needed = Math.max(1, Number(quantity) || 1);
    const job = jobOf(heroId);
    return {
        key: needsItemKey(itemId),
        text: t('messages.needs', { item: getItem(itemId)?.name || itemId }),
        tone: SPEECH_TONE.CANT,
        holds: () => {
            const hero = heroRecord(heroId);
            if (!hero || jobOf(heroId) !== job) return false;
            if (leftFrom && BoardState.workTokenOf(heroId) === leftFrom) return false;
            return availableOf(itemId) < needed || (carried && !carries(hero, itemId));
        },
        checkOn: NEEDS_CHECK_ON
    };
}

/** The key a hero's "Needs Fishing 40" is raised under: one per skill and level. */
export const needsLevelKey = (skill, level) => `needs:level:${skill}:${level}`;

/** A skill's name for the player ("Fishing"), else the id. */
function skillName(skill) {
    return getSkill(skill)?.name || String(skill || '');
}

/**
 * The bubble for a hero stopped at water `instanceId` because its fish are above them: "Needs
 * Fishing 40". It stands while they keep the job and have not gone back to work on it.
 */
export function needsLevelSpec(heroId, { instanceId, skill, level }) {
    const job = jobOf(heroId);
    return {
        key: needsLevelKey(skill, level),
        text: t('messages.needsLevel', { skill: skillName(skill), level }),
        tone: SPEECH_TONE.CANT,
        holds: () => {
            if (!heroRecord(heroId) || jobOf(heroId) !== job) return false;
            if (BoardState.workTokenOf(heroId) === instanceId) return false;
            const at = BoardState.getTokenById(instanceId);
            return !!at && WorkCheck.baitReason(heroId, at) === ALERT.FISH_LEVEL;
        },
        checkOn: NEEDS_CHECK_ON
    };
}

/** Raise {@link needsLevelSpec} for a `CATCH_NEEDS_LEVEL` payload, once: a bubble already up is kept. */
export function raiseNeedsLevel({ heroId, instanceId, skill, level } = {}) {
    if (!heroId || !instanceId || !(level > 0)) return false;
    return raiseBubble(heroId, needsLevelSpec(heroId, { instanceId, skill, level }), { keepExisting: true });
}

/** The key a hero's "No Salmon here" is raised under: one per spot and lure. */
export const noFishKey = (instanceId, lureId) => `noFish:${instanceId}:${lureId}`;

/** "Trout", "Trout or Salmon", "Trout, Tuna or Salmon": a lure's fish by name. */
function fishWords(fish) {
    const names = (fish || []).map(id => getItem(id)?.name || id);
    return names.length < 2 ? (names[0] || '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * The bubble for a hero whose lure names no fish of spot `instanceId`: "No Salmon here", said once.
 * It stands while they work that spot carrying the lure, or until hovered.
 */
export function noFishSpec(heroId, { instanceId, lureId, fish }) {
    return {
        key: noFishKey(instanceId, lureId),
        text: t('messages.noFishHere', { fish: fishWords(fish) }),
        tone: SPEECH_TONE.ATTENTION,
        holds: () => {
            const hero = heroRecord(heroId);
            return !!hero && BoardState.workTokenOf(heroId) === instanceId && getGrid(hero).includes(lureId);
        },
        checkOn: NEEDS_CHECK_ON
    };
}

/** Raise {@link noFishSpec} for a `LURE_FISH_ABSENT` payload, once: a bubble already up, drawn or dismissed, is kept. */
export function raiseNoFish({ heroId, instanceId, lureId, fish } = {}) {
    if (!heroId || !instanceId || !lureId) return false;
    return raiseBubble(heroId, noFishSpec(heroId, { instanceId, lureId, fish }), { keepExisting: true });
}

/** Whether a waiting bubble already says why the hero stopped: going idle then says nothing more. */
export function saysWhyStopped(heroId) {
    return bubbleKeysOf(heroId).some(key => key === GEAR_BROKE_KEY || key.startsWith('needs:'));
}

/**
 * A hero's work stops for want of an item (a station's Coal or Food, a fight's arrows, a catch's
 * bait, a field's seed): the hero says "Needs {item}" until it is within reach again or the player
 * hovers or clicks it. Safe to call each time the engine says it again: a bubble already up for
 * that item, drawn or dismissed, is left as it is.
 *
 * @param {string} heroId
 * @param {string} itemId
 * @param {{quantity?: number, carried?: boolean, leftFrom?: string|null}} [options] how many the
 *   work takes at once (default 1); `carried` when the hero must carry it in a consumable cell as
 *   well (bait); `leftFrom`, the Token the hero let go of for it
 * @returns {boolean} whether a bubble was raised
 */
export function raiseNeedsItem(heroId, itemId, { quantity = 1, carried = false, leftFrom = null } = {}) {
    if (!heroId || !itemId) return false;
    return raiseBubble(heroId, needsItemSpec(heroId, itemId, { quantity, carried, leftFrom }), { keepExisting: true });
}

/**
 * After a load, a hero ordered onto a station still short of an input says so again. Read from the
 * order, which is saved, when the hero's claim on the station is not back yet.
 */
export function rebuildNeedsItem(raise) {
    for (const hero of GameState.state?.heroes || []) {
        if (!hero?.id) continue;
        const flag = BoardState.flagOf(hero.id);
        const at = BoardState.getTokenById(BoardState.workTokenOf(hero.id))
            || (flag && !Flags.isSpot(flag) ? BoardState.getTokenById(flag.pinnedTo) : null);
        if (!at) continue;
        // Asked of the rules, not read off the Token's alert, which the first tick after a load raises.
        const found = WorkCheck.fixableReason(at.id, at, hero.id);
        if (found.reason !== ALERT.INPUTS) continue;
        const missing = found.inputCheck?.missing?.[0];
        if (!missing?.itemId) continue;
        raise(hero.id, needsItemSpec(hero.id, missing.itemId, { quantity: missing.needed }));
    }
}
