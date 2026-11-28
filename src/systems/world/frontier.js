// which cells are settled, which can be settled next, and what a cell asks against what the guild has (pure)

import { cellId, neighbours } from './hex.js';

/**
 * The world map's reading of a world: each cell is **settled** (the guild has a Region there, the
 * Hall's cell always), **frontier** (not settled, beside a settled cell: the guild may settle it
 * now) or **beyond** (further out; its contents show, but it cannot be settled yet).
 *
 * A cell's price ({@link priceRows}) is its `requires` read against what the guild has: each item
 * against the Bank, each skill against the best level any hero has reached. Settling pays all of
 * it at once (`Settling.js`).
 *
 * Pure: reads only what it is handed.
 */

export const HALL_CELL = cellId(0, 0);

export const CELL_STATE = Object.freeze({ SETTLED: 'settled', FRONTIER: 'frontier', BEYOND: 'beyond' });

/** The settled cells' ids: the Hall's, and each one a Region names (`region.cellId`). */
export function settledIds(world, regions = []) {
    const ids = new Set([HALL_CELL]);
    const exists = new Set((world?.cells || []).map(c => c.id));
    for (const r of regions) {
        if (typeof r?.cellId === 'string' && exists.has(r.cellId)) ids.add(r.cellId);
    }
    return ids;
}

/** How many cells of `ring` are settled, `exceptId` not counted: the places a guild has settled there before. */
export function settledInRing(world, settled, ring, exceptId = null) {
    let n = 0;
    for (const cell of world?.cells || []) if (cell.ring === ring && cell.id !== exceptId && settled.has(cell.id)) n++;
    return n;
}

/** Each cell's state, by id. */
export function cellStates(world, settled) {
    const out = new Map();
    for (const cell of world?.cells || []) {
        if (settled.has(cell.id)) {
            out.set(cell.id, CELL_STATE.SETTLED);
            continue;
        }
        const touches = neighbours(cell).some(n => settled.has(cellId(n.q, n.r)));
        out.set(cell.id, touches ? CELL_STATE.FRONTIER : CELL_STATE.BEYOND);
    }
    return out;
}

/**
 * A cell's price against what the guild has: `{ items, skills, coins, dropped, met }`, where each
 * item is `{ itemId, need, have, short }`, each skill `{ skill, need, have, short }`, `coins` is
 * `{ need, have, short }` when the price asks coins (else null), and `dropped` the item ids the
 * price names that have no definition now. A cell with no price (the Hall's) is met.
 *
 * The coins are not stored on the cell: `guild.coinsAsked(cell)` reads them from the world tables
 * now (by ring), so tables that start asking coins reach a world written before.
 *
 * The stored price is the ring's first place's: `guild.priceFactor(cell)` grows its coins and item
 * quantities (rounded) by the places the guild has settled in that ring so far, so the order the
 * player settles in decides it. The levels asked do not grow.
 *
 * ⚠️ The world's prices are written once, at the new game, so an item deleted or renamed in the
 * CMS since would make its place unpayable for good: such a row is not asked (and not paid), and
 * the stored price keeps it, so restoring the id restores the row.
 *
 * @param {object} cell a world cell
 * @param {{ itemCount: (itemId: string) => number, skillLevel: (skill: string) => number,
 *   itemKnown?: (itemId: string) => boolean, coinsAsked?: (cell: object) => number, coinCount?: () => number,
 *   priceFactor?: (cell: object) => number }} guild
 */
export function priceRows(cell, { itemCount, skillLevel, itemKnown = () => true, coinsAsked = () => 0, coinCount = () => 0, priceFactor = () => 1 }) {
    const req = cell?.requires || { items: [], skills: [] };
    const factor = Number(priceFactor(cell));
    const grown = (n) => Math.round(n * (Number.isFinite(factor) && factor > 0 ? factor : 1));
    const dropped = [];
    const items = [];
    for (const { itemId, qty } of req.items || []) {
        if (!itemKnown(itemId)) {
            dropped.push(itemId);
            continue;
        }
        const have = Math.max(0, Math.floor(Number(itemCount(itemId)) || 0));
        const need = grown(qty);
        items.push({ itemId, need, have, short: have < need });
    }
    const skills = (req.skills || []).map(({ skill, level }) => {
        const have = Math.max(0, Math.floor(Number(skillLevel(skill)) || 0));
        return { skill, need: level, have, short: have < level };
    });
    const need = cell?.requires ? grown(Math.max(0, Math.floor(Number(coinsAsked(cell)) || 0))) : 0;
    const have = need > 0 ? Math.max(0, Math.floor(Number(coinCount()) || 0)) : 0;
    const coins = need > 0 ? { need, have, short: have < need } : null;
    return { items, skills, coins, dropped, met: !items.some(r => r.short) && !skills.some(r => r.short) && !coins?.short };
}

/**
 * What a cell yields, as the map shows it: each material its origins yield, once, the key and main
 * origins' first, then the blends'. A place's chests are never read here.
 *
 * @param {object} cell a world cell
 * @param {(originId: string) => string[]} materialsOf
 */
export function cellOutputs(cell, materialsOf) {
    const rank = (o) => (o.role === 'blend' ? 1 : 0);
    const origins = [...(cell?.origins || [])].sort((a, b) => rank(a) - rank(b));
    const out = [];
    for (const o of origins) {
        for (const m of materialsOf(o.id) || []) if (!out.includes(m)) out.push(m);
    }
    return out;
}
