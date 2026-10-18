import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Placement from '../systems/board/Placement.js';
import * as EffectActions from '../systems/board/EffectActions.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatResize from '../systems/board/MatResize.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { mulberry32, seedFromText } from '../systems/atlas/seededRandom.js';
import { TERRAIN, terrainGrid, encodeTerrain } from '../systems/atlas/TerrainMap.js';
import { createRegionRecord } from '../state/StateSchema.js';
import { budget } from '../systems/atlas/Budget.js';
import { layout } from '../systems/atlas/Layout.js';
import { layoutOptions } from '../systems/atlas/layoutInputs.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A meadow places exactly as before the ground had a say** (terrain roadmap decision 15). A
 * long seeded script of every placement path (drops, nudges, fly-backs, moves, arrivals, pushes,
 * spawns, a shrinking mat) runs on a board with no water and Tokens with no "Stands on", and its
 * every answer is fingerprinted. The fingerprint was recorded on the code from before the ground
 * rule existed: any change to where a meadow puts a Token fails here, whatever the cause.
 *
 * It runs on three grounds that must all be the meadow: no Region at all (a bench board), the
 * Starter Camp (`terrain: null`), and a stored map with grass and rock but no water.
 */

const NO_NEIGHBOUR_ROCKS = {
    id: 'stm_gm_rock', keyword: KEYWORD.CANNOT,
    payload: { kind: 'adjacency_limit', max: 0 },
    to: { mode: 'tag', value: 'GmRock' }, when: null, upkeep: null
};

registerTokenTypes({
    gm_small: { id: 'gm_small', name: 'GM Small', tokenType: 'resource', size: 1, uses: 100, requiresHero: false, config: { cycleTimeMs: 5000, inputs: [], outputs: [] } },
    gm_large: { id: 'gm_large', name: 'GM Large', tokenType: 'resource', size: 2, uses: 100, requiresHero: false, config: { cycleTimeMs: 5000, inputs: [], outputs: [] } },
    gm_tiny: { id: 'gm_tiny', name: 'GM Tiny', tokenType: 'resource', artSize: 'small', uses: 100, requiresHero: false, config: { cycleTimeMs: 5000, inputs: [], outputs: [] } },
    gm_rock: {
        id: 'gm_rock', name: 'GM Rock', tokenType: 'resource', size: 1, uses: 100, requiresHero: false, tags: ['GmRock'],
        statements: [NO_NEIGHBOUR_ROCKS], config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
    }
});

const TYPES = ['gm_small', 'gm_small', 'gm_small', 'gm_large', 'gm_tiny', 'gm_rock'];

/** FNV-1a over a string: a short, exact fingerprint. */
function fnv(text) {
    let hash = 0x811C9DC5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Coordinates to a fixed number of places, so the fingerprint does not depend on float printing. */
const n = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : v);

/**
 * The script: every placement path, driven by one seeded stream. Ids are drawn from `Math.random`,
 * so the record names Tokens by arrival order, never by id.
 */
