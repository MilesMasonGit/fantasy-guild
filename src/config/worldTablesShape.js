// The world tables' shape: what the world's generation reads, one reader for the game, the CMS and the ledger

/**
 * The world map is generated from tables the CMS will hold (`data/world.json`, written by Sync;
 * until then the game runs on `worldPlaceholder.js`). One record:
 *
 * ```
 * {
 *   version: 1,
 *   lines: [                        // exactly six: one wedge per hex side, shuffled each run
 *     { id: 'ores', name: 'Ores', skill: 'mining',
 *       kits: { highland: 3, riverside: 1 },              // the line's lean between kit archetypes
 *       origins: { 1: [{ id: 'token_copper_ore_vein', weight: 3 }], 2: [...], 3: [...] } },
 *     ...
 *   ],
 *   neighbours: [{ a: 'waters', b: 'herbs', weight: 1 }],  // natural neighbours the shuffle prefers
 *   neighbourStrength: 8,           // each point of neighbour weight makes an order this many times likelier
 *   mainPerCell: 1,                 // at least this many of its line's origins per cell
 *   blendsPerNeighbour: 1,          // origins a cell takes from each other wedge it touches
 *   keys: { 2: ['token_iron_ore_vein', 'token_fir_tree'] },  // within reach of every cell one ring in
 *   kits: [{ id: 'highland', name: 'Highland' }],
 *   specialties: ['mining', 'forestry', ...],                // the specialty bag of every strict ring
 *   pityWindow: 4,                  // a specialty absent from this many cells in a row comes next
 *   extras: [{ id: 'mod_rich_veins', kind: 'modifier', value: 10, lines: ['ores'], rings: [1, 2],
 *              max: 1, weight: 1 }],                       // the hidden extras: modifiers and treasures
 *   ringValue: { 1: 16, 2: 24, 3: 32 },                     // what a cell's extras are worth, per ring
 *   valueTolerance: 0.1,
 *   prices: { 1: { items: [{ qty: 20 }, { qty: 10, from: 'hall' }, { qty: 2, item: 'item_rope' }],
 *                  skills: [{ skill: 'line', level: 5 }] }, 2: ..., 3: ... },
 *   wild: { rings: 3, priceGrowth: 1.5, levelStep: 10, valueGrowth: 1.5, extremeShare: 0.5,
 *           layouts: [{ id: 'islands', weight: 1 }] }
 * }
 * ```
 *
 * An origin is a wild node's Token type. A price slot names its place (`from`: the source cell one
 * ring in, the default, or the Hall's cell) and the generator picks one of that place's materials;
 * a slot with `item` asks for that item. A skill slot's `skill` is a skill id, `line` (the cell's
 * line's skill) or `specialty` (the cell's specialty).
 *
 * Pure and import-free: the CMS reads it too.
 */

export const WORLD_TABLES_VERSION = 1;

/** Rings 1 to 3 follow the strict rules; from ring 4 outward generation is wild (owner). */
export const STRICT_RINGS = 3;

/** One wedge per hex side. */
export const LINE_COUNT = 6;

export const EXTRA_KIND = Object.freeze({ MODIFIER: 'modifier', TREASURE: 'treasure' });

/** Where a price slot's material is gathered. */
export const PRICE_FROM = Object.freeze({ SOURCE: 'source', HALL: 'hall' });

/** The skill slots that follow the cell rather than naming a skill. */
export const SKILL_OF = Object.freeze({ LINE: 'line', SPECIALTY: 'specialty' });

const DEFAULTS = Object.freeze({
    neighbourStrength: 8,
    mainPerCell: 1,
    blendsPerNeighbour: 1,
    pityWindow: 4,
    valueTolerance: 0.1,
    wild: Object.freeze({ rings: 3, priceGrowth: 1.5, levelStep: 10, valueGrowth: 1.5, extremeShare: 0.5 })
});

