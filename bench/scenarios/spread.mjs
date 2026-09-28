// Spread a few kinds of special Token evenly through a run of producers, so no
// corner of a big board is all one thing. Deterministic.

/**
 * @param {Array<[string, number]>} specials type and how many
 * @param {number} producers how many producers to interleave
 * @param {string[]} producerTypes alternated
 * @returns {string[]}
 */
export function spread(specials, producers, producerTypes) {
    // Round-robin the specials so each kind is spread through the list.
    const pool = specials.map(([typeId, n]) => ({ typeId, left: n }));
    const specialList = [];
    while (pool.some(p => p.left > 0)) {
        for (const p of pool) {
            if (p.left > 0) { specialList.push(p.typeId); p.left--; }
        }
    }
    const total = specialList.length + producers;
    const out = [];
    let s = 0;
    let made = 0;
    for (let i = 0; i < total; i++) {
        // Take a special whenever we are behind its even share.
        const wantSpecials = Math.round(((i + 1) * specialList.length) / total);
        if (s < wantSpecials && s < specialList.length) out.push(specialList[s++]);
        else out.push(producerTypes[made++ % producerTypes.length]);
    }
    return out;
}
