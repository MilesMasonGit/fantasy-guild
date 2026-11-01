// spawners

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { PLACEMENT } from '../../config/registries/placementRegistry.js';
import { logger } from '../../utils/Logger.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as EffectActions from './EffectActions.js';
// ⚠️ TimedChanges imports this module for its handler table; importing TimedChanges back would be a
// cycle, so this takes the leaf `weightedPick` instead.
import { pickWeighted } from './weightedPick.js';
import * as InputAllocator from './InputAllocator.js';
import * as MatCap from './MatCap.js';
import * as Respawn from './Respawn.js';
import * as Demolition from './Demolition.js';
import { neighbourIds, nearRadius } from './nearby.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Spawners.
 *
 * How it runs: it rides `TimedChanges.tick`, which `BoardRunner.tick(delta)` calls, advanced by the
 * tick's `delta` only, so a catch-up and the dev Advance fast-forward it with everything else.
 * The spawner is one row of `TimedChanges.HANDLERS` (clock `spawnMs`, due at `intervalMs`). Its
 * `fire` is {@link attemptSpawn}, which returns the SAME instance after a spawn (the clock starts
 * its next lap, and a big tick can spawn several times) or null when blocked (the clock is held
 * full and the attempt is retried next tick, never looped within one).
 *
 * One attempt, in order:
 * 1. Cap: the family's live count must be below its cap (for a spawner that plants within its
 * reach, the family standing in its reach against its own allowance: {@link plantsWithinReach}; for
 * an enemy camp, what it spawned against its own allowance: {@link isEnemyCampType}).
 * 2. Mat cap: the mat must have room under the Token cap (`MatCap.canPlaceMore`); spawned Tokens
 * count toward it.
 * 3. Upkeep: the Bank and the item loot lying on the mat must hold all of it between them (checked,
 * not yet taken).
 * 4. Pick: a weighted pick from `spawns`.
 * 5. Land: `EffectActions.spawn` with `nearest_free` around the spawner; placed Tokens are fixed. A
 * spawner that plants within its reach lands only there, never pushing.
 * 6. Pay: only once the Token has landed, so a spawn with no room costs nothing and there is never
 * a refund to make. Bank first, then loot on the mat, through the same
 * `InputAllocator.consumeInputs` a Token's recipe inputs use.
 *
 * State: clocks are saved on the instance. Nothing else is: the reported state is worked out live
 * from the mat and the Bank, except no room, which is only known by trying; that one is remembered
 * in memory until the next attempt.
 */

/** Shortest spawn interval the engine honours (`intervalMs ≥ 1000`). */
export const MIN_INTERVAL_MS = 1000;

/** What a spawner reports. */
export const SPAWNER_STATE = Object.freeze({
    SPAWNING: 'spawning',
    AT_CAP: 'at_cap',
    MAT_FULL: 'mat_full',
    NEEDS_ITEM: 'needs_item',
    NO_ROOM: 'no_room'
});

/** Spawner instance ids whose last attempt found no room — cleared by the next success. */
const noRoom = new Set();

/** The `spawner` block of a type, when it can actually spawn something; else null. */
function spawnerBlock(def) {
    const block = def?.spawner;
    if (!block || !Array.isArray(block.spawns)) return null;
    return block.spawns.some(e => e?.typeId && getTokenType(e.typeId) && Number(e.weight) > 0) ? block : null;
}

/** Whether a Token type is a working spawner. */
export function isSpawner(def) {
    return spawnerBlock(def) != null;
}

/** A spawner's attempt interval, in ms. */
export function intervalOf(def) {
    return Math.max(MIN_INTERVAL_MS, Number(def?.spawner?.intervalMs) || 0);
}

