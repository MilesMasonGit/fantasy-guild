// Demolition: which Tokens may be taken off the mat for good, and the job that takes them

import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { QUEST_TOKEN_TYPE } from '../../config/registries/engineTokens.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { DEMOLITION_SKILL_ID } from '../../config/registries/skillRegistry.js';
import * as BoardState from './BoardState.js';
import { isGuildHall } from './MatCap.js';
import * as Landmarks from './Landmarks.js';

/**
 * Two questions about removing a Token for good.
 *
 * {@link canDemolish}: may it be taken off at all? Never the Guild Hall (or a type that cannot
 * leave the mat) and never a landmark, except while the dev layout tool is on
 * (`Landmarks.setLayoutEditing`). The discard bin and `Placement.removePlacedToken` ask it.
 *
 * {@link canMark}: may the player mark it for demolition? Narrower: nor a map's nodes (the settled
 * layout is permanent), quests or enemies, and never a landmark, dev tool or not. A marked Token
 * (`instance.demolish: true`, saved) is taken away by a hero holding Construction: no refund, no
 * loot, never a depletion.
 *
 * While marked the Token is that work and nothing else: `StationRecipe.workConfigOf(def,
 * instance)` answers {@link DEMOLITION_CONFIG}, so flags send Construction heroes to it whatever
 * it was (a spawner, a station, a resting node), and the runner advances the demolition in place
 * of its recipe or training. Its own clocks stand still (`TimedChanges` skips it: no growth, turn,
 * spawn, refill or Passive Production), so it is still the Token the player marked when the hero
 * finishes. What it gives its neighbours by standing there (tags, auras, rules) it keeps giving
 * until it is gone.
 *
 * Progress is the Token's ordinary `cycleElapsedMs`: saved with it, and lost like any cycle when
 * its hero leaves. Marking and unmarking both start it from nothing.
 *
 * ⚠️ A finished demolition removes the Token here, never through `Charges.destroyToken`, which
 * would turn a respawning type's removal into a rest and announce a depletion.
 */

/** How long one demolition takes, in game ms. */
export const DEMOLISH_MS = 10000;

/** The Construction level a hero needs to demolish. */
export const DEMOLISH_LEVEL = 1;

/** The work a marked Token is: no inputs, no output, no XP. */
export const DEMOLITION_CONFIG = Object.freeze({
    skill: DEMOLITION_SKILL_ID,
    skillRequired: DEMOLISH_LEVEL,
    cycleTimeMs: DEMOLISH_MS,
    xp: 0,
    inputs: Object.freeze([]),
    outputs: Object.freeze([])
});

/** Why a Token cannot be marked. */
export const REFUSAL = Object.freeze({
    NO_TOKEN: 'no_token',
    GUILD_HALL: 'guild_hall',
    LANDMARK: 'landmark',
    MAP_NODE: 'map_node',
    QUEST: 'quest',
    ENEMY: 'enemy'
});

/** What the player is told for each refusal. */
export const REFUSAL_TEXT = Object.freeze({
    [REFUSAL.NO_TOKEN]: 'No Token there.',
    [REFUSAL.GUILD_HALL]: 'The Guild Hall cannot be demolished.',
    [REFUSAL.LANDMARK]: 'Landmarks cannot be demolished.',
    [REFUSAL.MAP_NODE]: 'This was here when the Region was settled, so it cannot be demolished.',
    [REFUSAL.QUEST]: 'Quests cannot be demolished.',
    [REFUSAL.ENEMY]: 'Enemies cannot be demolished.'
});

const refuse = (code) => ({ success: false, code, reason: REFUSAL_TEXT[code] });

/** The Guild Hall, or a type that can never leave the mat. */
function isPermanent(instance) {
    return isGuildHall(instance) || !!getTokenType(instance.typeId)?.cannotLeaveBoard;
}

/** Whether `instance` may be removed for good (the bin, `Placement.removePlacedToken`). */
export function canDemolish(instance) {
    if (!instance?.typeId) return false;
    if (isPermanent(instance)) return false;
    return !Landmarks.isLandmark(instance) || Landmarks.isLayoutEditing();
}

