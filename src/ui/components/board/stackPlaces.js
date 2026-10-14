/**
 * Places for a list kept in order, from one answer to the next. Each entry holds a whole-number
 * place, places rise strictly from the first entry to the last, and a change to the list moves as
 * few places as it can: an entry that arrives, leaves or changes its position in the list takes a
 * free place between its new neighbours, and every other entry keeps its own.
 * Places start spread evenly over a range far larger than the list, so there is almost always a
 * free place between two neighbours. When there is none, the entries around that spot are spread
 * out again, over a window just wide enough to leave room on both sides.
 * @param {number} size places run from 0 to `size − 1`
 */
export function createStackPlaces(size) {
    /** Entry key → its place. Replaced, never changed, so an unchanged answer is the same Map. */
    let placeOf = new Map();
    /** Entry key → what it was sorted by last time (`sign`). */
    let signOf = new Map();
    let spreads = 0;

    return {
        /**
         * The places for `entries`, first to last. An entry's `sign` is whatever decided its
         * position (its band, its y, its tie-break): when two entries could each keep their place
         * but not both, the one whose sign did not change keeps it, so a Token that moves takes
         * the new place and the neighbour it passed does not.
         * @param {{key: string, sign: string}[]} entries keys unique
         * @returns {Map<string, number>} the same Map as last time when nothing moved
         */
        place(entries) {
            const n = entries.length;
            const old = new Array(n);
            let inOrder = placeOf.size === n;
            let prev = -1;
            for (let i = 0; i < n; i++) {
                const p = placeOf.get(entries[i].key);
                old[i] = p;
                if (p === undefined || p <= prev) inOrder = false;
                else prev = p;
            }
            if (inOrder) {
                for (const e of entries) signOf.set(e.key, e.sign);
                return placeOf;
            }

            const keep = keptPlaces(old, entries, signOf);
            const next = new Array(n);
            for (let i = 0; i < n; i++) if (keep[i]) next[i] = old[i];

            // Room left on each side when a window has to be spread: half the even spacing.
            const room = Math.max(1, Math.floor(size / (2 * (n + 1))));
            for (let i = 0; i < n;) {
                if (next[i] !== undefined) { i++; continue; }
                let a = i;
                let b = i;
                while (b + 1 < n && next[b + 1] === undefined) b++;
                let lo = a > 0 ? next[a - 1] : -1;
                let hi = b + 1 < n ? next[b + 1] : size;
                if (hi - lo - 1 < b - a + 1) {
                    spreads++;
                    while (a > 0 || b < n - 1) {
                        if (a > 0) a--;
                        if (b < n - 1) {
                            b++;
                            while (b + 1 < n && next[b + 1] === undefined) b++;
                        }
                        lo = a > 0 ? next[a - 1] : -1;
                        hi = b + 1 < n ? next[b + 1] : size;
                        if (hi - lo >= (b - a + 2) * room) break;
                    }
                }
                const count = b - a + 1;
                for (let j = 0; j < count; j++) next[a + j] = lo + Math.floor(((j + 1) * (hi - lo)) / (count + 1));
                i = b + 1;
            }

            placeOf = new Map();
            signOf = new Map();
            for (let i = 0; i < n; i++) {
                placeOf.set(entries[i].key, next[i]);
                signOf.set(entries[i].key, entries[i].sign);
            }
            return placeOf;
        },
        /** How many times a window had to be spread out (no free place where one was needed). */
        get spreads() { return spreads; }
    };
}

/**
 * Which entries keep their old place: the largest set whose old places still rise in the new
 * order, and among sets as large, the one with the most entries whose sign did not change. A
 * weighted longest increasing subsequence over the old places (a Fenwick tree of best scores).
 */
function keptPlaces(old, entries, signOf) {
    const n = old.length;
    const keep = new Uint8Array(n);
    const ranks = old.filter(p => p !== undefined).sort((x, y) => x - y);
    const m = ranks.length;
    if (!m) return keep;
    const rankOf = new Map(ranks.map((p, k) => [p, k + 1]));
    // Every kept entry is worth more than any number of unchanged signs.
    const each = n + 1;
    const bestScore = new Float64Array(m + 1);
    const bestAt = new Int32Array(m + 1).fill(-1);
    const from = new Int32Array(n).fill(-1);
    let top = -1;
    let topScore = 0;
    for (let i = 0; i < n; i++) {
        if (old[i] === undefined) continue;
        const r = rankOf.get(old[i]);
        let below = 0;
        let belowAt = -1;
        for (let k = r - 1; k > 0; k -= k & -k) {
            if (bestScore[k] > below) { below = bestScore[k]; belowAt = bestAt[k]; }
        }
        const score = below + each + (signOf.get(entries[i].key) === entries[i].sign ? 1 : 0);
        from[i] = belowAt;
        for (let k = r; k <= m; k += k & -k) {
            if (score > bestScore[k]) { bestScore[k] = score; bestAt[k] = i; }
        }
        if (score > topScore) { topScore = score; top = i; }
    }
    for (let i = top; i >= 0; i = from[i]) keep[i] = 1;
    return keep;
}
