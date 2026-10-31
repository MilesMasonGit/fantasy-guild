// the world's guarantees, checked on a generated world from the outside (pure)

import { cellId, neighbours, ringCells, SIDES } from './hex.js';
import { STRICT_RINGS } from '../../config/worldTablesShape.js';
import { priceTemplateOf } from './generate.js';

/**
 * Every rule the owner set for a world, read off a finished world and the tables it was generated
 * from, without trusting how the generator got there. The tests sweep thousands of seeds through
 * it; the ledger's World plan (brief 330 W5) lists its findings as checks.
 *
 * Each finding: `{ check, cellId?, ring?, message }`. None means the world keeps every rule.
 *
 * Not checked here: a price slot naming a fixed item (`item`) is crafted, so which ring it belongs
 * to is the ledger's to say; only materials a price takes from a place are checked against rings.
 *
 * Pure: reads only what it is handed.
 */

export const WORLD_CHECK = Object.freeze({
    SHAPE: 'shape',
    TIER: 'tier',
    NO_MAIN: 'no-main',
    COVERAGE: 'coverage',
    KEY_REACH: 'key-reach',
    BAG: 'specialty-bag',
    PITY: 'pity',
    VALUE: 'value',
    PRICE_RING: 'price-ring',
    PRICE_PLACES: 'price-places',
    PRICE_RISES: 'price-rises',
    KIT: 'kit',
    WILD: 'wild'
});

/** Author-facing words, kept together for translation. */
export const WORLD_CHECK_TEXT = Object.freeze({
    ringSize: (ring, has, wants) => `Ring ${ring} has ${has} cells, not ${wants}`,
    wedges: 'The six lines do not each take one side',
    wedgeWidth: (line, ring, has) => `The ${line} wedge has ${has} cells in ring ${ring}, not ${ring}`,
    tier: (cell) => `Cell ${cell}'s tier or wild mark does not follow its ring`,
    noMain: (cell) => `Cell ${cell} has no main origin`,
    coverage: (origin, ring) => `${origin} (ring ${ring}) is in no cell of the inner rings`,
    keyReach: (cell, key) => `Cell ${cell} has no cell one ring out holding the key origin ${key}`,
    bag: (ring) => `Ring ${ring}'s specialties are not an even bag`,
    pity: (cell, ring) => `Cell ${cell} (ring ${ring}) broke the pity rule: a specialty missing for too long did not come next`,
    value: (cell, value, target) => `Cell ${cell}'s extras are worth ${value}, outside its ring's ${target}`,
    priceRing: (cell, item, ring) => `Cell ${cell} asks for ${item}, a material of ring ${ring}, not of an earlier ring`,
    pricePlaces: (cell) => `Cell ${cell}'s price cannot be gathered from one or two earlier places beside it`,
    priceRises: (ring) => `Ring ${ring}'s cells do not all cost more than ring ${ring - 1}'s`,
    kit: (cell) => `Cell ${cell} has no kit, or one the tables do not list`,
    wild: (cell) => `Cell ${cell}'s wild extreme does not follow its ring`
});

/** Every origin a line lists for the strict rings, with the first ring it is listed in. */
function strictOrigins(tables) {
    const out = new Map();
    for (const line of tables.lines) {
        for (let n = 1; n <= STRICT_RINGS; n++) {
            for (const o of line.origins[n] || []) if (!out.has(o.id) || out.get(o.id) > n) out.set(o.id, n);
        }
    }
    return out;
}

/**
 * The ring a material belongs to: the earliest ring any origin yielding it is listed in, 0 for the
 * Hall's own origins; undefined for a material no origin yields.
 */
function materialRings(tables, hallOrigins, materialsOf) {
    const out = new Map();
    const note = (originId, ring) => {
        for (const m of materialsOf(originId) || []) if (!out.has(m) || out.get(m) > ring) out.set(m, ring);
    };
    for (const id of hallOrigins) note(id, 0);
    for (const [id, ring] of strictOrigins(tables)) note(id, ring);
    return out;
}

