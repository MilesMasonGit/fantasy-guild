// Fantasy Guild — Spawners and the Guild Hall trickle (Token Lifecycle slices 3.3 and 3.4)

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { PLACEMENT } from '../../config/registries/placementRegistry.js';
import { logger } from '../../utils/Logger.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS, ALERT } from './boardEvents.js';
import * as BoardState from './BoardState.js';
import * as EffectActions from './EffectActions.js';
// ⚠️ A cycle: TimedChanges imports this module for its handler table. Both
// sides use namespace imports and touch the other only inside functions, so
// either may load first.
import * as TimedChanges from './TimedChanges.js';
import * as TokenNotices from './TokenNotices.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as InputAllocator from './InputAllocator.js';
import { TimeBankManager } from '../core/TimeBankManager.js';

/**
 * ⭐ **Spawners** (roadmap §3.1, DP-4, DP-5, SP-5, SP-6, SP-46/SP-68).
 *
 * ## How it runs
 * It rides `TimedChanges.tick`, which `BoardRunner.tick(delta)` calls — one
 * clock system (DP-2), advanced by the tick's `delta` only, so the time bank
 * and the dev *Advance* fast-forward it with everything else.
 *
 * The spawner is one row of `TimedChanges.HANDLERS` (clock `spawnMs`, due at
 * `intervalMs`). Its `fire` is {@link attemptSpawn}, which returns the SAME
 * instance after a spawn (the clock starts its next lap, and a big tick can
 * spawn several times) or null when blocked (the clock is held full and the
 * attempt is retried next tick — never looped within one).
 *
 * The **trickle** (slice 3.4, SP-66) rides the same tick. It has one clock per
 * line (`clocks.trickle[i]`), which the handler table's single key per clock
 * cannot hold, so `TimedChanges.tick` calls {@link advanceTrickle} for every
 * Token beside the handler table.
 *
 * ## One attempt, in order
 * 1. **Cap** — the family's live count must be below its cap.
 * 2. **Upkeep** — the Bank and the item loot lying on the mat must hold all of
 *    it between them (checked, not yet taken; TL-20).
 * 3. **Pick** — a weighted pick from `spawns`.
 * 4. **Land** — `EffectActions.spawn` with `nearest_free` around the spawner;
 *    placed Tokens are fixed (SP-68).
 * 5. **Pay** — only once the Token has landed, so a spawn with no room costs
 *    nothing and there is never a refund to make (all or nothing, DP-5).
 *    ⭐ **Bank first, then loot on the mat** (TL-20), through the same
 *    `InputAllocator.consumeInputs` a Token's recipe inputs use (D-42): any
 *    matching loot anywhere on the mat counts, as it does there.
 *
 * ## State
 * Clocks are saved on the instance. Nothing else is: the reported state is
 * worked out live from the mat and the Bank, except "no room", which is only
 * known by trying — that one is remembered in memory until the next attempt.
 */

/** Shortest spawn interval the engine honours (§3.1: `intervalMs ≥ 1000`). */
export const MIN_INTERVAL_MS = 1000;

/** What a spawner reports (§3.1). */
export const SPAWNER_STATE = Object.freeze({
    SPAWNING: 'spawning',
    AT_CAP: 'at_cap',
    NEEDS_ITEM: 'needs_item',
    NO_ROOM: 'no_room'
});

/** Spawner instance ids whose last attempt found no room — cleared by the next success. */
const noRoom = new Set();

// ---------------------------------------------------------------------------
// Families and caps (DP-4, SP-5)
// ---------------------------------------------------------------------------

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
 * A spawner type's **family**: every type in its `spawns` list plus everything
 * they grow into, following `grows.into` until it stops (§3.1). An Oak
 * Forest's is `{Oak Sapling, Oak Tree}`.
 *
 * @returns {string[]} in discovery order (the first spawned type first)
 */
export function familyOf(spawnerTypeId) {
    const block = spawnerBlock(getTokenType(spawnerTypeId));
    if (!block) return [];
    const family = [];
    const seen = new Set();
    for (const entry of block.spawns) {
        let typeId = entry?.typeId;
        // `seen` also stops a grows loop (A → B → A), which the audit forbids.
        while (typeId && getTokenType(typeId) && !seen.has(typeId)) {
            seen.add(typeId);
            family.push(typeId);
            typeId = getTokenType(typeId)?.grows?.into;
        }
    }
    return family;
}

/** Every working spawner on the mat (a turned Token is not one). */
function liveSpawners() {
    return BoardState.tokens().filter(t => !t.turnedFrom && isSpawner(getTokenType(t.typeId)));
}

/** Live Tokens on the mat whose type is in `family`, whatever their origin. */
function countOf(family) {
    const set = new Set(family);
    return BoardState.tokens().filter(t => set.has(t.typeId)).length;
}

