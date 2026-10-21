/**
 * Randomness for the eye only.
 * ⚠️ Never `Math.random`: the engine rolls with it (and the bench seeds it), so a visual effect
 * that drew from it would change what the game does (`bench/README.md`, "The work"). Every
 * number here is a hash of what the effect is about, so the same strike scatters the same way.
 */

/** A string's 32-bit hash (FNV-1a). */
export function seedOf(text) {
    let h = 0x811c9dc5;
    const s = String(text ?? '');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** A number in [0, 1) fixed by `seed` and `n`: the n-th draw of that seed. */
export function fxNoise(seed, n = 0) {
    let t = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul((n + 1) >>> 0, 0x85ebca6b)) >>> 0;
    t = Math.imul(t ^ (t >>> 16), 0x7feb352d);
    t = Math.imul(t ^ (t >>> 15), 0x846ca68b);
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

/** A whole number in [min, max] fixed by `seed` and `n`. */
export function fxInt(seed, n, min, max) {
    return min + Math.floor(fxNoise(seed, n) * (max - min + 1));
}
