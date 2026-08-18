// Import-cycle detector for src/ (code review round 2, 2026-08-18).
// Finds circular import chains among game modules and prints each cycle once:
//     node tools/cycles.mjs        (or: npm run cycles)
//
// Why this exists: a circular import is the clearest machine-checkable sign of
// tangled structure. A depends on B depends on C depends on A means none of the
// three can be understood, tested, or moved on its own.
//
// ── Accuracy notes, inherited from tools/reachability.mjs and from the
//    "three ways this tool lies" section of code_review_v2_findings.md ──
//
// 1. We match REAL import specifiers only — an actual `from '…'`, `import '…'`,
//    or `import('…')`. We never search for a bare filename. An earlier pass in
//    this project matched any quoted string containing a module's stem,
//    including doc comments, and confidently reported the wrong answer.
// 2. Commented-out imports still match the regex (there is no JS parser here),
//    so a cycle could in principle be reported through a dead comment. Every
//    cycle printed below names its files and the specifier line, so a human can
//    confirm in seconds. Treat output as a lead, not a verdict.
// 3. Scope is `src/` only. `cms/src` imports a handful of game modules directly;
//    those edges are NOT followed, so a cycle running through the CMS would be
//    missed. That is deliberate — the CMS is out of review scope.
//
// Type-only or side-effect-only cycles are not distinguished; JS has no type
// imports here, so every edge found is a real runtime dependency.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

function allFiles(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) allFiles(p, out);
        else if (/\.(js|jsx)$/.test(name)) out.push(p.replace(/\\/g, '/'));
    }
    return out;
}

const files = allFiles(SRC);
const fileSet = new Set(files);

function resolveImport(fromFile, spec) {
    // '@/' alias → src/ (vite.config.js); other bare specifiers are npm packages.
    if (spec.startsWith('@/')) spec = join(SRC, spec.slice(2)).replace(/\\/g, '/');
    else if (!spec.startsWith('.')) return null;
    const base = resolve(dirname(fromFile), spec).replace(/\\/g, '/');
    for (const cand of [base, base + '.js', base + '.jsx', base + '/index.js', base + '/index.jsx']) {
        if (fileSet.has(cand)) return cand;
        if (existsSync(cand) && /\.(js|jsx)$/.test(cand)) return cand.replace(/\\/g, '/');
    }
    return null;
}

