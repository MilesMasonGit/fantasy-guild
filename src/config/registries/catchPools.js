// a water Token's catch pools: what bites for which tool and bait (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (through `toolKinds.js` and
// `cms/src/utils/constants.js`). Pure: no imports, so both sides and `toolKinds` can load it.

/**
 * A fishing spot names what can be caught there, per tool kind and bait:
 * `catchPools: [{ tool, bait, catches: [{ itemId, weight }] }]` on the Token type.
 *
 * - `tool`: a tool kind (`fishing_rod`, `fishing_net`, …). The hero's tool picks the pools.
 * - `bait`: an item id, or null for a pool worked with no bait. Only a {@link BAIT_FREE_TOOL} pool
 *   with no bait catches anything: every other tool fishes with bait or not at all.
 * - `catches`: a weighted pool; each catch lands one of its item. Weights are relative (50, 40,
 *   10 reads as 50 %, 40 %, 10 %).
 * - `water`, `biomes` (optional): the water kinds (`fishingSpots.WATER_KIND`) and the Region biomes
 *   the pool holds for. A fishing spot's catch comes from the water it sits on and the Region's
 *   biome ({@link poolsAt}); a pool naming neither holds everywhere. Where several pools for one
 *   tool and bait fit, the first wins, so a pool for a warm sea is written before the plain sea's.
 *
 * A Token with at least one usable pool is water: its catch replaces its Outputs, it never runs
 * out, and the tool it needs is any kind a pool names, at any tier.
 *
 * Read per Token type and kept (a `WeakMap` on the definition object), because the flags and the
 * board runner ask a Token's tool need on every tick. A content reload registers new objects, so
 * nothing stale is kept.
 */

/** The one tool kind that catches with no bait (a Trap): every other tool needs bait at water. */
export const BAIT_FREE_TOOL = 'fishing_trap';

/** Whether a pool catches anything: it takes a bait, or it is worked with a {@link BAIT_FREE_TOOL}. */
export function poolBites(pool) {
    return !!pool && (!!pool.bait || pool.tool === BAIT_FREE_TOOL);
}

const EMPTY = Object.freeze([]);
const cache = new WeakMap();

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** A pool's `water` or `biomes`: trimmed words, blanks and repeats dropped, or null for none. */
function tagList(raw) {
    const out = [];
    for (const v of Array.isArray(raw) ? raw : []) {
        const word = text(v);
        if (word && !out.includes(word)) out.push(word);
    }
    return out.length ? Object.freeze(out) : null;
}

/** The key a repeat is found by: the tool, the bait and where the pool holds. */
const poolKey = (tool, bait, water, biomes) => `${tool}|${bait || ''}|${water ? water.join(',') : ''}|${biomes ? biomes.join(',') : ''}`;

function normalise(raw) {
    if (!Array.isArray(raw)) return EMPTY;
    const out = [];
    const seen = new Set();
    for (const pool of raw) {
        const tool = text(pool?.tool);
        if (!tool) continue;
        const bait = text(pool?.bait);
        const water = tagList(pool?.water);
        const biomes = tagList(pool?.biomes);
        // The first pool for a tool, a bait and a place wins; the audit names the repeat.
        const key = poolKey(tool, bait, water, biomes);
        if (seen.has(key)) continue;
        const catches = (Array.isArray(pool?.catches) ? pool.catches : [])
            .map(c => ({ itemId: text(c?.itemId), weight: Number(c?.weight) }))
            .filter(c => c.itemId && Number.isFinite(c.weight) && c.weight > 0)
            .map(c => Object.freeze(c));
        if (!catches.length) continue;
        seen.add(key);
        // Written only when named, so a pool for everywhere reads exactly as it always did.
        out.push(Object.freeze({
            tool, bait, catches: Object.freeze(catches), ...(water ? { water } : {}), ...(biomes ? { biomes } : {})
        }));
    }
    return out.length ? Object.freeze(out) : EMPTY;
}

/** A Token type's usable pools, in authored order: a tool, and at least one catch with a weight. */
export function catchPoolsOf(def) {
    if (!def || typeof def !== 'object' || !Array.isArray(def.catchPools)) return EMPTY;
    let pools = cache.get(def);
    if (!pools) {
        pools = normalise(def.catchPools);
        cache.set(def, pools);
    }
    return pools;
}