const MAX_LEVEL = 99;

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const positive = (v, fallback) => (finite(v) && v > 0 ? v : fallback);
const wholeAtLeast = (v, min, fallback) => (Number.isInteger(v) && v >= min ? v : fallback);
const listOf = (v) => (Array.isArray(v) ? v : []);

/** A list of strings, trimmed, blanks and repeats dropped. */
function idList(raw) {
    const out = [];
    for (const v of listOf(raw)) {
        const id = text(v);
        if (id && !out.includes(id)) out.push(id);
    }
    return out;
}

/** `{ 1: x, 2: y, 3: z }` read for the strict rings only, through `read`. */
function perRing(raw, read) {
    const out = {};
    for (let ring = 1; ring <= STRICT_RINGS; ring++) out[ring] = read(isObject(raw) ? raw[ring] ?? raw[String(ring)] : undefined);
    return out;
}

/** Weighted origins: `{ id, weight }`, the first of an id kept. */
function weightedIds(raw) {
    const out = [];
    const seen = new Set();
    for (const row of listOf(raw)) {
        const id = text(isObject(row) ? row.id : row);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ id, weight: positive(isObject(row) ? row.weight : undefined, 1) });
    }
    return out;
}

function lineOf(raw) {
    if (!isObject(raw)) return null;
    const id = text(raw.id);
    if (!id) return null;
    const kits = {};
    if (isObject(raw.kits)) {
        for (const [kit, weight] of Object.entries(raw.kits)) {
            if (text(kit) && positive(weight, 0) > 0) kits[kit.trim()] = weight;
        }
    }
    return {
        id,
        name: text(raw.name) || id,
        skill: text(raw.skill),
        kits,
        origins: perRing(raw.origins, weightedIds)
    };
}

function priceSlot(raw) {
    if (!isObject(raw)) return null;
    const qty = Math.round(positive(raw.qty, 0));
    if (qty < 1) return null;
    const item = text(raw.item);
    if (item) return { qty, item };
    return { qty, from: raw.from === PRICE_FROM.HALL ? PRICE_FROM.HALL : PRICE_FROM.SOURCE };
}

function skillSlot(raw) {
    if (!isObject(raw)) return null;
    const skill = text(raw.skill);
    const level = Math.round(positive(raw.level, 0));
    if (!skill || level < 1) return null;
    return { skill, level: Math.min(MAX_LEVEL, level) };
}

function priceTemplate(raw) {
    const block = isObject(raw) ? raw : {};
    return {
        items: listOf(block.items).map(priceSlot).filter(Boolean),
        skills: listOf(block.skills).map(skillSlot).filter(Boolean)
    };
}

function extraOf(raw) {
    if (!isObject(raw)) return null;
    const id = text(raw.id);
    const kind = Object.values(EXTRA_KIND).includes(raw.kind) ? raw.kind : null;
    const value = positive(raw.value, 0);
    if (!id || !kind || !(value > 0)) return null;
    const out = { id, kind, value, max: wholeAtLeast(raw.max, 1, 1), weight: positive(raw.weight, 1) };
    const rings = listOf(raw.rings).filter(n => Number.isInteger(n) && n >= 1 && n <= STRICT_RINGS);
    const lines = idList(raw.lines);
    if (rings.length) out.rings = [...new Set(rings)].sort((a, b) => a - b);
    if (lines.length) out.lines = lines;
    return out;
}

function wildOf(raw) {
    const block = isObject(raw) ? raw : {};
    const d = DEFAULTS.wild;
    const share = finite(block.extremeShare) ? Math.min(1, Math.max(0, block.extremeShare)) : d.extremeShare;
    return {
        rings: wholeAtLeast(block.rings, 0, d.rings),
        priceGrowth: finite(block.priceGrowth) && block.priceGrowth >= 1 ? block.priceGrowth : d.priceGrowth,
        levelStep: finite(block.levelStep) && block.levelStep >= 0 ? Math.round(block.levelStep) : d.levelStep,
        valueGrowth: finite(block.valueGrowth) && block.valueGrowth >= 1 ? block.valueGrowth : d.valueGrowth,
        extremeShare: share,
        layouts: weightedIds(block.layouts)
    };
}

