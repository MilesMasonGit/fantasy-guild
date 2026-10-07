// the Upkeep Summary's maths

import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { statementsOf } from '../effects/statements.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as SpawnerSystem from './SpawnerSystem.js';
import { isStatementPaid } from './BlockUpkeep.js';

/**
 * Every ongoing cost on the mat, per item, per minute: the numbers behind the Upkeep Summary panel.
 * Pure: it reads the mat, the Bank and the Token types, and changes nothing.
 *
 * Spawner upkeep is paid per spawn, so a spawner costs `quantity × 60000 / intervalMs` per minute,
 * but only while it is `spawning` or waiting on an item (`needs_item`); one `at_cap` or with
 * `no_room` pays nothing and is listed as idle.
 *
 * Statement upkeep (`BlockUpkeep`): each costed statement charges `quantity × 60000 / cadenceMs`
 * per minute. Its clock runs on every Token on the mat regardless of heroes (see
 * `BoardRunner.tick`), so it always counts; an unpaid statement is listed as waiting.
 *
 * Income is `trickle` lines on live Tokens: `quantity × 60000 / everyMs`.
 *
 * Runs out in: rough by design, on hand ÷ (cost − that item's trickle income) per minute; net
 * income at or above the cost means it never runs out (`runsOutMs: null`).
 *
 * On hand: a spawner pays from the Bank and then from matching loot on the mat, so an item any
 * spawner uses counts both (`have` = `bank` + `onMat`). Statement upkeep is paid from the Bank
 * alone, so an item only rules use counts the Bank alone.
 */

const MINUTE = 60000;

/** The live engine readers. Tests pass their own. */
function liveSources() {
    return {
        tokens: () => BoardState.tokens(),
        typeOf: (typeId) => getTokenType(typeId),
        statusOf: (instanceId) => SpawnerSystem.spawnerStatus(instanceId),
        bankCount: (itemId) => InventoryManager.getItemCount(itemId),
        floorCount: (itemId) => SpriteLayer.countOnBoard(itemId),
        isPaid: (instance, statementId) => isStatementPaid(instance, statementId),
        itemName: (itemId) => getItem(itemId)?.name || itemId
    };
}

/** Positive whole quantity, or 0. */
function qty(n, fallback = 0) {
    const q = Math.floor(Number(n ?? fallback));
    return Number.isFinite(q) && q > 0 ? q : 0;
}

/** A spawner's upkeep summed by item (the same reading `SpawnerSystem` pays). */
function spawnerUpkeep(def) {
    const total = new Map();
    for (const line of Array.isArray(def?.spawner?.upkeep) ? def.spawner.upkeep : []) {
        const q = qty(line?.quantity);
        if (!line?.itemId || !q) continue;
        total.set(line.itemId, (total.get(line.itemId) || 0) + q);
    }
    return total;
}

/** Statements that cost items on a clock — the ones `BlockUpkeep.tickUpkeep` charges. */
function costedStatements(def) {
    return statementsOf(def).filter(s => s?.id && s?.upkeep?.items?.length && s.upkeep.cadenceMs > 0);
}

/**
 * Work out the summary.
 *
 * @param {object} [sources] overrides for the live readers (tests)
 * @returns {{
 *   items: Array<{ itemId, name, perMinute, incomePerMinute, netPerMinute, bank,
 *                  onMat, have, runsOutMs: number|null, consumers: object[], waiting: object[] }>,
 *   idle: Array<{ instanceId, name, state, familyLabel, count, cap }>,
 *   income: Array<{ itemId, name, perMinute, sources: object[] }>
 * }}
 *   `items` puts anything with a Token waiting first, then the soonest to run out.
 */
