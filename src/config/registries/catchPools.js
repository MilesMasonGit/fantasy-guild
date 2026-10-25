// a water Token's catch pools: what bites for which tool and bait (a leaf module)
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (through `toolKinds.js` and
// `cms/src/utils/constants.js`). Pure: no imports, so both sides and `toolKinds` can load it.

/**
 * A fishing spot names what can be caught there, per tool kind and bait:
 * `catchPools: [{ tool, bait, catches: [{ itemId, weight }] }]` on the Token type.
 *
 * - `tool`: a tool kind (`fishing_rod`, `fishing_net`, …). The hero's tool picks the pools.
 * - `bait`: an item id, or null for the water's basic pool for that tool (no bait carried).
 * - `catches`: a weighted pool; each catch lands one of its item. Weights are relative (50, 40,
 *   10 reads as 50 %, 40 %, 10 %).
 *
 * A Token with at least one usable pool is water: its catch replaces its Outputs, it never runs
 * out, and the tool it needs is any kind a pool names, at any tier.
 *
 * Read per Token type and kept (a `WeakMap` on the definition object), because the flags and the
 * board runner ask a Token's tool need on every tick. A content reload registers new objects, so
 * nothing stale is kept.
 */

const EMPTY = Object.freeze([]);
const cache = new WeakMap();

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function normalise(raw) {
    if (!Array.isArray(raw)) return EMPTY;
    const out = [];
    const seen = new Set();
    for (const pool of raw) {
        const tool = text(pool?.tool);
        if (!tool) continue;
        const bait = text(pool?.bait);
        // The first pool for a tool and bait wins; the audit names the repeat.
        const key = `${tool}|${bait || ''}`;
        if (seen.has(key)) continue;
        const catches = (Array.isArray(pool?.catches) ? pool.catches : [])
            .map(c => ({ itemId: text(c?.itemId), weight: Number(c?.weight) }))
            .filter(c => c.itemId && Number.isFinite(c.weight) && c.weight > 0)
            .map(c => Object.freeze(c));
        if (!catches.length) continue;
        seen.add(key);
        out.push(Object.freeze({ tool, bait, catches: Object.freeze(catches) }));
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

/** The pool for a tool kind and a bait (null: the basic pool, no bait), or null. */
export function poolFor(def, tool, bait = null) {
    return catchPoolsOf(def).find(p => p.tool === tool && p.bait === (bait || null)) || null;
}

/** The baits a Token type's pools for one tool kind take, in pool order. */
export function baitsFor(def, tool) {
    return catchPoolsOf(def).filter(p => p.tool === tool && p.bait).map(p => p.bait);
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