function runScript() {
    const random = mulberry32(seedFromText('meadow placements'));
    const order = new Map();
    const nameOf = (id) => {
        if (!order.has(id)) order.set(id, order.size);
        return order.get(id);
    };
    const pick = (list) => list[Math.floor(random() * list.length)];
    const point = () => ({ x: Math.round(random() * matW()), y: Math.round(random() * matH()) });
    const log = [];
    const fresh = (typeId) => BoardState.createTokenInstance(typeId, 100);

    // Drops, many into the crowd round the middle, so nudges, restocks and fly-backs all happen.
    for (let i = 0; i < 140; i++) {
        const typeId = pick(TYPES);
        const instance = fresh(typeId);
        const aim = i % 3 === 0 ? point() : { x: 880 + Math.round((random() - 0.5) * 500), y: 563 + Math.round((random() - 0.5) * 350) };
        const res = Placement.placeTokenAt(instance, aim);
        log.push(['drop', typeId, aim.x, aim.y, res.success, n(res.x), n(res.y), !!res.nudged, res.reason || '', !!res.restocked]);
        if (res.success && BoardState.getTokenById(instance.id)) nameOf(instance.id);
    }

    // Moves of Tokens already down.
    for (let i = 0; i < 30; i++) {
        const all = BoardState.tokens();
        const moving = all[Math.floor(random() * all.length)];
        const aim = point();
        const res = Placement.moveTokenTo(moving.id, aim);
        log.push(['move', nameOf(moving.id), aim.x, aim.y, res.success, n(res.x), n(res.y), !!res.nudged, res.reason || '']);
    }

    // Arrivals aimed at a point, as the Shop and a recipe's Token land.
    for (let i = 0; i < 20; i++) {
        const typeId = pick(TYPES);
        const instance = fresh(typeId);
        const res = Placement.placeArrivalNear(instance, point());
        log.push(['arrive', typeId, res.success, n(res.x), n(res.y), !!res.nudged, res.reason || '']);
        if (res.success) nameOf(instance.id);
    }

    // Pushes: an arrival that stands where it aims and shoves its neighbours.
    for (let i = 0; i < 25; i++) {
        const typeId = pick(TYPES);
        const all = BoardState.tokens();
        const near = all[Math.floor(random() * all.length)];
        const aim = { x: near.x + Math.round((random() - 0.5) * 60), y: near.y + Math.round((random() - 0.5) * 60) };
        const where = MatPlacement.forceSpot(typeId, aim);
        if (!where) {
            log.push(['push', typeId, aim.x, aim.y, null]);
            continue;
        }
        log.push(['push', typeId, aim.x, aim.y, n(where.x), n(where.y),
            where.pushed.map(p => [nameOf(p.id), n(p.x), n(p.y)])]);
        BoardState.applyPushes(where.pushed);
        const instance = fresh(typeId);
        BoardState.addToken(instance, where.x, where.y);
        nameOf(instance.id);
    }

    // Spawns, nearest free and random free, from Tokens on the mat.
    for (let i = 0; i < 20; i++) {
        const all = BoardState.tokens();
        const bearer = all[Math.floor(random() * all.length)];
        const placement = i % 2 === 0 ? PLACEMENT.NEAREST_FREE : PLACEMENT.RANDOM_FREE;
        const landed = EffectActions.spawn({ payload: { typeId: 'gm_small', placement } }, { self: bearer.id }, random);
        log.push(['spawn', placement, nameOf(bearer.id), landed ? [n(landed.x), n(landed.y)] : null]);
        if (landed) nameOf(landed.instanceId);
    }

    // The whole-mat search and the bare legality question.
    for (let i = 0; i < 30; i++) {
        const typeId = pick(TYPES);
        const aim = point();
        const spot = MatPlacement.findSpotAnywhere(typeId, aim);
        log.push(['anywhere', typeId, aim.x, aim.y, spot ? [n(spot.x), n(spot.y), n(spot.nudge)] : null,
            MatPlacement.isLegal(typeId, aim)]);
    }

    // The mat shrinks by a step: whatever no longer fits is pulled in.
    setMatTuning('matSteps', 10);
    const pulled = MatResize.fitToMat();
    log.push(['shrink', pulled.tokensPulled, pulled.crowded]);

    const board = BoardState.tokens().map(t => [nameOf(t.id), t.typeId, n(t.x), n(t.y)]);
    return { log, board };
}

function freshGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.init();
    clearMat();
}

/** The Starter Camp as `Atlas.ensureState` writes it: a Region with no stored map. */
function starterCamp() {
    const region = createRegionRecord('region_1');
    region.kind = 'starter';
    GameState.state.atlas = { activeRegionId: region.id, nextRegionNumber: 2, regions: { [region.id]: region }, seed: null };
}

/** A Region whose stored map has grass and rock (a Forest beside a Mountain), and no water. */
function dryRegion() {
    const grid = terrainGrid({ w: matW(), h: matH() });
    const terrains = Array.from({ length: grid.cols * grid.rows }, (_, i) => ((i % grid.cols) < grid.cols / 2 ? TERRAIN.GRASS : TERRAIN.ROCK));
    const region = createRegionRecord('region_2');
    region.kind = 'settled';
    region.terrain = encodeTerrain(grid, terrains);
    GameState.state.atlas = { activeRegionId: region.id, nextRegionNumber: 3, regions: { [region.id]: region }, seed: null };
}

/**
 * Recorded on `main` at fe151c8e, before the ground rule existed, with this script unchanged.
 * Only a deliberate change to how a meadow places Tokens may change it, and then the engine bench
 * reports WORK CHANGED too.
 */
const MEADOW_FINGERPRINT = 'e03cfd41';

