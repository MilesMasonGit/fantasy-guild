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

/**
 * ⚠️ STOPGAP allowlist — `oldSpotStopgap.js` and all three importers are
 * deleted in slice 1.6d. `MatRings` is on the list because the Near ring has to
 * show where a dragged Token will really land, and until free placement that is
 * the nearest old spot rather than the cursor (slice 1.6c-2).
 */
const OLD_SPOT_IMPORTERS = [
    'ui/components/board/MatRings.jsx',
    'ui/components/board/TrayMiniBoard.jsx',
    'ui/components/board/dropOnMat.js'
];

describe('⚠️ oldSpotStopgap is a stopgap (deleted in slice 1.6d) — slice 1.6c', () => {
    it('is imported only by the snapping stopgap’s three callers', () => {
        expect(importsOf('oldSpotStopgap')).toEqual(OLD_SPOT_IMPORTERS);
    });

    it('nothing imports the deleted placeTokenFromDrag, and the tile readers it leaned on are gone', () => {
        expect(importsOf('placeTokenFromDrag')).toEqual([]);
        const leftovers = FILES.filter(f => /\b(tileOfToken|displayTileOf|closest2x2Anchor)\b/.test(f.text)).map(f => f.path);
        expect(leftovers).toEqual([]);
    });
});

/**
 * ⭐ The grid renderer is **gone** (slice 1.6c-2): Tokens, heroes and flags are
 * drawn at their mat points by instance id. These are the leftovers that would
 * mean some part of the UI still thinks in tiles — and a leftover import is
 * exactly the kind of thing that crashes the running game while every test
 * still passes, which has happened twice on this project.
 */
describe('⭐ nothing draws tiles any more (slice 1.6c-2)', () => {
    it('the grid renderer and its payload→tile adapter are not imported anywhere', () => {
        expect(importsOf('BoardTile')).toEqual([]);
        expect(importsOf('payloadTile')).toEqual([]);
        expect(importsOf('TileProgressBar')).toEqual([]);
        expect(importsOf('TileEventAlert')).toEqual([]);
    });

    it('the grid-era flag fan-out and the tile drop preview are gone from src', () => {
        const leftovers = FILES
            .filter(f => /\b(fannedOrigin|MAX_FLAGS_SHOWN|FLAG_FAN_PX|MORE_CHIP_OFFSET|spotForDrop|payloadIsForTile)\b/.test(f.text))
            .map(f => f.path);
        expect(leftovers).toEqual([]);
    });
});

describe('the mat test helper stays in the tests', () => {
    it('no file outside src/tests imports tests/fixtures/mat.js', () => {
        expect(importsOf('fixtures/mat')).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 3. Board events name Tokens by instance id, never by tile (slice 1.6b part 2)
// ---------------------------------------------------------------------------

/**
 * ⚠️ STOPGAP allowlist — engine files still allowed to publish a `tile:` field,
 * each a labelled stopgap naming the slice that removes it. **Empty since slice
 * 1.6b part 2**: every published board event names its Token by `instanceId`,
 * or a mat point (`x`, `y`) when there is no Token. Keep it empty.
 */
const TILE_PAYLOAD_ALLOWLIST = [];

/** Every `publish(...)` call in `text`, as `{ line, call }` (parentheses balanced). */
function publishCalls(text) {
    const out = [];
    const re = /publish\s*\(/g;
    let m;
    while ((m = re.exec(text))) {
        let i = m.index + m[0].length;
        let depth = 1;
        while (i < text.length && depth > 0) {
            if (text[i] === '(') depth++;
            else if (text[i] === ')') depth--;
            i++;
        }
        out.push({ line: text.slice(0, m.index).split('\n').length, call: text.slice(m.index, i) });
    }
    return out;
}

/** Files (of `files`) with a `publish(...)` whose payload has a `tile` key — `tile: …` or shorthand `tile`. */
function tilePayloadPublishers(files) {
    const hits = new Set();
    for (const f of files) {
        for (const { call } of publishCalls(f.text)) {
            if (/[{,]\s*tile\s*[:,}]/.test(call)) hits.add(f.path);
        }
    }
    return [...hits].sort();
}

describe('⚠️ board events carry instance ids, not tiles (slice 1.6b part 2)', () => {
    it('no publish(...) in src/systems sends a tile field, outside the labelled allowlist', () => {
        const systems = FILES.filter(f => f.path.startsWith('systems/'));
        expect(systems.length).toBeGreaterThan(50);
        expect(tilePayloadPublishers(systems)).toEqual(TILE_PAYLOAD_ALLOWLIST);
    });

    it('the scan sees both spellings, and not a field that merely ends in "tile"', () => {
        const probe = (text) => tilePayloadPublishers([{ path: 'systems/probe.js', text }]);
        expect(probe('EventBus.publish(E, { tile: 3, typeId })')).toEqual(['systems/probe.js']);
        expect(probe('EventBus.publish(E, {\n    tile,\n    percent\n})')).toEqual(['systems/probe.js']);
        expect(probe('EventBus.publish(E, { fromTile: 1, toTile: 2 })')).toEqual([]);
        expect(probe('EventBus.publish(E, { instanceId: id, x, y })')).toEqual([]);
    });
});
