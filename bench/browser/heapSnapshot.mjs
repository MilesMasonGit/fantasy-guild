// A minimal reader for V8 heap snapshots (`HeapProfiler.takeHeapSnapshot`, the `.heapsnapshot`
// files DevTools' Memory panel opens), for the memory soak's `--snapshot`: per constructor, how
// many objects, their own size and the size they retain, and the difference between two
// snapshots. Pure, so it is unit-tested (src/tests/BenchSoak.test.js).
//
// Retained sizes follow DevTools' rules: the dominator tree over the graph from the root, through
// every edge but weak ones (a shortcut edge counts only from the root); a class's retained size
// adds each object's retained size once, skipping objects dominated by another of the same class
// (so a list of a thousand nodes is not counted a thousand times). Objects unreachable that way
// (garbage the snapshot's own GC left) are not counted.

/** DevTools' name for a node's class (its "constructor" in the Summary view). */
export function classNameOf(type, name, detachedness = 0) {
    switch (type) {
        case 'hidden': return '(system)';
        case 'object':
        case 'native': return `${detachedness === 2 ? 'Detached ' : ''}${name || '(anonymous)'}`;
        case 'code': return '(compiled code)';
        default: return `(${type})`;
    }
}

/**
 * Per class: `{ count, self, retained }` (bytes), for every object reachable from the root.
 * @param {object} snap a parsed `.heapsnapshot`
 * @returns {{ nodes: number, reachable: number, totalSelf: number, classes: Map<string, {count: number, self: number, retained: number}> }}
 */
