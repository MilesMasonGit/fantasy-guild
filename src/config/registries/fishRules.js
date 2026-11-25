// what a fish, a lure and a fishing tool say about a catch: its level, its time, its Bait (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`). Pure: no
// imports, so both sides can load it.

/**
 * Three item blocks, each optional:
 *
 * - **A fish** (any item a catch pool lands): `fish: { level, cycleMs, bait }`. `level` is the
 *   Fishing level that catches it, `cycleMs` how long one catch of it takes, `bait` how much Bait a
 *   catch of it spends (more for rarer fish). A field left out falls back to the water's own: its
 *   Token's level and cycle, and 1 Bait.
 * - **A lure**: `lure: { fish: [itemId, …], breakChance }`. Carried in a consumable cell, it picks
 *   which of its fish bites, when the spot holds one of them; `breakChance` is the % chance one is
 *   used up each catch it picks.
 * - **A fishing tool** may spend less Bait: `tool: { kind, tier, baitSaving }`, a whole number of
 *   Bait off each catch. A catch that spends any never spends less than 1.
 *
 * Which pool a hero fishes, and whether it spends Bait at all, is the catch pool's (`catchPools.js`):
 * a pool naming a bait spends it, a Trap's pool naming none is free.
 */

const MAX_CHANCE = 100;

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const positive = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
const whole = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : null);

const fishCache = new WeakMap();
const lureCache = new WeakMap();

/**
 * An item's fish block in one shape, or null when it has none. A field the block leaves out (or
 * writes as nonsense) is null, so the water's own stands in for it.
 *
 * @returns {{level: number|null, cycleMs: number|null, bait: number|null}|null}
 */
export function fishOf(item) {
    const raw = item && typeof item === 'object' ? item.fish : null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    let fish = fishCache.get(item);
    if (!fish) {
        const level = positive(raw.level);
        fish = Object.freeze({
            level: level === null ? null : Math.floor(level),
            cycleMs: positive(raw.cycleMs) === null ? null : Math.round(Number(raw.cycleMs)),
            bait: whole(raw.bait)
        });
        fishCache.set(item, fish);
    }
    return fish;
}

/**
 * An item's lure block in one shape, or null when it is not a lure (no block, or no fish named).
 *
 * @returns {{fish: string[], breakChance: number}|null}
 */
export function lureOf(item) {
    const raw = item && typeof item === 'object' ? item.lure : null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (lureCache.has(item)) return lureCache.get(item);
    const fish = [];
    for (const v of Array.isArray(raw.fish) ? raw.fish : []) {
        const id = text(v);
        if (id && !fish.includes(id)) fish.push(id);
    }
    const lure = fish.length
        ? Object.freeze({ fish: Object.freeze(fish), breakChance: Math.min(MAX_CHANCE, positive(raw.breakChance) || 0) })
        : null;
    lureCache.set(item, lure);
    return lure;
}

/** How much Bait a fishing tool saves each catch: its `tool.baitSaving`, a whole number, else 0. */
export function baitSavingOf(item) {
    return whole(item?.tool?.baitSaving) || 0;
}

/**
 * The Bait one catch spends: the fish's amount less the tool's saving, never below 1 for a catch
 * that spends any. A fish asking none (0) spends none.
 */
export function baitSpent(amount, saving = 0) {
    const asked = whole(amount);
    if (!asked) return 0;
    return Math.max(1, asked - (whole(saving) || 0));
}

/** A fish's level, else `fallback` (its water's level). */
export function fishLevel(item, fallback = 1) {
    return fishOf(item)?.level ?? fallback;
}

/** A fish's catch time in ms, else `fallback` (its water's cycle). */
export function fishCycleMs(item, fallback) {
    return fishOf(item)?.cycleMs ?? fallback;
}

/** The Bait a catch of this fish asks before any tool's saving: its own amount, else 1. */
export function fishBait(item) {
    return fishOf(item)?.bait ?? 1;
}
