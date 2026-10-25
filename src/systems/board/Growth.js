// what a growth needs before it happens, and what it says while it waits

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { growsTermsOf } from '../../config/registries/tokenConstants.js';
import { EventBus } from '../core/EventBus.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as Demolition from './Demolition.js';
import * as InputAllocator from './InputAllocator.js';
import { nearbyGateMet } from './TileModifiers.js';

/**
 * A `grows` block may ask two things before its Token grows (`tokenConstants.growsTermsOf`):
 *
 * * **a Token in reach** (`needsNearby`): while none of those types stands within Near, the
 *   growth's clock stands still where it is (`TimedChanges`' grows row): a Stump with no Forest of
 *   its species stays a Stump. The answer is cached per Token (`TileModifiers.nearbyGateMet`).
 * * **a cost** (`cost`): paid when the growth happens, from the Bank and then the loot on the mat,
 *   only once the new Token has landed. Short of it, the growth is **stopped**: held at its finish
 *   and tried again every tick, as a growth with nowhere to stand is.
 *
 * Either wait raises an alert on the Token, its own channel (`GROWTH_ALERT_CHANGED`), for the
 * problem mark and the "Needs Oak Seedling" callout. No hero is involved.
 *
 * ⚠️ A leaf for `TimedChanges` and `Flags` both: it must not import either.
 */

export { growsTermsOf };

/** Whether this growth's Token stands within reach of one it needs; true when it needs none. */
export function gateMet(instance, def = getTokenType(instance?.typeId)) {
    const { needsNearby } = growsTermsOf(def);
    return needsNearby.length === 0 || nearbyGateMet(instance, needsNearby);
}

/** The item ids of a growth's cost the Bank and the mat's loot cannot pay, in cost order; empty when it can. */
export function shortOf(def) {
    const { cost } = growsTermsOf(def);
    let short = null;
    for (const { itemId, quantity } of cost) {
        if (InputAllocator.availableOf(itemId) < quantity) (short ||= []).push(itemId);
    }
    return short || NONE;
}

/** Pay a growth's cost (checked first, so it never half-pays). */
export function payFor(def) {
    const { cost } = growsTermsOf(def);
    if (cost.length) InputAllocator.consumeInputs(cost);
}

const NONE = Object.freeze([]);

/** Growing Token instance id → `{ alert, needs }`, for the ones whose alert is up. */
const alerts = new Map();

/** The membership the alerts were last checked against, so departures are dropped once per change. */
let prunedAt = { tokens: null, version: -1 };

const sameList = (a = NONE, b = NONE) => a.length === b.length && a.every((v, i) => v === b[i]);

/** A growing Token's current alert, `{ alert, needs }`, or null when none is up. */
export function growthAlertOf(instanceId) {
    return alerts.get(instanceId) || null;
}

/**
 * Set (or with a null `alert`, drop) a growing Token's alert, publishing `GROWTH_ALERT_CHANGED`
 * only when it changes.
 */
export function setGrowthAlert(instanceId, alert, needs = NONE) {
    const prev = alerts.get(instanceId);
    if (!alert) {
        if (!prev) return;
        alerts.delete(instanceId);
        EventBus.publish(BOARD_EVENTS.GROWTH_ALERT_CHANGED, { instanceId, alert: null, needs: NONE });
        return;
    }
    if (prev && prev.alert === alert && sameList(prev.needs, needs)) return;
    alerts.set(instanceId, { alert, needs });
    EventBus.publish(BOARD_EVENTS.GROWTH_ALERT_CHANGED, { instanceId, alert, needs });
}

/** Whether any growth alert is up (the cheap test before the per-Token bookkeeping). */
export function anyGrowthAlert() {
    return alerts.size > 0;
}

/**
 * Drop the alerts of Tokens that have left the mat, once per membership change (a growth's own
 * change drops its alert as it happens; this catches a demolition or a removal).
 */
export function pruneGrowthAlerts() {
    if (!alerts.size) return;
    const { tokens, version } = BoardState.membershipVersion();
    if (prunedAt.tokens === tokens && prunedAt.version === version) return;
    prunedAt = { tokens, version };
    for (const id of [...alerts.keys()]) {
        if (!BoardState.getTokenById(id)) setGrowthAlert(id, null);
    }
}

/** Forget every alert (a new game, a load, travel, tests). */
export function resetGrowthAlerts() {
    alerts.clear();
    prunedAt = { tokens: null, version: -1 };
}

/**
 * Whether a Token is growing and its growth will happen by itself: it has a growth, is not marked
 * for demolition, stands in reach of what it needs, and its cost can be paid (or it has none). A
 * Stump with no Forest, or with no seedling for it, is not: nothing is on its way.
 */
export function isGrowingBack(instance, def = getTokenType(instance?.typeId)) {
    if (!instance || instance.turnedFrom || !def?.grows?.into || Demolition.isMarked(instance)) return false;
    if (!gateMet(instance, def)) return false;
    if (alerts.get(instance.id)?.alert === ALERT.GROW_NEEDS_ITEM) return false;
    return shortOf(def).length === 0;
}

/** Type id → the work it grows toward (`def`, or null), memoised on the registry's version. */
let toward = { version: -1, byType: new Map() };

/**
 * The Token type a growing type grows toward that a hero works: following `grows.into` (a Stump to
 * a Sapling to an Oak Tree) to the first type with a work skill, or null when the chain reaches
 * none. A type that is itself worked is not "growing toward" anything (null).
 */
export function growsTowardWork(typeId) {
    const version = registryVersion();
    if (toward.version !== version) toward = { version, byType: new Map() };
    if (toward.byType.has(typeId)) return toward.byType.get(typeId);
    let found = null;
    const start = getTokenType(typeId);
    if (start?.grows?.into && !isWorked(start)) {
        const seen = new Set([typeId]);
        let def = getTokenType(start.grows.into);
        while (def && !seen.has(def.id)) {
            if (isWorked(def)) {
                found = def;
                break;
            }
            seen.add(def.id);
            def = typeof def.grows?.into === 'string' ? getTokenType(def.grows.into) : null;
        }
    }
    toward.byType.set(typeId, found);
    return found;
}

function isWorked(def) {
    const skill = def?.config?.skill;
    return typeof skill === 'string' && skill.trim() !== '' && def.requiresHero !== false;
}

let initialized = false;

/** The alerts belong to the board they were raised on. Idempotent. */
export function init() {
    if (initialized) return;
    initialized = true;
    EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, resetGrowthAlerts);
    EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, resetGrowthAlerts);
}
