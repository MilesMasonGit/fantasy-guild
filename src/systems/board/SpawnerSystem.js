// spawners

import { getTokenType, registryVersion } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { isGroveSpawnerDef } from '../../config/registries/tokenConstants.js';
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
import * as Occupation from './Occupation.js';
import * as Respawn from './Respawn.js';
import * as Demolition from './Demolition.js';
import * as RoomWait from './RoomWait.js';
import { neighbourIds, reachRadius } from './nearby.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Spawners.
 *
 * How it runs: it rides `TimedChanges.tick`, which `BoardRunner.tick(delta)` calls, advanced by the
 * tick's `delta` only, so a catch-up and the dev Advance fast-forward it with everything else.
 * The spawner is one row of `TimedChanges.HANDLERS` (clock `spawnMs`, due at `intervalMs`). Its
 * `fire` is {@link spawnerTurn}, which returns the SAME instance when the turn is over (the clock
 * starts its next lap, and a big tick can take several turns) or null when held (the clock is held
 * full and the attempt is retried next tick, never looped within one).
 *
 * A turn is over after a spawn, and after a spawn missed for want of room: a spawner with nowhere to
 * land tries once when its clock comes round and then waits one whole interval for the next try,
 * whatever leaves the mat meanwhile (owner: a missed bus waits for the next one). Only its cap, the
 * mat's Token cap and its upkeep hold the clock full, since those are cheap to ask every tick.
 *
 * One attempt, in order:
 * 1. Cap: the family's live count must be below the spawner's own allowance: the family standing in
 * its reach, or for an enemy camp, a Forest or an Orchard what it spawned ({@link countsOwn}).
 * 2. Mat cap: the mat must have room under the Token cap (`MatCap.canPlaceMore`); spawned Tokens
 * count toward it.
 * 3. Upkeep: the Bank and the item loot lying on the mat must hold all of it between them (checked,
 * not yet taken). A Forest or an Orchard has none ({@link upkeepOf}).
 * 4. Pick: a weighted pick from `spawns`.
 * 5. Land: `EffectActions.spawn` with `nearest_free` around the spawner; placed Tokens are fixed. A
 * spawner other than an enemy camp lands only within its reach, never pushing.
 * 6. Pay: only once the Token has landed, so a spawn with no room costs nothing and there is never
 * a refund to make. Bank first, then loot on the mat, through the same
 * `InputAllocator.consumeInputs` a Token's recipe inputs use.
 *
 * State: clocks are saved on the instance. Nothing else is: the reported state is worked out live
 * from the mat and the Bank, except no room, which is only known by trying; that one is remembered
 * in memory until a spawn.
 */

/** Shortest spawn interval the engine honours (`intervalMs ≥ 1000`). */
export const MIN_INTERVAL_MS = 1000;

/** What a spawner reports. */
export const SPAWNER_STATE = Object.freeze({
    SPAWNING: 'spawning',
    AT_CAP: 'at_cap',
    MAT_FULL: 'mat_full',
    NEEDS_ITEM: 'needs_item',
    NO_ROOM: 'no_room',
    SLEEPING: 'sleeping'
});

/**
 * Spawner instance ids whose last landing found no room, cleared by the next success.
 * Never saved: the first {@link syncAlerts} after a load works it out again.
 */
const noRoom = new Set();

/** How one attempt ended (see {@link tryToSpawn}). */
const SPAWNED = 'spawned';
const MISSED = 'missed';
const HELD = 'held';

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
 * Whether a spawner type is a **Forest** or an **Orchard**: it owns what it spawns
 * (`tokenConstants.isGroveSpawnerDef`). Like an enemy camp it ties each spawn to itself and counts
 * only those against its allowance, so a lone tree of its species in its reach never fills it, and
 * it plants for free. Memoised with {@link familyOf}.
 */
export function isGroveSpawnerType(spawnerTypeId) {
    syncFamilyCaches();
    let answer = groveCache.get(spawnerTypeId);
    if (answer === undefined) {
        answer = isGroveSpawnerDef(getTokenType(spawnerTypeId), getTokenType);
        groveCache.set(spawnerTypeId, answer);
    }
    return answer;
}

/** Whether a spawner counts what it spawned rather than what stands in its reach. */
function countsOwn(spawnerTypeId) {
    return isEnemyCampType(spawnerTypeId) || isGroveSpawnerType(spawnerTypeId);
}

/**
 * ⚠️ Under the test suite every count from the census is compared with a walk of the mat, and a
 * difference fails the test that saw it (`tests/setup/tetherCensusCheck.js`). Off everywhere else: a
 * walk per answer is the very cost the census saves.
 */
