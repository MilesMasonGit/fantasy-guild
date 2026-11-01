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
 * A cell's price against what the guild has: `{ items, skills, met }`, where each item is
 * `{ itemId, need, have, short }` and each skill `{ skill, need, have, short }`. A cell with no
 * price (the Hall's) is met.
 *
 * @param {object} cell a world cell
 * @param {{ itemCount: (itemId: string) => number, skillLevel: (skill: string) => number }} guild
 */
export function priceRows(cell, { itemCount, skillLevel }) {
    const req = cell?.requires || { items: [], skills: [] };
    const items = (req.items || []).map(({ itemId, qty }) => {
        const have = Math.max(0, Math.floor(Number(itemCount(itemId)) || 0));
        return { itemId, need: qty, have, short: have < qty };
    });
    const skills = (req.skills || []).map(({ skill, level }) => {
        const have = Math.max(0, Math.floor(Number(skillLevel(skill)) || 0));
        return { skill, need: level, have, short: have < level };
    });
    return { items, skills, met: !items.some(r => r.short) && !skills.some(r => r.short) };
}

/**
 * What a cell yields, as the map shows it: each material its origins yield, once, the key and main
 * origins' first, then the blends'. The hidden extras are never read here.
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
