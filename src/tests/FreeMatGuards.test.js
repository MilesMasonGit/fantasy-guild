import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Free Playmat — the guards that keep the grid from growing back.
 *
 * 1. **The grid is deleted** (slice 1.6d-2). `gridShim.js`, `boardGeometry.js`
 *    and `adjacency.js` are gone, and the scan at the bottom of this file drives
 *    every name that was grid *geometry* to zero outside `src/tests/` and two
 *    short labelled allow-lists.
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

/**
 * ⭐ **Empty since slice 1.6d-2, and it stays empty.** This was the stopgap
 * allowlist of files still importing the tile view; driving it to zero was the
 * job of 1.6d-2.
 */
const SHIM_IMPORTERS = [];

describe('⭐ the grid shim is gone (slice 1.6d-2)', () => {
    it('nothing imports gridShim, and the file itself is deleted', () => {
        expect(importsOf('gridShim')).toEqual(SHIM_IMPORTERS);
        expect(FILES.some(f => f.path === 'systems/board/gridShim.js')).toBe(false);
    });

    it('the geometry module and the adjacency module are deleted too', () => {
        expect(importsOf('boardGeometry')).toEqual([]);
        expect(importsOf('board/adjacency')).toEqual([]);
        expect(FILES.some(f => f.path === 'config/boardGeometry.js')).toBe(false);
        expect(FILES.some(f => f.path === 'systems/board/adjacency.js')).toBe(false);
    });
});

/**
 * ⭐ **The snapping stopgap is GONE** (slice 1.6d-1). `oldSpotStopgap.js` and
 * every import of it went with free placement: a Token now lands exactly where
 * it was let go, so there is no "nearest old spot" left to snap to. The list is
 * empty and must stay empty.
 */
const OLD_SPOT_IMPORTERS = [];