const CHECK_TETHER_CENSUS = import.meta.env?.MODE === 'test';

/** How many of its family stand on the mat tethered to `instance`: what it spawned. */
function countOwn(instance) {
    const ids = familySetOf(instance.typeId);
    let n = 0;
    const byType = ensureCensus().tethered.get(instance.id);
    if (byType) for (const [typeId, count] of byType) if (ids.has(typeId)) n += count;
    if (CHECK_TETHER_CENSUS) {
        const walked = BoardState.walkTethered(instance.id, ids);
        if (walked !== n) console.error(`Tether census out of step: ${instance.typeId} ${instance.id} counts ${n}, the mat holds ${walked}`);
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

/** How many of its family stand within reach of a spawner (`nearby.neighbourIds`, cached). */
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
 * allowance, or for an enemy camp, a Forest or an Orchard what it spawned against its own allowance.
 */
function countsOf(instance, def) {
    const count = countsOwn(instance.typeId) ? countOwn(instance) : countNear(instance);
    return { count, cap: allowanceOf(def) };
}

/**
 * The family memo: a spawner type's family never changes without a content reload
 * (`registerTokenTypes`), so it is memoised per type id, keyed on {@link registryVersion}; a test
 * that re-registers a type mid-file sees the new family on its very next call.
 */
const familyCache = new Map();
const enemyCampCache = new Map();
const groveCache = new Map();
let familyCacheRegVersion = -1;

function syncFamilyCaches() {
    const regVersion = registryVersion();
    if (regVersion === familyCacheRegVersion) return;
    familyCache.clear();
    enemyCampCache.clear();
    groveCache.clear();
    familyCacheRegVersion = regVersion;
}

/**
 * A spawner type's family: every type in its `spawns` list plus everything they grow into,
 * following `grows.into` until it stops, and the Token a regrowing one becomes when it runs out
 * (`respawn.into`), so a felled tree growing back still counts.
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
        // regrow loop (a felled Tree growing back), which is the point.
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
 * (`BoardState.membershipVersion`), a tether is written (`BoardState.tetherVersion`) or the Token
 * registry changes. `attemptSpawn`'s cap check, every full enemy camp's question each tick and
 * `syncAlerts`' once-a-tick rescan share one scan (a spawn earlier in the same pass bumps membership
 * and the next spawner re-counts).
 *
 * `tethered` is every Token on the mat with a tether, by tether and type: `tetherId → (typeId → n)`.
 */
let census = { tokens: null, version: -1, tetherVersion: -1, regVersion: -1, spawners: [], tethered: new Map() };

function ensureCensus() {
    const { tokens, version } = BoardState.membershipVersion();
    const tetherVersion = BoardState.tetherVersion();
    const regVersion = registryVersion();
    if (census.tokens === tokens && census.version === version && census.tetherVersion === tetherVersion && census.regVersion === regVersion) return census;

    const tethered = new Map();
    const spawners = [];
    for (const t of BoardState.tokens()) {
        if (isSpawner(getTokenType(t.typeId))) spawners.push(t);
        if (typeof t.tether === 'string') {
            let byType = tethered.get(t.tether);
            if (!byType) {
                byType = new Map();
                tethered.set(t.tether, byType);
            }
            byType.set(t.typeId, (byType.get(t.typeId) || 0) + 1);
        }
    }
    census = { tokens, version, tetherVersion, regVersion, spawners, tethered };
    return census;
}

/** Every working spawner on the mat. */
function liveSpawners() {
    return ensureCensus().spawners;
}

/** A family's readable name: the first spawned type's name. */
function familyLabel(family) {
    const first = family[0];
    return first ? (getTokenType(first)?.name || first) : '';
}

/**
 * `upkeep` summed by item, so a list naming one item twice is checked as one. A Forest or an Orchard
 * pays none, whatever is authored: its seeds were paid once, to build it.
 */
function upkeepOf(def) {
    const total = new Map();
    if (def?.id && isGroveSpawnerType(def.id)) return [];
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
 * One spawn attempt, for anything that wants a spawn now: the dev tools, the bench's prefill, tests.
 * The game's own clock calls {@link spawnerTurn}.
 *
 * @param {object} instance the spawner on the mat
 * @param {object} def its type
 * @param {() => number} random for the weighted pick and the landing
 * @param {{overMs?: number, advance?: Function}} [ctx] from `TimedChanges.advance`:
 *        how long ago the attempt fell due, and the function that advances a
 *        Token's clocks — the new Token lives that leftover time, so a Token
 *        spawned part-way through a big tick grows as if the ticks had been small
 * @returns {object|null} the spawner itself after a spawn; null when blocked or there was no room
 */
export function attemptSpawn(instance, def, random = Math.random, ctx = {}) {
    return tryToSpawn(instance, def, random, ctx) === SPAWNED ? instance : null;
}

/**
 * One turn of a spawner's clock: `TimedChanges`' handler `fire` for a spawner. An attempt, as
 * {@link attemptSpawn}; a spawn missed for want of room still ends the turn, so the spawner waits
 * one whole interval for its next try instead of searching the mat again every tick.
 *
 * @returns {object|null} the spawner itself after a spawn or a miss (the clock starts its next lap);
 *          null when held by its cap, the mat's Token cap or its upkeep (retried next tick)
 */
export function spawnerTurn(instance, def, random = Math.random, ctx = {}) {
    return tryToSpawn(instance, def, random, ctx) === HELD ? null : instance;
}

/** Where a spawner's spawns may land: an enemy camp anywhere near it, any other within its reach. */
function landingOptions(instance) {
    return isEnemyCampType(instance.typeId) ? {} : { within: reachRadius() };
}

/** One attempt: {@link SPAWNED}, {@link MISSED} (nowhere to land) or {@link HELD}. */
function tryToSpawn(instance, def, random, ctx) {
    const block = spawnerBlock(def);
    if (!block) return HELD;

    const { count, cap } = countsOf(instance, def);
    if (count >= cap) return HELD;                               // at cap: waits
    if (!MatCap.canPlaceMore(1)) {                              // the mat's Token cap is full: waits
        RoomWait.tell(instance.id, { source: RoomWait.SOURCE.SPAWNER, instanceId: instance.id, typeId: instance.typeId });
        return HELD;
    }
    if (missingUpkeep(def).length) return HELD;                  // needs an item: waits

    const typeId = pickWeighted(block.spawns, random);
    if (!typeId) return HELD;

    // Anything but an enemy camp lands within its reach, with the room a grown Token will need, or
    // nowhere (`EffectActions.spotWithin`).
    const landed = EffectActions.spawn(
        { payload: { typeId, placement: PLACEMENT.NEAREST_FREE } },
        { self: instance.id },
        random,
        landingOptions(instance)
    );
    if (!landed) {
        // Nowhere to go. Nothing was paid.
        noRoom.add(instance.id);
        RoomWait.tell(instance.id, { source: RoomWait.SOURCE.SPAWNER, instanceId: instance.id, typeId: instance.typeId });
        return MISSED;
    }
    noRoom.delete(instance.id);
    RoomWait.landed(instance.id);

    // Paid only now that the Token is down; checked above, so this cannot fail part-way (the tick
    // is single-threaded). Bank first, then loot on the mat.
    InputAllocator.consumeInputs(upkeepOf(def));

    const spawned = BoardState.getTokenById(landed.instanceId);
    // Tethered to the spawner that made it (this instance, not its type), saved: an enemy potters by
    // it (`EnemyMotion`), an enemy camp counts what it spawned by it, an enemy or not, and a Forest's
    // tree is its own (`Groves`).
    if (spawned && (countsOwn(instance.typeId) || isEnemyDef(getTokenType(spawned.typeId)))) {
        BoardState.setTether(spawned, instance.id);
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
    return SPAWNED;
}

/**
 * A spawner's state, worked out live:
 * - `at_cap`: its family is at or over its cap;
 * - `mat_full`: the mat is at or over its Token cap (`MatCap`);
 * - `needs_item`: the Bank and the loot on the mat cannot pay one spawn's upkeep between them
 * (`needs`: item ids);
 * - `no_room`: its last landing found nowhere to land, and it waits for its next try (`nextInMs`);
 * - `sleeping`: an enemy camp on a mat its arrival holds ({@link isSleepingCamp});
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
    if (!instance || !isSpawner(def)) return null;

    const family = familyOf(instance.typeId);
    const base = { ...countsOf(instance, def), familyLabel: familyLabel(family) };
    const interval = intervalOf(def);
    const clock = Number(instance.clocks?.spawnMs) || 0;

    if (base.count >= base.cap) return { state: SPAWNER_STATE.AT_CAP, ...base };
    if (isSleepingCamp(instance)) return { state: SPAWNER_STATE.SLEEPING, ...base };
    if (!MatCap.canPlaceMore(1)) return { state: SPAWNER_STATE.MAT_FULL, ...base };
    const needs = missingUpkeep(def);
    if (needs.length) return { state: SPAWNER_STATE.NEEDS_ITEM, needs, ...base };
    const nextInMs = Math.max(0, interval - clock);
    if (noRoom.has(instanceId)) return { state: SPAWNER_STATE.NO_ROOM, nextInMs, ...base };
    return { state: SPAWNER_STATE.SPAWNING, nextInMs, ...base };
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
 * Whether an enemy camp sleeps: its mat is held by the enemies a settled place arrived with
 * (`Occupation`), and until they are beaten the place's own camps spawn nothing (owner).
 */
export function isSleepingCamp(instance) {
    return Occupation.isOccupied() && isEnemyCampType(instance?.typeId);
}

/**
 * A spawner's live family count against its cap, `{ count, cap }`, or null when it is not a working
 * spawner. The cheap half of {@link spawnerStatus} (no Bank check), for the count badge on the mat.
 */
export function spawnerCounts(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    const def = instance ? getTokenType(instance.typeId) : null;
    if (!instance || !isSpawner(def)) return null;
    return countsOf(instance, def);
}

/**
 * Every working spawner with its live count against its allowance: `[{ id, kind, typeIds, count,
 * cap }]`, one row each, `kind` its own name. Feeds the dev tools.
 */
export function familyCounts() {
    const rows = [];
    for (const s of liveSpawners()) {
        const family = familyOf(s.typeId);
        if (!family.length) continue;
        const def = getTokenType(s.typeId);
        const own = countsOwn(s.typeId) ? 'its own' : 'its reach';
        rows.push({ id: s.id, kind: `${def?.name || s.typeId} (${own})`, typeIds: family, ...countsOf(s, def) });
    }
    return rows;
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
 * Whether the "no room" notes are still to be worked out again: true until the first
 * {@link syncAlerts} after a load or a travel, as a spawner's last miss is not saved.
 */
let needsRecheck = true;

/**
 * A spawner that would be spawning but whose every spawn has nowhere to land is no_room now, as its
 * miss would have made it: the note and the one-time word (`RoomWait`) come back after a load.
 */
function markIfNoRoom(instance) {
    const def = getTokenType(instance.typeId);
    const block = spawnerBlock(def);
    if (!block || Demolition.isMarked(instance)) return;
    const { count, cap } = countsOf(instance, def);
    if (count >= cap || isSleepingCamp(instance) || !MatCap.canPlaceMore(1) || missingUpkeep(def).length) return;
    const options = landingOptions(instance);
    if (block.spawns.some(({ typeId, weight }) => Number(weight) > 0 && EffectActions.hasRoomToSpawn(typeId, instance.id, options))) return;
    noRoom.add(instance.id);
    RoomWait.tell(instance.id, { source: RoomWait.SOURCE.SPAWNER, instanceId: instance.id, typeId: instance.typeId });
}

/**
 * Bring every spawner's alert in line with {@link spawnerStatus}, publishing
 * `SPAWNER_ALERT_CHANGED` for each one that changed, and only those. Called at the end of
 * `TimedChanges.tick`, after this tick's attempts, so an alert goes up the tick a spawner starts
 * waiting and comes down the tick the cause is gone. Worked out from the engine's own state, never
 * polled from React.
 */
export function syncAlerts() {
    const live = new Set();
    const recheck = needsRecheck;
    needsRecheck = false;
    for (const s of liveSpawners()) {
        // A spawner marked for demolition never attempts (`TimedChanges` holds it), so nothing it
        // waits for is a problem: its alert drops below like a departed spawner's.
        if (Demolition.isMarked(s)) continue;
        live.add(s.id);
        if (recheck) markIfNoRoom(s);
        const status = spawnerStatus(s.id);
        const alert = (status && ALERT_FOR_STATE[status.state]) || null;
        const needs = alert === ALERT.SPAWN_NEEDS_ITEM ? (status.needs || []) : [];
        const prev = alerts.get(s.id);
        if ((prev?.alert || null) === alert && sameList(prev?.needs, needs)) continue;
        if (alert) alerts.set(s.id, { alert, needs });
        else alerts.delete(s.id);
        EventBus.publish(BOARD_EVENTS.SPAWNER_ALERT_CHANGED, { instanceId: s.id, alert, needs });
    }
    // A spawner that left the mat, or became something else, drops its alert.
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
    needsRecheck = true;
}

let initialized = false;

/** The alerts belong to the board they were raised on: forget them when the guild travels. Idempotent. */
export function init() {
    if (initialized) return;
    initialized = true;
    EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, resetAlerts);
    EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, resetAlerts);
}