export function computeUpkeepSummary(sources = {}) {
    const src = { ...liveSources(), ...sources };
    const items = new Map();
    const idle = [];
    const incomeByItem = new Map();

    const itemRow = (itemId) => {
        if (!items.has(itemId)) items.set(itemId, { itemId, perMinute: 0, consumers: [], waiting: [] });
        return items.get(itemId);
    };

    for (const instance of src.tokens()) {
        const def = src.typeOf(instance.typeId);
        if (!def) continue;
        const name = def.name || instance.typeId;

        const status = src.statusOf(instance.id);
        if (status) {
            const upkeep = spawnerUpkeep(def);
            const paying = status.state === SpawnerSystem.SPAWNER_STATE.SPAWNING
                || status.state === SpawnerSystem.SPAWNER_STATE.NEEDS_ITEM;
            if (!paying) {
                idle.push({
                    instanceId: instance.id, name, state: status.state,
                    familyLabel: status.familyLabel, count: status.count, cap: status.cap
                });
            } else {
                const interval = SpawnerSystem.intervalOf(def);
                const needs = new Set(status.needs || []);
                for (const [itemId, q] of upkeep) {
                    const perMinute = q * MINUTE / interval;
                    const row = itemRow(itemId);
                    row.perMinute += perMinute;
                    row.consumers.push({ instanceId: instance.id, name, source: 'spawner', perMinute, waiting: needs.has(itemId) });
                    if (needs.has(itemId)) row.waiting.push({ instanceId: instance.id, name, source: 'spawner' });
                }
            }
        }

        for (const statement of costedStatements(def)) {
            const paid = src.isPaid(instance, statement.id);
            const lines = statement.upkeep.items.filter(it => it?.itemId);
            // An unpaid rule waits on whichever items the Bank is short of; if it
            // is short of none (stock came back, the next charge not yet due), on all.
            const short = paid ? [] : lines.filter(it => src.bankCount(it.itemId) < qty(it.quantity, 1));
            const waitingOn = new Set((short.length ? short : (paid ? [] : lines)).map(it => it.itemId));
            for (const it of lines) {
                const perMinute = qty(it.quantity, 1) * MINUTE / statement.upkeep.cadenceMs;
                const row = itemRow(it.itemId);
                row.perMinute += perMinute;
                const waiting = waitingOn.has(it.itemId);
                row.consumers.push({ instanceId: instance.id, name, source: 'rule', perMinute, waiting });
                if (waiting) row.waiting.push({ instanceId: instance.id, name, source: 'rule' });
            }
        }

        for (const line of Array.isArray(def.trickle) ? def.trickle : []) {
            const q = qty(line?.quantity);
            const everyMs = Number(line?.everyMs);
            if (!line?.itemId || !q || !(everyMs > 0)) continue;
            const perMinute = q * MINUTE / everyMs;
            if (!incomeByItem.has(line.itemId)) incomeByItem.set(line.itemId, { itemId: line.itemId, perMinute: 0, sources: [] });
            const row = incomeByItem.get(line.itemId);
            row.perMinute += perMinute;
            row.sources.push({ instanceId: instance.id, name, perMinute });
        }
    }

    const itemRows = [...items.values()].map(row => {
        const incomePerMinute = incomeByItem.get(row.itemId)?.perMinute || 0;
        const netPerMinute = row.perMinute - incomePerMinute;
        const bank = src.bankCount(row.itemId);
        const onMat = src.floorCount ? (Number(src.floorCount(row.itemId)) || 0) : 0;
        // Floor loot pays spawners only, so it counts only where a spawner uses the item.
        const have = bank + (row.consumers.some(c => c.source === 'spawner') ? onMat : 0);
        return {
            ...row,
            name: src.itemName(row.itemId),
            incomePerMinute,
            netPerMinute,
            bank,
            onMat,
            have,
            runsOutMs: netPerMinute > 0 ? (have / netPerMinute) * MINUTE : null
        };
    });
    itemRows.sort((a, b) =>
        (b.waiting.length > 0) - (a.waiting.length > 0)
        || (a.runsOutMs ?? Infinity) - (b.runsOutMs ?? Infinity)
        || a.name.localeCompare(b.name));

    const income = [...incomeByItem.values()]
        .map(row => ({ ...row, name: src.itemName(row.itemId) }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return { items: itemRows, idle, income };
}

/** A per-minute rate for the panel: `1`, `0.5`, `2.5`, `0.25`. */
export function formatRate(perMinute) {
    if (!(perMinute > 0)) return '0';
    const rounded = perMinute >= 10 ? Math.round(perMinute) : Math.round(perMinute * 100) / 100;
    return String(rounded);
}

/** A rough "runs out in": `empty now`, `~40 s`, `~12 min`, `~3.5 h`, `never`. */
export function formatRunsOut(ms) {
    if (ms == null) return 'never';
    if (ms <= 0) return 'empty now';
    const s = ms / 1000;
    if (s < 60) return `~${Math.max(1, Math.round(s))} s`;
    const min = s / 60;
    if (min < 60) return `~${Math.round(min)} min`;
    const h = min / 60;
    if (h < 48) return `~${Math.round(h * 10) / 10} h`;
    return `~${Math.round(h / 24)} days`;
}
