// a new Region's map trees → each clump with its wild Forest

/**
 * Every tree a Region starts with belongs to a wild Forest. A pure pass over a layout's nodes: the
 * trees of one species that stand in a clump of two or more (each within `reach` of another,
 * chained) share one Forest, which stands in place of the clump's middle tree (the one nearest all
 * the others), and every other tree of the clump is its own (`owner`: the Forest's index in the
 * list). A tree standing alone belongs to the nearest of its species' Forests; a species with no
 * clump at all is one clump, so a Region's one Apple Tree is an Orchard that plants. A species
 * whose way back needs no owner (`headOf` null: a rock, a cherry tree with no Orchard) is left as
 * it is. Coordinates and order never move, so the pass keeps the layout's determinism; the Forest
 * takes the tree's spot, the two being the same size.
 *
 * @param {object[]} nodes  the layout's nodes, `{ typeId, x, y, ... }`, in its order
 * @param {{headOf: (typeId: string) => string|null, reach: number}} options  `headOf`: the wild
 *   Forest type a tree type belongs to, or null
 * @returns {object[]} copies of the nodes, a Forest's with its type, a tree's with its `owner`
 */
export function withWildForests(nodes, { headOf, reach }) {
    const out = (Array.isArray(nodes) ? nodes : []).map(n => ({ ...n }));
    const reachSq = reach * reach;
    const near = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

    const bySpecies = new Map();
    out.forEach((n, i) => {
        const head = headOf(n.typeId);
        if (!head) return;
        if (!bySpecies.has(n.typeId)) bySpecies.set(n.typeId, { head, members: [] });
        bySpecies.get(n.typeId).members.push(i);
    });

    const middleOf = (clump) => {
        let middle = clump[0];
        let best = Infinity;
        for (const i of clump) {
            let sum = 0;
            for (const j of clump) sum += near(out[i], out[j]);
            if (sum < best) { best = sum; middle = i; }
        }
        return middle;
    };

    for (const { head, members } of bySpecies.values()) {
        const clumps = [];
        const left = new Set(members);
        for (const first of members) {
            if (!left.has(first)) continue;
            left.delete(first);
            const clump = [first];
            for (let k = 0; k < clump.length; k++) {
                for (const j of members) {
                    if (left.has(j) && near(out[clump[k]], out[j]) <= reachSq) {
                        left.delete(j);
                        clump.push(j);
                    }
                }
            }
            clumps.push(clump.sort((a, b) => a - b));
        }
        const groves = clumps.filter(c => c.length > 1);
        const alone = clumps.filter(c => c.length === 1).map(c => c[0]);
        if (!groves.length) {
            groves.push(alone.splice(0));
        }
        const forests = groves.map(middleOf);
        groves.forEach((clump, k) => {
            out[forests[k]].typeId = head;
            for (const i of clump) if (i !== forests[k]) out[i].owner = forests[k];
        });
        for (const i of alone) {
            let owner = forests[0];
            for (const f of forests) if (near(out[i], out[f]) < near(out[i], out[owner])) owner = f;
            out[i].owner = owner;
        }
    }
    return out;
}
