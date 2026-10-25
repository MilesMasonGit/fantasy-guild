// Fantasy Guild — test helper: reading the game's own source for guard tests.
//
// **For tests only.** Guard tests (round-3 review, Wave 0) read non-test
// `src/` as text and fail when a rule about who may touch what is broken.
//
// The tree is walked once and each file read once per test file: vitest gives
// every test file its own process, so the cache lasts one file and cannot go
// stale across files. ⚠️ A test that writes a file under `src/` and then lists
// the tree will not see it; read such a probe by its path instead.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path of `src/`, with forward slashes. */
export const SRC = path.resolve(here, '../..').replace(/\\/g, '/');

/**
 * Per-case time limit for tests that scan the tree. A scan takes well under a
 * second alone but many times that beside a build or other agents' suites, and
 * vitest's 5 s default then fails it by timeout, not by a finding.
 */
export const SCAN_TIMEOUT = 30_000;

/** Give every case in the calling test file the scan time limit. */
export function setScanTimeout() {
    vi.setConfig({ testTimeout: SCAN_TIMEOUT });
}

/**
 * Strip block and line comments in ONE left-to-right pass, so only real code
 * is scanned (the same stripper as `tools/cycles.mjs`). One pass matters: a
 * line comment that mentions a glob such as data/*.json must not open a block
 * comment that swallows the code below it. A `//` after `:` (a URL) or after
 * a backslash (inside a regex) is not a comment. Still a regex, not a parser:
 * good enough for names and call shapes.
 */
export function codeOf(text) {
    return text.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, pre) => (pre ?? '') + ' ');
}

let tree = null;

/** Every file under `src/`, tests included, in directory-walk order (absolute, forward slashes). */
function srcTree() {
    if (tree) return tree;
    const out = [];
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = `${dir}/${entry.name}`;
            if (entry.isDirectory()) walk(full);
            else out.push(full);
        }
    })(SRC);
    tree = out;
    return tree;
}

const norm = (file) => path.resolve(file).replace(/\\/g, '/');

/**
 * Files under `dir` (default `src/`, which it must lie inside) whose file name
 * matches `ext`, absolute with forward slashes, in walk order. `src/tests/` is
 * left out unless `tests` is true.
 */
export function listFiles(dir = SRC, { ext = /\.(js|jsx)$/, tests = false } = {}) {
    const root = `${norm(dir)}/`;
    if (!root.startsWith(`${SRC}/`)) throw new Error(`listFiles: ${dir} is not under src/`);
    return srcTree().filter(file => file.startsWith(root)
        && (tests || !file.startsWith(`${SRC}/tests/`))
        && ext.test(file.slice(file.lastIndexOf('/') + 1)));
}

const texts = new Map();

/** A file's text (utf8), read once per test file. */
export function readSource(file) {
    const key = norm(file);
    let text = texts.get(key);
    if (text === undefined) {
        text = fs.readFileSync(key, 'utf8');
        texts.set(key, text);
    }
    return text;
}

/** Every `.js`/`.jsx` file under `dir` (default `src/`), skipping `src/tests/`. */
export function sourceFiles(dir = SRC) {
    return listFiles(dir);
}

/** `src/`-relative path of an absolute file path. */
export const rel = (file) => file.replace(`${SRC}/`, '');

let code = null;

/** Every non-test source file as `{ file, code }`, comments stripped. */
export function sourceCode() {
    code ??= sourceFiles().map(file => ({ file: rel(file), code: codeOf(readSource(file)) }));
    return [...code];
}

/** Real import specifiers: static, re-export and dynamic (the tools' regex, run on stripped code). */
const IMPORT_RE = /(?:import\s[^'"]*?|import\(|export\s[^'"]*?from\s*|from\s*)['"]([^'"]+)['"]/g;

/** A specifier from `fromRel` (a `src/`-relative file) → a `src/`-relative file, or null (a package). */
function resolveImport(fromRel, spec) {
    let base;
    if (spec.startsWith('@/')) base = path.posix.join(SRC, spec.slice(2));
    else if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(`${SRC}/${fromRel}`), spec);
    else return null;
    for (const cand of [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`, `${base}/index.jsx`]) {
        if (/\.(js|jsx)$/.test(cand) && fs.existsSync(cand) && fs.statSync(cand).isFile()) return rel(cand);
    }
    return null;
}

/**
 * Every `src/` file `startRel` loads, through any chain of imports, itself
 * included (`src/`-relative paths). Packages and files outside `src/` are not
 * followed.
 */
export function importClosure(startRel) {
    const seen = new Set();
    const queue = [startRel];
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        let text;
        try { text = readSource(`${SRC}/${file}`); } catch { continue; }
        seen.add(file);
        for (const m of codeOf(text).matchAll(IMPORT_RE)) {
            const dep = resolveImport(file, m[1]);
            if (dep && !seen.has(dep)) queue.push(dep);
        }
    }
    return seen;
}

/** Line numbers (1-based) in `code` where `pattern` (a global RegExp) matches. */
export function matchLines(code, pattern) {
    const lines = [];
    for (const m of code.matchAll(pattern)) lines.push(code.slice(0, m.index).split('\n').length);
    return lines;
}