/**
 * The world tables in their one shape, or null when `raw` cannot be generated from: not six lines
 * with distinct ids. Anything else malformed is dropped or defaulted, never refused, and said in
 * `issues` (plain sentences, for the CMS and the ledger to show).
 *
 * @returns {object|null}
 */
export function normaliseWorldTables(raw) {
    if (!isObject(raw)) return null;
    const lines = listOf(raw.lines).map(lineOf).filter(Boolean);
    const ids = new Set(lines.map(l => l.id));
    if (lines.length !== LINE_COUNT || ids.size !== LINE_COUNT) return null;
    const issues = [];

    const kits = [];
    for (const row of listOf(raw.kits)) {
        const id = text(isObject(row) ? row.id : row);
        if (id && !kits.some(k => k.id === id)) kits.push({ id, name: text(row?.name) || id });
    }
    const kitIds = new Set(kits.map(k => k.id));
    for (const line of lines) {
        for (const kit of Object.keys(line.kits)) {
            if (!kitIds.has(kit)) {
                issues.push(`The ${line.name} line leans to a kit "${kit}" that is not listed`);
                delete line.kits[kit];
            }
        }
    }

    const neighbours = [];
    for (const row of listOf(raw.neighbours)) {
        const a = text(row?.a);
        const b = text(row?.b);
        if (!ids.has(a) || !ids.has(b) || a === b) {
            issues.push(`A neighbour pair names a line that does not exist (${a} and ${b})`);
            continue;
        }
        neighbours.push({ a, b, weight: Math.max(1, Math.round(positive(row.weight, 1))) });
    }

    const extras = [];
    for (const row of listOf(raw.extras)) {
        const extra = extraOf(row);
        if (extra) extras.push(extra);
        else issues.push(`An extra was dropped: it needs an id, a kind (modifier or treasure) and a value above 0`);
    }

    const ringValue = perRing(raw.ringValue, v => (finite(v) && v >= 0 ? v : 0));
    const prices = perRing(raw.prices, priceTemplate);
    for (let ring = 2; ring <= STRICT_RINGS; ring++) {
        const total = (r) => prices[r].items.reduce((n, s) => n + s.qty, 0);
        if (total(ring) <= total(ring - 1)) issues.push(`Ring ${ring}'s price is not dearer than ring ${ring - 1}'s`);
    }

    const specialties = idList(raw.specialties);
    if (specialties.length > LINE_COUNT) {
        issues.push(`${specialties.length} specialties do not all fit in ring 1's ${LINE_COUNT} cells: some ring 1 goes without`);
    }

    const tolerance = finite(raw.valueTolerance) && raw.valueTolerance >= 0 && raw.valueTolerance < 1
        ? raw.valueTolerance : DEFAULTS.valueTolerance;

    return {
        version: WORLD_TABLES_VERSION,
        lines,
        neighbours,
        neighbourStrength: finite(raw.neighbourStrength) && raw.neighbourStrength >= 1 ? raw.neighbourStrength : DEFAULTS.neighbourStrength,
        mainPerCell: wholeAtLeast(raw.mainPerCell, 1, DEFAULTS.mainPerCell),
        blendsPerNeighbour: wholeAtLeast(raw.blendsPerNeighbour, 0, DEFAULTS.blendsPerNeighbour),
        keys: perRing(raw.keys, idList),
        kits,
        specialties,
        pityWindow: wholeAtLeast(raw.pityWindow, 1, DEFAULTS.pityWindow),
        extras,
        ringValue,
        valueTolerance: tolerance,
        prices,
        wild: wildOf(raw.wild),
        issues
    };
}

/** The line in `tables` with this id, or null. */
export function lineById(tables, id) {
    return tables?.lines?.find(l => l.id === id) || null;
}
