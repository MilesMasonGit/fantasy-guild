import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The CMS→game import boundary, guarded.
 *
 * ## Why this exists (CR2-010)
 *
 * The CMS is a separate Vite app with its own `package.json`, but it reaches
 * across the project boundary and imports the game's source directly by
 * relative path (`../../../src/config/registries/...`). That coupling is
 * deliberate and is not what this file objects to: the two apps share a content
 * vocabulary, and `cms/src/utils/constants.js` explains at length why that
 * vocabulary flows game → CMS in one direction rather than being copied.
 *
 * The problem is that the coupling is **invisible from the game's side**. The
 * game builds without the CMS, `npm run build` never compiles `cms/`, and the
 * reachability tool does not know the CMS exists. So a game-side module or
 * export that only the CMS uses looks like dead code to every tool in the
 * project. This has already bitten twice:
 *
 * - the skill/class rework removed `SUB_SKILL_TO_PARENT` from a game registry
 *   and left the CMS unable to build, with nothing to catch it;
 * - a cleanup pass came close to deleting `modifierPalette.js` and
 *   `tokenConstants.js` outright.
 *
 * The CMS has no test suite of its own (CR2-006, accepted deliberately), so
 * the only thing standing between a tidy-up and a broken authoring tool is a
 * check that lives here, where the deletion would be made.
 *
 * ## What this asserts
 *
 * It scans `cms/src` for every static import or re-export whose path escapes
 * into the game's `src/`, and then, for each one:
 *
 * 1. the target file still exists;
 * 2. the module still exports every binding the CMS names.
 *
 * The list is **derived by scanning, never hand-maintained**. A written-down
 * list is what CR2-010 itself shipped with, and it had gone stale in both
 * directions by the time anyone acted on it — it named seven modules when the
 * real number was twelve. A scanner cannot rot the same way: add a
 * cross-boundary import to the CMS and it is covered from that moment.
 *
 * ## What it does not claim
 *
 * Nothing about behaviour. An export can still change meaning underneath the
 * CMS and this file will stay green — it only asserts the shape of the seam,
 * not what flows through it. `CMSSmoke.test.js` is the shallow behavioural
 * companion; it renders the CMS's screens and would catch a *rendered* break,
 * but only along the paths a render happens to walk. This file covers every
 * named binding whether or not any test renders the component that uses it.
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
 *
 * Not cosmetic: `cms/src/utils/constants.js` discusses these very paths in its
 * prose, and `restrictionPalette.js` names `modifierPalette.js` in a doc block.
 * Matching those would invent imports that do not exist. Strings are left
 * alone — a `//` inside one would only ever appear in a URL here.
 */
function stripComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/**
 * Pull the bound names out of an import/export clause.
 *
 * `{ a, b as c }` binds `a` and `b` — the local alias is the CMS's business,
 * the exported name is the game's promise. `* as ns` and a default import bind
 * nothing checkable by name, so they resolve to `default` or to nothing and
 * the file-exists assertion carries them.
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
    const statement = /(?:^|[\n;])\s*(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;

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
