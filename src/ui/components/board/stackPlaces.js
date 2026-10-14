/**
 * Places for a list kept in order from one answer to the next. Each entry holds a whole-number
 * place, places rise strictly from the first entry to the last, and a change to the list moves as
 * few places as it can: an entry that arrives or changes its position in the list takes a free
 * place between its new neighbours, and every other entry keeps its own.
 * Places start spread evenly over a range far larger than the list, so there is almost always a
 * free place between two neighbours. When there is none, the entries around that spot are spread
 * out again, over a window just wide enough to leave room on both sides.
 */

/** Entries a list may hold: an entry's index is packed beside its place in one number. */
const MAX_ENTRIES = 2 ** 16;

/**
 * The places for a list in its new order.
 * @param {(number|undefined)[]} old each entry's place last time, in the new order; undefined for
 * an entry that is new
 * @param {ArrayLike<boolean|number>} same whether each entry's own position (what it is sorted by)
 * is unchanged: when two entries could each keep their place but not both, the unchanged one keeps
 * it, so a Token that moves takes the new place and the neighbour it passed does not
 * @param {number} size places run from 0 to `size − 1`
 * @returns {{places: number[], spread: boolean}} `spread` when a window had to be spread out
 */
export function keepPlaces(old, same, size) {
    const n = old.length;
    if (n >= MAX_ENTRIES || n >= size) throw new Error(`stack places: ${n} entries do not fit`);
    const keep = unchangedInOrder(old, same) ?? keptEntries(old, same);
    const next = new Array(n);
    for (let i = 0; i < n; i++) if (keep[i]) next[i] = old[i];

    let spread = false;
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
            spread = true;
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
    return { places: next, spread };
}

/**
 * The usual case, in one pass: the unchanged entries' places still rise, so all of them keep their
 * place, and each changed entry keeps its own too if it still fits between its kept neighbours.
 * Null when the unchanged entries are out of order (two that tie swapped in the input).
 */
function unchangedInOrder(old, same) {
    const n = old.length;
    let prev = -1;
    for (let i = 0; i < n; i++) {
        if (!same[i]) continue;
        if (old[i] === undefined || old[i] <= prev) return null;
        prev = old[i];
    }
    const keep = new Uint8Array(n);
    // The next unchanged entry's place, from the right.
    const ceiling = new Float64Array(n);
    let next = Infinity;
    for (let i = n - 1; i >= 0; i--) {
        ceiling[i] = next;
        if (same[i]) next = old[i];
    }
    prev = -1;
    for (let i = 0; i < n; i++) {
        if (same[i] || (old[i] !== undefined && old[i] > prev && old[i] < ceiling[i])) {
            keep[i] = 1;
            prev = old[i];
        }
    }
    return keep;
}

/**
 * Which entries keep their old place: the largest set whose old places still rise in the new
 * order, and among sets as large, the one with the most unchanged entries. A weighted longest
 * increasing subsequence over the old places (a Fenwick tree of best scores).
 */
function keptEntries(old, same) {
    const n = old.length;
    const keep = new Uint8Array(n);
    // Each old place with its entry's index packed below it, sorted: the places' ranks.
    let m = 0;
    for (let i = 0; i < n; i++) if (old[i] !== undefined) m++;
    if (!m) return keep;
    const packed = new Float64Array(m);
    for (let i = 0, k = 0; i < n; i++) if (old[i] !== undefined) packed[k++] = old[i] * MAX_ENTRIES + i;
    packed.sort();
    const rank = new Int32Array(n);
    for (let k = 0; k < m; k++) rank[packed[k] % MAX_ENTRIES] = k + 1;

    // Every kept entry is worth more than any number of unchanged ones.
    const each = n + 1;
    const bestScore = new Float64Array(m + 1);
    const bestAt = new Int32Array(m + 1).fill(-1);
    const from = new Int32Array(n).fill(-1);
    let top = -1;
    let topScore = 0;
    for (let i = 0; i < n; i++) {
        const r = rank[i];
        if (!r) continue;
        let below = 0;
        let belowAt = -1;
        for (let k = r - 1; k > 0; k -= k & -k) {
            if (bestScore[k] > below) { below = bestScore[k]; belowAt = bestAt[k]; }
        }
        const score = below + each + (same[i] ? 1 : 0);
        from[i] = belowAt;
        for (let k = r; k <= m; k += k & -k) {
            if (score > bestScore[k]) { bestScore[k] = score; bestAt[k] = i; }
        }
        if (score > topScore) { topScore = score; top = i; }
    }
    for (let i = top; i >= 0; i = from[i]) keep[i] = 1;
    return keep;
}
