// Fantasy Guild — Equipment Category Registry (Area Deck Rework, C-7)
//
// [D-54] Equipment categories are DATA, not constants baked into the engine.
// The owner intends to keep adding gear types — `quiver`, `gloves` and `boots`
// are planned, and `trinket` is expected to split into `ring` (cap 2) and
// `amulet` (cap 1) — so **adding a category must be an authoring change with
// no engine edit**. Everything downstream derives from this table.
//
// [D-55] A category's cap is a property OF THE CATEGORY: most allow 1, a few
// allow 2. Nothing else constrains the hero's grid.
//
// [D-7] The grid itself is fully flexible: nine slots, any item in any slot,
// gear and consumables sharing one pool. That is what makes the gear-vs-
// consumables ratio a real decision rather than a fixed layout.

/** How many slots a hero's loadout grid has (D-7). Rendered 3×3. */
export const GRID_SLOT_COUNT = 9;

/**
 * What a category is FOR. Consumers branch on this rather than on category
 * ids, so a new gear type or a new consumable class needs no engine change.
 *
 *   gear        — worn equipment; contributes stats, can be damaged/lost
 *   sustenance  — food & drink, consumed on need (the 25% rule, D-17)
 *   consumable  — potions, scrolls, runes; spent in the Prep Phase (D-20)
 */
export const CATEGORY_KINDS = {
    GEAR: 'gear',
    SUSTENANCE: 'sustenance',
    CONSUMABLE: 'consumable'
};

/** Unlimited — the `Consumable` class is deliberately uncapped (D-56). */
export const UNCAPPED = Infinity;

/**
 * The authored category table. An item declares its category through its
 * `equipSlot` field; the id here is what that field must match.
 *
 * To add a category — `boots`, say — append a row. Nothing else changes.
 */
export const EQUIPMENT_CATEGORY_DEFS = [
    // --- Gear (D-55: most cap at 1, hands allow 2) ---------------------
    {
        id: 'hand',
        label: 'Hand',
        icon: '⚔️',
        kind: CATEGORY_KINDS.GEAR,
        cap: 2,
        // Two free hands, no main/off distinction: either hand takes any
        // weapon and their bonuses stack (hero_dock_roadmap_v1.md D2).
        weapon: true
    },
    { id: 'hat',     label: 'Hat',     icon: '🎩',  kind: CATEGORY_KINDS.GEAR, cap: 1 },
    { id: 'chest',   label: 'Chest',   icon: '🛡️',  kind: CATEGORY_KINDS.GEAR, cap: 1 },
    { id: 'trinket', label: 'Trinket', icon: '💍',  kind: CATEGORY_KINDS.GEAR, cap: 2 },

    // --- Consumables (D-56: three classes, only the last is uncapped) ---
    { id: 'food',       label: 'Food',       icon: '🍖', kind: CATEGORY_KINDS.SUSTENANCE, cap: 1 },
    { id: 'drink',      label: 'Drink',      icon: '🍺', kind: CATEGORY_KINDS.SUSTENANCE, cap: 1 },
    {
        id: 'consumable',
        label: 'Consumable',
        icon: '🧪',
        kind: CATEGORY_KINDS.CONSUMABLE,
        // Uncapped on purpose: a wall of scrolls is a legitimate build, and
        // the only brake is the Prep Phase time it costs (D-56).
        cap: UNCAPPED
    }
];

/**
 * Id → definition lookup, DERIVED from the table rather than snapshotted at
 * module load. It is memoised on the table's length so lookups stay O(1),
 * but a category appended to `EQUIPMENT_CATEGORY_DEFS` is picked up.
 *
 * That matters because the table is the single source of truth (D-54): a
 * snapshot would mean "adding a category" silently required a reload, and
 * would be flatly wrong the day categories come from a data file the way
 * cards do.
 */
let byIdCache = null;
let byIdCacheSize = -1;

function byId() {
    if (byIdCache && byIdCacheSize === EQUIPMENT_CATEGORY_DEFS.length) return byIdCache;
    byIdCache = new Map(EQUIPMENT_CATEGORY_DEFS.map(def => [def.id, def]));
    byIdCacheSize = EQUIPMENT_CATEGORY_DEFS.length;
    return byIdCache;
}

/** The definition for a category id, or null. */
export function getCategoryDef(categoryId) {
    return byId().get(categoryId) || null;
}

/** True when this id names a real, equippable category. */
export function isEquipCategory(categoryId) {
    return byId().has(categoryId);
}

/** How many of this category a hero may carry. 0 for unknown categories. */
export function getCategoryCap(categoryId) {
    return byId().get(categoryId)?.cap ?? 0;
}

/** Every category id, in authored order. */
export function listCategoryIds() {
    return EQUIPMENT_CATEGORY_DEFS.map(def => def.id);
}

/** Category ids of a given kind — e.g. every gear type, for armour effects. */
export function categoryIdsOfKind(kind) {
    return EQUIPMENT_CATEGORY_DEFS.filter(def => def.kind === kind).map(def => def.id);
}

/** True when items of this category are worn gear (stats, defeat-loss). */
export function isGearCategory(categoryId) {
    return getCategoryDef(categoryId)?.kind === CATEGORY_KINDS.GEAR;
}

/** True when items of this category are potions/scrolls/runes (the Prep Phase class, D-20). */
export function isConsumableCategory(categoryId) {
    return getCategoryDef(categoryId)?.kind === CATEGORY_KINDS.CONSUMABLE;
}

/** True when this category's items count as weapons for combat. */
export function isWeaponCategory(categoryId) {
    return getCategoryDef(categoryId)?.weapon === true;
}

/** Display info for a category, with a safe fallback for unknown ids. */
export function getCategoryInfo(categoryId) {
    const def = getCategoryDef(categoryId);
    return def
        ? { icon: def.icon, label: def.label, kind: def.kind, cap: def.cap }
        : { icon: '❔', label: categoryId || 'Empty', kind: null, cap: 0 };
}