describe('⭐ the snapping stopgap is gone (slice 1.6d-1)', () => {
    it('nothing imports oldSpotStopgap, and the file itself is deleted', () => {
        expect(importsOf('oldSpotStopgap')).toEqual(OLD_SPOT_IMPORTERS);
        expect(FILES.some(f => f.path === 'ui/components/board/oldSpotStopgap.js')).toBe(false);
    });

    it('nothing snaps a drop to a spot, and no play-area refusal survives', () => {
        const leftovers = FILES
            .filter(f => /\b(oldSpotAt|oldSpotPoint|isFarOutsideArea|PLAY_AREA_NOTE|planCascadeFor2x2)\b/.test(f.text))
            .map(f => f.path);
        expect(leftovers).toEqual([]);
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

// ---------------------------------------------------------------------------
// 4. ⭐ THE GRID IS DELETED — the geometry scan (slice 1.6d-2)
// ---------------------------------------------------------------------------

/**
 * ⭐ **This scan passing is what "the grid is deleted" means.**
 *
 * It looks for grid **geometry** — the names that only make sense if there is a
 * lattice of numbered squares under the playmat — and requires **zero** of them
 * anywhere in `src/` outside `src/tests/` and the two labelled allow-lists
 * below. Putting any one of them back fails this file, which the neutering
 * proof at the end demonstrates name by name.
 *
 * ## What is deliberately NOT scanned
 * Names that merely *say* "tile" but are not grid geometry are out of scope, and
 * are listed in `NOT_GEOMETRY_KEPT` so the decision is recorded rather than
 * forgotten. They are event and module names, and renaming them is a separate
 * job with its own risk.
 *
 * ## Comments are stripped before scanning
 * These names appear in prose all over the engine — this file included — saying
 * what was deleted and when. That history is worth keeping. Only code counts.
 */

/** Strip block and line comments, so only real code is scanned. */
function codeOf(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * ⚠️ **Allow-list 1 — the Guild Hall upgrade board.** A separate 7×7 diagram
 * that genuinely has tiles and is deliberately not part of the playmat. It keeps
 * its own geometry module and its own `UPGRADE_BOARD_*` names.
 */
const UPGRADE_BOARD_FILES = [
    'config/upgradeBoardGeometry.js',
    'config/guildUpgrades.js',
    'ui/components/board/GuildHallBoard.jsx'
];

/**
 * ⚠️ **Allow-list 2 — dormant terrain (FP-10).** `TERRAIN_ENABLED` is false and
 * this stack draws nothing. It is wholly lattice-shaped and is **re-latticed or
 * deleted when terrain is revived**; slice 1.6d-3 owns it. Not re-latticed here.
 */
const DORMANT_TERRAIN_FILES = [
    'systems/board/TerrainLattice.js',
    'systems/board/TerrainProps.js',
    'ui/components/board/TerrainCanvas.jsx'
];

/**
 * ⚠️ **Kept on purpose — names that say "tile" but are not geometry.** Each is
 * an identifier in the live event/module vocabulary, not a coordinate system:
 *
 * * `BOARD_EVENTS.TILE_CHANGED` — published when a **Token** changes.
 * * `BOARD_EVENTS.TILE_EVENT_ALERT` — the red/green mark on a **Token**.
 * * `TileModifiers.js` — the module that aggregates a **Token's** modifiers.
 *
 * A follow-up rename to `TOKEN_CHANGED`, `TOKEN_ALERT` and `TokenModifiers.js`
 * is proposed as its own task. Until then this list is the record of why the
 * scan below ignores them.
 */
const NOT_GEOMETRY_KEPT = ['TILE_CHANGED', 'TILE_EVENT_ALERT', 'TileModifiers.js'];

/** Every grid-geometry name, and how it is spotted in code. */
const GRID_GEOMETRY = {
    // The deleted modules.
    gridShim: /\bgridShim\b/,
    boardGeometry: /\bboardGeometry\b/,
    'board/adjacency': /board\/adjacency\b/,
    // The board's shape.
    BOARD_SIZE: /(?<![A-Z_])BOARD_SIZE\b/,
    BOARD_PX: /(?<![A-Z_])BOARD_PX\b/,
    TILE_COUNT: /(?<![A-Z_])TILE_COUNT\b/,
    GUILD_HALL_TILE: /(?<![A-Z_])GUILD_HALL_TILE\b/,
    OLD_AREA_ORIGIN: /\bOLD_AREA_ORIGIN\b/,
    // Turning an index into a place, and back.
    tileCentre: /\btileCentre\b/,
    footprintCentre: /\bfootprintCentre\b/,
    tileFootprint: /\btileFootprint\b/,
    isFootprintInBounds: /\bisFootprintInBounds\b/,
    isTileIndex: /\bisTileIndex\b/,
    isPlaceable: /\bisPlaceable\b/,
    rowOf: /(?<![A-Za-z])rowOf\b/,
    colOf: /(?<![A-Za-z])colOf\b/,
    quadrantPushVectors: /\bquadrantPushVectors\b/,
    getTilePushVectors: /\bgetTilePushVectors\b/,
    tileAtPoint: /\btileAtPoint\b/,
    positionOf: /\bpositionOf\b/,
    // The BoardState tile API.
    getOccupyingToken: /\bgetOccupyingToken\b/,
    occupiedTiles: /\boccupiedTiles\b/,
    emptyTiles: /\bemptyTiles\b/,
    workerOfTile: /\bworkerOfTile\b/,
    workTileOf: /\bworkTileOf\b/,
    'BoardState.getToken': /\bgetToken\s*\(/,
    'BoardState.setToken': /\bsetToken\s*\(/,
    'BoardState.hasToken': /\bhasToken\s*\(/,
    'BoardState.takeToken': /\btakeToken\s*\(/,
    'BoardState.setVacancy': /\bsetVacancy\s*\(/,
    'BoardState.getVacancy': /\bgetVacancy\s*\(/,
    'BoardState.vacancies': /(?<![A-Za-z])vacancies\s*\(/,
    // The Placement index adapters.
    'Placement.placeToken': /\bplaceToken\s*\(/,
    'Placement.moveToken': /\bmoveToken\s*\(/,
    'Placement.returnTokenToTray': /\breturnTokenToTray\s*\(/,
    'Placement.returnTokenToVault': /\breturnTokenToVault\s*\(/,
    'Placement.placeHero': /\bplaceHero\s*\(/,
    'Placement.moveFlag': /\bmoveFlag\s*\(/
};

const GEOMETRY_EXEMPT = new Set([...UPGRADE_BOARD_FILES, ...DORMANT_TERRAIN_FILES]);

/** Every `path: name` hit in `files`, ignoring the allow-listed files. */
function gridGeometryHits(files) {
    const out = [];
    for (const f of files) {
        if (GEOMETRY_EXEMPT.has(f.path)) continue;
        const code = codeOf(f.text);
        for (const [name, re] of Object.entries(GRID_GEOMETRY)) {
            if (re.test(code)) out.push(`${f.path}: ${name}`);
        }
    }
    return out.sort();
}

describe('⭐ THE GRID IS DELETED (slice 1.6d-2)', () => {
    it('no grid geometry survives anywhere in src, outside tests and the two allow-lists', () => {
        expect(FILES.length).toBeGreaterThan(100);
        expect(gridGeometryHits(FILES)).toEqual([]);
    });

    it('the allow-listed files are real files, so neither list is a dead letter', () => {
        for (const path of [...UPGRADE_BOARD_FILES, ...DORMANT_TERRAIN_FILES]) {
            expect(FILES.some(f => f.path === path), `${path} is allow-listed but missing`).toBe(true);
        }
    });

    it('the names kept on purpose are still the live vocabulary, not stragglers', () => {
        // If one of these disappears, the rename happened and this list should
        // shrink with it — the allow-list must never outlive what it excuses.
        const all = FILES.map(f => f.text).join('\n');
        for (const name of NOT_GEOMETRY_KEPT) {
            expect(all.includes(name), `${name} is allow-listed but no longer exists`).toBe(true);
        }
    });
});

/**
 * ⚠️ **The neutering proof.** A guard that cannot fail is worse than no guard,
 * so every entry above is shown catching a realistic use of the thing it
 * guards — and the probe list must cover the scan exactly, so neither can drift
 * ahead of the other.
 */
const PROBE_USES = {
    gridShim: "import * as Shim from './gridShim.js';",
    boardGeometry: "import { X } from '../../config/boardGeometry.js';",
    'board/adjacency': "import * as adj from '../board/adjacency.js';",
    BOARD_SIZE: 'const n = BOARD_SIZE * BOARD_SIZE;',
    BOARD_PX: 'const px = BOARD_PX / 2;',
    TILE_COUNT: 'for (let i = 0; i < TILE_COUNT; i++) {}',
    GUILD_HALL_TILE: 'if (index === GUILD_HALL_TILE) return true;',
    OLD_AREA_ORIGIN: 'const x = OLD_AREA_ORIGIN.x + 10;',
    tileCentre: 'const at = tileCentre(21);',
    footprintCentre: 'const at = footprintCentre(21, 2);',
    tileFootprint: 'const cells = tileFootprint(21, 2);',
    isFootprintInBounds: 'if (!isFootprintInBounds(i, 2)) return null;',
    isTileIndex: 'if (!isTileIndex(i)) return null;',
    isPlaceable: 'if (!isPlaceable(i)) return null;',
    rowOf: 'const r = rowOf(index);',
    colOf: 'const c = colOf(index);',
    quadrantPushVectors: 'const v = quadrantPushVectors(anchor);',
    getTilePushVectors: 'const v = getTilePushVectors(index);',
    tileAtPoint: 'const tile = tileAtPoint(point);',
    positionOf: 'const at = positionOf(tile);',
    getOccupyingToken: 'const occ = BoardState.getOccupyingToken(i);',
    occupiedTiles: 'for (const [i, t] of BoardState.occupiedTiles()) {}',
    emptyTiles: 'const free = BoardState.emptyTiles();',
    workerOfTile: 'const hero = BoardState.workerOfTile(i);',
    workTileOf: 'const tile = BoardState.workTileOf(heroId);',
    'BoardState.getToken': 'const t = BoardState.getToken(14);',
    'BoardState.setToken': 'BoardState.setToken(14, instance);',
    'BoardState.hasToken': 'if (BoardState.hasToken(14)) return;',
    'BoardState.takeToken': 'const t = BoardState.takeToken(14);',
    'BoardState.setVacancy': 'BoardState.setVacancy(14, typeId);',
    'BoardState.getVacancy': 'const v = BoardState.getVacancy(14);',
    'BoardState.vacancies': 'for (const [i, v] of BoardState.vacancies()) {}',
    'Placement.placeToken': 'Placement.placeToken(14, instance);',
    'Placement.moveToken': 'Placement.moveToken(14, 15);',
    'Placement.returnTokenToTray': 'Placement.returnTokenToTray(14);',
    'Placement.returnTokenToVault': 'Placement.returnTokenToVault(14);',
    'Placement.placeHero': "Placement.placeHero('hero_1', 14);",
    'Placement.moveFlag': "Placement.moveFlag('hero_1', 14);"
};

describe('⚠️ the grid scan actually fires (neutering proof)', () => {
    it('every guarded name has a probe, and every probe a guarded name', () => {
        expect(Object.keys(PROBE_USES).sort()).toEqual(Object.keys(GRID_GEOMETRY).sort());
    });

    it('putting any single one of them back fails the scan', () => {
        for (const [name, snippet] of Object.entries(PROBE_USES)) {
            const probe = [{ path: 'systems/probe.js', text: snippet }];
            expect(gridGeometryHits(probe), `${name} was not caught`)
                .toContain(`systems/probe.js: ${name}`);
        }
    });

    it('the survivors are not flagged — the point/id API and the upgrade board pass', () => {
        const kept = [{
            path: 'systems/probe.js',
            text: [
                'Placement.placeTokenAt(instance, point);',
                'Placement.moveTokenTo(id, point);',
                'Placement.returnTokenToTrayById(id);',
                'Placement.returnTokenToVaultById(id);',
                'Placement.plantFlagAt(heroId, point);',
                'BoardState.addToken(instance, x, y);',
                'BoardState.getTokenById(id);',
                'BoardState.setTokenPoint(id, x, y);',
                'BoardState.tokensAtPoint(x, y);',
                'BoardState.setVacancyAt(point, typeId);',
                'BoardState.vacancyAt(spotId);',
                'BoardState.spotVacancies();',
                'BoardState.workerOf(id);',
                'BoardState.workTokenOf(heroId);',
                'BoardState.displayPointOf(heroId);',
                'const n = UPGRADE_BOARD_SIZE * UPGRADE_BOARD_TILE_COUNT;',
                'const r = upgradeRowOf(i) + upgradeColOf(i);',
                'EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId });'
            ].join('\n')
        }];
        expect(gridGeometryHits(kept)).toEqual([]);
    });

    it('a comment naming the deleted grid is history, not a leftover', () => {
        const prose = [{
            path: 'systems/probe.js',
            text: '// workTileOf and tileCentre were deleted in slice 1.6d-2.\n const x = 1;'
        }];
        expect(gridGeometryHits(prose)).toEqual([]);
    });
});