function allowanceOf(def) {
    const n = Math.floor(Number(def?.spawner?.allowance));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Whether a spawner plants within its own reach (`spawner.withinReach`, a box in the CMS): a
 * Forest that lands its Saplings only within Near of itself and whose allowance counts its family
 * standing in its reach (map trees included), not every one on the mat. Without it a spawner keeps
 * the mat-wide family cap, unless it is an enemy camp ({@link isEnemyCampType}).
 */
export function plantsWithinReach(def) {
    return def?.spawner?.withinReach === true;
}

/**
 * Whether a spawner type is an **enemy camp**: its family holds an enemy (the Goblin Camp; bosses
 * and guardians are camps of one). An enemy camp counts only what it spawned, the Tokens tethered to
 * it (`instance.tether`), against its own allowance, so goblins standing at one camp never keep
 * another from spawning. Memoised with {@link familyOf}.
 */
export function isEnemyCampType(spawnerTypeId) {
    syncFamilyCaches();
    let answer = enemyCampCache.get(spawnerTypeId);
    if (answer === undefined) {
        answer = familyOf(spawnerTypeId).some(typeId => isEnemyDef(getTokenType(typeId)));
        enemyCampCache.set(spawnerTypeId, answer);
    }
    return answer;
}

/**
 * How many of its family stand on the mat tethered to enemy camp `instance`: what it spawned.
 * ⚠️ A plain scan, not the census: a tether is written without a membership change (a spawn sets it
 * after landing, an older save's enemies are attached on the first tick), which a census keyed on
 * membership would miss.
 */
function countOwn(instance) {
    const ids = familySetOf(instance.typeId);
    let n = 0;
    for (const t of BoardState.tokens()) {
        if (t.tether === instance.id && ids.has(t.typeId)) n++;
    }
    return n;
}

/** A spawner type's family as a set, memoised with {@link familyOf}. */
const familySets = new Map();

function familySetOf(spawnerTypeId) {
    const family = familyOf(spawnerTypeId);
    let set = familySets.get(spawnerTypeId);
    if (!set || set.family !== family) {
        set = { family, ids: new Set(family) };
        familySets.set(spawnerTypeId, set);
    }
    return set.ids;
}

/** How many of its family stand within reach of a within-reach spawner (`nearby.neighbourIds`, cached). */
function countNear(instance) {
    const ids = familySetOf(instance.typeId);
    let n = 0;
    for (const id of neighbourIds(instance.id)) {
        const t = BoardState.getTokenById(id);
        if (t && ids.has(t.typeId)) n++;
    }
    return n;
}

/**
 * A spawner's live family count and its cap, `{ count, cap }`: within its reach against its own
 * allowance for one that plants within reach, what it spawned against its own allowance for an enemy
 * camp, else the mat-wide count against the family cap.
 */
function countsOf(instance, def) {
    if (plantsWithinReach(def)) return { count: countNear(instance), cap: allowanceOf(def) };
    if (isEnemyCampType(instance.typeId)) return { count: countOwn(instance), cap: allowanceOf(def) };
    const family = familyOf(instance.typeId);
    return { count: countOf(family), cap: capOf(family) };
}

/**
 * The family memo: a spawner type's family never changes without a content reload
 * (`registerTokenTypes`), so it is memoised per type id, keyed on {@link registryVersion}; a test
 * that re-registers a type mid-file sees the new family on its very next call.
 */
const familyCache = new Map();
const enemyCampCache = new Map();
let familyCacheRegVersion = -1;

function syncFamilyCaches() {
    const regVersion = registryVersion();
    if (regVersion === familyCacheRegVersion) return;
    familyCache.clear();
    enemyCampCache.clear();
    familyCacheRegVersion = regVersion;
}

/**
 * A spawner type's family: every type in its `spawns` list plus everything they grow into,
 * following `grows.into` until it stops, and the Token a regrowing one becomes when it runs out
 * (`respawn.into`), so a felled tree growing back still counts. An Oak Forest's is `{Oak Sapling,
 * Oak Tree}`.
 *
 * @returns {string[]} in discovery order (the first spawned type first)
 */
export function familyOf(spawnerTypeId) {
    syncFamilyCaches();
    const cached = familyCache.get(spawnerTypeId);
    if (cached) return cached;

    const block = spawnerBlock(getTokenType(spawnerTypeId));
    const family = [];
    if (block) {
        // `seen` also stops a loop: a grows loop (A → B → A), which the audit forbids, and the
        // regrow loop (Tree → Sapling → Tree), which is the point.
        const seen = new Set();
        const walk = (typeId) => {
            const def = typeId ? getTokenType(typeId) : null;
            if (!def || seen.has(typeId)) return;
            seen.add(typeId);
            family.push(typeId);
            walk(def.grows?.into);
            const respawn = Respawn.respawnOf(def);
            if (respawn?.mode === 'regrow') walk(respawn.into);
        };
        for (const entry of block.spawns) walk(entry?.typeId);
    }
    familyCache.set(spawnerTypeId, family);
    return family;
}

/**
 * The census: one pass over the mat, rebuilt lazily only when membership changes
 * (`BoardState.membershipVersion`) or the Token registry does. `attemptSpawn`'s cap check and
 * `syncAlerts`' once-a-tick rescan share one scan per tick (or per spawn, since a spawn earlier in
 * the same pass bumps membership and the next spawner re-counts).
 */
let census = { tokens: null, version: -1, regVersion: -1, spawners: [], countByType: new Map(), capsByKey: new Map() };

function ensureCensus() {
    const { tokens, version } = BoardState.membershipVersion();
    const regVersion = registryVersion();
    if (census.tokens === tokens && census.version === version && census.regVersion === regVersion) return census;

    const countByType = new Map();
    const spawners = [];
    for (const t of BoardState.tokens()) {
        countByType.set(t.typeId, (countByType.get(t.typeId) || 0) + 1);
        if (!t.turnedFrom && isSpawner(getTokenType(t.typeId))) spawners.push(t);
    }
    census = { tokens, version, regVersion, spawners, countByType, capsByKey: new Map() };
    return census;
}

/** Every working spawner on the mat (a turned Token is not one). */
function liveSpawners() {
    return ensureCensus().spawners;
}

/** Tokens on the mat whose type is in `family`, whatever their origin. */
function countOf(family) {
    const { countByType } = ensureCensus();
    let total = 0;
    // `family` never carries a duplicate type id (`familyOf`'s `seen` set), so
    // summing each type's count is exactly today's "set membership" filter.
    for (const typeId of family) total += countByType.get(typeId) || 0;
    return total;
}

/**
 * A family's cap: the sum of `allowance` over every live spawner whose family shares a type with
 * it. Two Forests double it; removing one halves it and removes nothing. A spawner that plants
 * within its own reach, and an enemy camp, keep their allowance to themselves and add nothing here. Memoised per family key
 * inside the census, so `spawnerStatus`'s own call and `syncAlerts`' rescan of the same spawner
 * share one answer.
 */
function capOf(family, spawners = liveSpawners()) {
    const { capsByKey } = ensureCensus();
    const key = family.join('|');
    const cached = capsByKey.get(key);
    if (cached !== undefined) return cached;

    const set = new Set(family);
    let cap = 0;
    for (const s of spawners) {
        const def = getTokenType(s.typeId);
        if (plantsWithinReach(def) || isEnemyCampType(s.typeId)) continue;
        if (familyOf(s.typeId).some(typeId => set.has(typeId))) cap += allowanceOf(def);
    }
    capsByKey.set(key, cap);
    return cap;
}

/** A family's readable name: the first spawned type's name. */
function familyLabel(family) {
    const first = family[0];
    return first ? (getTokenType(first)?.name || first) : '';
}

/** `upkeep` summed by item, so a list naming one item twice is checked as one. */
function upkeepOf(def) {
    const total = new Map();
    for (const line of Array.isArray(def?.spawner?.upkeep) ? def.spawner.upkeep : []) {
        const q = Math.floor(Number(line?.quantity));
        if (!line?.itemId || !(q > 0)) continue;
        total.set(line.itemId, (total.get(line.itemId) || 0) + q);
    }
    return [...total].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/**
 * The item ids one spawn's upkeep is short of, in upkeep order, counting the Bank and matching loot
 * on the mat (`InputAllocator.availableOf`), so the status, the alert and the Upkeep Summary never
 * say needs Oak Seed while seeds that would be paid lie on the floor.
 */
function missingUpkeep(def) {
    return upkeepOf(def)
        .filter(({ itemId, quantity }) => InputAllocator.availableOf(itemId) < quantity)
        .map(({ itemId }) => itemId);
}

/**
 * One spawn attempt: `TimedChanges`' handler `fire` for a spawner.
 *
 * @param {object} instance the spawner on the mat
 * @param {object} def its type
 * @param {() => number} random for the weighted pick and the landing
 * @param {{overMs?: number, advance?: Function}} [ctx] from `TimedChanges.advance`:
 *        how long ago the attempt fell due, and the function that advances a
 *        Token's clocks — the new Token lives that leftover time, so a Sapling
 *        spawned part-way through a big tick grows as if the ticks had been small
 * @returns {object|null} the spawner itself after a spawn; null when blocked
 */
export function attemptSpawn(instance, def, random = Math.random, ctx = {}) {
    const block = spawnerBlock(def);
    if (!block) return null;

    const { count, cap } = countsOf(instance, def);
    if (count >= cap) return null;                               // at cap: waits
    if (!MatCap.canPlaceMore(1)) return null;                    // the mat's Token cap is full: waits
    if (missingUpkeep(def).length) return null;                  // needs an item: waits

    const typeId = pickWeighted(block.spawns, random);
    if (!typeId) return null;

    // A Forest that plants within its reach lands its Sapling there or nowhere.
    const landed = EffectActions.spawn(
        { payload: { typeId, placement: PLACEMENT.NEAREST_FREE } },
        { self: instance.id },
        random,
        plantsWithinReach(def) ? { within: nearRadius() } : {}
    );
    if (!landed) {
        // Nowhere to go. Nothing was paid; the clock waits full.
        noRoom.add(instance.id);
        return null;
    }
    noRoom.delete(instance.id);

    // Paid only now that the Token is down; checked above, so this cannot fail part-way (the tick
    // is single-threaded). Bank first, then loot on the mat.
    InputAllocator.consumeInputs(upkeepOf(def));

    const spawned = BoardState.getTokenById(landed.instanceId);
    // Tethered to the spawner that made it (this instance, not its type), saved: an enemy potters by
    // it (`EnemyMotion`), and an enemy camp counts what it spawned by it, an enemy or not.
    if (spawned && (isEnemyCampType(instance.typeId) || isEnemyDef(getTokenType(spawned.typeId)))) {
        spawned.tether = instance.id;
    }
    if (spawned && ctx.overMs > 0 && typeof ctx.advance === 'function') ctx.advance(spawned, ctx.overMs, random);

    // "! Spawned Oak Tree", said from the spawner.
    if (BoardState.getTokenById(landed.instanceId)) {
        EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, {
            spawnerId: instance.id,
            instanceId: landed.instanceId,
            typeId,
            name: getTokenType(typeId)?.name || typeId
        });
    }

    logger.debug('SpawnerSystem', `${instance.typeId} spawned ${typeId}`);
    return instance;
}

/**
 * A spawner's state, worked out live:
 * - `at_cap`: its family is at or over its cap;
 * - `mat_full`: the mat is at or over its Token cap (`MatCap`);
 * - `needs_item`: the Bank and the loot on the mat cannot pay one spawn's upkeep between them
 * (`needs`: item ids);
 * - `no_room`: its last attempt found nowhere to land, and it is waiting;
 * - `spawning`: otherwise, with `nextInMs` to the next attempt.
 *
 * Checked in that order, which is the order an attempt checks them.
 *
 * @returns {{state: string, nextInMs?: number, needs?: string[], count: number,
 *            cap: number, familyLabel: string}|null} null when it is not a spawner
 */
export function spawnerStatus(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    const def = instance ? getTokenType(instance.typeId) : null;
    if (!instance || instance.turnedFrom || !isSpawner(def)) return null;

    const family = familyOf(instance.typeId);
    const base = { ...countsOf(instance, def), familyLabel: familyLabel(family) };
    const interval = intervalOf(def);
    const clock = Number(instance.clocks?.spawnMs) || 0;

    if (base.count >= base.cap) return { state: SPAWNER_STATE.AT_CAP, ...base };
    if (!MatCap.canPlaceMore(1)) return { state: SPAWNER_STATE.MAT_FULL, ...base };
    const needs = missingUpkeep(def);
    if (needs.length) return { state: SPAWNER_STATE.NEEDS_ITEM, needs, ...base };
    if (noRoom.has(instanceId) && clock >= interval) return { state: SPAWNER_STATE.NO_ROOM, ...base };
    return { state: SPAWNER_STATE.SPAWNING, nextInMs: Math.max(0, interval - clock), ...base };
}

/**
 * Whether `instance` is an **enemy camp at its cap** ({@link isEnemyCampType}), holding all it may
 * of its own. Its clock then stands at zero (`TimedChanges`' spawner row), so an enemy beaten in a
 * full camp comes back one whole interval later, never at once from time the camp spent full.
 * Forests, mines and every other spawner keep counting while full, as they always have.
 */
export function isFullEnemyCamp(instance, def) {
    if (!spawnerBlock(def) || !isEnemyCampType(instance.typeId)) return false;
    const { count, cap } = countsOf(instance, def);
    return count >= cap;
}

/**
 * A spawner's live family count against its cap, `{ count, cap }`, or null when it is not a working
 * spawner. The cheap half of {@link spawnerStatus} (no Bank check), for the count badge on the mat.
 */
export function spawnerCounts(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    const def = instance ? getTokenType(instance.typeId) : null;
    if (!instance || instance.turnedFrom || !isSpawner(def)) return null;
    return countsOf(instance, def);
}

/**
 * Every family with a live spawner, once each: `[{ kind, typeIds, count, cap }]`, where `kind` is
 * the family's readable name; a spawner that plants within its reach, and an enemy camp, is a row
 * of its own, named for itself. Feeds the dev tools.
 */
export function familyCounts() {
    const spawners = liveSpawners();
    const byKey = new Map();
    for (const s of spawners) {
        const family = familyOf(s.typeId);
        const def = getTokenType(s.typeId);
        const ownRow = plantsWithinReach(def) ? 'its reach' : (isEnemyCampType(s.typeId) ? 'its own' : null);
        if (ownRow) {
            if (family.length) {
                byKey.set(`own:${s.id}`, {
                    kind: `${def?.name || s.typeId} (${ownRow})`, typeIds: family, ...countsOf(s, def)
                });
            }
            continue;
        }
        const key = [...family].sort().join('|');
        if (!family.length || byKey.has(key)) continue;
        byKey.set(key, {
            kind: familyLabel(family),
            typeIds: family,
            count: countOf(family),
            cap: capOf(family, spawners)
        });
    }
    return [...byKey.values()];
}

/**
 * Which waiting states raise an on-Token alert. Only the ones the player can
 * fix: an empty Bank, a crowded mat and a full Token cap. `at_cap` is a spawner's normal resting
 * state — every healthy spawner ends up there — so it raises nothing (the
 * inspection lines and the Upkeep Summary still say so).
 */
const ALERT_FOR_STATE = Object.freeze({
    [SPAWNER_STATE.NEEDS_ITEM]: ALERT.SPAWN_NEEDS_ITEM,
    [SPAWNER_STATE.NO_ROOM]: ALERT.SPAWN_NO_ROOM,
    [SPAWNER_STATE.MAT_FULL]: ALERT.SPAWN_MAT_FULL
});

/** Spawner instance id → `{ alert, needs }`, for the spawners whose alert is up. */
const alerts = new Map();

/** A spawner's current alert, `{ alert, needs }`, or null when none is up. */
export function spawnerAlertOf(instanceId) {
    return alerts.get(instanceId) || null;
}

const sameList = (a = [], b = []) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Bring every spawner's alert in line with {@link spawnerStatus}, publishing
 * `SPAWNER_ALERT_CHANGED` for each one that changed, and only those. Called at the end of
 * `TimedChanges.tick`, after this tick's attempts, so an alert goes up the tick a spawner starts
 * waiting and comes down the tick the cause is gone. Worked out from the engine's own state, never
 * polled from React.
 */
export function syncAlerts() {
    const live = new Set();
    for (const s of liveSpawners()) {
        // A spawner marked for demolition never attempts (`TimedChanges` holds it), so nothing it
        // waits for is a problem: its alert drops below like a departed spawner's.
        if (Demolition.isMarked(s)) continue;
        live.add(s.id);
        const status = spawnerStatus(s.id);
        const alert = (status && ALERT_FOR_STATE[status.state]) || null;
        const needs = alert === ALERT.SPAWN_NEEDS_ITEM ? (status.needs || []) : [];
        const prev = alerts.get(s.id);
        if ((prev?.alert || null) === alert && sameList(prev?.needs, needs)) continue;
        if (alert) alerts.set(s.id, { alert, needs });
        else alerts.delete(s.id);
        EventBus.publish(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, { instanceId: s.id, alert, needs });
    }
    // A spawner that left the mat, or turned into something else, drops its alert.
    for (const id of [...alerts.keys()]) {
        if (live.has(id)) continue;
        alerts.delete(id);
        EventBus.publish(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, { instanceId: id, alert: null, needs: [] });
    }
    for (const id of [...noRoom]) if (!live.has(id)) noRoom.delete(id);
}

/** Forget every alert and "no room" note (a new game, a load, tests). */
export function resetAlerts() {
    alerts.clear();
    noRoom.clear();
}

let initialized = false;

/** The alerts belong to the board they were raised on: forget them when the guild travels. Idempotent. */
export function init() {
    if (initialized) return;
    initialized = true;
    EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, resetAlerts);
}
