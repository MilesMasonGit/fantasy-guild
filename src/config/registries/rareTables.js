// a Token's rare drop table: one chance a cycle or kill, then one find picked by weight (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (through `cms/src/utils/constants.js` and
// the ledger). Pure: its one import (`catchPools.js`) is pure too, so both sides can load it.

import { pickCatchIndex } from './catchPools.js';

/**
 * A Token type's rare drop table: `rareTable: { chance, entries: [{ itemId, weight, minQty, maxQty }] }`.
 *
 * - `chance`: percent a cycle (or a kill) rolls the table, decimals allowed (0.5 is one in two
 *   hundred). Lucky widens it, with this chance as its base.
 * - `entries`: a weighted pick, as a catch pool's: weights are relative (50, 40, 10 reads as 50 %,
 *   40 %, 10 % of the table's hits). One entry drops per hit, its quantity rolled over `minQty` to
 *   `maxQty` (missing: 1), then landed like any output line.
 *
 * Any Token kind with drops may carry one: a vein, a tree, a station, water, an enemy. A table with
 * no chance above 0 or no entry with an item and a weight above 0 is no table: nothing rolls, and
 * Lucky does nothing there.
 *
 * Read per Token type and kept (a `WeakMap` on the definition object), as `catchPools.js` does.
 */

const cache = new WeakMap();
const NONE = Symbol('none');

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const whole = (v, fallback) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
};

function normalise(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const chance = Number(raw.chance);
    if (!Number.isFinite(chance) || chance <= 0) return null;
    const entries = (Array.isArray(raw.entries) ? raw.entries : [])
        .map(e => {
            const min = whole(e?.minQty ?? e?.quantity, 1);
            const max = whole(e?.maxQty ?? e?.quantity, min);
            return { itemId: text(e?.itemId), weight: Number(e?.weight), minQty: Math.min(min, max), maxQty: Math.max(min, max) };
        })
        .filter(e => e.itemId && Number.isFinite(e.weight) && e.weight > 0 && e.maxQty > 0)
        .map(e => Object.freeze(e));
    if (!entries.length) return null;
    const total = entries.reduce((sum, e) => sum + e.weight, 0);
    return Object.freeze({ chance: Math.min(100, chance), entries: Object.freeze(entries), total });
}

/**
 * A Token type's usable rare table, `{ chance, entries, total }` (`total`: the entries' summed
 * weight), or null for none.
 */
export function rareTableOf(def) {
    if (!def || typeof def !== 'object' || !def.rareTable) return null;
    let table = cache.get(def);
    if (table === undefined) {
        table = normalise(def.rareTable) || NONE;
        cache.set(def, table);
    }
    return table === NONE ? null : table;
}

/**
 * The chance (percent) a Token type's rare table rolls before Lucky, or null when it has none.
 * Pure: what the effect breakdown takes as Lucky's base.
 */
export function rareTableChance(def) {
    return rareTableOf(def)?.chance ?? null;
}

/** An entry's share of its table's hits, 0 to 1. */
export function rareEntryShare(table, entry) {
    return table?.total > 0 ? Math.max(0, Number(entry?.weight) || 0) / table.total : 0;
}

/**
 * Each entry with its own chance (percent) a cycle drops it: the table's chance (`chance`, Lucky
 * already counted if the caller has) times the entry's share. In table order.
 */
export function rareEntryChances(table, chance = table?.chance) {
    if (!table) return [];
    const c = Math.max(0, Math.min(100, Number(chance) || 0));
    return table.entries.map(entry => ({ entry, chance: c * rareEntryShare(table, entry) }));
}

/**
 * The entry a hit picks, by weight: one draw, none when the table holds one entry
 * (`catchPools.pickCatchIndex`).
 */
export function pickRareEntry(table, random = Math.random) {
    if (!table) return null;
    const index = pickCatchIndex(table.entries.map(e => e.weight), random);
    return index == null ? null : table.entries[index];
}