describe('⭐ a meadow Region places exactly as before (decision 15)', () => {
    beforeEach(freshGame);
    afterEach(() => resetMatTuning());

    const grounds = {
        'no Region at all (a bench board)': () => {},
        'the Starter Camp (no stored map)': starterCamp,
        'a stored map with no water': dryRegion
    };

    for (const [label, setUp] of Object.entries(grounds)) {
        it(`same spots for the same calls: ${label}`, () => {
            setUp();
            const { log, board } = runScript();
            // The script exercised every outcome it is meant to.
            expect(log.some(e => e[0] === 'drop' && e[7] === true)).toBe(true);
            expect(log.some(e => e[0] === 'drop' && e[4] === false)).toBe(true);
            expect(log.some(e => e[0] === 'push' && Array.isArray(e[6]) && e[6].length > 0)).toBe(true);
            expect(log.some(e => e[0] === 'spawn' && e[3] !== null)).toBe(true);
            expect(board.length).toBeGreaterThan(100);
            const print = fnv(JSON.stringify({ log, board }));
            if (MEADOW_FINGERPRINT === 'RECORD_ME') console.log(`MEADOW_FINGERPRINT ${label}: ${print}`);
            expect(print).toBe(MEADOW_FINGERPRINT);
        });
    }
});

/**
 * ⭐ **A layout of Tokens with no "Stands on" is exactly as before** (roadmap risk 4: stored maps
 * are permanent, and a Region generated tomorrow from today's maps must come out as it would have
 * yesterday). Fixture Tokens, the game's own layout inputs, water and no water, every role.
 * Recorded on `main` at fe151c8e, before the layout read "Stands on"; recorded again when the water
 * became shapes and every biome brought its own (and again when the rivers calmed and the minor
 * biomes gained their small waters): new Regions get water, stored ones keep theirs.
 */
const LAYOUT_FINGERPRINT = 'aa16d6e5';

registerTokenTypes({
    gm_oak: { id: 'gm_oak', name: 'GM Oak', tokenType: 'resource', size: 1, uses: 5, requiresHero: true, config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 3000, inputs: [], outputs: [] } },
    gm_bush: { id: 'gm_bush', name: 'GM Bush', tokenType: 'resource', artSize: 'small', uses: 5, requiresHero: true, config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 3000, inputs: [], outputs: [] } },
    gm_ore: { id: 'gm_ore', name: 'GM Ore', tokenType: 'resource', size: 2, uses: 5, requiresHero: true, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, inputs: [], outputs: [] } },
    gm_fish: { id: 'gm_fish', name: 'GM Fish', tokenType: 'resource', size: 1, uses: 5, requiresHero: true, config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 3000, inputs: [], outputs: [] } },
    gm_camp: { id: 'gm_camp', name: 'GM Camp', tokenType: 'spawner', size: 1, uses: null, requiresHero: false, config: null },
    gm_ruins: { id: 'gm_ruins', name: 'GM Ruins', tokenType: 'resource', size: 1, uses: 1, requiresHero: true, config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 3000, inputs: [], outputs: [] } }
});

const FOREST_MAP = { id: 'gm_forest', kind: 'base', biome: 'forest', points: 40, nodes: [{ typeId: 'gm_oak', weight: 5 }, { typeId: 'gm_bush', weight: 2 }] };
const MOUNTAIN_MAP = { id: 'gm_mountain', kind: 'base', biome: 'mountain', points: 36, nodes: [{ typeId: 'gm_ore', weight: 2 }, { typeId: 'gm_bush', weight: 1 }] };
const COAST_MAP = { id: 'gm_coast', kind: 'base', biome: 'coast', points: 24, nodes: [{ typeId: 'gm_fish', weight: 3 }, { typeId: 'gm_oak', weight: 1 }] };
const CAMPS = { id: 'gm_camps', kind: 'modifier', effects: [{ kind: 'threat', typeId: 'gm_camp', count: 2 }, { kind: 'treasure', typeId: 'gm_ruins', count: 2 }] };

describe('⭐ a layout of Tokens with no "Stands on" is exactly as before', () => {
    beforeEach(freshGame);

    it('same nodes, same ground, for the same maps and seeds, water or none', () => {
        const recipes = [[FOREST_MAP], [FOREST_MAP, MOUNTAIN_MAP, CAMPS], [COAST_MAP, CAMPS], [COAST_MAP, FOREST_MAP, MOUNTAIN_MAP, CAMPS]];
        const out = [];
        for (const slots of recipes) {
            const summary = budget(slots, { cap: 128 });
            for (let k = 0; k < 4; k++) {
                const result = layout(summary, layoutOptions(summary, seedFromText(`layout ${k}`)));
                out.push([result.nodes.map(m => [m.typeId, m.role, m.biome, m.x, m.y]), result.unplaced, result.terrain.cells]);
            }
        }
        expect(out.some(([, , cells]) => cells.includes('3'))).toBe(true);
        const print = fnv(JSON.stringify(out));
        if (LAYOUT_FINGERPRINT === 'RECORD_ME') console.log(`LAYOUT_FINGERPRINT: ${print}`);
        expect(print).toBe(LAYOUT_FINGERPRINT);
    });
});