/** Whether a Token type is water: it has a usable catch pool. */
export function hasCatchPools(def) {
    return catchPoolsOf(def).length > 0;
}

/** The tool kinds a Token type's pools name, in pool order, each once. */
export function catchToolKinds(def) {
    const kinds = [];
    for (const pool of catchPoolsOf(def)) if (!kinds.includes(pool.tool)) kinds.push(pool.tool);
    return kinds;
}

/**
 * Whether a pool holds at `place`, `{ water, biomes }`: the water kind under the Token (null on dry
 * land) and the Region's biomes. A pool naming a water holds only on it, one naming biomes only in a
 * Region of one of them; a pool naming neither holds everywhere. No place: only those.
 */
export function poolFits(pool, place = null) {
    if (pool.water && !(place?.water && pool.water.includes(place.water))) return false;
    if (pool.biomes && !(Array.isArray(place?.biomes) && pool.biomes.some(b => place.biomes.includes(b)))) return false;
    return true;
}

/** Pools that fit a place, per definition and place; a place is a kept object (`GroundRules.placeAt`). */
const fitted = new WeakMap();
const NO_PLACE = Object.freeze({ water: null, biomes: EMPTY });

/**
 * A Token type's pools that hold at `place` (see {@link poolFits}), in authored order. Kept per
 * definition and place object, as the flags ask on every tick.
 */
export function poolsAt(def, place = null) {
    const pools = catchPoolsOf(def);
    if (!pools.length) return EMPTY;
    if (!pools.some(p => p.water || p.biomes)) return pools;
    const at = place && typeof place === 'object' ? place : NO_PLACE;
    let byPlace = fitted.get(def);
    if (!byPlace) {
        byPlace = new WeakMap();
        fitted.set(def, byPlace);
    }
    let out = byPlace.get(at);
    if (!out) {
        const kept = pools.filter(p => poolFits(p, at));
        out = kept.length ? Object.freeze(kept) : EMPTY;
        byPlace.set(at, out);
    }
    return out;
}

/**
 * The pool for a tool kind and a bait (null: its pool with no bait) that holds at `place`, or null:
 * the first that fits. Authored only: whether it catches anything is {@link poolBites}.
 */
export function poolFor(def, tool, bait = null, place = null) {
    return poolsAt(def, place).find(p => p.tool === tool && p.bait === (bait || null)) || null;
}

/** The baits a Token type's pools for one tool kind take at `place`, in pool order, each once. */
export function baitsFor(def, tool, place = null) {
    const out = [];
    for (const p of poolsAt(def, place)) if (p.tool === tool && p.bait && !out.includes(p.bait)) out.push(p.bait);
    return out;
}

/** Every item a Token type's pools can land, each once, in pool order. */
export function catchItemIds(def) {
    const ids = [];
    for (const pool of catchPoolsOf(def)) {
        for (const c of pool.catches) if (!ids.includes(c.itemId)) ids.push(c.itemId);
    }
    return ids;
}

/** Every bait a Token type's pools take, each once. */
export function baitItemIds(def) {
    const ids = [];
    for (const pool of catchPoolsOf(def)) if (pool.bait && !ids.includes(pool.bait)) ids.push(pool.bait);
    return ids;
}

/**
 * The index of the catch that bites, from `weights` (one per catch, already widened by any rules):
 * a weight of 0 or less never bites. Null when none can.
 *
 * ⚠️ One choice draws nothing, so a one-fish pool never moves the random stream; otherwise
 * exactly one draw. The bench's work check pins the stream.
 */
export function pickCatchIndex(weights, random = Math.random) {
    let total = 0;
    let only = -1;
    let usable = 0;
    for (let i = 0; i < weights.length; i++) {
        const w = Number(weights[i]);
        if (!(w > 0)) continue;
        total += w;
        usable++;
        only = i;
    }
    if (!usable) return null;
    if (usable === 1) return only;
    let roll = random() * total;
    let last = -1;
    for (let i = 0; i < weights.length; i++) {
        const w = Number(weights[i]);
        if (!(w > 0)) continue;
        last = i;
        roll -= w;
        if (roll < 0) return i;
    }
    return last;
}