/**
 * A family's cap: the sum of `allowance` over every live spawner whose family
 * shares a type with it (DP-4). Two Forests make 10; removing one makes 5 and
 * removes nothing (SP-6).
 */
function capOf(family, spawners = liveSpawners()) {
    const set = new Set(family);
    let cap = 0;
    for (const s of spawners) {
        if (familyOf(s.typeId).some(typeId => set.has(typeId))) cap += allowanceOf(getTokenType(s.typeId));
    }
    return cap;
}

/** A family's readable name: the first spawned type's name. */
function familyLabel(family) {
    const first = family[0];
    return first ? (getTokenType(first)?.name || first) : '';
}

// ---------------------------------------------------------------------------
// Upkeep (DP-5)
// ---------------------------------------------------------------------------

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
 * The item ids one spawn's upkeep is short of, in upkeep order — counting the
 * Bank **and** matching loot on the mat (TL-20, `InputAllocator.availableOf`),
 * so the status, the alert and the Upkeep Summary never say "needs Oak Seed"
 * while seeds that would be paid lie on the floor.
 */
function missingUpkeep(def) {
    return upkeepOf(def)
        .filter(({ itemId, quantity }) => InputAllocator.availableOf(itemId) < quantity)
        .map(({ itemId }) => itemId);
}

// ---------------------------------------------------------------------------
// The attempt
// ---------------------------------------------------------------------------

/**
 * One spawn attempt — `TimedChanges`' handler `fire` for a spawner.
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

    const family = familyOf(instance.typeId);
    if (countOf(family) >= capOf(family)) return null;          // at cap: waits
    if (missingUpkeep(def).length) return null;                  // needs an item: waits

    const typeId = TimedChanges.pickWeighted(block.spawns, random);
    if (!typeId) return null;

    const landed = EffectActions.spawn(
        { payload: { typeId, placement: PLACEMENT.NEAREST_FREE } },
        { self: instance.id },
        random
    );
    if (!landed) {
        // FP-46: nowhere to go. Nothing was paid; the clock waits full.
        noRoom.add(instance.id);
        return null;
    }
    noRoom.delete(instance.id);

    // Paid only now that the Token is down — checked above, so this cannot fail
    // part-way (the tick is single-threaded). Bank first, then loot on the mat
    // (TL-20, D-42).
    InputAllocator.consumeInputs(upkeepOf(def));

    const spawned = BoardState.getTokenById(landed.instanceId);
    // B7.1 (TL-16, FB-23): an enemy is tethered to the spawner that made it —
    // this instance, not its type — and potters by it (`EnemyMotion`). Saved.
    if (spawned && isEnemyDef(getTokenType(spawned.typeId))) spawned.tether = instance.id;
    if (spawned && ctx.overMs > 0 && typeof ctx.advance === 'function') ctx.advance(spawned, ctx.overMs, random);

    // A green notice on the new Token (FB-48): news, not a problem, so it goes
    // on its own. Raised on the id that landed; a Token that grew during the
    // leftover time above is a new instance and simply has no notice.
    // ⭐ None while the time bank replays time away (owner, after Q2): the
    // player comes back to a calm mat, not a field of green marks.
    const spawnedName = getTokenType(typeId)?.name || typeId;
    if (!TimeBankManager.isSpending && BoardState.getTokenById(landed.instanceId)) TokenNotices.raiseNotice(landed.instanceId, {
        type: 'token_spawned',
        title: `New ${spawnedName}`,
        rulesText: `Spawned by ${def?.name || instance.typeId}`
    });

    logger.debug('SpawnerSystem', `${instance.typeId} spawned ${typeId}`);
    return instance;
}

// ---------------------------------------------------------------------------
// What a spawner reports (§3.1, for the UI in Phase 8)
// ---------------------------------------------------------------------------

/**
 * A spawner's state, worked out live:
 *
 * * `at_cap` — its family is at or over its cap;
 * * `needs_item` — the Bank and the loot on the mat cannot pay one spawn's
 *   upkeep between them (`needs`: item ids);
 * * `no_room` — its last attempt found nowhere to land, and it is waiting;
 * * `spawning` — otherwise, with `nextInMs` to the next attempt.
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
    const base = { count: countOf(family), cap: capOf(family), familyLabel: familyLabel(family) };
    const interval = intervalOf(def);
    const clock = Number(instance.clocks?.spawnMs) || 0;

    if (base.count >= base.cap) return { state: SPAWNER_STATE.AT_CAP, ...base };
    const needs = missingUpkeep(def);
    if (needs.length) return { state: SPAWNER_STATE.NEEDS_ITEM, needs, ...base };
    if (noRoom.has(instanceId) && clock >= interval) return { state: SPAWNER_STATE.NO_ROOM, ...base };
    return { state: SPAWNER_STATE.SPAWNING, nextInMs: Math.max(0, interval - clock), ...base };
}

/**
 * A spawner's live family count against its cap — `{ count, cap }` — or null
 * when it is not a working spawner. The cheap half of {@link spawnerStatus}
 * (no Bank check), for the count badge on the mat (FB-5).
 */
