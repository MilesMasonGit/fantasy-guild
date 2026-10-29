import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, matTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/combat/DefeatPenalties.js', () => ({
    applyDefeatPenalties: vi.fn(() => [])
}));

/**
 * ⭐ Free Playmat slice 1.5b-i — **a hero works anything they can in range, by
 * their own rules** (…).
 *
 * ⚠️ Everything here runs at the **shipped reaches**: flag radius 240 u, Near
 * 164 u. A flag at tile 14 reaches the Token under it (0 u) and all eight
 * neighbours: the sides 8, 13, 15, 20 (160 u) and the diagonals 7, 9, 19, 21
 * (226 u), never a spot two steps away (320 u).
 */

registerTokenTypes({
    /** A forestry Token that needs coal — stuck for a fixable reason. */
    fr_hungry: {
        id: 'fr_hungry', name: 'Hungry Mill', uses: 100, requiresHero: true,
        config: {
            skill: 'forestry', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [{ itemId: 'item_coal', quantity: 2 }],
            outputs: [{ itemId: 'fixture_glowcap', quantity: 1, chance: 100 }]
        }
    }
});

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles.
 * This is a lattice of mat points 160 u apart — the step the old board had — so
 * a side neighbour is 160 u, a diagonal 226 u and two steps 320 u, which is
 * exactly what the shipped 240 u reach above turns on. The numbers are shorthand for spots.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** Which spot the Token a hero works stands on, or null. */
function workTileOf(heroId) {
    const instance = BoardState.getTokenById(BoardState.workTokenOf(heroId));
    if (!instance) return null;
    const col = Math.round((instance.x - 400) / 160);
    const row = Math.round((instance.y - 200) / 160);
    return row * 6 + col;
}

const FOREST = 'fixture_producer';        // forestry
const MINE = 'fixture_producer_alt';      // mining

function hero(id, skills = { forestry: 50, mining: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeTokenAt(instance, C(tile));
    return instance;
}

const plant = (heroId, tile) => Flags.plant(heroId, C(tile));
const reasons = (instance) => Flags.skipsOf(instance.id).map(s => s.reason);

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [hero('h1'), hero('h2'), hero('h3')];
    GameState.state.inventory.maxSlots = 50;
});

// ---------------------------------------------------------------------------

describe('the shipped reach (FP-75)', () => {
    it('the flag reaches 240 u and Near 164 u: a hero works the diagonal rock, not the tree two steps away', () => {
        expect(matTuning('flagRadius')).toBe(240);
        expect(matTuning('nearRadius')).toBe(164);

        put(21, MINE);                                // diagonal, 226 u
        const tree = put(16, FOREST);                 // two steps, 320 u
        FlagRules.heroRecord('h1').flagRules = { mining: { allowed: true, priority: 1 } };

        plant('h1', 14);

        expect(workTileOf('h1')).toBe(21);
        expect(reasons(tree)).toEqual([]);            // out of reach: not even looked at
    });
});

describe('⭐ works anything they hold, priority first, then nearest (FP-71, FP-72, FP-79)', () => {
    it('works a nearer Token of another held skill', () => {
        put(15, FOREST);                              // forestry, 160 u
        put(14, MINE);                                // mining, under the flag
        plant('h1', 14);
        expect(workTileOf('h1')).toBe(14);
    });
});