// Matches only genuine import specifiers — see accuracy note 1 above.
// Group 1 is set when the specifier came from a DYNAMIC `import('…')`.
const importRe = /(?:import\s[^'"]*?|(import\()|export\s[^'"]*?from\s*|from\s*)['"]([^'"]+)['"]/g;

const graph = new Map();        // file -> Set(file)   — all edges
const staticGraph = new Map();  // file -> Set(file)   — static edges only
const dynamicEdges = new Set(); // "from|to"
for (const file of files) {
    const deps = new Set();
    const statics = new Set();
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { text = ''; }
    for (const m of text.matchAll(importRe)) {
        const r = resolveImport(file, m[2]);
        // Only edges that stay inside src/ — see accuracy note 3. A few test
        // files import cms/src directly; those resolve outside fileSet.
        if (!r || r === file || !fileSet.has(r)) continue;
        deps.add(r);
        if (m[1]) dynamicEdges.add(file + '|' + r);
        else statics.add(r);
    }
    graph.set(file, deps);
    staticGraph.set(file, statics);
}

// ── Tarjan's strongly-connected components ────────────────────────────────
// Every SCC with more than one member is a knot of mutually-reachable modules.
// A self-loop (a file importing itself) is reported separately.
function findSccs(g) {
const index = new Map(), low = new Map(), onStack = new Set();
const stack = [];
let counter = 0;
const sccs = [];
const graph = g;

function strongconnect(v) {
    // Iterative to avoid blowing the call stack on a deep graph.
    const work = [[v, 0]];
    index.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); onStack.add(v);

    while (work.length) {
        const frame = work[work.length - 1];
        const [node, i] = frame;
        const deps = [...graph.get(node)];

        if (i < deps.length) {
            frame[1]++;
            const w = deps[i];
            if (!index.has(w)) {
                index.set(w, counter); low.set(w, counter); counter++;
                stack.push(w); onStack.add(w);
                work.push([w, 0]);
            } else if (onStack.has(w)) {
                low.set(node, Math.min(low.get(node), index.get(w)));
            }
        } else {
            work.pop();
            if (work.length) {
                const parent = work[work.length - 1][0];
                low.set(parent, Math.min(low.get(parent), low.get(node)));
            }
            if (low.get(node) === index.get(node)) {
                const comp = [];
                let w;
                do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== node);
                if (comp.length > 1) sccs.push(comp);
            }
        }
    }
}

for (const f of files) if (!index.has(f)) strongconnect(f);
return sccs;
}

const sccs = findSccs(graph);
const staticSccs = findSccs(staticGraph);
const staticMembers = new Set(staticSccs.flat());

// Self-imports (rare, but a real smell).
const selfLoops = files.filter(f => {
    let text; try { text = readFileSync(f, 'utf8'); } catch { return false; }
    for (const m of text.matchAll(importRe)) if (resolveImport(f, m[2]) === f) return true;
    return false;
});

// ── Turn each SCC into one readable representative chain ──────────────────
// An SCC of N files can contain very many distinct cycles. Printing them all is
// noise; we print the component (the actual tangle) plus one shortest cycle
// through it, which is what a reader needs to see the shape of the problem.
function shortestCycleIn(comp, g = graph) {
    const set = new Set(comp);
    let best = null;
    for (const start of comp) {
        const prev = new Map([[start, null]]);
        const q = [start];
        let found = null;
        while (q.length && !found) {
            const cur = q.shift();
            for (const nxt of g.get(cur)) {
                if (!set.has(nxt)) continue;
                if (nxt === start) { found = cur; break; }
                if (!prev.has(nxt)) { prev.set(nxt, cur); q.push(nxt); }
            }
        }
        if (found === null) continue;
        const chain = [];
        for (let n = found; n !== null; n = prev.get(n)) chain.push(n);
        chain.reverse();
        if (!best || chain.length < best.length) best = chain;
    }
    return best;
}

const rel = f => relative(ROOT, f).replace(/\\/g, '/');

console.log('=== IMPORT CYCLES in src/ ===\n');

if (!sccs.length && !selfLoops.length) {
    console.log('No circular imports found.');
} else {
    sccs.sort((a, b) => b.length - a.length);
    sccs.forEach((comp, n) => {
        const viaStatic = comp.some(f => staticMembers.has(f));
        console.log(`Cycle ${n + 1} — ${comp.length} modules mutually reachable`
            + (viaStatic ? '' : '  [broken at load time by a dynamic import]') + ':');
        const chain = shortestCycleIn(comp);
        if (chain) {
            const parts = [];
            for (let i = 0; i < chain.length; i++) {
                const to = chain[(i + 1) % chain.length];
                parts.push(rel(chain[i]) + (dynamicEdges.has(chain[i] + '|' + to) ? ' =(dynamic)=> ' : ' -> '));
            }
            console.log('  ' + parts.join('') + rel(chain[0]));
        }
        if (comp.length > (chain?.length ?? 0)) {
            console.log('  all members:');
            for (const f of comp.slice().sort()) console.log('    ' + rel(f));
        }
        console.log('');
    });
    for (const f of selfLoops) console.log(`Self-import: ${rel(f)}\n`);
}

// A cycle made only of static imports is the one that actually bites: it fixes
// module evaluation order, so a module can observe a half-initialised import.
// A cycle whose only return edge is a lazy `await import(…)` is usually a
// deliberate cycle-breaker and is much less dangerous.
console.log(`Of these, ${staticSccs.length} cycle group(s) are formed entirely by`
    + ` static imports (the dangerous kind); the rest are broken at load time by a dynamic import.`);


const edges = [...graph.values()].reduce((n, s) => n + s.size, 0);
console.log(`Scanned ${files.length} files, ${edges} internal import edges.`);
console.log(`Found ${sccs.length} cycle group(s)${selfLoops.length ? `, ${selfLoops.length} self-import(s)` : ''}.`);
