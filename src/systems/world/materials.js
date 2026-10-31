// what a world cell's origins yield, read from Token definitions (pure)

import { poolFor, catchToolKinds } from '../../config/registries/catchPools.js';

/**
 * A price asks for materials, and a cell's materials are what its origins (wild nodes) yield. Read
 * from the Token's own definition so the game, the CMS and the ledger agree: its Outputs that come
 * at least {@link MAIN_OUTPUT_CHANCE} percent of the time, and for water the catches making up at
 * least {@link MAIN_CATCH_SHARE} of a basic (no-bait) pool. Rare drops (a bird nest at 3 %) are
 * never asked for.
 *
 * ⚠️ Not a rate: a Field's crop, a spawner's family and a drop table are not read here. The ledger
 * (brief 330 W5) is the place for the full picture; this is what a price may name.
 *
 * Pure: the CMS can hand it its own Token store.
 */

/** An output this likely (percent) is one a price may ask for. */
export const MAIN_OUTPUT_CHANCE = 50;

/** A catch this large a share of its basic pool is one a price may ask for. */
export const MAIN_CATCH_SHARE = 0.5;

/** The items one Token definition yields as a matter of course, each once. */
export function materialsOfToken(def) {
    const out = [];
    const add = (id) => {
        if (typeof id === 'string' && id && !out.includes(id)) out.push(id);
    };
    for (const o of Array.isArray(def?.config?.outputs) ? def.config.outputs : []) {
        if (Number(o?.chance) >= MAIN_OUTPUT_CHANCE) add(o.itemId);
    }
    for (const tool of catchToolKinds(def)) {
        const pool = poolFor(def, tool, null);
        const catches = pool?.catches || [];
        const total = catches.reduce((n, c) => n + c.weight, 0);
        for (const c of catches) if (total > 0 && c.weight / total >= MAIN_CATCH_SHARE) add(c.itemId);
    }
    return out;
}

/** `materialsOf(originId)` over Token definitions found by `tokenOf(typeId)`, kept per id. */
export function materialsFromTokens(tokenOf) {
    const memo = new Map();
    return (id) => {
        if (!memo.has(id)) memo.set(id, materialsOfToken(tokenOf(id)));
        return memo.get(id);
    };
}

/** The Hall's cell's origins: each Token type the Starter Camp stands that yields something, once. */
export function hallOriginsOf(campTokens, materialsOf) {
    const out = [];
    for (const t of Array.isArray(campTokens) ? campTokens : []) {
        const id = t?.typeId;
        if (typeof id === 'string' && !out.includes(id) && materialsOf(id).length) out.push(id);
    }
    return out;
}
