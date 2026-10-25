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
 *   and tried again every tick, as a growth with nowhere to stand is. ⚠️ What the Bank and the mat
 *   hold is read once per item per tick ({@link supplyChanged}), not once per Stump: a day away with
 *   every Stump stopped would otherwise count the floor's loot 86,400 times per Stump.
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

const NONE = Object.freeze([]);

/**
 * What the Bank and the mat's loot hold, read at most once per item between two changes: item id →
 * `{ epoch, count }`. Every tick starts a new epoch, and so does every change the engine announces
 * (a Bank change, the loot on the mat moving: {@link init}) and every growth's payment, so a count is
 * never older than the last thing that could have changed it.
 */
const supply = new Map();
let supplyEpoch = 0;

/** Something the Bank or the mat holds may have changed: read afresh next time. */
export function supplyChanged() {
    supplyEpoch++;
}

function available(itemId) {
    let entry = supply.get(itemId);
    if (!entry) {
        entry = { epoch: -1, count: 0 };
        supply.set(itemId, entry);
    }
    if (entry.epoch !== supplyEpoch) {
        entry.epoch = supplyEpoch;
        entry.count = InputAllocator.availableOf(itemId);
    }
    return entry.count;
}

/** A cost list → the last answer {@link shortOf} gave for it, so an unchanged answer is the same array. */
const lastShort = new WeakMap();

/**
 * The item ids of a growth's cost the Bank and the mat's loot cannot pay, in cost order; empty when
 * it can. While the answer stays the same it is the same array, so a stopped Stump's alert is
 * compared by identity, tick after tick.
 */
export function shortOf(def) {
    const { cost } = growsTermsOf(def);
    if (!cost.length) return NONE;
    let short = null;
    for (const { itemId, quantity } of cost) {
        if (available(itemId) < quantity) (short ||= []).push(itemId);
    }
    if (!short) return NONE;
    const prev = lastShort.get(cost);
    if (prev && sameList(prev, short)) return prev;
    Object.freeze(short);
    lastShort.set(cost, short);
    return short;
}

/** Pay a growth's cost (checked first, so it never half-pays). */
export function payFor(def) {
    const { cost } = growsTermsOf(def);
    if (!cost.length) return;
    InputAllocator.consumeInputs(cost);
    supplyChanged();
}

/** Growing Token instance id → `{ alert, needs }`, for the ones whose alert is up. */
const alerts = new Map();

/** The membership the alerts were last checked against, so departures are dropped once per change. */
let prunedAt = { tokens: null, version: -1 };

function sameList(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

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
 * for demolition, stands in reach of what it needs, and has not stopped for want of its cost. A
 * Stump with no Forest, or stopped with no seedling for it, is not: nothing is on its way. (One
 * still counting down is, even with no seedling in the Bank yet: one may come before it is due.)
 */
export function isGrowingBack(instance, def = getTokenType(instance?.typeId)) {
    if (!instance || instance.turnedFrom || !def?.grows?.into || Demolition.isMarked(instance)) return false;
    if (!gateMet(instance, def)) return false;
    return alerts.get(instance.id)?.alert !== ALERT.GROW_NEEDS_ITEM;
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

/**
 * The alerts belong to the board they were raised on, and a change to what the Bank or the mat
 * holds is read afresh ({@link supplyChanged}; engine listeners, so a catch-up hears them too).
 * Idempotent.
 */
export function init() {
    if (initialized) return;
    initialized = true;
    const reset = () => { resetGrowthAlerts(); supplyChanged(); };
    EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, reset);
    EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, reset);
    for (const event of [ENGINE_EVENTS.INVENTORY_UPDATED, BOARD_EVENTS.SPRITES_CHANGED, BOARD_EVENTS.SPRITE_COLLECTED, BOARD_EVENTS.SPRITE_ABSORBED]) {
        EventBus.subscribe(event, supplyChanged);
    }
    // A resting refill waiting for its Orchard that is given charges back (a copy dropped on it) no
    // longer rests, so its refill row stops asking and would leave the mark up. A growing Token has
    // no charges, so only such a one can be here.
    EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (p) => {
        if (p?.instanceId && Number(p.remaining) > 0 && alerts.has(p.instanceId)) setGrowthAlert(p.instanceId, null);
    });
}