export function classSummary(snap) {
    const meta = snap.snapshot.meta;
    const nf = meta.node_fields;
    const ef = meta.edge_fields;
    const NF = nf.length;
    const EF = ef.length;
    const nodes = snap.nodes;
    const edges = snap.edges;
    const strings = snap.strings;
    const N = Math.floor(nodes.length / NF);
    const tOff = nf.indexOf('type');
    const nOff = nf.indexOf('name');
    const sOff = nf.indexOf('self_size');
    const cOff = nf.indexOf('edge_count');
    const dOff = nf.indexOf('detachedness');
    const nodeTypes = meta.node_types[tOff];
    const etOff = ef.indexOf('type');
    const toOff = ef.indexOf('to_node');
    const edgeTypes = meta.edge_types[etOff];
    const WEAK = edgeTypes.indexOf('weak');
    const SHORTCUT = edgeTypes.indexOf('shortcut');
    const ROOT = 0;

    // Each node's first edge (edges are stored node by node, edge_count each).
    const firstEdge = new Uint32Array(N + 1);
    for (let i = 0, e = 0; i < N; i++) {
        firstEdge[i] = e;
        e += nodes[i * NF + cOff];
        firstEdge[i + 1] = e;
    }
    const essential = (from, e) => {
        const t = edges[e * EF + etOff];
        return t !== WEAK && (t !== SHORTCUT || from === ROOT);
    };
    const target = (e) => edges[e * EF + toOff] / NF;

    // Post-order from the root through the essential edges (iterative: the graph is deep).
    const post = new Int32Array(N).fill(-1);
    const atPost = new Int32Array(N);
    const seen = new Uint8Array(N);
    const stackNode = new Int32Array(N);
    const stackEdge = new Uint32Array(N);
    let sp = 0;
    let po = 0;
    stackNode[sp] = ROOT; stackEdge[sp] = firstEdge[ROOT]; sp++;
    seen[ROOT] = 1;
    while (sp > 0) {
        const node = stackNode[sp - 1];
        const end = firstEdge[node + 1];
        let e = stackEdge[sp - 1];
        let pushed = false;
        for (; e < end; e++) {
            if (!essential(node, e)) continue;
            const to = target(e);
            if (seen[to]) continue;
            seen[to] = 1;
            stackEdge[sp - 1] = e + 1;
            stackNode[sp] = to; stackEdge[sp] = firstEdge[to]; sp++;
            pushed = true;
            break;
        }
        if (!pushed) {
            post[node] = po;
            atPost[po] = node;
            po++;
            sp--;
        }
    }
    const reachable = po;
    const rootPost = reachable - 1;

    // Predecessors of each reachable node, by post-order number.
    const predStart = new Uint32Array(reachable + 1);
    for (let b = 0; b < reachable; b++) {
        const node = atPost[b];
        for (let e = firstEdge[node]; e < firstEdge[node + 1]; e++) {
            if (!essential(node, e)) continue;
            const to = post[target(e)];
            if (to >= 0) predStart[to + 1]++;
        }
    }
    for (let b = 0; b < reachable; b++) predStart[b + 1] += predStart[b];
    const preds = new Int32Array(predStart[reachable]);
    const fill = predStart.slice(0, reachable);
    for (let b = 0; b < reachable; b++) {
        const node = atPost[b];
        for (let e = firstEdge[node]; e < firstEdge[node + 1]; e++) {
            if (!essential(node, e)) continue;
            const to = post[target(e)];
            if (to >= 0) preds[fill[to]++] = b;
        }
    }

    // Immediate dominators (Cooper, Harvey and Kennedy), by post-order number: a dominator is a
    // tree ancestor, so it always has the higher number.
    const dom = new Int32Array(reachable).fill(-1);
    dom[rootPost] = rootPost;
    for (let changed = true; changed;) {
        changed = false;
        for (let b = rootPost - 1; b >= 0; b--) {
            let idom = -1;
            for (let k = predStart[b]; k < predStart[b + 1]; k++) {
                const p = preds[k];
                if (dom[p] === -1) continue;
                if (idom === -1) { idom = p; continue; }
                let f1 = p, f2 = idom;
                while (f1 !== f2) {
                    while (f1 < f2) f1 = dom[f1];
                    while (f2 < f1) f2 = dom[f2];
                }
                idom = f1;
            }
            if (dom[b] !== idom) { dom[b] = idom; changed = true; }
        }
    }

    // Retained sizes: each node's own size, added up the dominator tree.
    const retained = new Float64Array(reachable);
    let totalSelf = 0;
    for (let b = 0; b < reachable; b++) {
        const s = nodes[atPost[b] * NF + sOff];
        retained[b] = s;
        totalSelf += s;
    }
    for (let b = 0; b < rootPost; b++) retained[dom[b]] += retained[b];

    // Classes.
    const classIndex = new Map();
    const names = [];
    const classOf = new Int32Array(reachable);
    for (let b = 0; b < reachable; b++) {
        const i = atPost[b] * NF;
        const name = classNameOf(nodeTypes[nodes[i + tOff]], strings[nodes[i + nOff]], dOff >= 0 ? nodes[i + dOff] : 0);
        let c = classIndex.get(name);
        if (c === undefined) { c = names.length; names.push(name); classIndex.set(name, c); }
        classOf[b] = c;
    }
    const count = new Float64Array(names.length);
    const self = new Float64Array(names.length);
    const classRetained = new Float64Array(names.length);
    for (let b = 0; b < rootPost; b++) {
        count[classOf[b]]++;
        self[classOf[b]] += nodes[atPost[b] * NF + sOff];
    }

    // A class's retained size, walking the dominator tree: an object counts only when no
    // dominator above it (below the root) is of its class.
    const childStart = new Uint32Array(reachable + 1);
    for (let b = 0; b < rootPost; b++) childStart[dom[b] + 1]++;
    for (let b = 0; b < reachable; b++) childStart[b + 1] += childStart[b];
    const children = new Int32Array(childStart[reachable]);
    const cfill = childStart.slice(0, reachable);
    for (let b = 0; b < rootPost; b++) children[cfill[dom[b]]++] = b;
    const onPath = new Int32Array(names.length);
    const walkNode = new Int32Array(reachable);
    const walkNext = new Uint32Array(reachable);
    let wp = 0;
    for (let k = childStart[rootPost]; k < childStart[rootPost + 1]; k++) {
        const top = children[k];
        walkNode[wp] = top; walkNext[wp] = childStart[top]; wp++;
        if (onPath[classOf[top]]++ === 0) classRetained[classOf[top]] += retained[top];
        while (wp > 0) {
            const b = walkNode[wp - 1];
            const k2 = walkNext[wp - 1];
            if (k2 < childStart[b + 1]) {
                walkNext[wp - 1] = k2 + 1;
                const c = children[k2];
                walkNode[wp] = c; walkNext[wp] = childStart[c]; wp++;
                if (onPath[classOf[c]]++ === 0) classRetained[classOf[c]] += retained[c];
            } else {
                onPath[classOf[b]]--;
                wp--;
            }
        }
    }

    const classes = new Map();
    for (let c = 0; c < names.length; c++) {
        if (count[c] === 0) continue;
        classes.set(names[c], { count: count[c], self: self[c], retained: classRetained[c] });
    }
    return { nodes: N, reachable, totalSelf, classes };
}

/**
 * The classes that grew most between two summaries, by retained size (then count): rows of
 * `{ name, countA, countB, dCount, dSelf, dRetained, retainedB }`. The snapshot's own grouping
 * nodes, `(synthetic)`, are left out.
 */
export function diffClasses(a, b, top = 15) {
    const names = new Set([...a.classes.keys(), ...b.classes.keys()]);
    const rows = [];
    for (const name of names) {
        if (name === '(synthetic)') continue;
        const x = a.classes.get(name) || { count: 0, self: 0, retained: 0 };
        const y = b.classes.get(name) || { count: 0, self: 0, retained: 0 };
        rows.push({
            name, countA: x.count, countB: y.count, dCount: y.count - x.count,
            dSelf: y.self - x.self, dRetained: y.retained - x.retained, retainedB: y.retained
        });
    }
    rows.sort((p, q) => (q.dRetained - p.dRetained) || (q.dCount - p.dCount) || p.name.localeCompare(q.name));
    return rows.slice(0, top);
}
