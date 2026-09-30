// Fantasy Guild — test helper: reading the game's own source for guard tests.
//
// **For tests only.** Guard tests (round-3 review, Wave 0) read non-test
// `src/` as text and fail when a rule about who may touch what is broken.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path of `src/`, with forward slashes. */
export const SRC = path.resolve(here, '../..').replace(/\\/g, '/');

/**
 * Strip block and line comments in ONE left-to-right pass, so only real code
 * is scanned (the same stripper as `tools/cycles.mjs`, CR3-505). One pass
 * matters: a line comment that mentions a glob such as data/*.json must not
 * open a block comment that swallows the code below it. A `//` after `:` (a
 * URL) or after a backslash (inside a regex) is not a comment. Still a regex,
 * not a parser: good enough for names and call shapes.
 */
export function codeOf(text) {
    return text.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, pre) => (pre ?? '') + ' ');
}

/** Every `.js`/`.jsx` file under `dir` (default `src/`), skipping `src/tests/`. */
export function sourceFiles(dir = SRC) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            if (full === `${SRC}/tests`) continue;
            out.push(...sourceFiles(full));
        } else if (/\.(js|jsx)$/.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

/** `src/`-relative path of an absolute file path. */
export const rel = (file) => file.replace(`${SRC}/`, '');

/** Every non-test source file as `{ file, code }`, comments stripped. */
export function sourceCode() {
    return sourceFiles().map(file => ({ file: rel(file), code: codeOf(fs.readFileSync(file, 'utf8')) }));
}

/** Line numbers (1-based) in `code` where `pattern` (a global RegExp) matches. */
export function matchLines(code, pattern) {
    const lines = [];
    for (const m of code.matchAll(pattern)) lines.push(code.slice(0, m.index).split('\n').length);
    return lines;
}
