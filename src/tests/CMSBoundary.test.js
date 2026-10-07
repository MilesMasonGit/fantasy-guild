import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The CMS→game import boundary, guarded.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CMS_SRC = path.join(REPO_ROOT, 'cms', 'src');
const GAME_SRC = path.join(REPO_ROOT, 'src');

/** Every `.js`/`.jsx` file under `cms/src`, recursively. */
function cmsSourceFiles(dir = CMS_SRC, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            cmsSourceFiles(full, found);
        } else if (/\.jsx?$/.test(entry.name)) {
            found.push(full);
        }
    }
    return found;
}

/**
 * Remove comments before matching.
 */
function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/**
 * Pull the bound names out of an import/export clause.
 */
function bindingsOf(clause) {
    const names = [];
    const braced = clause.match(/\{([\s\S]*?)\}/);
    if (braced) {
        for (const part of braced[1].split(',')) {
            const name = part.trim().split(/\s+as\s+/)[0].trim();
            if (name) names.push(name);
        }
    }
    const outsideBraces = clause.replace(/\{[\s\S]*?\}/g, '').replace(/,/g, ' ').trim();
    if (outsideBraces && !/^\*/.test(outsideBraces) && !/^type$/.test(outsideBraces)) {
        names.push('default');
    }
    return names;
}

/** Every cross-boundary edge: one entry per (CMS file, game module) import. */
function crossBoundaryImports() {
    const edges = [];
    // ⚠️ The clause excludes `;` and `=` deliberately. It used to be
    // `[\s\S]*?`, which is lazy but can still run across statement boundaries:
    // an `export const FOO = …` line with no `from` of its own would let the
    // clause reach forward to the NEXT `from` in the file, and `bindingsOf`
    const statement = /(?:^|[\n;])\s*(?:import|export)\s+([^;=]*?)\s+from\s+['"]([^'"]+)['"]/g;

    for (const file of cmsSourceFiles()) {
        const source = stripComments(fs.readFileSync(file, 'utf8'));
        let match;
        while ((match = statement.exec(source)) !== null) {
            const [, clause, specifier] = match;
            if (!specifier.startsWith('.')) continue;
            const resolved = path.resolve(path.dirname(file), specifier);
            // Only edges that land inside the GAME's src/ — a CMS-internal
            // relative import is not a boundary crossing.
            const relativeToGame = path.relative(GAME_SRC, resolved);
            if (relativeToGame.startsWith('..') || path.isAbsolute(relativeToGame)) continue;
            edges.push({
                from: path.relative(REPO_ROOT, file).split('\\').join('/'),
                module: path.relative(REPO_ROOT, resolved).split('\\').join('/'),
                absolute: resolved,
                names: bindingsOf(clause)
            });
        }
    }
    return edges;
}

const EDGES = crossBoundaryImports();
const MODULES = [...new Set(EDGES.map((e) => e.module))].sort();

describe('The CMS→game import boundary (CR2-010)', () => {
    it('finds the cross-boundary imports at all', () => {
        // A scanner that silently matches nothing is worse than no guard: every
        // assertion below would vacuously pass. This is the scanner's own
        // smoke test. The number is a floor, not a fixture — adding a
        // cross-boundary import should not make anyone edit this line.
        expect(EDGES.length).toBeGreaterThanOrEqual(10);
        expect(MODULES.length).toBeGreaterThanOrEqual(10);
    });

    it.each(MODULES)('%s still exists — the CMS imports it', (module) => {
        const edge = EDGES.find((e) => e.module === module);
        expect(
            fs.existsSync(edge.absolute),
            `${module} was deleted, but the CMS still imports it (e.g. from ${edge.from}). ` +
                'Nothing in the running game may reference it; that does not make it dead. ' +
                'Restore it, or remove the CMS import first.'
        ).toBe(true);
    });

    it.each(MODULES)('%s still exports everything the CMS names', async (module) => {
        const namesWanted = new Map();
        for (const edge of EDGES) {
            if (edge.module !== module) continue;
            for (const name of edge.names) {
                if (!namesWanted.has(name)) namesWanted.set(name, edge.from);
            }
        }

        const loaded = await import(/* @vite-ignore */ `../../${module}`);

        for (const [name, importer] of namesWanted) {
            expect(
                Object.prototype.hasOwnProperty.call(loaded, name),
                `${module} no longer exports "${name}", but the CMS imports it from ` +
                    `${importer}. The CMS has no tests of its own and does not build with ` +
                    'the game, so this break would only surface in front of the author.'
            ).toBe(true);
        }
    });
});
