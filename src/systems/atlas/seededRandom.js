// a seeded random source for the Atlas

/**
 * A Region's layout must come out the same every time it is asked for with the same seed, on
 * every machine, so the generation engine never touches `Math.random`. Integer arithmetic only
 * (`Math.imul`, shifts): no floating-point step whose last bit could differ between engines.
 */

/**
 * The same generator the bench seeds `Math.random` with (`bench/lib/prelude.mjs`): a function
 * returning numbers in [0, 1), fully determined by `seed`.
 */
export function mulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** The seed after `seed`: a reroll steps the seed with this, so a run of rerolls replays. */
export function nextSeed(seed) {
    return Math.floor(mulberry32(seed)() * 4294967296) >>> 0;
}

/** A 32-bit seed from text (FNV-1a), for a seed that should follow from a name or an id. */
export function seedFromText(text) {
    let hash = 0x811C9DC5;
    for (const ch of String(text)) {
        hash ^= ch.codePointAt(0);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}