/** Whether this Token is marked for demolition. */
export function isMarked(instance) {
    return instance?.demolish === true;
}

/** The Token on the mat a caller names, by instance id or by the instance itself. */
function tokenOf(target) {
    return BoardState.getTokenById(typeof target === 'string' ? target : target?.id);
}

/**
 * Why this Token may not be marked ({@link REFUSAL}), or null when it may. Everything bought,
 * built, spawned or planted may.
 */
export function refusalOf(instance) {
    if (!instance?.typeId) return REFUSAL.NO_TOKEN;
    if (isPermanent(instance)) return REFUSAL.GUILD_HALL;
    if (Landmarks.isLandmark(instance)) return REFUSAL.LANDMARK;
    if (BoardState.isFixture(instance)) return REFUSAL.MAP_NODE;
    if (instance.typeId === QUEST_TOKEN_TYPE) return REFUSAL.QUEST;
    if (isEnemyDef(getTokenType(instance.typeId))) return REFUSAL.ENEMY;
    return null;
}

/**
 * Whether the Token named (instance id or instance, on the mat) may be marked: `{ success: true,
 * instance }`, or `{ success: false, code, reason }` with a sentence the UI can show.
 */
export function canMark(target) {
    const instance = tokenOf(target);
    const code = refusalOf(instance);
    return code ? refuse(code) : { success: true, instance };
}

/** Start the Token's progress and alert from nothing, telling the mat. */
function restart(instance) {
    if (instance.cycleElapsedMs > 0) {
        instance.cycleElapsedMs = 0;
        EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: instance.id, percent: 0 });
    }
    // ⚠️ Cleared now, not on the runner's next pass: flags read the alert before the runner runs,
    // and a stale fixable alert would send the hero standing there off to other work.
    if (instance.alert) {
        instance.alert = null;
        EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: instance.id, alert: null });
    }
}

/** Tell the mat a Token's mark changed: flags look again, badges re-read, the game saves. */
function announce(instance) {
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, typeId: instance.typeId });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
}

/**
 * Mark a Token for demolition. Its cycle, recipe or training stops where it is (progress lost) and
 * the next Construction hero in reach takes it on; the one already standing there carries on as its
 * demolisher if their Construction rule allows. From the console: `Game.Demolition.mark(id)`.
 *
 * @returns {{ success: boolean, code?: string, reason?: string, unchanged?: boolean }}
 */
export function mark(target) {
    const check = canMark(target);
    if (!check.success) return check;
    const { instance } = check;
    if (isMarked(instance)) return { success: true, unchanged: true };
    instance.demolish = true;
    restart(instance);
    announce(instance);
    return { success: true };
}

/**
 * Take the mark off: the Token is its old self again and the half-done demolition is lost.
 *
 * @returns {{ success: boolean, code?: string, reason?: string, unchanged?: boolean }}
 */
export function unmark(target) {
    const instance = tokenOf(target);
    if (!instance) return refuse(REFUSAL.NO_TOKEN);
    if (!isMarked(instance)) return { success: true, unchanged: true };
    delete instance.demolish;
    restart(instance);
    announce(instance);
    return { success: true };
}

/** Every marked Token on the mat, in arrival order. */
export function markedTokens() {
    return BoardState.tokens().filter(isMarked);
}

/**
 * A demolition finished: the Token leaves the mat with nothing paid back and nothing dropped.
 * Called by the runner when its hero's work completes. Every event names the spot it stood on, as
 * a depletion's do.
 *
 * @returns {boolean} whether a Token was removed
 */
export function finish(instance, { heroId = null } = {}) {
    const token = tokenOf(instance);
    if (!token) return false;
    const at = { x: token.x, y: token.y };
    BoardState.removeToken(token.id);

    EventBus.publish(BOARD_EVENTS.TOKEN_DEMOLISHED, { instanceId: token.id, typeId: token.typeId, ...at, heroId });
    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: token.id, ...at, typeId: null });
    if (heroId) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...at });
    EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [at] });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
    return true;
}