export function spawnerCounts(instanceId) {
    const instance = BoardState.getTokenById(instanceId);
    const def = instance ? getTokenType(instance.typeId) : null;
    if (!instance || instance.turnedFrom || !isSpawner(def)) return null;
    const family = familyOf(instance.typeId);
    return { count: countOf(family), cap: capOf(family) };
}

/**
 * Every family with a live spawner, once each: `[{ kind, typeIds, count, cap }]`,
 * where `kind` is the family's readable name. Feeds the QA panel.
 */
export function familyCounts() {
    const spawners = liveSpawners();
    const byKey = new Map();
    for (const s of spawners) {
        const family = familyOf(s.typeId);
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

// ---------------------------------------------------------------------------
// The on-mat alert (slice 8.3)
// ---------------------------------------------------------------------------

/**
 * Which waiting states raise an on-Token alert. Only the two the player can
 * fix: an empty Bank and a crowded mat. `at_cap` is a spawner's normal resting
 * state — every healthy spawner ends up there — so it raises nothing (the
 * inspection lines and the Upkeep Summary still say so).
 */
const ALERT_FOR_STATE = Object.freeze({
    [SPAWNER_STATE.NEEDS_ITEM]: ALERT.SPAWN_NEEDS_ITEM,
    [SPAWNER_STATE.NO_ROOM]: ALERT.SPAWN_NO_ROOM
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
 * `SPAWNER_ALERT_CHANGED` for each one that changed — and only those.
 *
 * Called at the end of `TimedChanges.tick`, after this tick's attempts, so an
 * alert goes up the tick a spawner starts waiting and comes down the tick the
 * cause is gone (a seed lands in the Bank or on the mat, a tree is cut and
 * frees room).
 * Worked out from the engine's own state, never polled from React.
 */
export function syncAlerts() {
    const live = new Set();
    for (const s of liveSpawners()) {
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

// ---------------------------------------------------------------------------
// The trickle (slice 3.4, SP-66)
// ---------------------------------------------------------------------------

/**
 * Advance a Token's `trickle` lines by `delta`, paying each line's items as its
 * clock comes round — no hero needed. Worked out in closed form (whole laps of
 * `everyMs`), so one big tick grants exactly what many small ones do.
 *
 * ⭐ **The pay drops as loot beside the Token** (FB-53), exactly as a gathered
 * output does (`BoardRunner` → `SpriteLayer.addSprite` with the Token's id):
 * it floats on the mat, is collected on hover (TL-9) or by auto-collect, and
 * flies to the Hall (Q5). Nothing reaches the Bank until it is collected, so a
 * full Bank simply leaves it on the floor (D-138) — `collectSprite` banks
 * through `InventoryManager` and never destroys what does not fit.
 *
 * **In bulk** (a time-bank replay or a long `advanceTime`), each line drops
 * ONE sprite per call holding every lap it completed (`laps × quantity`), and
 * `addSprite` folds same-item drops near an existing stack into that stack, as
 * it does for every other source; the floor's stack cap still applies.
 *
 * Lines with no item, no positive quantity or no positive `everyMs` are skipped
 * (the content audit reports them).
 *
 * @returns {number} how many items were granted (tests)
 */
export function advanceTrickle(instance, delta) {
    const lines = getTokenType(instance?.typeId)?.trickle;
    if (!Array.isArray(lines) || !lines.length || !(delta > 0)) return 0;

    const clocks = instance.clocks && typeof instance.clocks === 'object' ? instance.clocks : (instance.clocks = {});
    if (!Array.isArray(clocks.trickle)) clocks.trickle = [];

    let granted = 0;
    lines.forEach((line, i) => {
        const everyMs = Number(line?.everyMs);
        const quantity = Math.floor(Number(line?.quantity));
        if (!line?.itemId || !(everyMs > 0) || !(quantity > 0)) return;

        const clock = (Number(clocks.trickle[i]) || 0) + delta;
        const laps = Math.floor(clock / everyMs);
        clocks.trickle[i] = clock - laps * everyMs;
        if (laps > 0) {
            SpriteLayer.addSprite('item', line.itemId, laps * quantity, instance.id);
            granted += laps * quantity;
        }
    });
    // Unused slots are written as 0, so the saved array is dense.
    for (let i = 0; i < lines.length; i++) if (!Number.isFinite(clocks.trickle[i])) clocks.trickle[i] = 0;
    return granted;
}