/**
 * The findings for one world.
 *
 * @param {object} world a `generateWorld` result
 * @param {object} tables the normalised tables it was generated from
 * @param {{materialsOf?: (originId: string) => string[], hallOrigins?: string[]}} [lookups]
 * @returns {{check: string, cellId?: string, ring?: number, message: string}[]}
 */
export function worldFindings(world, tables, { materialsOf = () => [], hallOrigins = [] } = {}) {
    const out = [];
    const find = (check, message, extra = {}) => out.push({ check, ...extra, message });
    const byId = new Map(world.cells.map(c => [c.id, c]));
    const ringOf = (n) => world.cells.filter(c => c.ring === n);
    const around = (cell) => neighbours(cell).map(n => byId.get(cellId(n.q, n.r))).filter(Boolean);

    // The grid and the wedges.
    for (let n = 0; n <= world.rings; n++) {
        const wants = n === 0 ? 1 : SIDES * n;
        if (ringOf(n).length !== wants) find(WORLD_CHECK.SHAPE, WORLD_CHECK_TEXT.ringSize(n, ringOf(n).length, wants), { ring: n });
    }
    const lineIds = tables.lines.map(l => l.id);
    if (world.wedges.length !== SIDES || new Set(world.wedges).size !== SIDES || !world.wedges.every(w => lineIds.includes(w))) {
        find(WORLD_CHECK.SHAPE, WORLD_CHECK_TEXT.wedges);
    }
    for (let n = 1; n <= world.rings; n++) {
        for (const expected of ringCells(n)) {
            const cell = byId.get(cellId(expected.q, expected.r));
            if (cell && cell.wedge !== world.wedges[expected.side]) find(WORLD_CHECK.SHAPE, WORLD_CHECK_TEXT.wedges, { cellId: cell.id });
        }
        for (const line of tables.lines) {
            const has = ringOf(n).filter(c => c.wedge === line.id).length;
            if (has !== n) find(WORLD_CHECK.SHAPE, WORLD_CHECK_TEXT.wedgeWidth(line.name, n, has), { ring: n });
        }
    }

    // Tiers by ring; every outer cell has its line's origin.
    for (const cell of world.cells) {
        if (cell.tier !== Math.min(cell.ring, STRICT_RINGS) || cell.wild !== (cell.ring > STRICT_RINGS)) {
            find(WORLD_CHECK.TIER, WORLD_CHECK_TEXT.tier(cell.id), { cellId: cell.id });
        }
        if (cell.ring > 0 && !cell.origins.some(o => o.role === 'main' && o.line === cell.wedge)) {
            find(WORLD_CHECK.NO_MAIN, WORLD_CHECK_TEXT.noMain(cell.id), { cellId: cell.id });
        }
    }

    // The inner rings hold every origin the tables list.
    const inner = new Set(world.cells.filter(c => c.ring >= 1 && c.ring <= STRICT_RINGS).flatMap(c => c.origins.map(o => o.id)));
    for (const [id, ring] of strictOrigins(tables)) {
        if (!inner.has(id)) find(WORLD_CHECK.COVERAGE, WORLD_CHECK_TEXT.coverage(id, ring), { ring });
    }

    // Key origins within a step of every cell one ring in.
    for (let n = 1; n <= STRICT_RINGS; n++) {
        for (const key of tables.keys[n] || []) {
            for (const cell of ringOf(n - 1)) {
                const reach = around(cell).filter(c => c.ring === n);
                if (!reach.some(c => c.origins.some(o => o.id === key))) {
                    find(WORLD_CHECK.KEY_REACH, WORLD_CHECK_TEXT.keyReach(cell.id, key), { cellId: cell.id, ring: n });
                }
            }
        }
    }

    // The specialty bag and the pity rule, walking each strict ring.
    const skills = tables.specialties;
    if (skills.length) {
        for (let n = 1; n <= Math.min(STRICT_RINGS, world.rings); n++) {
            const order = ringCells(n).map(c => byId.get(cellId(c.q, c.r))).filter(Boolean);
            const drawn = order.map(c => c.specialty);
            const counts = skills.map(s => drawn.filter(d => d === s).length);
            const floor = Math.floor(order.length / skills.length);
            if (drawn.some(d => !skills.includes(d)) || counts.some(c => c < floor || c > floor + 1)) {
                find(WORLD_CHECK.BAG, WORLD_CHECK_TEXT.bag(n), { ring: n });
                continue;
            }
            const window = tables.pityWindow;
            for (let i = window; i < drawn.length; i++) {
                const left = new Set(drawn.slice(i));
                const recent = new Set(drawn.slice(i - window, i));
                const due = [...left].filter(s => !recent.has(s));
                if (due.length && !due.includes(drawn[i])) {
                    find(WORLD_CHECK.PITY, WORLD_CHECK_TEXT.pity(order[i].id, n), { cellId: order[i].id, ring: n });
                }
            }
        }
    }

    // The value budget in the strict rings.
    for (const cell of world.cells) {
        if (cell.ring < 1 || cell.ring > STRICT_RINGS) continue;
        const target = tables.ringValue[cell.ring] || 0;
        const value = cell.extras.reduce((n, e) => n + e.value, 0);
        if (Math.abs(value - target) > target * tables.valueTolerance + 1e-9 || value !== cell.value) {
            find(WORLD_CHECK.VALUE, WORLD_CHECK_TEXT.value(cell.id, value, target), { cellId: cell.id });
        }
    }

    // Requirements: earlier rings only, from one or two places, rising with the ring.
    const rings = materialRings(tables, hallOrigins, materialsOf);
    const materialsAt = (cell) => new Set(cell.origins.flatMap(o => materialsOf(o.id) || []));
    const totals = new Map();
    for (const cell of world.cells) {
        if (cell.ring < 1) continue;
        const template = priceTemplateOf(tables, cell.ring);
        const fixed = new Set(template.items.filter(s => s.item).map(s => s.item));
        const gathered = (cell.requires?.items || []).filter(i => !fixed.has(i.itemId));
        for (const { itemId } of gathered) {
            const ring = rings.get(itemId);
            if (ring === undefined || ring >= cell.ring) find(WORLD_CHECK.PRICE_RING, WORLD_CHECK_TEXT.priceRing(cell.id, itemId, ring ?? '?'), { cellId: cell.id });
        }
        const places = (cell.payFrom || []).map(id => byId.get(id)).filter(Boolean);
        const inward = around(cell).filter(c => c.ring === cell.ring - 1);
        const placesOk = places.length === (cell.payFrom || []).length
            && places.length <= 2
            && places.every(p => p.ring < cell.ring)
            && (!gathered.length || places.some(p => inward.includes(p)))
            && gathered.every(i => places.some(p => materialsAt(p).has(i.itemId)));
        if (!placesOk) find(WORLD_CHECK.PRICE_PLACES, WORLD_CHECK_TEXT.pricePlaces(cell.id), { cellId: cell.id });
        const total = (cell.requires?.items || []).reduce((n, i) => n + i.qty, 0);
        const range = totals.get(cell.ring) || { min: Infinity, max: -Infinity };
        totals.set(cell.ring, { min: Math.min(range.min, total), max: Math.max(range.max, total) });
    }
    for (let n = 2; n <= world.rings; n++) {
        if (totals.has(n) && totals.has(n - 1) && !(totals.get(n).min > totals.get(n - 1).max)) {
            find(WORLD_CHECK.PRICE_RISES, WORLD_CHECK_TEXT.priceRises(n), { ring: n });
        }
    }

    // Kits, and the wild rings' extremes.
    const kits = new Set(tables.kits.map(k => k.id));
    for (const cell of world.cells) {
        if (cell.ring < 1) continue;
        if (!kits.has(cell.kit)) find(WORLD_CHECK.KIT, WORLD_CHECK_TEXT.kit(cell.id), { cellId: cell.id });
        const extreme = cell.extreme;
        const wildOk = cell.wild
            ? !!extreme && (extreme.kind === 'composition' ? cell.origins.some(o => o.id === extreme.focus) : tables.wild.layouts.some(l => l.id === extreme.layout))
            : extreme === null;
        if (!wildOk) find(WORLD_CHECK.WILD, WORLD_CHECK_TEXT.wild(cell.id), { cellId: cell.id });
    }

    return out;
}
