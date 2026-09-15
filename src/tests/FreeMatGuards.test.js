import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Free Playmat slice 1.6a — two import guards.
 *
 * 1. **`gridShim.js` is a STOPGAP** (deleted in slice 1.6d). Only the files
 *    listed in `SHIM_IMPORTERS` may import it. A new importer fails here; so
 *    does one of the listed files dropping it without the list being updated,
 *    so the list always shows how far 1.6d has to go. **At 1.6d the list must
 *    be empty and `gridShim.js` deleted.**
 * 2. **`tests/fixtures/mat.js` is test layout, not a game concept.** Nothing
 *    outside `src/tests/` may import it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..');

function sourceFiles(dir = SRC) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'tests' ? [] : sourceFiles(full);
        return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
    });
}

const FILES = sourceFiles().map(file => ({
    path: path.relative(SRC, file).replace(/\\/g, '/'),
    text: fs.readFileSync(file, 'utf8')
}));

const importsOf = (pattern) => FILES
    .filter(f => new RegExp(`(from|import)\\s*\\(?\\s*['"][^'"]*${pattern}(\\.js)?['"]`).test(f.text))
    .map(f => f.path)
    .sort();

/** ⚠️ STOPGAP allowlist — must be driven to empty in slice 1.6d. */
const SHIM_IMPORTERS = ['systems/board/BoardState.js'];

describe('⚠️ gridShim is a stopgap (deleted in slice 1.6d)', () => {
    it('is imported only by the allowlisted files', () => {
        expect(importsOf('gridShim')).toEqual(SHIM_IMPORTERS);
    });
});

describe('the mat test helper stays in the tests', () => {
    it('no file outside src/tests imports tests/fixtures/mat.js', () => {
        expect(importsOf('fixtures/mat')).toEqual([]);
    });
});
