// Import-graph reachability check (code review Session 6, 2026-07-17).
// BFS from src/main.jsx over relative imports; lists every src/ file nothing
// reaches. Run after dead-code deletions (CR-049 and friends) to find newly
// orphaned files:  node tools/reachability.mjs
//
// Comments are stripped before the import regex runs (CR3-505): a comment
// like "…this import and getRandomName's other call site…" used to swallow
// everything up to its apostrophe and hide the real import below it, and a
// commented-out import used to count as a real one. This is still a regex, not
// a parser. Test files show up as unreachable by design (vitest finds them
// itself); ignore src/tests/ lines.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
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
    // '@/' alias → src/ (vite.config.js); other bare imports are npm packages.
    if (spec.startsWith('@/')) spec = join(SRC, spec.slice(2)).replace(/\\/g, '/');
    else if (!spec.startsWith('.')) return null;
    const base = resolve(dirname(fromFile), spec).replace(/\\/g, '/');
    for (const cand of [base, base + '.js', base + '.jsx', base + '/index.js', base + '/index.jsx']) {
        if (fileSet.has(cand)) return cand;
        if (existsSync(cand) && /\.(js|jsx)$/.test(cand)) return cand.replace(/\\/g, '/');
    }
    return null;
}

/** Strip block and line comments in ONE left-to-right pass, so only real code
 *  is scanned. One pass matters: a line comment that mentions a glob such as
 *  data/*.json must not open a block comment that swallows the imports below
 *  it. (FreeMatGuards.test.js's `codeOf` strips block comments first.) */
function codeOf(text) {
    return text.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, pre) => (pre ?? '') + ' ');
}

const importRe = /(?:import\s[^'"]*?|import\(|export\s[^'"]*?from\s*|from\s*)['"]([^'"]+)['"]/g;

function importsOf(file) {
    const out = [];
    let text;
    try { text = codeOf(readFileSync(file, 'utf8')); } catch { return out; }
    for (const m of text.matchAll(importRe)) {
        const r = resolveImport(file, m[1]);
        if (r) out.push(r);
    }
    return out;
}

const entries = [join(SRC, 'main.jsx').replace(/\\/g, '/')];
const seen = new Set();
const queue = [...entries];
while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const dep of importsOf(f)) if (!seen.has(dep)) queue.push(dep);
}

const unreachable = files.filter(f => !seen.has(f));
console.log('=== UNREACHABLE from src/main.jsx ===');
for (const f of unreachable.sort()) {
    const lines = readFileSync(f, 'utf8').split('\n').length;
    console.log(String(lines).padStart(6), f.replace(ROOT.replace(/\\/g, '/') + '/', ''));
}
console.log(`\nTotal: ${unreachable.length} unreachable of ${files.length} src files`);
